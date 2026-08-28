"""
╔══════════════════════════════════════════════════════════════════╗
║  Orchid Island — ML Prediction Microservice (FastAPI)            ║
║  Port: 8000  |  Model: CatBoost + Sklearn pipeline               ║
╚══════════════════════════════════════════════════════════════════╝

Standalone Microservice (Tier 3)
Exposes POST /predict, POST /analyze-investment, and GET /health /features
"""

import os
import math
import pickle
import logging
import unicodedata
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
import catboost as cb

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from location_models import get_location_models
except ImportError:  # exécution en tant que package (uvicorn MlService.main:app)
    from .location_models import get_location_models

# ── Logging ────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger("ml_service")

# ── Paths ──────────────────────────────────────────────────────────
import sys
BASE_DIR   = Path(__file__).parent                # MlService/
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

ARTIFACTS  = BASE_DIR / "artificats"
MODEL_PATH = ARTIFACTS / "catboost_prix_immobilier.cbm"
PKL_PATH   = ARTIFACTS / "pipeline_artifacts.pkl"

# ── Load artifacts once at startup ─────────────────────────────────
logger.info("Loading pipeline artifacts from %s …", PKL_PATH)
with open(PKL_PATH, "rb") as f:
    pipeline = pickle.load(f)

KMEANS:   object         = pipeline["kmeans"]
FREQ_MAP: dict           = pipeline["freq_map"]          # quartier → freq
FEATURE_COLS: list       = pipeline["feature_cols"]      # 67 ordered feature names
CAT_FEATURES: list       = pipeline["categorical_features"]  # list of cat col names
CAT_IDX: list            = pipeline["cat_idx"]           # integer indices

logger.info("Loading CatBoost model from %s …", MODEL_PATH)
MODEL = cb.CatBoostRegressor()
MODEL.load_model(str(MODEL_PATH))
logger.info("✅  ML Service ready | features=%d", len(FEATURE_COLS))

# ── Load ML v5.2 models ───────────────────────────────────────────
import joblib
import h3

ISO_FOREST_PATH = ARTIFACTS / "isolation_forest_risk.joblib"
LOCATION_PARQUET_PATH = ARTIFACTS / "location_scores_v5_2.parquet"

# Isolation Forest (3 features: dist_industrial_m, dist_security_m, dist_dam_m)
logger.info("Loading Isolation Forest from %s …", ISO_FOREST_PATH)
ISO_FOREST = joblib.load(str(ISO_FOREST_PATH))
ISO_FEATURES = ["dist_industrial_m", "dist_security_m", "dist_dam_m"]
logger.info("✅  Isolation Forest loaded | n_features=%d", ISO_FOREST.n_features_in_)

# Location Intelligence — Parquet → dict for O(1) lookup
logger.info("Loading Location Intelligence from %s …", LOCATION_PARQUET_PATH)
_loc_df = pd.read_parquet(str(LOCATION_PARQUET_PATH))
LOCATION_MAP = {
    row.h3_cell: {
        "score": float(row.location_score),
        "typo_nom": row.typo_nom if pd.notna(row.typo_nom) else None,
        "hotspot": row.hotspot if pd.notna(row.hotspot) else None,
        "fiabilite": float(row.fiabilite) if pd.notna(row.fiabilite) else None,
        "tranche_score": str(row.tranche_score) if pd.notna(row.tranche_score) else None,
    }
    for row in _loc_df.itertuples()
}
H3_RESOLUTION = 8  # Must match training resolution
logger.info("✅  Location map loaded | %d H3 cells (res=%d)", len(LOCATION_MAP), H3_RESOLUTION)
del _loc_df  # Free memory

