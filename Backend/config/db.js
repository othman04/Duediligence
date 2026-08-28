const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URL, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB connecté : ${conn.connection.host}`);
    console.log(`📦 Base de données  : ${conn.connection.name}`);
  } catch (error) {
    console.error(`⚠️ Erreur de connexion MongoDB : ${error.message}`);
    console.warn(`👉 L'API Express démarre en mode autonome (routes ML/API fonctionnelles)`);
  }
};

// Événements de connexion
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB déconnecté');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 MongoDB reconnecté');
});

module.exports = connectDB;
