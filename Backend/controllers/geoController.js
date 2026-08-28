/**
 * geoController.js
 *
 * Proxy entre le Backend Express et le microservice GeoService (FastAPI, port 8001).
 * Fournit l'enrichissement géospatial (distances, POIs, scores d'accessibilité).
 */

const GEO_SERVICE_URL = process.env.GEO_SERVICE_URL || 'http://localhost:8001';

// Helper : appel HTTP vers le GeoService Python
async function callGeo(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${GEO_SERVICE_URL}${path}`, opts);
  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.detail || `GeoService error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/v1/geo/health
 * Vérification que le GeoService Python est opérationnel.
 */
exports.health = async (req, res) => {
  const data = await callGeo('/health');
  res.json(data);
};

// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/v1/geo/enrich
 * Enrichissement géospatial d'une coordonnée (lat, lon).
 *
 * Corps requis :
 *   { latitude: number, longitude: number }
 *
 * Retourne :
 *   { h3_index_res9, distances_m, pois, accessibility_scores_0_100, is_mocked }
 */
exports.enrich = async (req, res) => {
  const { latitude, longitude } = req.body;

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      error: 'Champs obligatoires manquants',
      missing: ['latitude', 'longitude'].filter(f => req.body[f] === undefined),
    });
  }

  const data = await callGeo('/enrich', 'POST', { latitude, longitude });
  res.json(data);
};

// Export du helper pour usage dans d'autres contrôleurs (ex: predictionController)
exports._callGeo = callGeo;
