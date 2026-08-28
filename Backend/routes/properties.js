const express = require('express');
const router = express.Router();
const propertiesController = require('../controllers/propertiesController');

// GET /api/v1/properties
router.get('/', propertiesController.getProperties);

// GET /api/v1/properties/stats/summary
router.get('/stats/summary', propertiesController.getPropertiesStats);

// POST /api/v1/properties/analyze
router.post('/analyze', propertiesController.analyzeProperty);

// GET /api/v1/properties/:id
router.get('/:id', propertiesController.getPropertyById);

// GET /api/v1/properties/:id/scores
router.get('/:id/scores', propertiesController.getPropertyScores);

// GET /api/v1/properties/:id/risks
router.get('/:id/risks', propertiesController.getPropertyRisks);

// GET /api/v1/properties/:id/report
router.get('/:id/report', propertiesController.getPropertyReport);

module.exports = router;