# ── FastAPI app ─────────────────────────────────────────────────────
app = FastAPI(
    title="Orchid Island — Prix Immobilier ML Service",
    description="Microservice indépendant de prédiction immobilière (CatBoost)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Input schema ───────────────────────────────────────────────────
class PropertyInput(BaseModel):
    # ── Obligatoires ──────────────────────────────────
    type_bien: str                   = Field(..., example="Appartement")
    localisation_quartier: str       = Field(..., example="Agdal")
    commune_fr: str                  = Field(..., example="Marrakech")
    latitude: float                  = Field(..., example=31.63)
    longitude: float                 = Field(..., example=-7.99)
    surface_consolidee_m2: float     = Field(..., example=120)
    surface_habitable_m2: float      = Field(..., example=110)
    total_pieces: int                = Field(..., example=4)
    chambres: int                    = Field(..., example=2)
    salles_bain: int                 = Field(..., example=2)
    salons: int                      = Field(..., example=1)
    etages: int                      = Field(..., example=2)
    etage_semantique: str            = Field(..., example="etage_situation")

    # ── Équipements (optionnels, défaut = 0) ──────────
    equipement_ascenseur:        int = Field(0)
    equipement_balcon:           int = Field(0)
    equipement_chauffage:        int = Field(0)
    equipement_climatisation:    int = Field(0)
    equipement_concierge:        int = Field(0)
    equipement_cuisine_equipee:  int = Field(0)
    equipement_meuble:           int = Field(0)
    equipement_parking:          int = Field(0)
    equipement_securite:         int = Field(0)
    equipement_terrasse:         int = Field(0)
    equipement_piscine:          int = Field(0)
    equipement_jardin:           int = Field(0)

    # ── Scores d'accessibilité (optionnels) ───────────
    score_accessibilite_globale:   float = Field(300.0)
    score_accessibilite_sante:     float = Field(12.0)
    score_accessibilite_education: float = Field(5.0)
    score_accessibilite_transport: float = Field(15.0)
    score_accessibilite_commerces: float = Field(40.0)
    score_accessibilite_loisirs:   float = Field(200.0)
    score_accessibilite_services:  float = Field(5.0)
    score_accessibilite_religieux: float = Field(20.0)

    # ── Distances (optionnelles) ───────────────────────
    distance_nearest_commodites:      float = Field(30.0)
    distance_nearest_transport_route: float = Field(300.0)
    distance_nearest_bank:            float = Field(200.0)
    distance_nearest_bus_stop:        float = Field(300.0)
    distance_nearest_hospital:        float = Field(800.0)
    distance_nearest_motorway:        float = Field(15000.0)
    distance_nearest_park:            float = Field(100.0)
    distance_nearest_pharmacy:        float = Field(80.0)
    distance_nearest_primary_road:    float = Field(1000.0)
    distance_nearest_restaurant:      float = Field(30.0)
    distance_nearest_school:          float = Field(400.0)
    distance_nearest_secondary_road:  float = Field(600.0)
    distance_nearest_supermarket:     float = Field(160.0)

    # ── Temporel (optionnel) ──────────────────────────
    annee:     int   = Field(2026)
    mois:      int   = Field(7)
    trimestre: int   = Field(3)

    # ── Dérivés fournis explicitement (optionnels) ────
    ratio_habitable:            Optional[float] = Field(None)
    score_equipements_calcule:  Optional[float] = Field(None)
    distance_services_moyenne:  Optional[float] = Field(None)
    distance_transport_moyenne: Optional[float] = Field(None)
    distance_centre_ville:      Optional[float] = Field(None)


def resolve_quartier_name(q_raw: str) -> str:
    if not q_raw or not q_raw.strip():
        return "Guéliz"
    if q_raw in FREQ_MAP:
        return q_raw
    def norm(s: str) -> str:
        return unicodedata.normalize('NFKD', str(s)).encode('ASCII', 'ignore').decode('utf-8').lower()
    q_norm = norm(q_raw)
    for k in FREQ_MAP:
        if norm(k) == q_norm:
            return k
    sorted_keys = sorted(FREQ_MAP.keys(), key=len, reverse=True)
    for k in sorted_keys:
        k_norm = norm(k)
        if len(k_norm) >= 3 and (k_norm in q_norm or q_norm in k_norm):
            return k
    return q_raw
class InvestmentAnalysisInput(BaseModel):
    """Input schema for POST /analyze-investment."""
    sale_price: float = Field(..., gt=0, description="Prix d'achat ou prix demandé (MAD)")
    rental_price_monthly: Optional[float] = Field(
        None,
        ge=0,
        description=(
            "Loyer mensuel (MAD). Optionnel : si fourni, le rapport financier complet "
            "est généré. Sinon, financial_report sera null et le modèle Rental Prediction "
            "sera utilisé dans une phase ultérieure."
        ),
    )
    type_bien: str = Field("Appartement", description="Type de bien pour la stratégie de décision")
    predicted_price: Optional[float] = Field(None, description="Prix prédit par /predict (pour comparaison)")
    property_features: Dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Features géo et propriété pour l'Investment Scorer "
            "(dist_industrial_m, dist_security_m, dist_dam_m, scores accessibilité, etc.)"
        ),
    )


