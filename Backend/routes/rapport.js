const express  = require('express');
const router   = express.Router();
const { generateRapport, getRapport } = require('../controllers/rapportController');

// POST /api/v1/rapport/generate — Génère un rapport complet (accessible aux utilisateurs et invités)
router.post('/generate', generateRapport);

// GET /api/v1/rapport/:id — Récupère un rapport sauvegardé
router.get('/:id', getRapport);

module.exports = router;
