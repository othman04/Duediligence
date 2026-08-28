"""
Investment Scoring Engine — composite score 0-100 from 7 transparent sub-scores.

Weights match etl.config.SCORING_WEIGHTS so batch ETL and live API agree.
environmental_risk_score is a RISK index (0 = safe, 100 = critical), inverted
in the composite. This is the opposite of etl/09_compute_scores.py which stores
a safety score in the same column — callers must not mix the two without conversion.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Same keys/values as etl.config.SCORING_WEIGHTS
DEFAULT_WEIGHTS = {
    "location": 0.20,
    "market": 0.20,
    "development": 0.15,
    "accessibility": 0.15,
    "urban_planning": 0.10,
    "environmental_risk": 0.10,
    "tourism": 0.10,
}

FEATURE_KEYS = (
    "densite_poi_1km", "diversite_poi_1km", "dist_route_principale",
    "prix", "prix_moyen_quartier", "nb_annonces_quartier",
    "revenu_moyen_region", "taux_chomage_region",
    "en_zone_urbaine", "couvert_par_pa", "surface_terrain_m2", "in_zone_touristique",
    "dist_ecole", "dist_hopital", "dist_pharmacie", "dist_banque",
    "dist_commerce", "dist_restaurant",
    "in_planning_boundary", "statut_foncier", "zone_category",
    "litige_en_cours", "saisie_active", "hypotheque_active", "servitude_active",
    "nb_hotels_2km", "nb_restaurants_1km",
)

PROPERTY_PROFILES = {
    "Appartement": {
        "accessibility": {"schools": 1.0, "commerce": 0.8, "transport": 1.0},
        "development": {"land_surface": 0.2, "construction_potential": 0.4},
        "urban_planning": {"zoning": 0.5},
    },
    "Villa": {
        "accessibility": {"schools": 0.9, "commerce": 0.5, "transport": 0.4},
        "development": {"land_surface": 1.0, "construction_potential": 0.7},
        "urban_planning": {"zoning": 0.7},
    },
    "Local commercial": {
        "accessibility": {"schools": 0.2, "commerce": 1.0, "transport": 1.0},
        "development": {"land_surface": 0.5, "construction_potential": 0.7},
        "urban_planning": {"zoning": 1.0},
    },
    "Terrain": {
        "accessibility": {"schools": 0.2, "commerce": 0.2, "transport": 0.4},
        "development": {"land_surface": 1.0, "construction_potential": 1.0},
        "urban_planning": {"zoning": 1.0},
    },
}

def _get_profile(type_bien: str) -> dict:
    tb = str(type_bien).strip().capitalize() if type_bien else "Appartement"
    if tb in PROPERTY_PROFILES:
        return PROPERTY_PROFILES[tb]
    elif "Commercial" in tb or "Magasin" in tb or "Bureau" in tb:
        return PROPERTY_PROFILES["Local commercial"]
    elif "Ferme" in tb or "Agricole" in tb:
        return PROPERTY_PROFILES["Terrain"]
    elif "Maison" in tb or "Riad" in tb:
        return PROPERTY_PROFILES["Villa"]
    return PROPERTY_PROFILES["Appartement"]


def _num(f: Dict, key: str) -> Optional[float]:
    if key not in f or f[key] is None:
        return None
    try:
        return float(f[key])
    except (TypeError, ValueError):
        return None


def _clip(score: float) -> float:
    return float(max(0, min(100, round(score, 1))))


class InvestmentScorer:
    """Hybrid investment scorer: ML v5.2 models + rule-based fallback."""

    WEIGHTS = DEFAULT_WEIGHTS

    def __init__(
        self,
        weights: Optional[Dict[str, float]] = None,
        ml_models: Optional[Dict[str, Any]] = None,
    ):
        self.WEIGHTS = dict(DEFAULT_WEIGHTS)
        if weights:
            self.WEIGHTS.update(weights)
        total = sum(self.WEIGHTS.values())
        if abs(total - 1.0) > 1e-6:
            logger.warning("InvestmentScorer weights sum to %.3f, not 1.0", total)

        # ML v5.2 models (optional — graceful degradation if absent)
        self._ml = ml_models or {}
        self._location_map = self._ml.get("location_map")       # dict[h3_cell -> score data]
        self._h3_resolution = self._ml.get("h3_resolution", 8)
        self._iso_forest = self._ml.get("iso_forest")           # sklearn IsolationForest
        self._iso_features = self._ml.get("iso_features", ["dist_industrial_m", "dist_security_m", "dist_dam_m"])

    def compute_all_scores(self, features: Dict[str, Any], type_bien: str = "Appartement") -> Dict[str, Any]:
        features = features or {}
        profile = _get_profile(type_bien)

        scores = {
            "location_score": self._location_score(features, profile["accessibility"]["transport"]),
            "market_score": self._market_score(features),
            "development_score": self._development_score(features, profile["development"]),
            "accessibility_score": self._accessibility_score(features, profile["accessibility"]),
            "urban_planning_score": self._urban_planning_score(features, profile["urban_planning"]),
            "environmental_risk_score": self._environmental_risk_score(features),
            "tourism_score": self._tourism_score(features),
        }

        w = self.WEIGHTS
        risk_index = scores["environmental_risk_score"]["score"]
        investment = (
            w["market"] * scores["market_score"]["score"]
            + w["location"] * scores["location_score"]["score"]
            + w["development"] * scores["development_score"]["score"]
            + w["urban_planning"] * scores["urban_planning_score"]["score"]
            + w["accessibility"] * scores["accessibility_score"]["score"]
            + w["tourism"] * scores["tourism_score"]["score"]
            + w["environmental_risk"] * (100.0 - risk_index)
        )
        investment = _clip(investment)

        if risk_index >= 75:
            risk_level = "CRITICAL"
        elif risk_index >= 50:
            risk_level = "HIGH"
        elif risk_index >= 25:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        recommendation = self._recommend(investment, risk_level)

        strengths: List[str] = []
        weaknesses: List[str] = []
        for data in scores.values():
            strengths.extend(data.get("strengths", []))
            weaknesses.extend(data.get("weaknesses", []))

        provided = sum(1 for k in FEATURE_KEYS if features.get(k) is not None)
        coverage_pct = round(100.0 * provided / len(FEATURE_KEYS), 1)

        return {
            "investment_score": investment,
            "location_score": scores["location_score"]["score"],
            "market_score": scores["market_score"]["score"],
            "development_score": scores["development_score"]["score"],
            "accessibility_score": scores["accessibility_score"]["score"],
            "urban_planning_score": scores["urban_planning_score"]["score"],
            "environmental_risk_score": risk_index,
            "tourism_score": scores["tourism_score"]["score"],
            "overall_risk_level": risk_level,
            "recommendation": recommendation,
            "coverage_pct": coverage_pct,
            "explanation": {
                "strengths": strengths[:5],
                "weaknesses": weaknesses[:5],
                "recommendation": recommendation,
                "weights_used": self.WEIGHTS,
                "coverage_pct": coverage_pct,
            },
            "details": scores,
        }

    @staticmethod
    def _recommend(investment: float, risk_level: str) -> str:
        if risk_level == "CRITICAL":
            return "AVOID"
        if risk_level == "HIGH" and investment < 60:
            return "AVOID"
        if investment >= 75 and risk_level == "LOW":
            return "BUY"
        if investment >= 50:
            return "INVESTIGATE_FURTHER"
        return "AVOID"

    def _location_score(self, f: Dict, transport_multiplier: float = 1.0) -> Dict:
        # ── Try ML v5.2 lookup first ───────────────────────────
        lat = _num(f, "latitude")
        lng = _num(f, "longitude")

        if lat is not None and lng is not None and self._location_map:
            from intelligence.location_intelligence import location_score_from_ml
            ml_result = location_score_from_ml(
                latitude=lat,
                longitude=lng,
                location_map=self._location_map,
                h3_resolution=self._h3_resolution,
                grav_features=f.get("grav_features", {}),
                nb_pois_1km=_num(f, "nb_pois_1km") or 0,
                entropie_poi_1km=_num(f, "entropie_poi_1km"),
            )
            if ml_result.get("location_source") == "ML_V5_2":
                strengths = ml_result.get("strengths", [])
                return {
                    "score": _clip(ml_result["location_score"]),
                    "strengths": strengths,
                    "weaknesses": [],
                    "location_source": "ML_V5_2",
                    "neighborhood_type": ml_result.get("neighborhood_type"),
                    "hotspot": ml_result.get("hotspot"),
                    "fiabilite": ml_result.get("fiabilite"),
                    "h3_cell": ml_result.get("h3_cell"),
                }

        # ── Fallback: Rule-based scoring ────────────────────────
        score = 50.0
        strengths, weaknesses = [], []

        density = _num(f, "densite_poi_1km")
        if density is not None:
            if density > 100:
                score += 20
                strengths.append(f"Forte densité de services ({int(density)} POIs/km²)")
            elif density > 50:
                score += 10
            elif density < 10:
                score -= 15
                weaknesses.append("Faible densité de services à proximité")

        diversity = _num(f, "diversite_poi_1km")
        if diversity is not None:
            if diversity >= 8:
                score += 15
                strengths.append(f"Grande diversité de services ({int(diversity)} catégories)")
            elif diversity >= 5:
                score += 8
            elif diversity < 3:
                score -= 10
                weaknesses.append("Peu de types de services disponibles")

        dist_road = _num(f, "dist_route_principale")
        if dist_road is not None:
            if dist_road < 500:
                score += 10 * transport_multiplier
            elif dist_road > 3000:
                score -= 10 * transport_multiplier
                weaknesses.append(f"Route principale à {dist_road / 1000:.1f} km")

        return {
            "score": _clip(score),
            "strengths": strengths,
            "weaknesses": weaknesses,
            "location_source": "RULE_BASED",
            "neighborhood_type": None,
            "hotspot": None,
            "fiabilite": None,
            "h3_cell": None,
        }

    def _market_score(self, f: Dict) -> Dict:
        score = 50.0
        strengths, weaknesses = [], []

        prix = _num(f, "prix")
        prix_moyen = _num(f, "prix_moyen_quartier")
        if prix and prix_moyen and prix_moyen > 0:
            ratio = prix / prix_moyen
            if ratio < 0.85:
                score += 20
                strengths.append("Prix 15% en-dessous de la moyenne du quartier (à vérifier)")
            elif ratio < 0.95:
                score += 10
            elif ratio > 1.2:
                score -= 15
                weaknesses.append("Prix 20% au-dessus de la moyenne du quartier")

        nb_annonces = _num(f, "nb_annonces_quartier")
        if nb_annonces is not None:
            if nb_annonces > 50:
                score += 10
                strengths.append(f"Quartier actif ({int(nb_annonces)} annonces)")
            elif nb_annonces < 5:
                score -= 10
                weaknesses.append("Très peu d'annonces dans le quartier")

        revenu = _num(f, "revenu_moyen_region")
        if revenu is not None:
            if revenu > 7000:
                score += 10
                strengths.append(f"Région à revenu élevé ({revenu:,.0f} MAD/mois)")
            elif revenu > 5000:
                score += 5

        chomage = _num(f, "taux_chomage_region")
        if chomage is not None:
            if chomage < 10:
                score += 5
            elif chomage > 15:
                score -= 10
                weaknesses.append(f"Taux de chômage élevé ({chomage:.1f}%)")

        return {"score": _clip(score), "strengths": strengths, "weaknesses": weaknesses}

    def _development_score(self, f: Dict, profile_dev: Dict) -> Dict:
        score = 50.0
        strengths, weaknesses = [], []
        
        c_pot = profile_dev["construction_potential"]

        if f.get("en_zone_urbaine"):
            score += 15 * c_pot
            strengths.append("En zone urbaine")

        if f.get("couvert_par_pa"):
            score += 15 * c_pot
            strengths.append("Couvert par un plan d'aménagement")
        elif "couvert_par_pa" in f:
            weaknesses.append("Pas de plan d'aménagement identifié")

        surf_mult = profile_dev["land_surface"]
        surface_terrain = _num(f, "surface_terrain_m2")
        if surface_terrain and surface_terrain > 500:
            surf_bonus = 10 * surf_mult
            # Modulate bonus if zoning is bad
            if not f.get("couvert_par_pa"):
                surf_bonus *= 0.5
                if surf_mult >= 1.0:
                    weaknesses.append("Grande surface mais sans plan d'aménagement clair")
            score += surf_bonus
            strengths.append(f"Terrain de {surface_terrain:,.0f} m² (potentiel de développement)")

        if f.get("in_zone_touristique"):
            score += 10 * c_pot
            strengths.append("En zone touristique")

        return {"score": _clip(score), "strengths": strengths, "weaknesses": weaknesses}

    def _accessibility_score(self, f: Dict, profile_acc: Dict) -> Dict:
        score = 50.0
        strengths, weaknesses = [], []
        service_thresholds: Dict[str, Tuple[str, float, float, float]] = {
            "dist_ecole": ("École", 1000, 3000, profile_acc["schools"]),
            "dist_hopital": ("Hôpital", 2000, 5000, profile_acc["schools"]),
            "dist_pharmacie": ("Pharmacie", 500, 2000, profile_acc["schools"]),
            "dist_banque": ("Banque", 500, 2000, profile_acc["commerce"]),
            "dist_commerce": ("Commerce", 300, 1500, profile_acc["commerce"]),
            "dist_restaurant": ("Restaurant", 500, 2000, profile_acc["commerce"]),
        }
        for key, (name, good, bad, mult) in service_thresholds.items():
            dist = _num(f, key)
            if dist is None:
                continue
            if dist <= good:
                score += 8 * mult
                strengths.append(f"{name} à {dist:.0f} m")
            elif dist >= bad:
                score -= 5 * mult
                if mult > 0.5:
                    weaknesses.append(f"{name} la plus proche à {dist / 1000:.1f} km")
        return {"score": _clip(score), "strengths": strengths, "weaknesses": weaknesses}

    def _urban_planning_score(self, f: Dict, profile_urb: Dict) -> Dict:
        score = 50.0
        strengths, weaknesses = [], []
        
        z = profile_urb["zoning"]

        if f.get("couvert_par_pa"):
            score += 20 * z
            strengths.append("Plan d'aménagement approuvé")

        if f.get("in_planning_boundary"):
            score += 10 * z

        statut = f.get("statut_foncier") or ""
        statut_l = str(statut).lower()
        if statut and "immatricul" in statut_l:
            score += 15
            strengths.append(f"Statut foncier sécurisé ({statut})")
        elif statut and "collectif" in statut_l:
            score -= 10
            weaknesses.append("Statut foncier collectif — risque de complexité")

        zone_cat = f.get("zone_category")
        if zone_cat:
            strengths.append(f"Zone: {zone_cat}")

        return {"score": _clip(score), "strengths": strengths, "weaknesses": weaknesses}

    def _environmental_risk_score(self, f: Dict) -> Dict:
        """Legal / title risk index + Isolation Forest spatial anomaly.
        Higher = more risky (0 safe, 100 critical)."""
        score = 10.0
        strengths, weaknesses = [], []

        # ── Legal risk (rule-based) ────────────────────────────
        if f.get("litige_en_cours"):
            score += 30
            weaknesses.append("Litige en cours sur la parcelle")
        if f.get("saisie_active"):
            score += 25
            weaknesses.append("Saisie active sur le titre foncier")
        if f.get("hypotheque_active"):
            score += 20
            weaknesses.append("Hypothèque active détectée")
        if f.get("servitude_active"):
            score += 10
            weaknesses.append("Servitude active")

        if score <= 15:
            strengths.append("Aucun risque juridique identifié")

        # ── Spatial anomaly (Isolation Forest) ─────────────────
        anomaly_result = None
        if self._iso_forest is not None:
            from intelligence.risk_intelligence import detect_anomaly_single
            anomaly_result = detect_anomaly_single(
                property_features=f,
                iso_forest=self._iso_forest,
                feature_names=self._iso_features,
            )
            # Integrate calibrated penalty
            adjustment = anomaly_result.get("risk_adjustment", 0)
            if adjustment > 0:
                score += adjustment
                weaknesses.extend(anomaly_result.get("warnings", []))

        return {
            "score": _clip(score),
            "strengths": strengths,
            "weaknesses": weaknesses,
            "spatial_anomaly": anomaly_result,
        }

    def _tourism_score(self, f: Dict) -> Dict:
        score = 30.0
        strengths, weaknesses = [], []

        if f.get("in_zone_touristique"):
            score += 30
            strengths.append("En zone touristique")

        hotels_2km = _num(f, "nb_hotels_2km")
        if hotels_2km is not None:
            if hotels_2km >= 5:
                score += 20
                strengths.append(f"{int(hotels_2km)} hôtels à moins de 2 km")
            elif hotels_2km >= 2:
                score += 10

        restaurants_1km = _num(f, "nb_restaurants_1km")
        if restaurants_1km is not None:
            if restaurants_1km >= 10:
                score += 15
                strengths.append(f"{int(restaurants_1km)} restaurants à moins de 1 km")
            elif restaurants_1km >= 5:
                score += 8

        return {"score": _clip(score), "strengths": strengths, "weaknesses": weaknesses}
