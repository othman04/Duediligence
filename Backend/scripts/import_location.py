# -*- coding: utf-8 -*-
"""
Import des données LOCATION dans le schéma unifié du site
(collection "properties", champ operation='Location').

Convention suivie pour le volet Vente : UNE seule collection `properties`
avec un champ `operation`. Les listings mensuels / nuitées sont distingués
par le champ `periode_norm` ("mois" | "jour").
"""
import re
import sys
import json
import math
from datetime import datetime

import numpy as np
import pandas as pd

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = r"d:\due_dilligence-price_prediction-"
# Sources Excel (OPTIONNEL — les annonces sont déjà dans MongoDB).
# Si ré-import nécessaire, remettre les xlsx dans Backend/data/source/.
DATA_DIR = ROOT + r"\Backend\data\source"
XL_FUSION = DATA_DIR + r"\fusion_locations_complet.xlsx"
XL_VACANCES = DATA_DIR + r"\location_de_vacances_marrakech_combine.xlsx"
GEOJSON_COMMUNES = ROOT + r"\Backend\data\communes.geojson"
ENV_FILE = ROOT + r"\Backend\.env"


def load_mongo_uri():
    for line in open(ENV_FILE, encoding="utf-8"):
        line = line.strip()
        if line.startswith("MONGO_URL="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("MONGO_URL introuvable dans Backend/.env")


DEVISE_TO_MAD = {
    "DH": 1.0, "MAD": 1.0, "DHS": 1.0, "DIRHAM": 1.0, "DIRHAMS": 1.0,
    "EUR": 10.75, "EURO": 10.75, "EUROS": 10.75, "\u20ac": 10.75,
    "USD": 9.9, "$": 9.9, "DOLLAR": 9.9, "DOLLARS": 9.9,
}


def parse_devise_token(s):
    if pd.isna(s):
        return "MAD"
    s = str(s).upper()
    for token in ["EUR", "USD", "MAD", "DH", "DHS"]:
        if token in s:
            return "MAD" if token in ("DH", "DHS") else token
    return "MAD"


def to_mad_from_series(prix, devise_series):
    taux = devise_series.apply(parse_devise_token).map(DEVISE_TO_MAD).fillna(1.0)
    return pd.to_numeric(prix, errors="coerce") * taux


def excel_serial_to_date(val):
    try:
        num = float(val)
        if 20000 < num < 90000:
            return datetime(1899, 12, 30) + pd.Timedelta(days=num)
    except (TypeError, ValueError):
        pass
    return pd.NaT


def parse_capacite(val):
    if pd.isna(val):
        return None
    m = re.search(r"\d+", str(val))
    return float(m.group()) if m else None


def f2n(v):
    try:
        if v is None:
            return None
        fv = float(v)
        if math.isnan(fv):
            return None
        return fv
    except (TypeError, ValueError):
        return None
# Point-in-polygon sur communes.geojson (ray casting)
def build_communes_polys(geojson_path):
    with open(geojson_path, encoding="utf-8") as f:
        gj = json.load(f)
    polys = []
    for feat in gj.get("features", []):
        name = feat.get("properties", {}).get("com_fr")
        if not name:
            continue
        geom = feat.get("geometry", {})
        rings = []
        if geom.get("type") == "Polygon":
            rings = geom["coordinates"]
        elif geom.get("type") == "MultiPolygon":
            for poly in geom["coordinates"]:
                rings.extend(poly)
        for ring in rings:
            if len(ring) >= 3:
                polys.append((name, ring))
    return polys

def point_in_ring(lon, lat, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


COMMUNES_POLYS = build_communes_polys(GEOJSON_COMMUNES)


def compute_commune(lat, lon):
    if lat is None or lon is None:
        return None
    try:
        lat = float(lat)
        lon = float(lon)
    except (TypeError, ValueError):
        return None
    if not (math.isfinite(lat) and math.isfinite(lon)):
        return None
    for name, ring in COMMUNES_POLYS:
        if point_in_ring(lon, lat, ring):
            return name
    return None


KEY_EQUIPMENTS = [
    "Piscine", "Parking", "Sécurité", "Ascenseur", "Climatisation",
    "Meublé", "Terrasse", "Concierge", "Balcon", "Chauffage",
]


def eq_col(eq_label):
    return "eq_" + eq_label.lower().replace("é", "e")


def build_equipment_flags(df):
    src = df.get("equipements")
    if src is None:
        series = pd.Series("", index=df.index)
    else:
        series = src.fillna("").astype(str)
    for eq in KEY_EQUIPMENTS:
        col = eq_col(eq)
        if col not in df.columns:
            df[col] = series.str.contains(eq, case=False, regex=False).astype(int)
    return df


def norm_type_bien(s):
    if pd.isna(s):
        return None
    v = str(s).strip()
    if not v or v.lower() in ("nan", "none", "null", "non renseign\u00e9"):
        return None
    return v[0].upper() + v[1:]


def norm_quartier(s):
    if pd.isna(s):
        return None
    v = str(s).strip()
    if not v or v.lower() in ("nan", "none", "null"):
        return None
    return v.title()


def parse_serial_to_date(val):
    try:
        num = float(val)
        if 20000 < num < 90000:
            return datetime(1899, 12, 30) + pd.Timedelta(days=num)
    except (TypeError, ValueError):
        pass
    return pd.NaT


def main():
    print("[1/4] Lecture Excel ...")
    fusion = pd.read_excel(XL_FUSION)
    fusion.columns = [str(c).strip() for c in fusion.columns]
    vacances = pd.read_excel(XL_VACANCES)
    vacances.columns = [str(c).strip() for c in vacances.columns]
    vacances = vacances.rename(columns={
        "latitude": "lat", "longitude": "long",
        "chambres_a_louer": "chambres", "localisation": "quartier",
    })

    # Fusion : types numériques, devise -> MAD, période normalisée
    fusion = fusion.dropna(subset=["lat", "long"]).copy()
    fusion["lat"] = pd.to_numeric(fusion["lat"], errors="coerce")
    fusion["long"] = pd.to_numeric(fusion["long"], errors="coerce")
    fusion = fusion.dropna(subset=["lat", "long"]).reset_index(drop=True)

    fusion["prix_mad"] = to_mad_from_series(
        fusion.get("prix", pd.Series(dtype=float)),
        fusion.get("devise", pd.Series(dtype=object)),
    )
    fusion["periode_norm"] = (
        fusion.get("periode_prix", pd.Series(dtype=object))
        .astype(str).str.strip().str.lower()
    )
    for col in ["superficie_m2", "chambres", "salles_de_bain", "nb_etages", "salons"]:
        if col in fusion.columns:
            fusion[col] = pd.to_numeric(fusion[col], errors="coerce")

    if "type_bien" in fusion.columns:
        fusion["type_bien"] = fusion["type_bien"].apply(norm_type_bien)
    if "quartier" in fusion.columns:
        fusion["quartier"] = fusion["quartier"].apply(norm_quartier)

    fusion["_date_pub"] = (
        pd.to_datetime(fusion["date_publication"], errors="coerce")
        if "date_publication" in fusion.columns else pd.NaT
    )
    fusion["_date_raw"] = fusion.get("date", pd.Series(dtype=object)).apply(excel_serial_to_date)
    fusion["date_annonce"] = fusion["_date_pub"].fillna(fusion["_date_raw"])

    fusion["commune_officielle"] = fusion.apply(
        lambda r: compute_commune(r["lat"], r["long"]), axis=1
    )

    # --- Mensuel (mois) ---
    mensuel = fusion[fusion["periode_norm"] == "mois"].copy()
    mensuel["prix_mensuel_dh"] = mensuel["prix_mad"]
    mensuel = mensuel[mensuel["prix_mensuel_dh"].between(1000, 200000)].copy()
    lo, hi = mensuel["prix_mensuel_dh"].quantile([0.01, 0.99])
    mensuel = mensuel[(mensuel["prix_mensuel_dh"] >= lo) & (mensuel["prix_mensuel_dh"] <= hi)]
    mensuel = build_equipment_flags(mensuel)

    jour_fusion = fusion[fusion["periode_norm"] == "jour"].copy()
    jour_fusion["prix_nuit_dh"] = jour_fusion["prix_mad"]
    jour_fusion["capacite"] = None
    jour_fusion["_src"] = "fusion_jour"

    print(f"  fusion: {len(fusion)} | mensuel: {len(mensuel)} | jour_fusion: {len(jour_fusion)}")

# --- Vacances (nuitée) ---
    vacances = vacances.dropna(subset=["lat", "long"]).reset_index(drop=True)
    vacances["lat"] = pd.to_numeric(vacances["lat"], errors="coerce")
    vacances["long"] = pd.to_numeric(vacances["long"], errors="coerce")
    vacances = vacances.dropna(subset=["lat", "long"]).reset_index(drop=True)
    vacances["prix_nuit_dh"] = to_mad_from_series(
        vacances.get("prix", pd.Series(dtype=object)),
        vacances.get("devise", pd.Series(dtype=object)),
    )
    if "chambres" in vacances.columns:
        vacances["chambres"] = pd.to_numeric(vacances["chambres"], errors="coerce")
    vacances["capacite"] = (
        vacances["capacite_personnes"].apply(parse_capacite)
        if "capacite_personnes" in vacances.columns else None
    )
    if "type_bien" in vacances.columns:
        vacances["type_bien"] = vacances["type_bien"].apply(norm_type_bien)
    if "quartier" in vacances.columns:
        vacances["quartier"] = vacances["quartier"].apply(norm_quartier)
    vacances["_src"] = "vacances"

    vacances["_date_pub"] = (
        pd.to_datetime(vacances["date_publication"], errors="coerce")
        if "date_publication" in vacances.columns else pd.NaT
    )
    vacances["_date_raw"] = vacances.get("date", pd.Series(dtype=object)).apply(excel_serial_to_date)
    vacances["date_annonce"] = vacances["_date_pub"].fillna(vacances["_date_raw"])

    vacances["commune_officielle"] = vacances.apply(
        lambda r: compute_commune(r["lat"], r["long"]), axis=1
    )
    vacances = build_equipment_flags(vacances)

    # --- Nuitées fusionnées (jour de la fusion + vacances) ---
    nuitee = pd.concat([jour_fusion, vacances], ignore_index=True, sort=False)
    nuitee = nuitee[nuitee["prix_nuit_dh"].notna() & nuitee["prix_nuit_dh"].between(100, 15000)].copy()
    lo = nuitee["prix_nuit_dh"].quantile(0.01)
    hi = nuitee["prix_nuit_dh"].quantile(0.99)
    nuitee = nuitee[(nuitee["prix_nuit_dh"] >= lo) & (nuitee["prix_nuit_dh"] <= hi)]
    nuitee = nuitee.reset_index(drop=True)

    print(f"  [2/4] mensuel={len(mensuel)} | nuitee={len(nuitee)}")

# --- Construction des documents MongoDB (schéma "properties") ---
    from pymongo import MongoClient, GEOSPHERE

    client = MongoClient(load_mongo_uri(), serverSelectionTimeoutMS=25000)
    db = client.get_database()
    coll = db["properties"]

    print("  [3/4] Suppression des anciennes locations (Vente intacte) ...")
    coll.delete_many({"operation": {"$in": ["Location", "Location_Vacances"]}})

    max_doc = coll.find_one({}, sort=[("id", -1)])
    next_id = (max_doc.get("id") or 0) + 1 if max_doc else 1

    def build_doc(r, periode, source):
        lat = r.get("lat")
        lon = r.get("long")
        prix = r.get("prix_mensuel_dh") if periode == "mois" else r.get("prix_nuit_dh")
        da = r.get("date_annonce")
        if da is None or bool(pd.isna(da)):
            da = None
        elif hasattr(da, "to_pydatetime"):
            da = da.to_pydatetime()
        doc = {
            "id": None,
            "operation": "Location",
            "source": source,
            "titre": None if pd.isna(r.get("titre")) else str(r.get("titre")),
            "type_bien": r.get("type_bien"),
            "quartier": r.get("quartier"),
            "ville": None if pd.isna(r.get("ville")) else str(r.get("ville")),
            "region": "Marrakech-Safi",
            "commune_officielle": r.get("commune_officielle"),
            "prix": f2n(prix),
            "devise": "MAD",
            "periode_norm": periode,
            "surface_m2": f2n(r.get("superficie_m2")),
            "chambres": f2n(r.get("chambres")),
            "salles_bain": f2n(r.get("salles_de_bain")),
            "salons": f2n(r.get("salons")),
            "etages": f2n(r.get("nb_etages")),
            "capacite": f2n(r.get("capacite")),
            "description": None if pd.isna(r.get("description")) else str(r.get("description")),
            "equipements": None if pd.isna(r.get("equipements")) else str(r.get("equipements")),
            "url": None if pd.isna(r.get("lien")) else str(r.get("lien")),
            "date_annonce": da,
            "latitude": f2n(lat),
            "longitude": f2n(lon),
            "geocoded": 1,
            "created_at": datetime.utcnow(),
        }
        if periode == "mois":
            doc["prix_mensuel_dh"] = f2n(prix)
        else:
            doc["prix_nuit_dh"] = f2n(prix)
        for eq in KEY_EQUIPMENTS:
            col = eq_col(eq)
            doc[col] = int(r.get(col)) if pd.notna(r.get(col)) else 0
        return doc

    docs = []
    for _, r in mensuel.iterrows():
        d = build_doc(r, "mois", "fusion_mensuel")
        d["id"] = next_id
        next_id += 1
        docs.append(d)
    for _, r in nuitee.iterrows():
        d = build_doc(r, "jour", r.get("_src", "fusion_jour"))
        d["id"] = next_id
        next_id += 1
        docs.append(d)

    for d in docs:
        lat = d["latitude"]
        lon = d["longitude"]
        d["geo"] = None if lat is None or lon is None else {
            "type": "Point", "coordinates": [lon, lat],
        }

    print(f"  [3/4] Insertion de {len(docs)} documents Location (Vente preservee) ...")
    for i in range(0, len(docs), 1000):
        coll.insert_many(docs[i:i + 1000], ordered=False)

    print("  [4/4] Creation des index ...")
    coll.create_index([("geo", GEOSPHERE)])
    coll.create_index([("operation", 1), ("periode_norm", 1)])
    coll.create_index([("commune_officielle", 1)])
    coll.create_index([("quartier", 1)])
    coll.create_index([("type_bien", 1)])
    coll.create_index([("date_annonce", 1)])

    n_men = coll.count_documents({"operation": "Location", "periode_norm": "mois"})
    n_jour = coll.count_documents({"operation": "Location", "periode_norm": "jour"})
    print(f"  => IMPORT TERMINE : Location mensuel={n_men} | nuee={n_jour}")
    client.close()


if __name__ == "__main__":
    main()