# ── Feature engineering ────────────────────────────────────────────
class LocationInput(BaseModel):
    """Entrée du parcours LOCATION (Estimer un bien → mode Location)."""
    periode: str = Field("mensuel", example="mensuel")  # mensuel | nuitee
    type_bien: str = Field("Appartement", example="Appartement")
    quartier: Optional[str] = Field(None, example="Guéliz")
    commune_officielle: str = Field("Marrakech", example="Marrakech")
    superficie_m2: float = Field(80, example=80)
    chambres: int = Field(2)
    salles_de_bain: int = Field(1)
    nb_etages: int = Field(0)
    salons: int = Field(1)
    capacite: Optional[float] = Field(None)
    equipements: list[str] = Field(default_factory=list)  # ex: ["piscine","parking"]

    def to_payload(self) -> dict:
        d = self.model_dump()
        eq_map = {
            "piscine": "eq_piscine", "parking": "eq_parking",
            "securite": "eq_securite", "ascenseur": "eq_ascenseur",
            "climatisation": "eq_climatisation", "meuble": "eq_meuble",
            "terrasse": "eq_terrasse", "concierge": "eq_concierge",
            "balcon": "eq_balcon", "chauffage": "eq_chauffage",
        }
        for key, feat in eq_map.items():
            d[feat] = 1 if key in d.get("equipements", []) else 0
        return d


