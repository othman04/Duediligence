const mongoose = require('mongoose');

// ─── Sous-schémas des détails par type d'action ───────────────────────────────
//
// Ces sous-schémas correspondent EXACTEMENT aux interfaces TypeScript définies
// dans Frontend/src/store/historyStore.tsx :
//   • EstimationDetails    → type === 'estimation'
//   • InvestissementDetails → type === 'investissement'
//   • RapportDetails        → type === 'rapport'
//
// Le champ `details` est Mixed pour accepter n'importe quelle structure future,
// mais on documente ici les champs connus pour la lisibilité et les indexes.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schéma principal de l'historique.
 *
 * Compatibilité garantie avec :
 *  ✅  historyController.js  — utilise req.session.userId (string ou ObjectId)
 *  ✅  historyStore.tsx       — envoie POST { type, label, details }
 *                               attend GET  { entries: [{ _id, type, label, createdAt, userSnapshot, details }] }
 *  ✅  estimeBien.tsx         — enregistre EstimationDetails dans details
 */
const historySchema = new mongoose.Schema(
  {
    // ── Référence utilisateur ────────────────────────────────────────────────
    // Stocké en String pour rester compatible avec req.session.userId
    // (qui peut être un string issu de la session, pas forcément un ObjectId Mongoose).
    userId: {
      type: mongoose.Schema.Types.Mixed, // accepte string ou ObjectId
      required: true,
      index: true,
    },

    // ── Snapshot des infos utilisateur au moment de l'action ────────────────
    // Correspond à user: { id, firstName, lastName, email } dans historyStore.tsx
    // et à req.session.{ firstName, lastName, email } dans le contrôleur.
    userSnapshot: {
      firstName: { type: String, default: '' },
      lastName:  { type: String, default: '' },
      email:     { type: String, default: '' },
    },

    // ── Type de l'action ─────────────────────────────────────────────────────
    // ActionType dans historyStore.tsx
    type: {
      type: String,
      enum: ['estimation', 'investissement', 'rapport', 'admin'],
      required: true,
      index: true,
    },

    // ── Label court de l'action ──────────────────────────────────────────────
    // Ex: "Estimation vente — Appartement à Marrakech"
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    // ── Détails libres de l'action ───────────────────────────────────────────
    // Type Mixed pour accepter EstimationDetails | InvestissementDetails | RapportDetails
    // sans contrainte stricte côté Mongoose.
    //
    // Champs connus pour type === 'estimation' (EstimationDetails) :
    //   mode, propertyType, city, neighborhood, surface, rooms, bathrooms,
    //   equipment, address, estimate, low, high, pricePerSqm
    //
    // Champs connus pour type === 'investissement' (InvestissementDetails) :
    //   address, city, type, price, rent, surface, yieldRate,
    //   investmentScore, riskScore
    //
    // Champs connus pour type === 'rapport' (RapportDetails) :
    //   sections (string[])
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    // ── Options de la collection ─────────────────────────────────────────────
    collection: 'history',

    // createdAt est utilisé dans historyStore.tsx via mapBackendEntry()
    // updatedAt inutile pour un log immuable
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ── Index composé ─────────────────────────────────────────────────────────────
// Optimise les requêtes "historique d'un user trié par date desc"
// utilisées dans historyController.getMyHistory()
historySchema.index({ userId: 1, createdAt: -1 });

// ── Index filtrage par type ───────────────────────────────────────────────────
// Optimise le filtre optionnel ?type=estimation dans getMyHistory()
historySchema.index({ userId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('History', historySchema);
