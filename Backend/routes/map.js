const express = require('express');
const router = express.Router();
const mapController = require('../controllers/mapController');

// GET /api/v1/map/properties
router.get('/properties', mapController.getMapProperties);

// GET /api/v1/map/pois
router.get('/pois', mapController.getMapPois);

// GET /api/v1/map/zones
router.get('/zones', mapController.getMapZones);

// GET /api/v1/map/routes
router.get('/routes', mapController.getMapRoutes);

module.exports = router;
