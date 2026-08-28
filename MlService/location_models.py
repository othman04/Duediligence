"""
location_models.py — Modèles LOCATION (XGBoost + régression quantile)

Charge les modèles depuis MlService/artificats/location :
  - model_mensuel.pkl            -> loyer mensuel (XGBRegressor)
  - model_mensuel_quantile.pkl   -> bornes 10% / 90% (quantile regression)
  - model_nuitee.pkl             -> prix par nuitée
  - model_nuitee_quantile.pkl    -> bornes 10% / 90%

Les variables catégorielles sont encodées avec EXACTEMENT le même mapping que
pendant l'entraînement (pandas .astype("category") => codes triés), d'où
l'utilisation des listes de catégories de metadata.json.
"""
import json
import pickle
from pathlib import Path

import numpy as np
import xgboost as xgb

BASE_DIR = Path(__file__).resolve().parent          # MlService/
EXPORTS = BASE_DIR / "artificats" / "location"      # modèles LOCATION (même logique que Vente)
METADATA_PATH = EXPORTS / "metadata.json"

CAT_FEATURES = [
    "zoning_category", "commune_officielle",
    "statut_foncier_parcelle_proche", "type_bien", "quartier",
]

# Valeurs par défaut neutres pour les variables contextuelles non saisies
BASE_DEFAULTS = {
    "dist_ecole_m": 800.0, "nb_ecole_300m": 0, "nb_ecole_500m": 0, "nb_ecole_1000m": 1,
    "dist_restaurant_m": 600.0, "nb_restaurant_300m": 0, "nb_restaurant_500m": 1,
    "nb_restaurant_1000m": 2,
    "dist_pharmacie_m": 700.0, "nb_pharmacie_300m": 0, "nb_pharmacie_500m": 0,
    "nb_pharmacie_1000m": 1,
    "dist_supermarche_m": 900.0, "nb_supermarche_300m": 0, "nb_supermarche_500m": 0,
    "nb_supermarche_1000m": 1,
    "dist_mosquee_m": 500.0, "nb_mosquee_300m": 0, "nb_mosquee_500m": 1, "nb_mosquee_1000m": 1,
    "dist_route_primary_m": 2500.0, "dist_route_secondary_m": 1200.0,
    "dist_route_residential_m": 200.0, "dist_route_trunk_m": 8000.0,
    "dist_parcelle_cadastrale_m": 2000.0,
    "risque_juridique_parcelle_proche": 0,
    "nb_entreprises_actives_ville": 12000.0,
    "population_estimee_millions": 4.5,
    "taux_chomage_pct": 13.2,
    "revenu_mensuel_moyen_menage_mad": 6200.0,
    "taux_urbanisation_pct": 63.0,
    "taux_croissance_eco_estime_pct": 2.9,
    "taille_moyenne_menage": 4.2,
}

FEATURE_LABELS = {
    "superficie_m2": "Surface",
    "chambres": "Chambres",
    "salles_de_bain": "Salles de bain",
    "salons": "Salons",
    "nb_etages": "Étages",
    "capacite": "Capacité d'accueil",
    "eq_piscine": "Piscine",
    "eq_parking": "Parking",
    "eq_securite": "Sécurité",
    "eq_ascenseur": "Ascenseur",
    "eq_climatisation": "Climatisation",
    "eq_meuble": "Meublé",
    "eq_terrasse": "Terrasse",
    "eq_concierge": "Concierge",
    "eq_balcon": "Balcon",
    "eq_chauffage": "Chauffage",
    "type_bien": "Type de bien",
    "quartier": "Quartier",
    "commune_officielle": "Commune",
    "zoning_category": "Zonage urbain",
    "statut_foncier_parcelle_proche": "Statut foncier",
    "dist_ecole_m": "Distance école",
    "dist_restaurant_m": "Distance restaurants",
    "dist_pharmacie_m": "Distance pharmacie",
    "dist_supermarche_m": "Distance supermarché",
    "dist_mosquee_m": "Distance mosquée",
    "dist_route_primary_m": "Distance route principale",
    "dist_parcelle_cadastrale_m": "Distance parcelle cadastrale",
    "risque_juridique_parcelle_proche": "Risque juridique",
    "taux_chomage_pct": "Taux de chômage",
    "revenu_mensuel_moyen_menage_mad": "Revenu moyen ménage",
    "population_estimee_millions": "Population",
    "taille_moyenne_menage": "Taille du ménage",
}

_cache = {}


