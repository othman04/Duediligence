const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { isAuthenticated, requireRole } = require('../middleware/authMiddleware');

router.use(isAuthenticated, requireRole('superAdmin'));

// GET /api/v1/analytics/filters
router.get('/filters', analyticsController.getFilters);

// GET /api/v1/analytics/metadata
router.get('/metadata', analyticsController.getMetadata);

// GET /api/v1/analytics/dashboard-summary
router.get('/dashboard-summary', analyticsController.getDashboardSummary);

// POST /api/v1/analytics/chart-data
router.post('/chart-data', analyticsController.getChartData);

// POST /api/v1/analytics/correlation
router.post('/correlation', analyticsController.getCorrelation);

module.exports = router;
