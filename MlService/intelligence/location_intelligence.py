"""
Location Intelligence — production helpers.

The Colab v5 blend (Ridge 0.4 / LightGBM 0.5 / KNN 0.1) is trained offline.
This module provides:
  - Hansen gravity accessibility
  - a transparent location_score proxy from gravity + POI mix
  - ranking metrics for evaluating a trained score against prix/m²
"""
from __future__ import annotations

from typing import Iterable, Optional, Sequence

import numpy as np
import pandas as pd


def hansen_gravity(distances_m: Sequence[float], beta: float = 0.001, weights: Optional[Sequence[float]] = None) -> float:
    """Hansen accessibility: sum w * exp(-beta * d). distances in meters."""
    d = np.asarray(distances_m, dtype=float)
    if d.size == 0:
        return 0.0
    w = np.ones_like(d) if weights is None else np.asarray(weights, dtype=float)
    return float(np.sum(w * np.exp(-beta * np.clip(d, 0, None))))


def poi_entropy(counts_by_category: Sequence[float]) -> float:
    """Shannon entropy of POI mix (nats). Higher = more diverse."""
    c = np.asarray(counts_by_category, dtype=float)
    c = c[c > 0]
    if c.size == 0:
        return 0.0
    p = c / c.sum()
    return float(-np.sum(p * np.log(p)))


def location_score_from_gravity(
    grav_features: dict,
    nb_pois_1km: float = 0,
    entropie_poi_1km: Optional[float] = None,
) -> dict:
    """
    Transparent 0-100 proxy used when the v5 joblib blend is not loaded.

    Uses mean of available grav_* features (already Hansen-decayed),
    plus density/diversity bonuses. Not a substitute for the OOF blend.
    """
    grav_vals = [float(v) for k, v in grav_features.items() if k.startswith("grav_") and v is not None]
    if not grav_vals:
        base = 40.0
    else:
        g = np.array(grav_vals)
        # rank-like squash so a few large gravities do not explode
        base = 20.0 + 60.0 * (1.0 - np.exp(-float(np.mean(g))))

    density_bonus = 15.0 * (1.0 - np.exp(-max(nb_pois_1km, 0) / 40.0))
    entropy = entropie_poi_1km if entropie_poi_1km is not None else poi_entropy(grav_vals or [1.0])
    diversity_bonus = 10.0 * (1.0 - np.exp(-entropy / 1.5))
    score = float(np.clip(base + density_bonus + diversity_bonus, 0, 100))
    return {
        "location_score": round(score, 1),
        "location_source": "RULE_BASED",
        "neighborhood_type": None,
        "hotspot": None,
        "fiabilite": None,
        "n_gravity_features": len(grav_vals),
        "density_bonus": round(float(density_bonus), 2),
        "diversity_bonus": round(float(diversity_bonus), 2),
        "method": "gravity_proxy_v1",
    }


def location_score_from_ml(
    latitude: float,
    longitude: float,
    location_map: dict,
    h3_resolution: int = 8,
    grav_features: Optional[dict] = None,
    nb_pois_1km: float = 0,
    entropie_poi_1km: Optional[float] = None,
) -> dict:
    """
    Location score from pre-computed ML v5.2 data via H3 lookup.

    1. Compute H3 cell index from lat/lng at the training resolution
    2. Look up the cell in LOCATION_MAP (dict from parquet)
    3. If found → return ML score + metadata (source = ML_V5_2)
    4. If not found → fallback to gravity_proxy (source = RULE_BASED)
    """
    import h3 as h3_lib

    try:
        h3_index = h3_lib.latlng_to_cell(latitude, longitude, h3_resolution)
    except Exception:
        # Fallback if h3 computation fails
        return location_score_from_gravity(
            grav_features=grav_features or {},
            nb_pois_1km=nb_pois_1km,
            entropie_poi_1km=entropie_poi_1km,
        )

    cell_data = location_map.get(h3_index)

    if cell_data is not None:
        # ML v5.2 hit — use pre-computed score
        strengths = []
        if cell_data.get("neighborhood_type") or cell_data.get("typo_nom"):
            ntype = cell_data.get("typo_nom", "")
            strengths.append(f"Localisation dans un {ntype.lower()}")
        if cell_data.get("hotspot") == "hot":
            strengths.append("Zone identifiée comme hotspot")
        if cell_data.get("fiabilite") and cell_data["fiabilite"] > 0.9:
            strengths.append(f"Score ML fiable ({cell_data['fiabilite']:.0%})")

        return {
            "location_score": round(cell_data["score"], 1),
            "location_source": "ML_V5_2",
            "neighborhood_type": cell_data.get("typo_nom"),
            "hotspot": cell_data.get("hotspot"),
            "fiabilite": cell_data.get("fiabilite"),
            "tranche_score": cell_data.get("tranche_score"),
            "h3_cell": h3_index,
            "strengths": strengths,
            "method": "location_intelligence_v5_2",
        }
    else:
        # H3 cell not in map (outside trained coverage, e.g. not Marrakech)
        result = location_score_from_gravity(
            grav_features=grav_features or {},
            nb_pois_1km=nb_pois_1km,
            entropie_poi_1km=entropie_poi_1km,
        )
        result["h3_cell"] = h3_index
        return result


def ndcg_at_k(y_true: Sequence[float], y_score: Sequence[float], k: int = 10) -> float:
    """NDCG@k for ranking evaluation (higher true value = more relevant)."""
    y_true = np.asarray(y_true, dtype=float)
    y_score = np.asarray(y_score, dtype=float)
    if len(y_true) == 0:
        return 0.0
    k = min(k, len(y_true))
    order = np.argsort(-y_score)[:k]
    gains = y_true[order]
    discounts = 1.0 / np.log2(np.arange(2, k + 2))
    dcg = float(np.sum(gains * discounts))
    ideal = np.sort(y_true)[::-1][:k]
    idcg = float(np.sum(ideal * discounts))
    return 0.0 if idcg == 0 else dcg / idcg


def spearman_safe(a: Sequence[float], b: Sequence[float]) -> float:
    from scipy.stats import spearmanr

    if len(a) < 3:
        return float("nan")
    r, _ = spearmanr(a, b)
    return float(r)
