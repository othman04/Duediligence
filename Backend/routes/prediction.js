/**
 * routes/prediction.js
 *
 * Routes de prédiction et d'analyse d'investissement immobilier.
 *
 * Préfixe : /api/v1/prediction
 */

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/predictionController');

// GET  /api/v1/prediction/health              → status du service ML
router.get('/health', ctrl.health);

// GET  /api/v1/prediction/features            → liste des 67 features du modèle
router.get('/features', ctrl.getFeatures);

// POST /api/v1/prediction/predict             → prédiction de prix (CatBoost)
router.post('/predict', ctrl.predict);

// POST /api/v1/prediction/analyze-investment  → analyse d'investissement (Risk + Financial + Decision)
router.post('/analyze-investment', ctrl.analyzeInvestment);

// POST /api/v1/prediction/orchestrate         → workflow complet (Geo → Predict → Analyze → MongoDB)
router.post('/orchestrate', ctrl.orchestrate);

// POST /api/v1/prediction/location  → prédiction LOCATION (XGBoost + quantile)
router.post('/location', ctrl.predictLocation);

// GET  /api/v1/prediction/location/health → status modèles LOCATION
router.get('/location/health', ctrl.healthLocation);

module.exports = router;