def engineer_features(inp: PropertyInput) -> pd.DataFrame:
    d = inp.model_dump()
    # ── 1. Derived ratios ─────────────────────────────────────────
    surf_cons = d["surface_consolidee_m2"] or 1
    surf_hab  = d["surface_habitable_m2"]  or 1
    chambres  = max(d["chambres"], 1)
    pieces    = max(d["total_pieces"], 1)
    salles    = max(d["salles_bain"], 1)

    d["ratio_habitable"]   = d.get("ratio_habitable") or (surf_hab / surf_cons)
    d["ratio_chambres_pieces"] = chambres / pieces
    d["ratio_sdb_chambres_equipee"] = salles / chambres
    d["surface_par_piece"] = surf_cons / pieces
    d["surface_par_chambre"] = surf_cons / chambres

    # ── 2. Équipements ────────────────────────────────────────────
    equip_cols = [
        "equipement_ascenseur", "equipement_balcon", "equipement_chauffage",
        "equipement_climatisation", "equipement_concierge",
        "equipement_cuisine_equipee", "equipement_meuble", "equipement_parking",
        "equipement_securite", "equipement_terrasse", "equipement_piscine",
        "equipement_jardin",
    ]
    nb_equip = sum(d.get(c, 0) or 0 for c in equip_cols)
    d["nb_equipements"] = nb_equip

    if d.get("score_equipements_calcule") is None:
        d["score_equipements_calcule"] = nb_equip

    d["is_haut_standing"] = int(
        nb_equip >= 5
        or d.get("equipement_piscine", 0)
        or d.get("equipement_jardin", 0)
    )
    d["is_meuble_equipe"] = int(
        d.get("equipement_meuble", 0) == 1
        and d.get("equipement_cuisine_equipee", 0) == 1
    )

    # ── 3. Distances agrégées ─────────────────────────────────────
    services_cols = [
        "distance_nearest_bank", "distance_nearest_hospital",
        "distance_nearest_pharmacy", "distance_nearest_school",
        "distance_nearest_supermarket",
    ]
    transport_cols = [
        "distance_nearest_bus_stop", "distance_nearest_transport_route",
        "distance_nearest_motorway", "distance_nearest_primary_road",
        "distance_nearest_secondary_road",
    ]
    essentiels_cols = [
        "distance_nearest_restaurant", "distance_nearest_park",
        "distance_nearest_commodites",
    ]

    if d.get("distance_services_moyenne") is None:
        vals = [d.get(c, 0) for c in services_cols]
        d["distance_services_moyenne"] = float(np.mean(vals)) if vals else 0.0

    if d.get("distance_transport_moyenne") is None:
        vals = [d.get(c, 0) for c in transport_cols]
        d["distance_transport_moyenne"] = float(np.mean(vals)) if vals else 0.0

    d["distance_essentiels_moyenne"] = float(
        np.mean([d.get(c, 0) for c in essentiels_cols])
    )

    if d.get("distance_centre_ville") is None:
        d["distance_centre_ville"] = 0.5  # default Marrakech centre

    # ── 4. Score accessibilité moyen ─────────────────────────────
    acc_cols = [
        "score_accessibilite_sante", "score_accessibilite_education",
        "score_accessibilite_transport", "score_accessibilite_commerces",
        "score_accessibilite_loisirs", "score_accessibilite_services",
        "score_accessibilite_religieux",
    ]
    d["score_accessibilite_moyen"] = float(
        np.mean([d.get(c, 0) for c in acc_cols])
    )

    # ── 5. Saisonnalité cyclique ──────────────────────────────────
    mois = d.get("mois", 7)
    d["mois_sin"] = math.sin(2 * math.pi * mois / 12)
    d["mois_cos"] = math.cos(2 * math.pi * mois / 12)

    # ── 6. Geo cluster (KMeans) ───────────────────────────────────
    coords_df = pd.DataFrame([{"latitude": d["latitude"], "longitude": d["longitude"]}])
    d["geo_cluster"] = str(int(KMEANS.predict(coords_df)[0]))

    # ── 7. Fréquence du quartier ──────────────────────────────────
    q_raw = d.get("localisation_quartier", "")
    resolved_q = resolve_quartier_name(q_raw)
    d["localisation_quartier"] = resolved_q
    d["localisation_quartier_freq"] = FREQ_MAP.get(resolved_q, FREQ_MAP.get(q_raw, 0.001))

    # ── Build ordered DataFrame ────────────────────────────────────
    row = {}
    for col in FEATURE_COLS:
        row[col] = d.get(col, 0)

    df = pd.DataFrame([row], columns=FEATURE_COLS)

    # ── Cast categorical columns ───────────────────────────────────
    for col in CAT_FEATURES:
        if col in df.columns:
            df[col] = df[col].astype(str)

    return df


# ── Routes ─────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "MlService",
        "model": "catboost_prix_immobilier",
        "features": len(FEATURE_COLS),
        "geo_clusters": getattr(KMEANS, "n_clusters", "?"),
    }


@app.get("/features")
async def get_features():
    """Retourne la liste des features attendues par le modèle."""
    return {
        "feature_cols": FEATURE_COLS,
        "categorical_features": CAT_FEATURES,
        "cat_idx": CAT_IDX,
        "total": len(FEATURE_COLS),
    }


