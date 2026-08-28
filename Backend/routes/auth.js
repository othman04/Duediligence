const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isAuthenticated, requireRole } = require('../middleware/authMiddleware');

// POST /api/v1/auth/login
router.post('/login', authController.login);

// POST /api/v1/auth/logout
router.post('/logout', authController.logout);

// GET /api/v1/auth/me
router.get('/me', isAuthenticated, authController.getMe);

// GET /api/v1/auth/users
router.get('/users', isAuthenticated, requireRole('superAdmin'), authController.getUsers);

// POST /api/v1/auth/create-user
router.post('/create-user', isAuthenticated, requireRole('superAdmin'), authController.createAdminUser);

// DELETE /api/v1/auth/users/:id
router.delete('/users/:id', isAuthenticated, requireRole('superAdmin'), authController.deleteUser);
// PUT /api/v1/auth/change-password
router.put('/change-password', isAuthenticated, authController.changePassword);

module.exports = router;
