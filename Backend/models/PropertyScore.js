const mongoose = require('mongoose');

const propertyScoreSchema = new mongoose.Schema({
  id: Number,
  property_id: Number,
  investment_score: Number,
  location_score: Number,
  market_score: Number,
  development_score: Number,
  urban_planning_score: Number,
  environmental_risk_score: Number,
  accessibility_score: Number,
  tourism_score: Number,
  overall_risk_level: String,   // "low" | "medium" | "high"
  explanation_json: mongoose.Schema.Types.Mixed,
  computed_at: Date,
}, { collection: 'property_scores', strict: false });

propertyScoreSchema.index({ property_id: 1 });
propertyScoreSchema.index({ overall_risk_level: 1 });

module.exports = mongoose.model('PropertyScore', propertyScoreSchema);
