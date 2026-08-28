import os
import logging
import requests
from typing import Dict, List

logger = logging.getLogger(__name__)

# Fallback values for routing categories
DEFAULT_DISTANCES = {
    "commodites": 400.0,
    "transport_route": 500.0,
    "bank": 550.0,
    "bus_stop": 300.0,
    "hospital": 850.0,
    "motorway": 4000.0,
    "park": 600.0,
    "pharmacy": 300.0,
    "primary_road": 500.0,
    "restaurant": 250.0,
    "school": 450.0,
    "secondary_road": 350.0,
    "supermarket": 350.0,
    "industrial": 8000.0,
    "security": 1200.0,
}

# Mapping between Mapbox names and ML names
MAPBOX_TO_ML_MAPPING = {
    "bank": "distance_nearest_bank",
    "bus_station": "distance_nearest_bus_stop",
    "hospital": "distance_nearest_hospital",
    "park": "distance_nearest_park",
    "pharmacy": "distance_nearest_pharmacy",
    "restaurant": "distance_nearest_restaurant",
    "school": "distance_nearest_school",
    "supermarket": "distance_nearest_supermarket"
}

def get_routing_distances(origin_lat: float, origin_lon: float, poi_coordinates: Dict[str, list]) -> Dict[str, float]:
    """
    Calcule les distances routières vers une liste de POIs.
    Utilise Mapbox Matrix API si le token est présent, sinon retourne un mock.
    poi_coordinates: dict de { 'bank': [lon, lat], ... }
    """
    token = os.getenv("MAPBOX_ACCESS_TOKEN")
    distances_result = {
        "dist_dam_m": 25000.0  # Constant mock for now, usually requires specialized shapefile
    }

    # Initialize all required ML features with default/fallback values
    for category, fallback in DEFAULT_DISTANCES.items():
        ml_key = MAPBOX_TO_ML_MAPPING.get(category, f"distance_nearest_{category}")
        if ml_key not in distances_result:
            distances_result[ml_key] = fallback
    distances_result["dist_industrial_m"] = DEFAULT_DISTANCES["industrial"]
    distances_result["dist_security_m"] = DEFAULT_DISTANCES["security"]

    if not poi_coordinates:
        return distances_result
        
    if not token or token == "your_mapbox_token_here":
        logger.info("[MOCK] Calcul des distances routières (MAPBOX_ACCESS_TOKEN non configuré)")
        return _mock_distances(distances_result, poi_coordinates)
        
    logger.info(f"[REAL] Appel à Mapbox Matrix API avec {len(poi_coordinates)} destinations...")
    
    # Prépare les coordonnées : origine + toutes les destinations
    destinations_keys = list(poi_coordinates.keys())
    
    # Mapbox Matrix limite: max 25 points.
    # [lon, lat]
    coords = [f"{origin_lon},{origin_lat}"] 
    for k in destinations_keys:
        coords.append(f"{poi_coordinates[k][0]},{poi_coordinates[k][1]}")
        
    coordinates_str = ";".join(coords)
    # L'origine est l'index 0, les destinations vont de 1 à N
    destinations_indices = ";".join(str(i) for i in range(1, len(coords)))
    
    url = f"https://api.mapbox.com/directions-matrix/v1/mapbox/driving/{coordinates_str}"
    params = {
        "sources": "0",
        "destinations": destinations_indices,
        "annotations": "distance",
        "access_token": token
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if "distances" in data and len(data["distances"]) > 0:
            distances_array = data["distances"][0] # Distances depuis la source 0
            
            for idx, key in enumerate(destinations_keys):
                dist = distances_array[idx]
                if dist is not None:
                    # Map to ML expected key
                    ml_key = MAPBOX_TO_ML_MAPPING.get(key, f"distance_nearest_{key}")
                    if key in ["police"]:
                        ml_key = "dist_security_m"
                    elif key in ["industrial"]:
                        ml_key = "dist_industrial_m"
                        
                    distances_result[ml_key] = dist
                    
    except Exception as e:
        logger.error(f"Erreur API Mapbox: {e}")
        # En cas d'erreur réseau, les valeurs par défaut sont renvoyées

    return distances_result

def _mock_distances(base_result: Dict[str, float], poi_coordinates: Dict[str, list]) -> Dict[str, float]:
    """Applique des valeurs mockées pour les POIs trouvés."""
    for key in poi_coordinates.keys():
        ml_key = MAPBOX_TO_ML_MAPPING.get(key, f"distance_nearest_{key}")
        if key in ["police"]:
            ml_key = "dist_security_m"
        elif key in ["industrial"]:
            ml_key = "dist_industrial_m"
            
        base_result[ml_key] = 300.0 # Distance standard simulée
    return base_result
