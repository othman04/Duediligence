const History = require('../models/History');

/**
 * POST /api/v1/history
 * Crée une nouvelle entrée dans l'historique pour l'utilisateur connecté
 */
exports.createEntry = async (req, res, next) => {
  try {
    const { type, label, details } = req.body;

    if (!type || !label) {
      return res.status(400).json({ error: 'Les champs "type" et "label" sont requis.' });
    }

    if (!['estimation', 'investissement', 'rapport', 'admin'].includes(type)) {
      return res.status(400).json({ error: 'Type invalide. Valeurs acceptées : estimation, investissement, rapport, admin.' });
    }

    const entry = new History({
      userId: req.session.userId,
      userSnapshot: {
        firstName: req.session.firstName || '',
        lastName:  req.session.lastName  || '',
        email:     req.session.email     || '',
      },
      type,
      label,
      details: details || {},
    });

    await entry.save();

    res.status(201).json({
      message: 'Action enregistrée dans l\'historique.',
      entry: {
        _id:       entry._id,
        type:      entry.type,
        label:     entry.label,
        details:   entry.details,
        createdAt: entry.createdAt,
        userSnapshot: entry.userSnapshot,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/history
 * Récupère l'historique de l'utilisateur connecté (les 100 dernières entrées)
 */
exports.getMyHistory = async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 200);
    const skip   = parseInt(req.query.skip || '0', 10);
    const filter = { userId: req.session.userId };

    // Filtre optionnel par type
    if (req.query.type && ['estimation', 'investissement', 'rapport', 'admin'].includes(req.query.type)) {
      filter.type = req.query.type;
    }

    const [entries, total] = await Promise.all([
      History.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      History.countDocuments(filter),
    ]);

    res.json({ entries, total, skip, limit });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/history/all  (admin)
 * Récupère l'historique de tous les utilisateurs
 */
exports.getAllHistory = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);
    const skip  = parseInt(req.query.skip || '0', 10);

    const [entries, total] = await Promise.all([
      History.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      History.countDocuments(),
    ]);

    res.json({ entries, total, skip, limit });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/history/:id
 * Supprime une entrée de l'historique (propriétaire uniquement)
 */
exports.deleteEntry = async (req, res, next) => {
  try {
    const { id } = req.params;

    const entry = await History.findOne({ _id: id, userId: req.session.userId });
    if (!entry) {
      return res.status(404).json({ error: 'Entrée introuvable ou accès interdit.' });
    }

    await entry.deleteOne();
    res.json({ message: 'Entrée supprimée.', id });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/history
 * Supprime tout l'historique de l'utilisateur connecté
 */
exports.clearMyHistory = async (req, res, next) => {
  try {
    const result = await History.deleteMany({ userId: req.session.userId });
    res.json({ message: 'Historique effacé.', deleted: result.deletedCount });
  } catch (err) {
    next(err);
  }
};
