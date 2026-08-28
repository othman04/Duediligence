/**
 * Middleware pour vérifier si l'utilisateur est authentifié via session
 */
exports.isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Accès non autorisé. Veuillez vous connecter.' });
};

/**
 * Middleware de contrôle d'accès basé sur les rôles (RBAC)
 */
exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Accès non autorisé. Veuillez vous connecter.' });
    }
    if (!roles.includes(req.session.role)) {
      return res.status(403).json({ error: 'Accès interdit. Droits insuffisants.' });
    }
    next();
  };
};
