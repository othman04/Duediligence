const Property = require('../models/Property');
const PropertyScore = require('../models/PropertyScore');
const PropertyFeature = require('../models/PropertyFeature');
const Prediction = require('../models/Prediction');

/**
 * GET /api/v1/properties
 * Liste paginée + filtrée
 */
exports.getProperties = async (req, res) => {
  const {
    page = 1, limit = 20,
    region, ville, quartier, type_bien, operation,
    prix_min, prix_max, surface_min, surface_max,
    sort_by = 'date_annonce', order = 'desc',
  } = req.query;

  const match = {};
  if (region)    match.region    = region;
  if (ville)     match.ville     = ville;
  if (quartier)  match.quartier  = quartier;
  if (type_bien) match.type_bien = type_bien;
  if (operation) match.operation = operation;
  if (prix_min || prix_max) {
    match.prix = {};
    if (prix_min) match.prix.$gte = parseFloat(prix_min);
    if (prix_max) match.prix.$lte = parseFloat(prix_max);
  }
  if (surface_min || surface_max) {
    match.surface_effective_m2 = {};
    if (surface_min) match.surface_effective_m2.$gte = parseFloat(surface_min);
    if (surface_max) match.surface_effective_m2.$lte = parseFloat(surface_max);
  }

  const skip    = (parseInt(page) - 1) * parseInt(limit);
  const sortDir = order === 'asc' ? 1 : -1;
  const sortObj = { [sort_by]: sortDir };

  const [properties, total] = await Promise.all([
    Property.find(match, { description: 0 }).sort(sortObj).skip(skip).limit(parseInt(limit)).lean(),
    Property.countDocuments(match),
  ]);

  res.json({
    data: properties,
    meta: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  });
};

/**
 * GET /api/v1/properties/stats/summary
 * Statistiques générales
 */
exports.getPropertiesStats = async (req, res) => {
  const match = {};
  const { region, ville, type_bien, operation } = req.query;
  if (region)    match.region    = region;
  if (ville)     match.ville     = ville;
  if (type_bien) match.type_bien = type_bien;
  if (operation) match.operation = operation;

  const stats = await Property.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total:       { $sum: 1 },
        min_prix:    { $min: '$prix' },
        max_prix:    { $max: '$prix' },
        avg_prix:    { $avg: '$prix' },
        avg_surface: { $avg: '$surface_effective_m2' },
        avg_prix_m2: {
          $avg: {
            $cond: [
              { $gt: ['$surface_effective_m2', 0] },
              { $divide: ['$prix', '$surface_effective_m2'] }, null,
            ]
          }
        },
      },
    },
  ]);

  const byType = await Property.aggregate([
    { $match: match },
    { $group: { _id: '$type_bien', count: { $sum: 1 }, avg_prix: { $avg: '$prix' } } },
    { $sort: { count: -1 } },
  ]);

  const byOperation = await Property.aggregate([
    { $match: match },
    { $group: { _id: '$operation', count: { $sum: 1 } } },
  ]);

  res.json({
    summary: stats[0] || {},
    by_type: byType,
    by_operation: byOperation,
  });
};

/**
 * GET /api/v1/properties/:id
 * Détail d'un bien
 */
exports.getPropertyById = async (req, res) => {
  const property = await Property.findOne({ id: parseInt(req.params.id) }).lean();
  if (!property) return res.status(404).json({ error: 'Bien introuvable' });
  res.json(property);
};

/**
 * GET /api/v1/properties/:id/scores
 * Scores d'un bien
 */
exports.getPropertyScores = async (req, res) => {
  const propId = parseInt(req.params.id);
  const [score, features] = await Promise.all([
    PropertyScore.findOne({ property_id: propId }).lean(),
    PropertyFeature.findOne({ property_id: propId }).lean(),
  ]);
  if (!score) return res.status(404).json({ error: 'Scores introuvables' });
  res.json({ scores: score, features: features || {} });
};

/**
 * GET /api/v1/properties/:id/risks
 * Risques & contexte spatial d'un bien
 */
exports.getPropertyRisks = async (req, res) => {
  const propId = parseInt(req.params.id);
  const [property, score, features] = await Promise.all([
    Property.findOne({ id: propId }).lean(),
    PropertyScore.findOne({ property_id: propId }).lean(),
    PropertyFeature.findOne({ property_id: propId }).lean(),
  ]);
  if (!property) return res.status(404).json({ error: 'Bien introuvable' });

  res.json({
    property_id: propId,
    overall_risk_level: score?.overall_risk_level || 'N/A',
    environmental_risk_score: score?.environmental_risk_score || null,
    urban_planning_score: score?.urban_planning_score || null,
    litige_en_cours: features?.litige_en_cours || false,
    hypotheque_active: features?.hypotheque_active || false,
    saisie_active: features?.saisie_active || false,
    servitude_active: features?.servitude_active || false,
    in_zone_touristique: features?.in_zone_touristique || false,
    in_zone_industrielle: features?.in_zone_industrielle || false,
    in_planning_boundary: features?.in_planning_boundary || false,
    statut_foncier: features?.statut_foncier || null,
    explanation: score?.explanation_json || null,
  });
};

/**
 * GET /api/v1/properties/:id/report
 * Rapport de due diligence complet
 */
exports.getPropertyReport = async (req, res) => {
  const propId = parseInt(req.params.id);
  const [property, score, features, prediction] = await Promise.all([
    Property.findOne({ id: propId }).lean(),
    PropertyScore.findOne({ property_id: propId }).lean(),
    PropertyFeature.findOne({ property_id: propId }).lean(),
    Prediction.findOne({ property_id: propId }).lean(),
  ]);

  if (!property) return res.status(404).json({ error: 'Bien introuvable' });

  const surf = property.surface_effective_m2 || property.surface_m2 || 0;
  const prix_m2 = surf > 0 ? Math.round(property.prix / surf) : null;

  res.json({
    property,
    scores: score || {},
    features: features || {},
    prediction: prediction || null,
    summary: {
      prix_m2,
      overall_risk_level: score?.overall_risk_level || 'N/A',
      investment_score: score?.investment_score || null,
      location_score: score?.location_score || null,
      recommendation: score?.investment_score >= 70 ? 'Fortement recommandé'
        : score?.investment_score >= 50 ? 'À considérer' : 'Prudence recommandée',
    },
    generated_at: new Date().toISOString(),
  });
};

/**
 * POST /api/v1/properties/analyze
 * Génération / analyse de rapport (mock)
 */
exports.analyzeProperty = async (req, res) => {
  const { property_id } = req.body;
  if (!property_id) return res.status(400).json({ error: 'property_id requis' });

  const property = await Property.findOne({ id: parseInt(property_id) }).lean();
  if (!property) return res.status(404).json({ error: 'Bien introuvable' });

  res.json({
    status: 'completed',
    property_id: parseInt(property_id),
    message: `Analyse générée pour le bien #${property_id}`,
    report_url: `/api/v1/properties/${property_id}/report`,
    generated_at: new Date().toISOString(),
  });
};
