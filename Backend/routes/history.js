const express = require('express');
const router  = express.Router();
const historyController = require('../controllers/historyController');
const { isAuthenticated, requireRole } = require('../middleware/authMiddleware');

// POST /api/v1/history           → Créer une entrée (utilisateur connecté)
router.post('/', isAuthenticated, historyController.createEntry);

// GET  /api/v1/history           → Historique de l'utilisateur connecté
router.get('/', isAuthenticated, requireRole('superAdmin'), historyController.getMyHistory);

// GET  /api/v1/history/all       → Historique global (admin uniquement)
router.get('/all', isAuthenticated, requireRole('superAdmin'), historyController.getAllHistory);

// DELETE /api/v1/history         → Vider son propre historique
router.delete('/', isAuthenticated, requireRole('superAdmin'), historyController.clearMyHistory);

// DELETE /api/v1/history/:id     → Supprimer une entrée spécifique
router.delete('/:id', isAuthenticated, requireRole('superAdmin'), historyController.deleteEntry);

module.exports = router;
