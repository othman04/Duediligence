import os
import math
import logging
import requests
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# ── Endpoints Overpass par ordre de préférence ───────────────────────
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
HEADERS = {
    "User-Agent": "OrchidIslandGeoService/2.0 (https://orchidisland.ma; contact@orchidisland.ma)",
    "Accept-Encoding": "gzip",
}

# ── Mapping ÉTENDU OSM tags → catégories ───────────────────────────
# Couvre amenity, shop, leisure, healthcare, office, tourism
CATEGORY_MAPPING = {
    "sante": [
        "hospital", "clinic", "doctors", "pharmacy", "dentist",
        "veterinary", "health_post", "nursing_home", "optician",
        # healthcare=*
        "centre", "alternative", "blood_bank",
    ],
    "education": [
        "school", "kindergarten", "university", "college",
        "driving_school", "language_school", "music_school",
        "library", "research_institute",
    ],
    "transport": [
        "bus_station", "bus_stop", "taxi", "train_station", "ferry_terminal",
        "fuel", "parking", "bicycle_parking", "car_sharing", "subway_entrance",
    ],
    "commerces": [
        "supermarket", "mall", "bakery", "convenience", "butcher",
        "greengrocer", "clothes", "shoes", "electronics", "hardware",
        "marketplace", "department_store", "general", "doityourself",
        "kiosk", "laundry", "dry_cleaning",
        # shop tags (tout ce qui est shop=* tombe ici)
    ],
    "loisirs": [
        "park", "garden", "sports_centre", "stadium", "swimming_pool",
        "cinema", "theatre", "cafe", "restaurant", "bar", "pub",
        "fast_food", "ice_cream", "pitch", "playground", "nightclub",
        "gym", "fitness_centre", "golf_course", "casino",
        "hotel", "hostel", "guest_house", "tourist_attraction",
    ],
    "services": [
        "bank", "atm", "post_office", "police", "townhall", "courthouse",
        "bureau_de_change", "money_transfer", "insurance", "real_estate",
        "accountant", "lawyer", "notary", "government",
        "telephone", "internet_cafe", "copy_shop",
    ],
    "religieux": [
        "place_of_worship", "mosque", "church", "synagogue",
        "hindu_temple", "buddhist_temple",
    ],
}

# Inversion rapide tag → catégorie
TAG_TO_CATEGORY: Dict[str, str] = {}
for _cat, _tags in CATEGORY_MAPPING.items():
    for _tag in _tags:
        TAG_TO_CATEGORY[_tag] = _cat


# ── Haversine ───────────────────────────────────────────────────────
def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Requête Overpass groupée (300m + 1km en un seul appel) ──────────
def _overpass_query(latitude: float, longitude: float, radius_m: int, timeout: int = 25) -> Optional[Dict]:
    """
    Requête Overpass couvrant les tags amenity, shop, leisure, healthcare, office, tourism.
    Retourne le JSON Overpass ou None si tous les endpoints échouent.
    """
    query = f"""
[out:json][timeout:{timeout}];
(
  node["amenity"](around:{radius_m},{latitude},{longitude});
  way["amenity"](around:{radius_m},{latitude},{longitude});
  node["shop"](around:{radius_m},{latitude},{longitude});
  way["shop"](around:{radius_m},{latitude},{longitude});
  node["leisure"](around:{radius_m},{latitude},{longitude});
  way["leisure"](around:{radius_m},{latitude},{longitude});
  node["healthcare"](around:{radius_m},{latitude},{longitude});
  way["healthcare"](around:{radius_m},{latitude},{longitude});
  node["tourism"](around:{radius_m},{latitude},{longitude});
  node["office"](around:{radius_m},{latitude},{longitude});
);
out center;
"""
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            logger.info(f"[OSM] Requête Overpass rayon={radius_m}m → {endpoint}")
            resp = requests.post(
                endpoint,
                data={"data": query},
                headers=HEADERS,
                timeout=20,  # augmenté à 20s
            )
            if resp.status_code == 200:
                data = resp.json()
                n = len(data.get("elements", []))
                logger.info(f"[OSM] ✅ Overpass OK — {n} éléments (rayon {radius_m}m)")
                return data
            else:
                logger.warning(f"[OSM] HTTP {resp.status_code} pour {endpoint}")
        except requests.Timeout:
            logger.warning(f"[OSM] ⏱ Timeout pour {endpoint}")
        except Exception as err:
            logger.warning(f"[OSM] Erreur {endpoint}: {err}")

    logger.error("[OSM] ❌ Tous les serveurs Overpass ont échoué.")
    return None


