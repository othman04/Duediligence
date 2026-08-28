const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
  id: Number,
  property_id: Number,
  prediction_type: String,
  predicted_price: Number,
  predicted_price_m2: Number,
  confidence_low: Number,
  confidence_high: Number,
  model_version: String,
  feature_importance: mongoose.Schema.Types.Mixed,
  shap_values: mongoose.Schema.Types.Mixed,
  predicted_at: Date,
}, { collection: 'predictions', strict: false });

predictionSchema.index({ property_id: 1 });

module.exports = mongoose.model('Prediction', predictionSchema);
