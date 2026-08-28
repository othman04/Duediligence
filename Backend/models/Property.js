const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  id: Number,
  operation: String,        // "Vente" | "Location"
  source: String,
  type_bien: String,
  titre: String,
  prix: Number,
  devise: String,
  localisation: String,
  quartier: String,
  ville: String,
  region: String,
  date_annonce: Date,
  surface_m2: Number,
  surface_habitable_m2: Number,
  surface_terrain_m2: Number,
  chambres: Number,
  salles_bain: Number,
  salons: Number,
  etages: Number,
  description: String,
  equipements: mongoose.Schema.Types.Mixed,
  url: String,
  periode_location: String,
  geocoded: Boolean,
  latitude: Number,
  longitude: Number,
  surface_effective_m2: Number,
  nb_equipements: Number,
  dq_valid: Boolean,
  dq_reject_reason: String,
  dq_is_duplicate: Boolean,
  dq_prix_m2_corrige: Number,
  dq_ville_imputee: String,
  dq_champs_imputes: mongoose.Schema.Types.Mixed,
  prix_original: Number,
  created_at: { type: Date, default: Date.now },
}, { collection: 'properties', strict: false });

propertySchema.index({ region: 1, ville: 1, quartier: 1 });
propertySchema.index({ type_bien: 1 });
propertySchema.index({ operation: 1 });
propertySchema.index({ date_annonce: 1 });
propertySchema.index({ latitude: 1, longitude: 1 });

module.exports = mongoose.model('Property', propertySchema);
