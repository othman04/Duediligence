/**
 * predictionController.js
 *
 * Proxy entre le frontend React et le microservice Python FastAPI (port 8000).
 * Toutes les requêtes de prédiction sont validées ici avant d'être transmises.
 *
 * Endpoints :
 *   POST /predict             → Prédiction de prix (CatBoost, léger)
 *   POST /analyze-investment   → Analyse d'investissement (Risk + Financial + Decision)
 *   POST /orchestrate          → Workflow complet (GeoService → Predict → Analyze → MongoDB)
 *
 * Flux enrichi (pour /predict et /orchestrate) :
 *   1. Frontend envoie lat/lon + infos du bien
 *   2. Backend appelle GeoService /enrich pour obtenir distances & scores réels
 *   3. Backend fusionne les données enrichies dans le payload
 *   4. Backend transmet au MlService /predict
 *   5. Si GeoService indisponible → fallback sur les valeurs par défaut du body
 */

const PYTHON_ML_URL  = process.env.ML_SERVICE_URL  || 'http://localhost:8000';
const GEO_SERVICE_URL = process.env.GEO_SERVICE_URL || 'http://localhost:8001';

// Helper : appel HTTP vers le service ML Python
async function callML(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${PYTHON_ML_URL}${path}`, opts);
  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.detail || `ML service error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Helper : appel HTTP vers le GeoService Python
async function callGeo(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${GEO_SERVICE_URL}${path}`, opts);
  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.detail || `GeoService error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/v1/prediction/location
 * Proxy vers le microservice Python : modèle LOCATION XGBoost + quantile.
 */
exports.predictLocation = async (req, res) => {
  const data = await callML('/location/predict', 'POST', req.body);
  res.json(data);
};

// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/v1/prediction/location/health
 * Status des modèles LOCATION côté service Python.
 */
exports.healthLocation = async (req, res) => {
  const data = await callML('/location/health');
  res.json(data);
};

// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/v1/prediction/health
 * Vérification que le service ML Python est opérationnel.
 */
exports.health = async (req, res) => {
  const data = await callML('/health');
  res.json(data);
};

// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/v1/prediction/features
 * Retourne les 67 features attendues par le modèle CatBoost.
 */
exports.getFeatures = async (req, res) => {
  const data = await callML('/features');
  res.json(data);
};

// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/v1/prediction/predict
 *
 * Corps requis (minimum) :
 *   type_bien, localisation_quartier, commune_fr,
 *   latitude, longitude, surface_consolidee_m2, surface_habitable_m2,
 *   total_pieces, chambres, salles_bain, salons, etages, etage_semantique
 *
 * Corps optionnel : équipements, scores, distances, temporel, dérivés.
 *
 * Flux :
 *   1. Validation des champs obligatoires
 *   2. Appel GeoService /enrich (lat, lon) → distances + scores réels
 *   3. Fusion des données enrichies dans le payload (sans écraser les valeurs explicites)
 *   4. Envoi au MlService /predict
 *
 * Retourne :
 *   { predicted_price, price_per_m2, confidence_range, inputs_summary, currency, geo_enriched }
 */
exports.predict = async (req, res) => {
  const REQUIRED_FIELDS = [
    'type_bien', 'localisation_quartier', 'commune_fr',
    'latitude', 'longitude',
    'surface_consolidee_m2', 'surface_habitable_m2',
    'total_pieces', 'chambres', 'salles_bain', 'salons',
    'etages', 'etage_semantique',
  ];

  const missing = REQUIRED_FIELDS.filter(f => req.body[f] === undefined || req.body[f] === null || req.body[f] === '');
  if (missing.length > 0) {
    return res.status(400).json({
      error: 'Champs obligatoires manquants',
      missing,
      required: REQUIRED_FIELDS,
    });
  }

  // ── Étape 1 : Enrichissement via GeoService ──────────────────────
  let geoEnriched = false;
  let geoData = null;

  try {
    geoData = await callGeo('/enrich', 'POST', {
      latitude: req.body.latitude,
      longitude: req.body.longitude,
    });
    geoEnriched = true;
    console.log(`[GEO] ✅ Enrichissement réussi pour (${req.body.latitude}, ${req.body.longitude})`);
  } catch (geoErr) {
    console.warn(`[GEO] ⚠️ GeoService indisponible, utilisation des valeurs par défaut: ${geoErr.message}`);
    // Fallback : on continue avec les valeurs par défaut du body
  }

  // ── Étape 2 : Fusion des données géo dans le payload ─────────────
  const enrichedBody = { ...req.body };

  if (geoData) {
    // Distances : on ne remplace que si le Frontend n'a pas fourni de valeur explicite
    if (geoData.distances_m) {
      for (const [key, value] of Object.entries(geoData.distances_m)) {
        if (enrichedBody[key] === undefined || enrichedBody[key] === null) {
          enrichedBody[key] = value;
        }
      }
    }

    // Scores d'accessibilité
    if (geoData.accessibility_scores_0_100) {
      for (const [key, value] of Object.entries(geoData.accessibility_scores_0_100)) {
        if (enrichedBody[key] === undefined || enrichedBody[key] === null) {
          enrichedBody[key] = value;
        }
      }
    }
  }

  // ── Étape 3 : Appel au MlService avec le payload enrichi ────────
  const data = await callML('/predict', 'POST', enrichedBody);

  // Ajouter un flag indiquant si les données géo sont réelles
  data.geo_enriched = geoEnriched;
  if (geoData) {
    data.geo_source = geoData.is_mocked ? 'mock' : 'real';
  }

  // Optionnel : enregistrer la prédiction en base MongoDB
  // (peut être activé si le modèle Prediction est configuré)
  // try {
  //   const Prediction = require('../models/Prediction');
  //   await Prediction.create({ ...req.body, ...data, created_at: new Date() });
  // } catch (_) { /* non-bloquant */ }

  res.json(data);
};

// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/v1/prediction/analyze-investment
 *
 * Analyse d'investissement découplée de la prédiction de prix.
 * Compose : Risk Assessment + Financial Intelligence + Investment Scorer + Decision Engine.
 *
 * Corps requis :
 *   sale_price (obligatoire)
 *
 * Corps optionnel :
 *   rental_price_monthly  → si fourni, rapport financier complet ; sinon null
 *   type_bien             → stratégie de décision (défaut: "Appartement")
 *   predicted_price       → pour comparaison avec le prix demandé
 *   property_features     → distances géo, scores accessibilité, etc.
 *   latitude, longitude   → si fournis, enrichissement géo automatique
 *
 * Retourne :
 *   { overall_score, decision, explanation_text, financial_report, risk_assessment, ... }
 */
exports.analyzeInvestment = async (req, res) => {
  const { sale_price } = req.body;

  if (!sale_price || sale_price <= 0) {
    return res.status(400).json({
      error: 'sale_price est obligatoire et doit être > 0',
    });
  }

  // ── Enrichissement géo optionnel ────────────────────────────────
  let propertyFeatures = req.body.property_features || {};

  if (req.body.latitude && req.body.longitude) {
    try {
      const geoData = await callGeo('/enrich', 'POST', {
        latitude: req.body.latitude,
        longitude: req.body.longitude,
      });
      // Fusionner les distances et scores géo dans property_features
      if (geoData.distances_m) {
        propertyFeatures = { ...geoData.distances_m, ...propertyFeatures };
      }
      if (geoData.accessibility_scores_0_100) {
        propertyFeatures = { ...geoData.accessibility_scores_0_100, ...propertyFeatures };
      }
      // Injecter les POI data pour le fallback gravity-based
      if (geoData.pois) {
        propertyFeatures.nb_pois_1km = geoData.pois.nb_pois_1km;
        propertyFeatures.entropie_poi_1km = geoData.pois.entropie_poi_1km;
        if (geoData.pois.grav_features) {
          propertyFeatures.grav_features = geoData.pois.grav_features;
        }
      }
      console.log(`[GEO] ✅ Enrichissement pour analyze-investment (${req.body.latitude}, ${req.body.longitude})`);
    } catch (geoErr) {
      console.warn(`[GEO] ⚠️ GeoService indisponible pour analyze-investment: ${geoErr.message}`);
    }
  }

  // Toujours injecter lat/lng pour le H3 lookup (Location Intelligence ML v5.2)
  if (req.body.latitude && req.body.longitude) {
    propertyFeatures.latitude = req.body.latitude;
    propertyFeatures.longitude = req.body.longitude;
  }

  // ── Appel MlService /analyze-investment ─────────────────────────
  const mlPayload = {
    sale_price: req.body.sale_price,
    rental_price_monthly: req.body.rental_price_monthly || null,
    type_bien: req.body.type_bien || 'Appartement',
    predicted_price: req.body.predicted_price || null,
    property_features: propertyFeatures,
  };

  const data = await callML('/analyze-investment', 'POST', mlPayload);
  res.json(data);
};

// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/v1/prediction/orchestrate
 *
 * Workflow d'orchestration complet pour le frontend :
 *   1. GeoService /enrich → distances + scores réels
 *   2. MlService /predict → prédiction CatBoost
 *   3. MlService /analyze-investment → Risk + Financial + Decision
 *   4. Sauvegarde MongoDB (properties + investment_analyses)
 *
 * Corps requis (même que /predict + sale_price) :
 *   type_bien, localisation_quartier, commune_fr,
 *   latitude, longitude, surface_consolidee_m2, surface_habitable_m2,
 *   total_pieces, chambres, salles_bain, salons, etages, etage_semantique,
 *   sale_price
 *
 * Corps optionnel :
 *   rental_price_monthly, equipements
 *
 * Retourne :
 *   { status, listing_id, geo_enrichment, prediction, investment_analysis }
 */
exports.orchestrate = async (req, res) => {
  try {
    const REQUIRED_FIELDS = [
      'type_bien', 'localisation_quartier', 'commune_fr',
      'latitude', 'longitude',
      'surface_consolidee_m2', 'surface_habitable_m2',
      'total_pieces', 'chambres', 'salles_bain', 'salons',
      'etages', 'etage_semantique',
    ];

    const missing = REQUIRED_FIELDS.filter(f => req.body[f] === undefined || req.body[f] === null || req.body[f] === '');
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Champs obligatoires manquants pour l\'orchestration',
        missing,
        required: REQUIRED_FIELDS,
      });
    }

    const listingId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // ── ÉTAPE 1 : Enrichissement GeoService ────────────────────────
    let geoData = null;
    let geoEnriched = false;

    try {
      geoData = await callGeo('/enrich', 'POST', {
        latitude: req.body.latitude,
        longitude: req.body.longitude,
      });
      geoEnriched = true;
      console.log(`[ORCH] ✅ GeoService enrichi pour (${req.body.latitude}, ${req.body.longitude})`);
    } catch (geoErr) {
      console.warn(`[ORCH] ⚠️ GeoService indisponible: ${geoErr.message}`);
    }

    // ── ÉTAPE 2 : Prédiction CatBoost ─────────────────────────────
    const predictPayload = { ...req.body };

    if (geoData) {
      if (geoData.distances_m) {
        for (const [key, value] of Object.entries(geoData.distances_m)) {
          if (predictPayload[key] === undefined || predictPayload[key] === null) {
            predictPayload[key] = value;
          }
        }
      }
      if (geoData.accessibility_scores_0_100) {
        for (const [key, value] of Object.entries(geoData.accessibility_scores_0_100)) {
          if (predictPayload[key] === undefined || predictPayload[key] === null) {
            predictPayload[key] = value;
          }
        }
      }
    }

    const predictionData = await callML('/predict', 'POST', predictPayload);
    predictionData.geo_enriched = geoEnriched;
    if (geoData) {
      predictionData.geo_source = geoData.is_mocked ? 'mock' : 'real';
    }

    // ── Détermination du prix de référence (user_provided ou predicted)
    const isSalePriceProvided = req.body.sale_price !== undefined && req.body.sale_price !== null && req.body.sale_price > 0;
    const actualSalePrice = isSalePriceProvided ? req.body.sale_price : predictionData.predicted_price;
    const priceDataSource = isSalePriceProvided ? 'user_provided' : 'predicted';

    // ── ÉTAPE 3 : Analyse d'investissement (optionnel / résilient) ────────────────────────
    let investmentData = null;
    try {
      const propertyFeatures = {};
      if (geoData) {
        if (geoData.distances_m) Object.assign(propertyFeatures, geoData.distances_m);
        if (geoData.accessibility_scores_0_100) Object.assign(propertyFeatures, geoData.accessibility_scores_0_100);
        // Injecter les POI data pour le fallback gravity-based
        if (geoData.pois) {
          propertyFeatures.nb_pois_1km = geoData.pois.nb_pois_1km;
          propertyFeatures.entropie_poi_1km = geoData.pois.entropie_poi_1km;
          if (geoData.pois.grav_features) {
            propertyFeatures.grav_features = geoData.pois.grav_features;
          }
        }
      }
      // Toujours injecter lat/lng pour le H3 lookup (Location Intelligence ML v5.2)
      propertyFeatures.latitude = req.body.latitude;
      propertyFeatures.longitude = req.body.longitude;

      const investPayload = {
        sale_price: actualSalePrice,
        rental_price_monthly: req.body.rental_price_monthly || null,
        type_bien: req.body.type_bien,
        predicted_price: predictionData.predicted_price,
        property_features: propertyFeatures,
      };

      investmentData = await callML('/analyze-investment', 'POST', investPayload);
    } catch (invErr) {
      console.warn(`[ORCH] ⚠️ Analyze-investment indisponible ou échoué: ${invErr.message}`);
    }

    // ── ÉTAPE 4 : Sauvegarde MongoDB (non-bloquante) ──────────────
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        const db = mongoose.connection.db;

        // Sauvegarde du bien
        await db.collection('properties').insertOne({
          listing_id: listingId,
          commune_fr: req.body.commune_fr,
          localisation_quartier: req.body.localisation_quartier,
          type_bien: req.body.type_bien,
          location: {
            type: 'Point',
            coordinates: [req.body.longitude, req.body.latitude],
          },
          characteristics: {
            surface_consolidee_m2: req.body.surface_consolidee_m2,
            surface_habitable_m2: req.body.surface_habitable_m2,
            total_pieces: req.body.total_pieces,
            chambres: req.body.chambres,
            salles_bain: req.body.salles_bain,
            salons: req.body.salons,
            etages: req.body.etages,
            etage_semantique: req.body.etage_semantique,
          },
          financials: {
            sale_price: actualSalePrice,
            price_data_source: priceDataSource,
            rental_price_monthly: req.body.rental_price_monthly || null,
          },
          h3_index_res9: geoData?.h3_index_res9 || null,
          created_at: new Date(),
        });

        // Sauvegarde de l'analyse d'investissement si présente
        if (investmentData) {
          await db.collection('investment_analyses').insertOne({
            listing_id: listingId,
            overall_score: investmentData.overall_score,
            decision: investmentData.decision,
            explanation_text: investmentData.explanation_text,
            prediction: predictionData,
            financial_report: investmentData.financial_report,
            risk_assessment: investmentData.risk_assessment,
            metadata: {
              model_version: 'v2.0-orchestrated',
              executed_at: new Date(),
            },
          });
        }

        console.log(`[ORCH] ✅ Sauvegardé en MongoDB (listing_id: ${listingId})`);
      }
    } catch (dbErr) {
      console.warn(`[ORCH] ⚠️ Sauvegarde MongoDB non-bloquante échouée: ${dbErr.message}`);
    }

    // ── ÉTAPE 5 : Réponse unifiée ─────────────────────────────────
    res.json({
      status: 'success',
      listing_id: listingId,
      price_data_source: priceDataSource,
      actual_sale_price_used: actualSalePrice,
      geo_enrichment: geoData || null,
      prediction: predictionData,
      investment_analysis: investmentData,
    });
  } catch (err) {
    console.error(`[ORCH] ❌ Erreur Orchestrateur:`, err);
    res.status(err.status || 500).json({
      error: err.message || 'Erreur lors de la prédiction du prix par le modèle ML.',
    });
  }
};

