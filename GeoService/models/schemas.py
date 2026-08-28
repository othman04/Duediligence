from pydantic import BaseModel, Field
from typing import Dict, Optional

class GeoEnrichmentRequest(BaseModel):
    latitude: float = Field(..., description="Latitude du bien immobilier", example=31.63)
    longitude: float = Field(..., description="Longitude du bien immobilier", example=-7.99)

class Distances(BaseModel):
    distance_nearest_commodites: float = Field(default=3000.0)
    distance_nearest_transport_route: float = Field(default=3000.0)
    distance_nearest_bank: float = Field(default=3000.0)
    distance_nearest_bus_stop: float = Field(default=3000.0)
    distance_nearest_hospital: float = Field(default=3000.0)
    distance_nearest_motorway: float = Field(default=3000.0)
    distance_nearest_park: float = Field(default=3000.0)
    distance_nearest_pharmacy: float = Field(default=3000.0)
    distance_nearest_primary_road: float = Field(default=3000.0)
    distance_nearest_restaurant: float = Field(default=3000.0)
    distance_nearest_school: float = Field(default=3000.0)
    distance_nearest_secondary_road: float = Field(default=3000.0)
    distance_nearest_supermarket: float = Field(default=3000.0)
    distance_centre_ville: float = Field(default=5000.0)
    dist_industrial_m: float = Field(default=10000.0)
    dist_security_m: float = Field(default=10000.0)
    dist_dam_m: float = Field(default=30000.0)

class POIRadiusBreakdown(BaseModel):
    """Données POI pour un rayon donné."""
    nb_pois: int = Field(default=0)
    counts_by_category: Dict[str, int] = Field(default_factory=dict)
    grav_features: Dict[str, float] = Field(default_factory=dict)
    entropie: float = Field(default=0.0)
    accessibility_scores: Dict[str, float] = Field(default_factory=dict)

class POIs(BaseModel):
    # Rayon principal 1 km (compatibilité ML)
    nb_pois_1km: int = Field(default=0)
    entropie_poi_1km: float = Field(default=0.0)
    grav_features: Dict[str, float] = Field(default_factory=dict)
    counts_by_category: Dict[str, int] = Field(default_factory=dict)
    # Rayon 300 m (micro-environnement)
    nb_pois_300m: int = Field(default=0)
    entropie_poi_300m: float = Field(default=0.0)
    counts_by_category_300m: Dict[str, int] = Field(default_factory=dict)
    grav_features_300m: Dict[str, float] = Field(default_factory=dict)
    # Diagnostic
    overpass_success: bool = Field(default=False)

class AccessibilityScores(BaseModel):
    score_accessibilite_globale: float = Field(default=0.0)
    score_accessibilite_sante: float = Field(default=0.0)
    score_accessibilite_education: float = Field(default=0.0)
    score_accessibilite_transport: float = Field(default=0.0)
    score_accessibilite_commerces: float = Field(default=0.0)
    score_accessibilite_loisirs: float = Field(default=0.0)
    score_accessibilite_services: float = Field(default=0.0)
    score_accessibilite_religieux: float = Field(default=0.0)

class GeoEnrichmentResponse(BaseModel):
    h3_index_res9: str = Field(..., description="Index spatial H3 pour mise en cache")
    distances_m: Distances
    pois: POIs
    accessibility_scores_0_100: AccessibilityScores
    is_mocked: bool = Field(default=False, description="Indique si les données proviennent d'un mock")
