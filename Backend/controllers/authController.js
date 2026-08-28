const bcrypt = require('bcryptjs');
const User = require('../models/User');
const History = require('../models/History');

/**
 * POST /api/v1/auth/login
 * Connexion d'un utilisateur
 */
exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe sont requis.' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Identifiants invalides .' });
  }

  // Session stockée avec _id MongoDB
  req.session.userId    = user._id.toString();
  req.session.role      = user.role;
  req.session.email     = user.email;
  req.session.firstName = user.firstName;
  req.session.lastName  = user.lastName;

  res.json({
    message: 'Connexion réussie',
    user: {
      _id:       user._id,
      firstName: user.firstName,
      lastName:  user.lastName,
      email:     user.email,
      role:      user.role,
      created_at: user.created_at,
    },
  });
};

/**
 * POST /api/v1/auth/logout
 * Déconnexion de l'utilisateur
 */
exports.logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la déconnexion.' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Déconnexion réussie' });
  });
};

/**
 * GET /api/v1/auth/me
 * Récupération du profil courant depuis la session
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId).select('-password_hash').lean();
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/create-user
 * Création d'un nouvel administrateur/utilisateur par un admin sans écraser la session
 */
exports.createAdminUser = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'Prénom, nom, email et mot de passe sont requis.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'Un utilisateur avec cet email existe déjà.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password_hash,
      // Seul un superAdmin accède à cette route. Aucun compte client n'est créé ici.
      role: ['admin', 'superAdmin'].includes(role) ? role : 'admin',
    });

    await user.save();

    // Enregistrer l'action dans l'historique
    if (req.session && req.session.userId) {
      try {
        await History.create({
          userId: req.session.userId,
          userSnapshot: {
            firstName: req.session.firstName || 'Admin',
            lastName:  req.session.lastName  || '',
            email:     req.session.email     || '',
          },
          type: 'admin',
          label: `Création de l'administrateur : ${user.firstName} ${user.lastName} (${user.email})`,
          details: { action: 'create_admin', targetUserId: String(user._id), targetName: `${user.firstName} ${user.lastName}`, targetEmail: user.email },
        });
      } catch (hErr) {
        console.warn('Erreur log historique création admin:', hErr.message);
      }
    }

    res.status(201).json({
      message: 'Administrateur créé avec succès',
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/auth/users
 * Récupération de tous les utilisateurs enregistrés
 */
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password_hash').sort({ created_at: -1 }).lean();
    res.json({ users });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/auth/users/:id
 * Suppression d'un administrateur/utilisateur
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.session && req.session.userId === id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte connecté.' });
    }

    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    // Enregistrer l'action dans l'historique
    if (req.session && req.session.userId) {
      try {
        await History.create({
          userId: req.session.userId,
          userSnapshot: {
            firstName: req.session.firstName || 'Admin',
            lastName:  req.session.lastName  || '',
            email:     req.session.email     || '',
          },
          type: 'admin',
          label: `Suppression de l'administrateur : ${deletedUser.firstName} ${deletedUser.lastName} (${deletedUser.email})`,
          details: { action: 'delete_admin', targetUserId: String(deletedUser._id), targetName: `${deletedUser.firstName} ${deletedUser.lastName}`, targetEmail: deletedUser.email },
        });
      } catch (hErr) {
        console.warn('Erreur log historique suppression admin:', hErr.message);
      }
    }

    res.json({ message: 'Administrateur supprimé avec succès', id });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/auth/change-password
 * Modification du mot de passe de l'utilisateur connecté
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Le mot de passe actuel et le nouveau mot de passe sont requis.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'La confirmation du nouveau mot de passe ne correspond pas.' });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Le mot de passe actuel est incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Mot de passe modifié avec succès.' });
  } catch (err) {
    next(err);
  }
};
