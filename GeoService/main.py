import os
import sys
from pathlib import Path
import logging

GEO_DIR = Path(__file__).parent
if str(GEO_DIR) not in sys.path:
    sys.path.insert(0, str(GEO_DIR))

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from models.schemas import (
    GeoEnrichmentRequest, 
    GeoEnrichmentResponse, 
    Distances, 
    POIs, 
    AccessibilityScores
)
from services.h3_service import get_h3_index
from services.osm_service import discover_pois_dual, discover_risk_distances
from services.mapbox_service import get_routing_distances

# Chargement des variables d'environnement
load_dotenv()

# Configuration du logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("geo_service")

# MongoDB connection settings
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/dueDillegenceDB")
mongo_client = None
db = None
geo_cache = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global mongo_client, db, geo_cache
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        db = mongo_client.get_database() # Uses database name from URI, or defaults
        geo_cache = db["geo_cache"]
        logger.info("✅ Connecté à MongoDB (GeoCache)")
    except Exception as e:
        logger.warning(f"⚠️ Erreur de connexion MongoDB: {e}")
    yield
    if mongo_client:
        mongo_client.close()

# Initialisation de l'application FastAPI
app = FastAPI(
    title="Orchid Island — Geo Enrichment Service",
    description="Microservice de découverte de POIs et routage (OSM + Mapbox) avec cache H3",
    version="1.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "GeoService",
        "mapbox_configured": os.getenv("MAPBOX_ACCESS_TOKEN") is not None,
        "mongo_connected": mongo_client is not None
    }

@app.post("/enrich", response_model=GeoEnrichmentResponse)
async def enrich_location(request: GeoEnrichmentRequest):
    """
    Enrichit une coordonnée géographique avec les distances et scores attendus par le ML.
    Utilise un cache MongoDB basé sur l'index H3 pour minimiser les appels OSM/Mapbox.
    """
    try:
        # 1. Calcul de l'index spatial H3 (Clé du cache)
        h3_index = get_h3_index(request.latitude, request.longitude)
        
        # 2. Vérification du cache MongoDB
        if geo_cache is not None:
            try:
                cached_data = await geo_cache.find_one({"h3_index_res9": h3_index}, max_time_ms=3000)
                if cached_data:
                    logger.info(f"[CACHE] Hit pour {h3_index}")
                    cached_data.pop('_id', None)
                    return GeoEnrichmentResponse(**cached_data)
            except Exception as cache_error:
                # Le cache MongoDB est optionnel : OSM doit rester disponible
                # même lorsque le DNS ou le réseau MongoDB est indisponible.
                logger.warning(f"[CACHE] Lecture ignorée: {cache_error}")
        
        logger.info(f"[API] Miss pour {h3_index}, appel OSM/Mapbox")
        
        # 3. Découverte des POIs via OSM / Overpass — 1km + 300m en un seul appel
        osm_data = discover_pois_dual(request.latitude, request.longitude)
        
        # 4. Calcul des routages via Mapbox Matrix API (si token configuré)
        distances_data = get_routing_distances(
            request.latitude, 
            request.longitude, 
            osm_data.get("poi_coordinates", {})
        )
        
        # 5. Distances de risque via Overpass (industrial, security, dam)
        risk_distances = discover_risk_distances(request.latitude, request.longitude)
        distances_data["dist_industrial_m"] = risk_distances["dist_industrial_m"]
        distances_data["dist_security_m"]   = risk_distances["dist_security_m"]
        distances_data["dist_dam_m"]        = risk_distances["dist_dam_m"]
        
        # Distance au centre-ville depuis OSM
        distances_data["distance_centre_ville"] = osm_data.get("distance_centre_ville", 5000.0)
        
        # 6. Formatage de la réponse — inclut les deux rayons
        response_dict = {
            "h3_index_res9": h3_index,
            "distances_m": distances_data,
            "pois": {
                # 1 km (ML)
                "nb_pois_1km":        osm_data["nb_pois_1km"],
                "entropie_poi_1km":   osm_data["entropie_poi_1km"],
                "grav_features":      osm_data["grav_features"],
                "counts_by_category": osm_data.get("counts_by_category", {}),
                # 300 m (micro-environnement)
                "nb_pois_300m":           osm_data.get("nb_pois_300m", 0),
                "entropie_poi_300m":      osm_data.get("entropie_poi_300m", 0.0),
                "counts_by_category_300m": osm_data.get("counts_by_category_300m", {}),
                "grav_features_300m":     osm_data.get("grav_features_300m", {}),
                # Diagnostic
                "overpass_success": osm_data.get("overpass_success", False),
            },
            "accessibility_scores_0_100": osm_data["accessibility_scores_0_100"],
            "is_mocked": not bool(os.getenv("MAPBOX_ACCESS_TOKEN"))
        }
        
        response = GeoEnrichmentResponse(**response_dict)
        
        # 6. Sauvegarde dans le cache asynchrone
        if geo_cache is not None:
            try:
                await geo_cache.update_one(
                    {"h3_index_res9": h3_index},
                    {"$set": response_dict},
                    upsert=True
                )
                logger.info(f"[CACHE] Sauvegardé pour {h3_index}")
            except Exception as cache_error:
                logger.warning(f"[CACHE] Écriture ignorée: {cache_error}")

            
        return response
        
    except Exception as e:
        logger.error(f"Erreur lors de l'enrichissement spatial: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Le GeoService tourne sur le port 8001 par défaut
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