def _classify_element(tags: Dict) -> Optional[str]:
    """
    Détermine la catégorie d'un élément OSM à partir de ses tags.
    Ordre de priorité : amenity → shop → leisure → healthcare → tourism → office
    """
    # --- amenity ---
    amenity = tags.get("amenity", "")
    if amenity:
        cat = TAG_TO_CATEGORY.get(amenity)
        if cat:
            return cat
        # Cas génériques non listés explicitement
        if amenity in ("fast_food", "food_court", "ice_cream", "biergarten"):
            return "loisirs"
        if amenity in ("money_transfer", "payment_terminal", "payment_centre"):
            return "services"
        if amenity in ("charging_station", "car_wash", "car_rental"):
            return "transport"

    # --- shop ---
    if tags.get("shop"):
        return "commerces"

    # --- leisure ---
    leisure = tags.get("leisure", "")
    if leisure:
        cat = TAG_TO_CATEGORY.get(leisure)
        return cat or "loisirs"

    # --- healthcare ---
    if tags.get("healthcare"):
        return "sante"

    # --- tourism ---
    tourism = tags.get("tourism", "")
    if tourism in ("hotel", "hostel", "guest_house", "motel", "apartment"):
        return "loisirs"
    if tourism in ("attraction", "museum", "gallery", "viewpoint", "theme_park"):
        return "loisirs"

    # --- office ---
    if tags.get("office") in ("government", "ngo", "association"):
        return "services"

    return None


def _process_elements(elements: List[Dict], origin_lat: float, origin_lon: float, radius_m: float) -> Dict:
    """
    Traite une liste d'éléments Overpass et calcule les métriques.
    """
    counts  = {cat: 0 for cat in CATEGORY_MAPPING}
    gravity = {f"grav_{cat}": 0.0 for cat in CATEGORY_MAPPING}
    poi_coordinates: Dict[str, Dict] = {}
    beta = 0.001  # Hansen gravity decay
    total = 0

    for el in elements:
        tags = el.get("tags", {})
        if not tags:
            continue

        # Coordonnées (node direct ou centroïde way/relation)
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lon = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is None or lon is None:
            continue

        dist_m = haversine(origin_lat, origin_lon, lat, lon)
        if dist_m > radius_m:
            continue  # sécurité supplémentaire

        cat = _classify_element(tags)
        if cat is None:
            continue

        total += 1
        counts[cat] += 1
        gravity[f"grav_{cat}"] += math.exp(-beta * dist_m)

        # Garder le POI le plus proche par type pour le routage Mapbox
        tag_val = (tags.get("amenity") or tags.get("shop") or
                   tags.get("leisure") or tags.get("healthcare") or "unknown")
        existing = poi_coordinates.get(tag_val)
        if existing is None or dist_m < existing["dist"]:
            poi_coordinates[tag_val] = {"lat": lat, "lon": lon, "dist": dist_m}

    # Entropie de Shannon
    entropie = 0.0
    if total > 0:
        for c in counts.values():
            if c > 0:
                p = c / total
                entropie -= p * math.log(p)

    # Scores d'accessibilité (normalisés 0-100)
    acc = {
        f"score_accessibilite_{cat}": min(100.0, gravity[f"grav_{cat}"] * 20.0)
        for cat in CATEGORY_MAPPING
    }
    acc["score_accessibilite_globale"] = min(
        100.0, sum(acc.values()) / max(1, len(acc))
    )

    # Routage coordinates (lon, lat pour Mapbox)
    routing = {k: [v["lon"], v["lat"]] for k, v in poi_coordinates.items()}

    return {
        "total": total,
        "counts": counts,
        "gravity": {k: round(v, 4) for k, v in gravity.items()},
        "entropie": round(entropie, 4),
        "accessibility": {k: round(v, 1) for k, v in acc.items()},
        "poi_coordinates": routing,
    }