@app.post("/predict")
async def predict(inp: PropertyInput):
    """
    Prédit le prix d'un bien immobilier.
    """
    try:
        df = engineer_features(inp)
    except Exception as e:
        logger.error("Feature engineering error: %s", e)
        raise HTTPException(status_code=422, detail=f"Erreur feature engineering: {e}")

    try:
        pool = cb.Pool(df, cat_features=CAT_IDX)
        raw_pred = float(MODEL.predict(pool)[0])
    except Exception as e:
        logger.error("Model prediction error: %s", e)
        raise HTTPException(status_code=500, detail=f"Erreur de prédiction: {e}")

    # Si le modèle renvoie le log du prix (raw_pred < 35), on convertit en MAD avec exp()
    if 0 < raw_pred < 35:
        predicted_price = math.exp(raw_pred)
    else:
        predicted_price = max(raw_pred, 0)

    surface = inp.surface_consolidee_m2 or inp.surface_habitable_m2 or 1
    margin = 0.08

    # ── Facteurs d'impact (SHAP CatBoost natif) ─────────────────────
    # Contribution de chaque caractéristique à l'écart au prix attendu.
    # Vert (#1F5C3F) = augmente le prix, Rouge foncé (#7A2E22) = le diminue.
    shap_factors = []
    try:
        pool_shap = cb.Pool(df, cat_features=CAT_IDX)
        shap_vals = MODEL.get_feature_importance(pool_shap, type="ShapValues")
        sv = shap_vals[0][:-1]  # dernière colonne = expected_value (bias)

        LABELS = {
            "surface_habitable_m2": "Surface habitable",
            "surface_consolidee_m2": "Surface consolidée",
            "type_bien": "Type de bien",
            "localisation_quartier": "Quartier",
            "commune_fr": "Commune",
            "total_pieces": "Nombre de pièces",
            "chambres": "Chambres",
            "salles_bain": "Salles de bain",
            "salons": "Salons",
            "etages": "Étages",
            "etage_semantique": "Position étage",
            "geo_cluster": "Zone géographique (KMeans)",
            "localisation_quartier_freq": "Popularité du quartier",
        }
        for key, extra in [
            ("equipement_piscine", "Piscine"), ("equipement_parking", "Parking"),
            ("equipement_securite", "Sécurité"), ("equipement_ascenseur", "Ascenseur"),
            ("equipement_climatisation", "Climatisation"), ("equipement_meuble", "Meublé"),
            ("equipement_terrasse", "Terrasse"), ("equipement_concierge", "Concierge"),
            ("equipement_balcon", "Balcon"), ("equipement_chauffage", "Chauffage"),
        ]:
            LABELS.setdefault(key, f"Équipement : {extra}")

        idx_of = {c: i for i, c in enumerate(FEATURE_COLS)}
        contributions = []
        # Le modèle prédit le LOG du prix (raw_pred < 35 → exp()).
        # Les SHAP sont alors en espace log : on les convertit en MAD
        # via la dérivée de exp : impact_MAD ≈ prix_prédit × shap_log.
        in_log_space = 0 < raw_pred < 35
        for col in FEATURE_COLS:
            if col == "expected_value" or col not in idx_of:
                continue
            v = float(sv[idx_of[col]])
            if in_log_space:
                v = predicted_price * v
            if abs(v) < max(1.0, abs(predicted_price) * 0.002):
                continue  # ignorer les contributions négligeables (<0.2% du prix)
            contributions.append((col, v))

        contributions.sort(key=lambda t: abs(t[1]), reverse=True)
        for col, v in contributions[:8]:
            shap_factors.append({
                "feature": LABELS.get(col, col),
                "impact_mad": round(v),
                "direction": "up" if v > 0 else "down",
            })
    except Exception as e:
        logger.warning("SHAP indisponible: %s", e)

    return {
        "predicted_price": round(predicted_price),
        "price_per_m2": round(predicted_price / surface),
        "confidence_range": {
            "low":  round(predicted_price * (1 - margin)),
            "high": round(predicted_price * (1 + margin)),
        },
        "shap_factors": shap_factors,
        "inputs_summary": {
            "type_bien":             inp.type_bien,
            "localisation_quartier": inp.localisation_quartier,
            "commune_fr":            inp.commune_fr,
            "surface_m2":            inp.surface_consolidee_m2,
            "geo_cluster":           df["geo_cluster"].iloc[0],
            "quartier_freq":         round(float(df["localisation_quartier_freq"].iloc[0]), 4),
        },
        "currency": "MAD",
        "model_version": "catboost_v1",
    }


