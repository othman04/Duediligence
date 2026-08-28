const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

// GET /api/v1/location/options — communes + types distincts (Location)
router.get('/options', locationController.getOptions);

// GET /api/v1/location/quartiers?commune=X
router.get('/quartiers', locationController.getQuartiers);

// GET /api/v1/location/commune-center?commune=X
router.get('/commune-center', locationController.getCommuneCenter);

// GET /api/v1/location/quartier-center?commune=X&quartier=Y
router.get('/quartier-center', locationController.getQuartierCenter);

// POST /api/v1/location/resolve — lat/lng -> commune + quartier
router.post('/resolve', locationController.resolveLocation);

// GET /api/v1/location/dashboard — stats précalculées (Analytique)
router.get('/dashboard', locationController.getLocationDashboard);

// GET /api/v1/location/sale-zones — zones du dataset VENTE
router.get('/sale-zones', locationController.getSaleZones);

// Centres + résolution pour le mode Vente (dataset_model_ready_cleaned)
router.get('/sale-commune-center', locationController.getSaleCommuneCenter);
router.get('/sale-quartier-center', locationController.getSaleQuartierCenter);
router.post('/sale-resolve', locationController.resolveSaleLocation);

module.exports = router;