# ── Fonction principale : deux rayons en un appel ───────────────────
def discover_pois_dual(latitude: float, longitude: float) -> Dict[str, Any]:
    """
    Effectue UNE requête Overpass à rayon 1000m, puis extrait aussi les données
    correspondant au sous-rayon 300m côté Python (évite 2 appels réseau).

    Retourne un dict avec :
      - pois_1km : métriques sur 1000m
      - pois_300m : métriques sur 300m  
      - poi_coordinates : pour routage Mapbox
      - distance_centre_ville
      - overpass_success : bool
    """
    dist_centre = round(haversine(latitude, longitude, 31.6258, -7.9891), 1)

    data = _overpass_query(latitude, longitude, radius_m=1000)
    overpass_success = data is not None

    if not overpass_success:
        logger.warning("[OSM] Overpass indisponible — données estimées par distance au centre")
        return _estimated_response(latitude, longitude, dist_centre)

    elements = data.get("elements", [])
    logger.info(f"[OSM] {len(elements)} éléments bruts reçus")

    # Traitement 1 km
    res_1km  = _process_elements(elements, latitude, longitude, 1000)
    # Traitement 300 m (sous-ensemble du même appel)
    res_300m = _process_elements(elements, latitude, longitude, 300)

    logger.info(
        f"[OSM] POIs validés → 1km: {res_1km['total']} | 300m: {res_300m['total']}"
    )

    return {
        # 1 km — utilisé par le modèle ML
        "nb_pois_1km":          res_1km["total"],
        "entropie_poi_1km":     res_1km["entropie"],
        "grav_features":        res_1km["gravity"],
        "counts_by_category":   res_1km["counts"],
        # 300 m — micro-environnement
        "nb_pois_300m":         res_300m["total"],
        "entropie_poi_300m":    res_300m["entropie"],
        "counts_by_category_300m": res_300m["counts"],
        "grav_features_300m":   res_300m["gravity"],
        # Accessibilité basée sur 1 km
        "accessibility_scores_0_100": res_1km["accessibility"],
        # Routage Mapbox
        "poi_coordinates":      res_1km["poi_coordinates"],
        # Distance centre-ville
        "distance_centre_ville": dist_centre,
        # Diagnostic
        "overpass_success": True,
    }


def _estimated_response(latitude: float, longitude: float, dist_centre: float) -> Dict[str, Any]:
    """
    Estimation basée sur la centralité quand Overpass est indisponible.
    Les compteurs restent exploitables en mode dégradé : ils sont estimés
    à partir de la centralité, et le champ overpass_success permet de
    distinguer ces valeurs des données OSM réelles.
    """
    is_central = dist_centre <= 4500
    counts = {
        "sante":     3 if is_central else 1,
        "education": 3 if is_central else 1,
        "transport": 4 if is_central else 2,
        "commerces": 6 if is_central else 2,
        "loisirs":   5 if is_central else 2,
        "services":  3 if is_central else 1,
        "religieux": 2 if is_central else 1,
    }
    total = sum(counts.values())
    counts_300 = {k: max(0, v - 1) for k, v in counts.items()}

    gravity = {f"grav_{k}": float(v) * 0.6 for k, v in counts.items()}
    acc = {
        "score_accessibilite_sante":     82.0 if is_central else 45.0,
        "score_accessibilite_education": 80.0 if is_central else 40.0,
        "score_accessibilite_transport": 88.0 if is_central else 55.0,
        "score_accessibilite_commerces": 92.0 if is_central else 48.0,
        "score_accessibilite_loisirs":   85.0 if is_central else 42.0,
        "score_accessibilite_services":  84.0 if is_central else 46.0,
        "score_accessibilite_religieux": 90.0 if is_central else 70.0,
        "score_accessibilite_globale":   86.0 if is_central else 49.0,
    }
    entropie = 0.0
    if total > 0:
        for c in counts.values():
            if c > 0:
                p = c / total
                entropie -= p * math.log(p)

    return {
        "nb_pois_1km":          total,
        "entropie_poi_1km":     round(entropie, 4),
        "grav_features":        gravity,
        "counts_by_category":   counts,
        "nb_pois_300m":         sum(counts_300.values()),
        "entropie_poi_300m":    round(entropie * 0.7, 4),
        "counts_by_category_300m": counts_300,
        "grav_features_300m":   {f"grav_{k}": v * 0.4 for k, v in {k: float(v) for k, v in counts.items()}.items()},
        "accessibility_scores_0_100": acc,
        "poi_coordinates":      {},
        "distance_centre_ville": dist_centre,
        "overpass_success":     False,
    }