# ── POST /analyze-investment ────────────────────────────────────────

@app.post("/analyze-investment")
async def analyze_investment(inp: InvestmentAnalysisInput):
    """
    Analyse d'investissement complète : Risk + Financial + Investment + Decision.

    rental_price_monthly est optionnel :
      - Si fourni → rapport financier complet (yield, cashflow, ROI, Monte Carlo)
      - Si absent → financial_report = null, rental_data_source = "not_provided"
      - Aucun fallback automatique (pas de 5% du prix)
    """
    from intelligence.risk_intelligence import score_risk_row
    from intelligence.financial_intelligence import FinancialIntelligenceModel
    from intelligence.investment_scorer import InvestmentScorer
    from intelligence.decision_strategies import get_strategy

    pf = inp.property_features or {}

    # ── 1. Risk Assessment ──────────────────────────────────────────
    dist_industrial = float(pf.get("dist_industrial_m", 15000))
    dist_security = float(pf.get("dist_security_m", 10000))
    dist_dam = float(pf.get("dist_dam_m", 25000))

    risk_result = score_risk_row(
        dist_industrial_m=dist_industrial,
        dist_security_m=dist_security,
        dist_dam_m=dist_dam,
    )
    logger.info("[RISK] global_risk_score=%.1f", risk_result["global_risk_score"])

    # ── 2. Financial Intelligence (conditionnel au loyer) ───────────
    financial_report = None
    rental_data_source = "not_provided"
    financial_score = 50.0  # Score neutre quand pas de loyer

    if inp.rental_price_monthly is not None and inp.rental_price_monthly > 0:
        rental_data_source = "user_provided"
        try:
            fin_model = FinancialIntelligenceModel(
                sale_price=inp.sale_price,
                rental_price_monthly=inp.rental_price_monthly,
            )
            financial_report = fin_model.generate_full_report()
            financial_score = financial_report["financial_score"]
            logger.info("[FIN] financial_score=%.1f (loyer=%.0f MAD/mois)",
                        financial_score, inp.rental_price_monthly)
        except Exception as e:
            logger.error("[FIN] Erreur calcul financier: %s", e)
            financial_report = None
            financial_score = 50.0
    else:
        logger.info("[FIN] Pas de loyer fourni → financial_report=null, score neutre=50")

    # ── 3. Investment Scorer (with ML v5.2 models) ─────────────────
    scorer = InvestmentScorer(
        ml_models={
            "location_map": LOCATION_MAP,
            "h3_resolution": H3_RESOLUTION,
            "iso_forest": ISO_FOREST,
            "iso_features": ISO_FEATURES,
        }
    )
    score_result = scorer.compute_all_scores(pf, type_bien=inp.type_bien)
    logger.info("[INV] investment_score=%.1f", score_result["investment_score"])

    # Extract location intelligence metadata
    loc_details = score_result.get("details", {}).get("location_score", {})
    location_source = loc_details.get("location_source", "RULE_BASED")
    neighborhood_type = loc_details.get("neighborhood_type")
    logger.info("[LOC] source=%s, neighborhood=%s", location_source, neighborhood_type)

    # Extract spatial anomaly result
    risk_details = score_result.get("details", {}).get("environmental_risk_score", {})
    spatial_anomaly = risk_details.get("spatial_anomaly")

    # ── 4. Decision Engine (Strategy Pattern) ──────────────────────
    strategy = get_strategy(inp.type_bien)

    loc_score = score_result.get("location_score", 50.0)
    mkt_score = score_result.get("market_score", 50.0)
    risk_score_val = risk_result["global_risk_score"]

    # Cash flow mensuel (0 si pas de loyer)
    monthly_cf = 0.0
    prob_loss = 0.0
    if financial_report:
        monthly_cf = financial_report.get("financing_cashflow", {}).get("monthly_cash_flow", 0.0)
        prob_loss = financial_report.get("scenarios", {}).get("dispersion", {}).get("probability_of_loss_pct", 0.0)

    overall_score, decision, cash_flow_penalty = strategy.evaluate(
        fin_score=financial_score,
        loc_score=loc_score,
        mkt_score=mkt_score,
        risk_score=risk_score_val,
        monthly_cf=monthly_cf,
        prob_loss=prob_loss,
    )

    # Explication textuelle
    explanation_text = strategy.build_why_text(
        decision=decision,
        overall_score=overall_score,
        fin_report=financial_report or {
            "yield": {"gross_yield_pct": 0, "net_yield_pct": 0},
            "roi": {"annualized_roi_pct": 0},
        },
        monthly_cf=monthly_cf,
        cash_flow_penalty=cash_flow_penalty,
        prob_loss=prob_loss,
        risk_score=risk_score_val,
        score_result=score_result,
        urban=None,
        collectivites=None,
    )

    return {
        "overall_score": overall_score,
        "decision": decision,
        "explanation_text": explanation_text,
        "rental_data_source": rental_data_source,
        "financial_report": financial_report,
        "risk_assessment": risk_result,
        "spatial_anomaly": spatial_anomaly,
        "investment_scores": {
            "investment_score": score_result["investment_score"],
            "location_score": loc_score,
            "location_source": location_source,
            "neighborhood_type": neighborhood_type,
            "market_score": mkt_score,
            "development_score": score_result.get("development_score", 50.0),
            "accessibility_score": score_result.get("accessibility_score", 50.0),
            "urban_planning_score": score_result.get("urban_planning_score", 50.0),
            "tourism_score": score_result.get("tourism_score", 30.0),
            "overall_risk_level": score_result.get("overall_risk_level", "MEDIUM"),
            "recommendation": score_result.get("recommendation", "INVESTIGATE_FURTHER"),
            "explanation": score_result.get("explanation", {}),
        },
        "pillars": {
            "financial_score": financial_score,
            "market_score": mkt_score,
            "location_score": loc_score,
            "risk_score": risk_score_val,
        },
    }


