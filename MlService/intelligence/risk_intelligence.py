"""
Risk Intelligence — relative environmental / isolation index (not a loss probability).

industrial / dam: closer = riskier.
emergency_vulnerability: farther from fire/police = more vulnerable.
global_risk_score is scaled as a relative index, typically 20-80 on real OSM data.
"""
from __future__ import annotations

from typing import Iterable, Optional

import numpy as np
import pandas as pd


def linear_risk(dist: float, min_dist: float, max_dist: float, invert: bool = False) -> float:
    """0-100 interpolation. invert=True → farther is riskier."""
    if max_dist <= min_dist:
        return 50.0
    if invert:
        raw = (dist - min_dist) / (max_dist - min_dist)
    else:
        raw = (max_dist - dist) / (max_dist - min_dist)
    return float(np.clip(raw * 100, 0, 100))


def score_risk_row(
    dist_industrial_m: float,
    dist_security_m: float,
    dist_dam_m: float,
) -> dict:
    industrial = linear_risk(dist_industrial_m, 200, 20000, invert=False)
    emergency = linear_risk(dist_security_m, 500, 20000, invert=True)
    environmental = linear_risk(dist_dam_m, 5000, 50000, invert=False)
    global_score = round(industrial * 0.5 + emergency * 0.3 + environmental * 0.2, 2)
    min_osm = min(dist_industrial_m, dist_security_m)
    confidence = float(np.clip((30000 - np.clip(min_osm, 500, 30000)) / (30000 - 500) * 80 + 20, 20, 100))
    return {
        "industrial_risk_score": round(industrial, 1),
        "emergency_vulnerability_score": round(emergency, 1),
        "environmental_risk_score": round(environmental, 1),
        "global_risk_score": global_score,
        "risk_confidence": round(confidence, 0),
    }


def score_risk_frame(df: pd.DataFrame) -> pd.DataFrame:
    required = ("dist_industrial_m", "dist_security_m", "dist_dam_m")
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}")
    out = df.copy()
    rows = [
        score_risk_row(r.dist_industrial_m, r.dist_security_m, r.dist_dam_m)
        for r in out.itertuples(index=False)
    ]
    scored = pd.DataFrame(rows, index=out.index)
    out = pd.concat([out, scored], axis=1)
    min_any = out[list(required)].min(axis=1)
    q05, q95 = min_any.quantile(0.05), min_any.quantile(0.95)
    span = max(q95 - q05, 1.0)
    out["spatial_isolation_score"] = ((min_any - q05) / span).clip(0, 1).mul(100).round(1)
    return out


def detect_spatial_anomalies(
    df: pd.DataFrame,
    feature_cols: Iterable[str] = ("dist_industrial_m", "dist_security_m", "dist_dam_m"),
    contamination: float = 0.05,
    random_state: int = 42,
) -> pd.DataFrame:
    from sklearn.ensemble import IsolationForest

    out = df.copy()
    X = out[list(feature_cols)].values
    iso = IsolationForest(n_estimators=200, contamination=contamination, random_state=random_state)
    preds = iso.fit_predict(X)
    out["is_atypical_profile"] = (preds == -1).astype(int)
    out["spatial_risk_profile_anomaly"] = iso.decision_function(X)
    return out


def detect_anomaly_single(
    property_features: dict,
    iso_forest,
    feature_names: list[str] = ("dist_industrial_m", "dist_security_m", "dist_dam_m"),
) -> dict:
    """
    Détection d'anomalie spatiale pour un SEUL bien via un Isolation Forest pré-chargé.

    Retourne un objet explicable avec anomalie calibrée :
      - spatial_anomaly: True/False/None
      - spatial_anomaly_score: float (négatif = plus anormal)
      - risk_source: "ML_ISOLATION_FOREST" ou "RULE_BASED"
      - risk_adjustment: int (pénalité calibrée, 0 si normal)
      - warnings: list[str]
    """
    # Vérifier que les 3 features sont présentes et non-null
    missing = [f for f in feature_names if property_features.get(f) is None]
    if missing:
        return {
            "spatial_anomaly": None,
            "spatial_anomaly_score": None,
            "risk_source": "RULE_BASED",
            "risk_adjustment": 0,
            "warnings": [
                f"Isolation Forest non exécuté : features géospatiales manquantes ({', '.join(missing)})"
            ],
        }

    # Construire le vecteur de features dans l'ORDRE EXACT du training
    try:
        X = np.array([[float(property_features[f]) for f in feature_names]])
    except (ValueError, TypeError) as e:
        return {
            "spatial_anomaly": None,
            "spatial_anomaly_score": None,
            "risk_source": "RULE_BASED",
            "risk_adjustment": 0,
            "warnings": [f"Isolation Forest non exécuté : erreur de conversion ({e})"],
        }

    # Inférence
    prediction = int(iso_forest.predict(X)[0])        # -1 = anomalie, 1 = normal
    anomaly_score = float(iso_forest.decision_function(X)[0])  # négatif = plus anormal

    is_anomaly = prediction == -1

    # Calibration progressive de la pénalité
    # anomaly_score est typiquement entre -0.5 (très anormal) et +0.3 (très normal)
    # On ne pénalise que les anomalies, et proportionnellement à leur sévérité
    if is_anomaly:
        # Score négatif → pénalité proportionnelle, bornée entre 5 et 20
        risk_adjustment = int(min(20, max(5, abs(anomaly_score) * 50)))
    else:
        risk_adjustment = 0

    warnings = []
    if is_anomaly:
        warnings.append(
            f"Profil spatial atypique détecté par l'IA (score: {anomaly_score:.3f})"
        )

    return {
        "spatial_anomaly": is_anomaly,
        "spatial_anomaly_score": round(anomaly_score, 4),
        "risk_source": "ML_ISOLATION_FOREST",
        "risk_adjustment": risk_adjustment,
        "warnings": warnings,
    }

