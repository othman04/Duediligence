const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password_hash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    // RBAC plateforme : superAdmin (administration complète), admin (opérations), user (espace client à venir).
    enum: ['superAdmin', 'admin', 'user'],
    default: 'user',
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
}, { collection: 'users', timestamps: false });

module.exports = mongoose.model('User', userSchema);
