/**
 * routes/geo.js
 *
 * Routes d'enrichissement géospatial via le GeoService Python.
 *
 * Préfixe : /api/v1/geo
 */

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/geoController');

// GET  /api/v1/geo/health  → status du GeoService
router.get('/health', ctrl.health);

// POST /api/v1/geo/enrich  → enrichissement géospatial (lat, lon)
router.post('/enrich', ctrl.enrich);

module.exports = router;
