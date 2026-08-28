"""
Market Intelligence — relative pricing signals at H3 / listing grain.

value_opportunity_score is an anomaly to investigate, not a guaranteed deal.
Always display scores with market_confidence.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Optional

import numpy as np
import pandas as pd


def normalize_quartier(name) -> str:
    if pd.isna(name) or not isinstance(name, str):
        return "inconnu"
    text = unicodedata.normalize("NFD", name)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", "_", text.strip())
    text = re.sub(r"_a_marrakech$", "", text)
    text = re.sub(r"_marrakech$", "", text)
    return text or "inconnu"


def _minmax(series: pd.Series, q_low: float = 0.05, q_high: float = 0.95) -> pd.Series:
    lo = series.quantile(q_low)
    hi = series.quantile(q_high)
    if hi <= lo:
        return pd.Series(np.full(len(series), 0.5), index=series.index)
    return ((series - lo) / (hi - lo)).clip(0, 1)


def score_market(
    df: pd.DataFrame,
    prix_m2_col: str = "prix_m2",
    cell_col: str = "h3_cell",
    id_col: str = "id",
) -> pd.DataFrame:
    """Add neighborhood premium, value opportunity, confidence, global score."""
    out = df.copy()
    if "quartier" in out.columns:
        out["quartier_normalized"] = out["quartier"].apply(normalize_quartier)

    out["prix_m2_median_cell"] = out.groupby(cell_col)[prix_m2_col].transform("median")
    n = out.groupby(cell_col)[prix_m2_col].transform("count")
    cell_sum = out.groupby(cell_col)[prix_m2_col].transform("sum")
    # Leave-one-out mean so a listing is not compared to a cell that includes itself
    loo_mean = (cell_sum - out[prix_m2_col]) / (n - 1)
    out["prix_m2_mean_cell_loo"] = loo_mean.where(n > 1, out[prix_m2_col])

    out["neighborhood_premium_score"] = (_minmax(out["prix_m2_median_cell"]) * 100).round(1)

    denom = out["prix_m2_mean_cell_loo"].replace(0, np.nan)
    out["ratio_vs_cell"] = (out[prix_m2_col] / denom).fillna(1.0)
    ratio_min, ratio_max = 0.70, 1.30
    out["value_opportunity_score"] = (
        ((ratio_max - out["ratio_vs_cell"]) / (ratio_max - ratio_min)).clip(0, 1) * 100
    ).round(1)

    count_col = id_col if id_col in out.columns else prix_m2_col
    out["n_listings_cell"] = out.groupby(cell_col)[count_col].transform("count")
    n_scale = _minmax(out["n_listings_cell"], 0.10, 0.90)
    out["market_confidence"] = (n_scale * 80 + 20).round(0)

    out["global_market_score"] = (
        out["neighborhood_premium_score"] * 0.5 + out["value_opportunity_score"] * 0.5
    ).round(1)

    bins = [0, 20, 40, 60, 80, 100.1]
    labels = ["0-20 Deprecie", "20-40 Modeste", "40-60 Moyen", "60-80 Attractive", "80-100 Premium"]
    out["market_tranche"] = pd.cut(out["global_market_score"], bins=bins, labels=labels, right=False)
    return out


def score_single_listing(
    prix_m2: float,
    cell_median_prix_m2: float,
    n_listings_cell: int,
    city_p05_median: float,
    city_p95_median: float,
    n_p10: float = 5,
    n_p90: float = 80,
) -> dict:
    """Point inference when a full dataframe is not available."""
    if cell_median_prix_m2 <= 0 or prix_m2 <= 0:
        raise ValueError("prix_m2 and cell median must be > 0")
    span = max(city_p95_median - city_p05_median, 1.0)
    premium = float(np.clip((cell_median_prix_m2 - city_p05_median) / span, 0, 1) * 100)
    ratio = prix_m2 / cell_median_prix_m2
    opportunity = float(np.clip((1.30 - ratio) / 0.60, 0, 1) * 100)
    n_span = max(n_p90 - n_p10, 1.0)
    confidence = float(np.clip((n_listings_cell - n_p10) / n_span, 0, 1) * 80 + 20)
    global_score = round(0.5 * premium + 0.5 * opportunity, 1)
    return {
        "neighborhood_premium_score": round(premium, 1),
        "value_opportunity_score": round(opportunity, 1),
        "market_confidence": round(confidence, 0),
        "global_market_score": global_score,
        "ratio_vs_cell": round(ratio, 3),
    }
