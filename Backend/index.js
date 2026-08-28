const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config(); // Fallback for root cwd
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;

const connectDB = require('./config/db');
const authRouter = require('./routes/auth');
const analyticsRouter = require('./routes/analytics');
const propertiesRouter = require('./routes/properties');
const mapRouter = require('./routes/map');
const predictionRouter = require('./routes/prediction');
const historyRouter = require('./routes/history');
const geoRouter = require('./routes/geo');
const locationRouter = require('./routes/location');
const rapportRouter = require('./routes/rapport');

// ── Bootstrap ────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

// ── Connexion MongoDB ─────────────────────────────────────────────
connectDB();

// ── Middleware globaux ────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    const ok =
      !origin ||                                                              // curl / same-origin (proxy Vercel)
      /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ||               // dev local
      origin === process.env.FRONTEND_URL ||                                  // URL de prod déclarée
      /^https:\/\/[\w-]+\.vercel\.app$/.test(origin) ||                       // previews Vercel
      (process.env.EXTRA_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean).includes(origin);
    if (ok) {
      callback(null, true);
    } else {
      console.error(`CORS Blocked Origin: "${origin}"`);
      callback(new Error('CORS non autorisée'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// ── Session HTTP-Only stockée dans MongoDB ────────────────────────
const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/dueDillegenceDB';
app.use(session({
  secret: process.env.SESSION_SECRET || 'due_diligence_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: mongoUrl,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // 1 jour
  }),
  cookie: {
    httpOnly: true, // Empêche l'accès via XSS côté document.cookie
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 heures
  },
}));

// ── Routes ────────────────────────────────────────────────────────
const API = '/api/v1';

app.get(`${API}/health`, (req, res) => {
  const state = require('mongoose').connection.readyState;
  const stateLabel = ['disconnected', 'connected', 'connecting', 'disconnecting'][state] || 'unknown';
  res.json({
    status: 'ok',
    mongodb: stateLabel,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use(`${API}/auth`, authRouter);
app.use(`${API}/analytics`, analyticsRouter);
app.use(`${API}/properties`, propertiesRouter);
app.use(`${API}/map`, mapRouter);
app.use(`${API}/prediction`, predictionRouter);
app.use(`${API}/history`, historyRouter);
app.use(`${API}/geo`, geoRouter);
app.use(`${API}/location`, locationRouter);
app.use(`${API}/rapport`, rapportRouter);

// ── 404 ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} introuvable` });
});

// ── Gestionnaire d'erreurs global ────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Erreur serveur interne',
    path: req.originalUrl,
  });
});

// ── Démarrage ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log(`║  🚀  Orchid Island API  — port ${PORT}                       ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  POST ${API}/auth/login                              ║`);
  console.log(`║  POST ${API}/auth/logout                             ║`);
  console.log(`║  GET  ${API}/auth/me                                 ║`);
  console.log(`║  GET  ${API}/health                                  ║`);
  console.log(`║  GET  ${API}/analytics/filters                       ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  🤖  ML Prediction (→ Python :8000)                      ║`);
  console.log(`║  GET  ${API}/prediction/health                       ║`);
  console.log(`║  GET  ${API}/prediction/features                     ║`);
  console.log(`║  POST ${API}/prediction/predict                      ║`);
  console.log(`║  POST ${API}/prediction/analyze-investment           ║`);
  console.log(`║  POST ${API}/prediction/orchestrate                  ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  🌍  Geo Enrichment (→ Python :8001)                     ║`);
  console.log(`║  GET  ${API}/geo/health                              ║`);
  console.log(`║  POST ${API}/geo/enrich                              ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