class LocationModels:
    def __init__(self, mode: str):
        self.mode = mode  # 'mensuel' | 'nuitee'
        suffix = "_m" if mode == "mensuel" else "_n"
        meta = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
        self.features = list(meta[f"all_features{suffix}"])
        cats = meta[f"categories{suffix}"]
        # pandas .astype('category') pendant l'entraînement => codes triés
        self.cat_maps = {
            name: {cat: i for i, cat in enumerate(sorted(vals))}
            for name, vals in cats.items() if name in CAT_FEATURES
        }
        with open(EXPORTS / f"model_{mode}.pkl", "rb") as fh:
            self.model = pickle.load(fh)
        with open(EXPORTS / f"model_{mode}_quantile.pkl", "rb") as fh:
            self.quantile = pickle.load(fh)
        self.booster = self.model.get_booster()
        self.quantile_booster = self.quantile.get_booster()
        self.feature_types = ["c" if f in self.cat_maps else "float" for f in self.features]

    def encode_cat(self, feat: str, value) -> float:
        mapping = self.cat_maps.get(feat)
        if not mapping:
            return 0.0
        if value is not None and value in mapping:
            return float(mapping[value])
        v = str(value or "").strip().lower()
        for k, idx in mapping.items():
            if k.strip().lower() == v:
                return float(idx)
        fallbacks = {
            "quartier": ["Autre", "Autre secteur", "autre"],
            "zoning_category": ["Zone d'habitat"],
            "type_bien": ["Appartement", "appartement"],
            "commune_officielle": ["Marrakech"],
            "statut_foncier_parcelle_proche": ["Melk non immatriculé"],
        }
        for cand in fallbacks.get(feat, []):
            if cand in mapping:
                return float(mapping[cand])
        return 0.0

    def build_vector(self, payload: dict) -> np.ndarray:
        row = []
        for feat in self.features:
            if feat in self.cat_maps:
                row.append(self.encode_cat(feat, payload.get(feat)))
                continue
            val = payload.get(feat)
            if val is None:
                val = BASE_DEFAULTS.get(feat, 0.0)
            try:
                row.append(float(val))
            except (TypeError, ValueError):
                row.append(BASE_DEFAULTS.get(feat, 0.0))
        return np.array([row])

    def dmatrix(self, payload: dict) -> xgb.DMatrix:
        vec = self.build_vector(payload)
        return xgb.DMatrix(vec, feature_types=self.feature_types, feature_names=self.features)

    def predict(self, payload: dict) -> dict:
        dm = self.dmatrix(payload)
        price = float(self.booster.predict(dm)[0])
        q = np.asarray(self.quantile_booster.predict(dm))[0]
        low_raw = float(min(q[0], q[-1]))
        high_raw = float(max(q[0], q[-1]))
        # Si le modèle quantile et le modèle principal divergent trop,
        # on conserve la LARGEUR de l'intervalle quantile mais recentrée
        # sur l'estimation principale (fourchette toujours cohérente).
        if not (low_raw <= price <= high_raw):
            half = max((high_raw - low_raw) / 2.0, abs(price) * 0.12, 1.0)
            low = price - half
            high = price + half
        else:
            low, high = low_raw, high_raw
        contribs = np.asarray(self.booster.predict(dm, pred_contribs=True))[0]
        shap = [
            {
                "feature": feat,
                "label": FEATURE_LABELS.get(feat, feat),
                "contribution": round(float(c), 2),
            }
            for feat, c in zip(self.features, contribs[:-1])
        ]
        shap.sort(key=lambda x: abs(x["contribution"]), reverse=True)
        surface = payload.get("superficie_m2")
        price_per_m2 = round(price / surface) if surface else None
        return {
            "predicted_price": round(max(price, 0)),
            "price_per_m2": price_per_m2,
            "confidence_range": {"low": round(max(low, 0)), "high": round(max(high, 0))},
            "shap_values": shap[:10],
            "inputs_summary": {
                "type_bien": payload.get("type_bien"),
                "quartier": payload.get("quartier"),
                "commune_fr": payload.get("commune_officielle"),
                "surface_m2": surface,
                "periode": self.mode,
            },
            "currency": "MAD",
        }


def get_location_models(mode: str) -> LocationModels:
    """Chargement paresseux : modèles chargés au premier appel uniquement."""
    if mode not in ("mensuel", "nuitee"):
        raise ValueError(f"Période inconnue: {mode}")
    if mode not in _cache:
        _cache[mode] = LocationModels(mode)
    return _cache[mode]