# ── Routes LOCATION (XGBoost + régression quantile) ────────────────

_LOCATION_LOADED_CACHE: set = set()


@app.post("/location/predict")
async def predict_location(inp: LocationInput):
    """
    Prédit le prix de LOCATION d'un bien.
    periode='mensuel' -> loyer mensuel ; periode='nuitee' -> prix par nuit.
    Retourne le prix, la fourchette quantile 10–90 % et les contributions SHAP.
    """
    try:
        models = get_location_models(inp.periode)
        _LOCATION_LOADED_CACHE.add(inp.periode)
    except Exception as e:
        logger.error("Location model load error: %s", e)
        raise HTTPException(status_code=500, detail=f"Modèle location indisponible: {e}")

    try:
        return models.predict(inp.to_payload())
    except Exception as e:
        logger.error("Location prediction error: %s", e)
        raise HTTPException(status_code=422, detail=f"Erreur de prédiction location: {e}")


@app.get("/location/health")
async def health_location():
    return {
        "status": "ok",
        "service": "MlService",
        "models": ["model_mensuel", "model_mensuel_quantile",
                    "model_nuitee", "model_nuitee_quantile"],
        "loaded": sorted(_LOCATION_LOADED_CACHE),
    }


@app.get("/")
async def root():
    return {
        "service": "Orchid Island ML Prediction Service",
        "version": "2.0.0",
        "endpoints": {
            "GET  /health":              "Health check",
            "GET  /features":            "Liste des features du modèle",
            "POST /predict":             "Prédiction de prix (CatBoost)",
            "POST /analyze-investment":   "Analyse d'investissement (Risk + Financial + Decision)",
        },
    }


# ── Entrypoint ─────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
