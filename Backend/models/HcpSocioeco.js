const mongoose = require('mongoose');

const hcpSocioecoSchema = new mongoose.Schema({
  id: Number,
  annee: Number,
  region: String,
  population_millions: Number,
  taux_chomage_pct: Number,
  revenu_mensuel_moyen: Number,
  taux_urbanisation_pct: Number,
  taux_croissance_eco_pct: Number,
  taille_moyenne_menage: Number,
  created_at: { type: Date, default: Date.now },
}, { collection: 'hcp_socioeco', strict: false });

hcpSocioecoSchema.index({ region: 1, annee: -1 });

module.exports = mongoose.model('HcpSocioeco', hcpSocioecoSchema);