# ── Distances de risque (Industrial / Security / Dam) ───────────────
DEFAULT_RISK_DISTANCES = {
    "dist_industrial_m": 15000.0,
    "dist_security_m":   10000.0,
    "dist_dam_m":        25000.0,
}

def discover_risk_distances(latitude: float, longitude: float, radius_m: int = 20000) -> Dict[str, float]:
    """
    Requête Overpass groupée pour les 3 catégories de risque spatial.
    """
    logger.info(f"[RISK-GEO] Requête Overpass groupée (rayon {radius_m}m)")

    query = f"""
[out:json][timeout:30];
(
  node["landuse"="industrial"](around:{radius_m},{latitude},{longitude});
  way["landuse"="industrial"](around:{radius_m},{latitude},{longitude});
  node["amenity"="police"](around:{radius_m},{latitude},{longitude});
  node["amenity"="fire_station"](around:{radius_m},{latitude},{longitude});
  node["waterway"="dam"](around:{radius_m},{latitude},{longitude});
  way["waterway"="dam"](around:{radius_m},{latitude},{longitude});
  node["waterway"="weir"](around:{radius_m},{latitude},{longitude});
  way["waterway"="weir"](around:{radius_m},{latitude},{longitude});
);
out center;
"""
    data = None
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            resp = requests.post(endpoint, data={"data": query}, headers=HEADERS, timeout=20)
            if resp.status_code == 200:
                data = resp.json()
                break
        except Exception as err:
            logger.warning(f"[RISK] {endpoint} failed: {err}")

    if not data:
        return dict(DEFAULT_RISK_DISTANCES)

    min_dist: Dict[str, Optional[float]] = {k: None for k in DEFAULT_RISK_DISTANCES}
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        el_lat = el.get("lat") or (el.get("center") or {}).get("lat")
        el_lon = el.get("lon") or (el.get("center") or {}).get("lon")
        if el_lat is None or el_lon is None:
            continue

        dist = haversine(latitude, longitude, el_lat, el_lon)
        landuse  = tags.get("landuse", "")
        amenity  = tags.get("amenity", "")
        waterway = tags.get("waterway", "")

        if landuse == "industrial":
            key = "dist_industrial_m"
        elif amenity in ("police", "fire_station"):
            key = "dist_security_m"
        elif waterway in ("dam", "weir"):
            key = "dist_dam_m"
        else:
            continue

        if min_dist[key] is None or dist < min_dist[key]:
            min_dist[key] = dist

    result = {
        k: round(min_dist[k], 1) if min_dist[k] is not None else default
        for k, default in DEFAULT_RISK_DISTANCES.items()
    }
    logger.info(f"[RISK] industrial={result['dist_industrial_m']:.0f}m, security={result['dist_security_m']:.0f}m, dam={result['dist_dam_m']:.0f}m")
    return result


# ── Compatibilité rétrograde (ancien nom) ───────────────────────────
def discover_pois(latitude: float, longitude: float, radius_m: int = 1000) -> Dict[str, Any]:
    """Alias vers discover_pois_dual pour compatibilité."""
    return discover_pois_dual(latitude, longitude)
