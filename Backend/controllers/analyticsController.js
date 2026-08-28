const Property = require('../models/Property');
const PropertyScore = require('../models/PropertyScore');
const PropertyFeature = require('../models/PropertyFeature');
const HcpSocioeco = require('../models/HcpSocioeco');

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function buildBaseMatch(query) {
  const match = {};
  if (query.region)    match.region    = query.region;
  if (query.ville)     match.ville     = query.ville;
  if (query.type_bien) match.type_bien = query.type_bien;
  if (query.operation) match.operation = query.operation;
  return match;
}

function computePearson(xArr, yArr) {
  const n = xArr.length;
  if (n < 2) return 0;
  const meanX = xArr.reduce((a, b) => a + b, 0) / n;
  const meanY = yArr.reduce((a, b) => a + b, 0) / n;
  const num   = xArr.reduce((s, x, i) => s + (x - meanX) * (yArr[i] - meanY), 0);
  const denX  = Math.sqrt(xArr.reduce((s, x) => s + (x - meanX) ** 2, 0));
  const denY  = Math.sqrt(yArr.reduce((s, y) => s + (y - meanY) ** 2, 0));
  return denX === 0 || denY === 0 ? 0 : num / (denX * denY);
}

function pearsonDescription(r, xVar, yVar) {
  const abs = Math.abs(r);
  const dir = r > 0 ? 'positive' : 'négative';
  const force = abs > 0.7 ? 'forte' : abs > 0.4 ? 'modérée' : abs > 0.2 ? 'faible' : 'très faible';
  return `Corrélation ${dir} ${force} (r=${r.toFixed(2)}) entre ${xVar} et ${yVar}.`;
}

// ─────────────────────────────────────────────────────────────────
// CONTROLLERS
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/analytics/filters
 * Valeurs distinctes pour les dropdowns de filtres
 */
exports.getFilters = async (req, res) => {
  const [regions, villes, types_bien] = await Promise.all([
    Property.distinct('region'),
    Property.distinct('ville'),
    Property.distinct('type_bien'),
  ]);

  res.json({
    regions:    regions.filter(Boolean).sort(),
    villes:     villes.filter(Boolean).sort(),
    types_bien: types_bien.filter(Boolean).sort(),
    operations: ['Vente', 'Location'],
  });
};

/**
 * GET /api/v1/analytics/metadata
 * Variables disponibles pour Data Explorer
 */
exports.getMetadata = async (req, res) => {
  const variables = {
    prix: [
      { id: 'prix_m2_moyen',   label: 'Prix moyen/m²',           type: 'number', table: 'properties' },
      { id: 'loyer_m2_moyen',  label: 'Loyer moyen/m²',          type: 'number', table: 'properties' },
      { id: 'rental_yield',    label: 'Rendement locatif (%)',    type: 'number', table: 'properties' },
    ],
    demographie_economie: [
      { id: 'population_millions',  label: 'Population (millions)', type: 'number', table: 'hcp_socioeco' },
      { id: 'revenu_mensuel_moyen', label: 'Revenu mensuel moyen',  type: 'number', table: 'hcp_socioeco' },
      { id: 'taux_chomage_pct',     label: 'Taux de chômage (%)',   type: 'number', table: 'hcp_socioeco' },
    ],
    infrastructures: [
      { id: 'densite_poi_1km', label: 'Densité POI (1 km)',  type: 'number', table: 'property_features' },
      { id: 'nb_ecoles_1km',  label: 'Nb écoles (1 km)',    type: 'number', table: 'property_features' },
      { id: 'nb_hotels_2km',  label: 'Nb hôtels (2 km)',    type: 'number', table: 'property_features' },
    ],
    scores: [
      { id: 'location_score',          label: 'Score de localisation',  type: 'number', table: 'property_scores' },
      { id: 'investment_score',        label: "Score d'investissement", type: 'number', table: 'property_scores' },
      { id: 'environmental_risk_score',label: 'Score risque environnemental', type: 'number', table: 'property_scores' },
    ],
  };

  res.json(variables);
};

/**
 * GET /api/v1/analytics/dashboard-summary
 * KPIs + agrégations pour les graphiques du dashboard
 */
exports.getDashboardSummary = async (req, res) => {
  const { region, ville, type_bien, operation, top_n = 8 } = req.query;
  const topN = Math.min(Math.max(parseInt(top_n) || 8, 3), 20);
  const match = buildBaseMatch(req.query);

  // 1. KPIs de base
  const [kpiAgg, cityCount, quartierCount] = await Promise.all([
    Property.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total_properties: { $sum: 1 },
          vente_count:    { $sum: { $cond: [{ $eq: ['$operation', 'Vente']    }, 1, 0] } },
          location_count: { $sum: { $cond: [{ $eq: ['$operation', 'Location'] }, 1, 0] } },
          sum_prix_vente: { $sum: { $cond: [
            { $and: [{ $eq: ['$operation', 'Vente'] }, { $gt: ['$surface_effective_m2', 0] }] },
            { $divide: ['$prix', '$surface_effective_m2'] }, 0,
          ]}},
          cnt_prix_vente: { $sum: { $cond: [
            { $and: [{ $eq: ['$operation', 'Vente'] }, { $gt: ['$surface_effective_m2', 0] }] }, 1, 0,
          ]}},
          sum_prix_location: { $sum: { $cond: [
            { $and: [{ $eq: ['$operation', 'Location'] }, { $gt: ['$surface_effective_m2', 0] }] },
            { $divide: ['$prix', '$surface_effective_m2'] }, 0,
          ]}},
          cnt_prix_location: { $sum: { $cond: [
            { $and: [{ $eq: ['$operation', 'Location'] }, { $gt: ['$surface_effective_m2', 0] }] }, 1, 0,
          ]}},
        },
      },
    ]),
    Property.distinct('ville', match),
    Property.distinct('quartier', match),
  ]);

  const kpiBase = kpiAgg[0] || {
    total_properties: 0, vente_count: 0, location_count: 0,
    sum_prix_vente: 0, cnt_prix_vente: 0,
    sum_prix_location: 0, cnt_prix_location: 0,
  };

  const avg_price_m2 = kpiBase.cnt_prix_vente > 0 ? kpiBase.sum_prix_vente / kpiBase.cnt_prix_vente : 0;
  const avg_rent_m2  = kpiBase.cnt_prix_location > 0 ? kpiBase.sum_prix_location / kpiBase.cnt_prix_location : 0;
  const rental_yield = avg_price_m2 > 0 ? parseFloat(((avg_rent_m2 * 12) / avg_price_m2 * 100).toFixed(2)) : null;

  // 2. KPIs scores
  const ids = await Property.distinct('id', match);
  const scoreKpi = await PropertyScore.aggregate([
    { $match: { property_id: { $in: ids } } },
    {
      $group: {
        _id: null,
        scored_count:          { $sum: 1 },
        avg_investment_score:  { $avg: '$investment_score' },
        avg_location_score:    { $avg: '$location_score' },
        avg_risk_score:        { $avg: '$environmental_risk_score' },
      },
    },
  ]);
  const sk = scoreKpi[0] || {};

  const kpis = {
    total_properties:     kpiBase.total_properties,
    total_cities:         cityCount.filter(Boolean).length,
    total_quartiers:      quartierCount.filter(Boolean).length,
    vente_count:          kpiBase.vente_count,
    location_count:       kpiBase.location_count,
    scored_count:         sk.scored_count || 0,
    avg_price_m2:         Math.round(avg_price_m2),
    avg_rent_m2:          Math.round(avg_rent_m2),
    rental_yield,
    avg_investment_score: sk.avg_investment_score ? parseFloat(sk.avg_investment_score.toFixed(1)) : null,
    avg_location_score:   sk.avg_location_score   ? parseFloat(sk.avg_location_score.toFixed(1))   : null,
    avg_risk_score:       sk.avg_risk_score        ? parseFloat(sk.avg_risk_score.toFixed(1))        : null,
  };

  // 3. by_geo — Prix/m² par zone
  const geoGroupField = ville ? '$quartier' : '$ville';
  const byGeoAgg = await Property.aggregate([
    { $match: { ...match, operation: 'Vente', surface_effective_m2: { $gt: 0 } } },
    {
      $group: {
        _id: geoGroupField,
        properties_count:  { $sum: 1 },
        avg_sale_price_m2: { $avg: { $divide: ['$prix', '$surface_effective_m2'] } },
        property_ids:      { $push: '$id' },
      },
    },
    { $sort: { avg_sale_price_m2: -1 } },
    { $limit: topN },
  ]);

  const byGeo = await Promise.all(byGeoAgg.map(async (g) => {
    const scoreData = await PropertyScore.aggregate([
      { $match: { property_id: { $in: g.property_ids } } },
      { $group: { _id: null, avg_investment_score: { $avg: '$investment_score' } } },
    ]);
    return {
      label:               g._id || 'Inconnu',
      properties_count:    g.properties_count,
      avg_sale_price_m2:   Math.round(g.avg_sale_price_m2),
      avg_investment_score: scoreData[0]?.avg_investment_score ? parseFloat(scoreData[0].avg_investment_score.toFixed(1)) : null,
      rental_yield: null,
    };
  }));

  // 4. by_type
  const byType = await Property.aggregate([
    { $match: match },
    { $group: { _id: '$type_bien', properties_count: { $sum: 1 } } },
    { $project: { type_bien: '$_id', properties_count: 1, _id: 0 } },
    { $sort: { properties_count: -1 } },
  ]);

  // 5. by_operation
  const byOperation = await Property.aggregate([
    { $match: match },
    { $group: { _id: '$operation', properties_count: { $sum: 1 } } },
    { $project: { operation: '$_id', properties_count: 1, _id: 0 } },
  ]);

  // 6. by_risk
  const byRisk = await PropertyScore.aggregate([
    { $match: { property_id: { $in: ids } } },
    { $group: { _id: '$overall_risk_level', properties_count: { $sum: 1 } } },
    { $project: { overall_risk_level: '$_id', properties_count: 1, _id: 0 } },
    { $sort: { properties_count: -1 } },
  ]);

  // 7. price_buckets
  const priceBuckets = await Property.aggregate([
    { $match: { ...match, operation: 'Vente', prix: { $gt: 0 } } },
    {
      $bucket: {
        groupBy: '$prix',
        boundaries: [0, 500000, 1000000, 2000000, 5000000, 10000000, 50000000],
        default: '50M+',
        output: { count: { $sum: 1 } },
      },
    },
    {
      $project: {
        _id: 0,
        range: {
          $switch: {
            branches: [
              { case: { $eq: ['$_id', 0]        }, then: '0–500K' },
              { case: { $eq: ['$_id', 500000]   }, then: '500K–1M' },
              { case: { $eq: ['$_id', 1000000]  }, then: '1M–2M' },
              { case: { $eq: ['$_id', 2000000]  }, then: '2M–5M' },
              { case: { $eq: ['$_id', 5000000]  }, then: '5M–10M' },
              { case: { $eq: ['$_id', 10000000] }, then: '10M–50M' },
            ],
            default: { $toString: '$_id' },
          },
        },
        count: 1,
      },
    },
  ]);

  // 8. trend sur 24 mois
  const twentyFourMonthsAgo = new Date();
  twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);

  const trendAgg = await Property.aggregate([
    { $match: { ...match, date_annonce: { $gte: twentyFourMonthsAgo } } },
    {
      $group: {
        _id: {
          annee: { $year: '$date_annonce' },
          mois:  { $month: '$date_annonce' },
          operation: '$operation',
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.annee': 1, '_id.mois': 1 } },
  ]);

  const trendMap = {};
  trendAgg.forEach(({ _id, count }) => {
    const key = `${_id.annee}-${String(_id.mois).padStart(2, '0')}`;
    if (!trendMap[key]) trendMap[key] = { mois: key, vente_count: 0, location_count: 0 };
    if (_id.operation === 'Vente')    trendMap[key].vente_count    += count;
    if (_id.operation === 'Location') trendMap[key].location_count += count;
  });
  const trend = Object.values(trendMap).sort((a, b) => a.mois.localeCompare(b.mois));

  // 9. hcp_data
  const lastYear = await HcpSocioeco.findOne({}, {}, { sort: { annee: -1 } });
  const latestAnnee = lastYear?.annee;
  const hcpFilter = region ? { region, annee: latestAnnee } : { annee: latestAnnee };
  const hcpData = await HcpSocioeco.find(hcpFilter, {
    _id: 0, region: 1, revenu_mensuel_moyen: 1, population_millions: 1, taux_chomage_pct: 1,
  }).sort({ region: 1 });

  // 10. opportunities
  const venteIds = await Property.distinct('id', { ...match, operation: 'Vente', surface_effective_m2: { $gt: 0 } });
  const scoredProps = await PropertyScore.find(
    { property_id: { $in: venteIds }, investment_score: { $gte: 60 } },
    { property_id: 1, investment_score: 1, _id: 0 }
  );
  const highScoreIds = scoredProps.map(s => s.property_id);

  const geoFieldOpp = ville ? '$quartier' : '$ville';
  const oppsAgg = await Property.aggregate([
    { $match: { id: { $in: highScoreIds }, operation: 'Vente', surface_effective_m2: { $gt: 0 } } },
    {
      $group: {
        _id: geoFieldOpp,
        properties_count:  { $sum: 1 },
        avg_sale_price_m2: { $avg: { $divide: ['$prix', '$surface_effective_m2'] } },
        property_ids:      { $push: '$id' },
      },
    },
    { $sort: { avg_sale_price_m2: 1 } },
    { $limit: topN },
  ]);

  const allPrixM2 = await Property.aggregate([
    { $match: { ...match, operation: 'Vente', surface_effective_m2: { $gt: 0 } } },
    { $project: { prixM2: { $divide: ['$prix', '$surface_effective_m2'] } } },
    { $sort: { prixM2: 1 } },
    { $group: { _id: null, prices: { $push: '$prixM2' } } },
  ]);
  let mediane = 0;
  if (allPrixM2[0]?.prices?.length) {
    const arr = allPrixM2[0].prices;
    const mid = Math.floor(arr.length / 2);
    mediane = arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  }

  const scoreMap = {};
  scoredProps.forEach(s => { scoreMap[s.property_id] = s.investment_score; });

  const opportunities = oppsAgg.map(g => {
    const avgScore = g.property_ids.reduce((sum, pid) => sum + (scoreMap[pid] || 0), 0) / g.property_ids.length;
    const valueIndex = mediane > 0 ? parseFloat((avgScore / (g.avg_sale_price_m2 / mediane)).toFixed(2)) : null;
    return {
      label:              g._id || 'Inconnu',
      properties_count:   g.properties_count,
      avg_sale_price_m2:  Math.round(g.avg_sale_price_m2),
      avg_investment_score: parseFloat(avgScore.toFixed(1)),
      rental_yield:       null,
      value_index:        valueIndex,
      decision:           avgScore >= 70 && g.avg_sale_price_m2 <= mediane ? 'Acheter' : 'Surveiller',
    };
  });

  // 11. insights
  const insights = [];
  if (avg_price_m2 > 0) {
    const topGeo = byGeo[0];
    if (topGeo) insights.push(`La zone "${topGeo.label}" affiche le prix/m² le plus élevé : ${topGeo.avg_sale_price_m2.toLocaleString()} MAD/m².`);
  }
  if (rental_yield !== null) {
    insights.push(`Le rendement locatif moyen est de ${rental_yield}%.`);
  }
  if (opportunities.length > 0) {
    insights.push(`${opportunities.length} zones présentent de bonnes opportunités d'investissement (score ≥ 60).`);
  }

  res.json({
    filters:      { region: region || null, ville: ville || null, type_bien: type_bien || null, operation: operation || null },
    kpis,
    by_geo:       byGeo,
    by_type:      byType,
    by_operation: byOperation,
    by_risk:      byRisk,
    price_buckets: priceBuckets,
    trend,
    hcp_data:     hcpData,
    opportunities,
    insights,
  });
};

/**
 * POST /api/v1/analytics/chart-data
 * Données pour Data Explorer
 */
exports.getChartData = async (req, res) => {
  const { x_var, y_var, chart_type = 'scatter', region, ville, quartier, type_bien } = req.body;

  const propMatch = {};
  if (region)    propMatch.region    = region;
  if (ville)     propMatch.ville     = ville;
  if (quartier)  propMatch.quartier  = quartier;
  if (type_bien) propMatch.type_bien = type_bien;

  const propAgg = await Property.aggregate([
    { $match: propMatch },
    {
      $group: {
        _id: { region: '$region', ville: '$ville', quartier: '$quartier' },
        property_ids:   { $push: '$id' },
        sum_prix_vente: { $sum: { $cond: [
          { $and: [{ $eq: ['$operation', 'Vente'] }, { $gt: ['$surface_effective_m2', 0] }] },
          { $divide: ['$prix', '$surface_effective_m2'] }, 0,
        ]}},
        cnt_prix_vente: { $sum: { $cond: [
          { $and: [{ $eq: ['$operation', 'Vente'] }, { $gt: ['$surface_effective_m2', 0] }] }, 1, 0,
        ]}},
        sum_loyer: { $sum: { $cond: [
          { $and: [{ $eq: ['$operation', 'Location'] }, { $gt: ['$surface_effective_m2', 0] }] },
          { $divide: ['$prix', '$surface_effective_m2'] }, 0,
        ]}},
        cnt_loyer: { $sum: { $cond: [
          { $and: [{ $eq: ['$operation', 'Location'] }, { $gt: ['$surface_effective_m2', 0] }] }, 1, 0,
        ]}},
        sum_prix_vente_raw: { $sum: { $cond: [{ $eq: ['$operation', 'Vente'] }, '$prix', 0] } },
        cnt_prix_vente_raw: { $sum: { $cond: [{ $eq: ['$operation', 'Vente'] }, 1, 0] } },
        cnt_total:          { $sum: 1 },
      },
    },
  ]);

  let rows = propAgg;
  if (rows.length > 300 && !ville) {
    const villeAgg = await Property.aggregate([
      { $match: propMatch },
      {
        $group: {
          _id: { region: '$region', ville: '$ville', quartier: { $literal: null } },
          property_ids:   { $push: '$id' },
          sum_prix_vente: { $sum: { $cond: [
            { $and: [{ $eq: ['$operation', 'Vente'] }, { $gt: ['$surface_effective_m2', 0] }] },
            { $divide: ['$prix', '$surface_effective_m2'] }, 0,
          ]}},
          cnt_prix_vente: { $sum: { $cond: [
            { $and: [{ $eq: ['$operation', 'Vente'] }, { $gt: ['$surface_effective_m2', 0] }] }, 1, 0,
          ]}},
          sum_loyer: { $sum: { $cond: [
            { $and: [{ $eq: ['$operation', 'Location'] }, { $gt: ['$surface_effective_m2', 0] }] },
            { $divide: ['$prix', '$surface_effective_m2'] }, 0,
          ]}},
          cnt_loyer: { $sum: { $cond: [
            { $and: [{ $eq: ['$operation', 'Location'] }, { $gt: ['$surface_effective_m2', 0] }] }, 1, 0,
          ]}},
          sum_prix_vente_raw: { $sum: { $cond: [{ $eq: ['$operation', 'Vente'] }, '$prix', 0] } },
          cnt_prix_vente_raw: { $sum: { $cond: [{ $eq: ['$operation', 'Vente'] }, 1, 0] } },
          cnt_total:          { $sum: 1 },
        },
      },
    ]);
    rows = villeAgg;
  }

  const allIds = rows.flatMap(r => r.property_ids);
  const [scores, features, hcpList] = await Promise.all([
    PropertyScore.aggregate([
      { $match: { property_id: { $in: allIds } } },
      { $group: {
        _id: '$property_id',
        investment_score:          { $first: '$investment_score' },
        location_score:            { $first: '$location_score' },
        environmental_risk_score:  { $first: '$environmental_risk_score' },
      }},
    ]),
    PropertyFeature.aggregate([
      { $match: { property_id: { $in: allIds } } },
      { $group: {
        _id: '$property_id',
        densite_poi_1km: { $first: '$densite_poi_1km' },
        nb_ecoles_1km:   { $first: '$nb_ecoles_1km' },
        nb_hotels_2km:   { $first: '$nb_hotels_2km' },
      }},
    ]),
    HcpSocioeco.find({}, { region: 1, revenu_mensuel_moyen: 1, population_millions: 1, taux_chomage_pct: 1, annee: 1 }).sort({ annee: -1 }),
  ]);

  const scoreById = {};
  scores.forEach(s => { scoreById[s._id] = s; });
  const featById = {};
  features.forEach(f => { featById[f._id] = f; });
  const hcpByRegion = {};
  hcpList.forEach(h => { if (!hcpByRegion[h.region]) hcpByRegion[h.region] = h; });

  const data = rows.map(r => {
    const { region, ville, quartier } = r._id;
    const name = quartier ? `${quartier} (${ville})` : (ville || region);

    const groupScores   = r.property_ids.map(pid => scoreById[pid]).filter(Boolean);
    const groupFeatures = r.property_ids.map(pid => featById[pid]).filter(Boolean);
    const avg = (arr, key) => arr.length ? arr.reduce((s, x) => s + (x[key] || 0), 0) / arr.length : 0;

    const hcp = hcpByRegion[region] || {};
    const prix_m2_moyen  = r.cnt_prix_vente > 0 ? r.sum_prix_vente / r.cnt_prix_vente : 0;
    const loyer_m2_moyen = r.cnt_loyer > 0       ? r.sum_loyer / r.cnt_loyer : 0;
    const avg_vente_raw  = r.cnt_prix_vente_raw > 0 ? r.sum_prix_vente_raw / r.cnt_prix_vente_raw : 0;
    const rental_yield   = avg_vente_raw > 0 ? parseFloat(((loyer_m2_moyen * 12) / avg_vente_raw * 100).toFixed(2)) : 0;

    return {
      region: region || '',
      ville:  ville  || '',
      quartier: quartier || '',
      name,
      prix_m2_moyen:          Math.round(prix_m2_moyen),
      loyer_m2_moyen:         Math.round(loyer_m2_moyen),
      rental_yield,
      population_millions:    hcp.population_millions    || 0,
      revenu_mensuel_moyen:   hcp.revenu_mensuel_moyen   || 0,
      taux_chomage_pct:       hcp.taux_chomage_pct       || 0,
      densite_poi_1km:        parseFloat(avg(groupFeatures, 'densite_poi_1km').toFixed(2)),
      nb_ecoles_1km:          parseFloat(avg(groupFeatures, 'nb_ecoles_1km').toFixed(2)),
      nb_hotels_2km:          parseFloat(avg(groupFeatures, 'nb_hotels_2km').toFixed(2)),
      location_score:         parseFloat(avg(groupScores, 'location_score').toFixed(1)),
      investment_score:       parseFloat(avg(groupScores, 'investment_score').toFixed(1)),
      environmental_risk_score: parseFloat(avg(groupScores, 'environmental_risk_score').toFixed(1)),
    };
  });

  const xArr = data.map(d => d[x_var] || 0);
  const yArr = data.map(d => d[y_var] || 0);
  const pearson = computePearson(xArr, yArr);

  res.json({
    data,
    insight: {
      pearson:     parseFloat(pearson.toFixed(3)),
      spearman:    null,
      description: pearsonDescription(pearson, x_var, y_var),
    },
  });
};

/**
 * POST /api/v1/analytics/correlation
 * Matrice de corrélation
 */
exports.getCorrelation = async (req, res) => {
  const { variables = [], ville, quartier } = req.body;

  const propMatch = {};
  if (ville)    propMatch.ville    = ville;
  if (quartier) propMatch.quartier = quartier;

  const propAgg = await Property.aggregate([
    { $match: propMatch },
    {
      $group: {
        _id: { region: '$region', ville: '$ville', quartier: '$quartier' },
        property_ids: { $push: '$id' },
        sum_prix_vente: { $sum: { $cond: [
          { $and: [{ $eq: ['$operation', 'Vente'] }, { $gt: ['$surface_effective_m2', 0] }] },
          { $divide: ['$prix', '$surface_effective_m2'] }, 0,
        ]}},
        cnt_prix_vente: { $sum: { $cond: [
          { $and: [{ $eq: ['$operation', 'Vente'] }, { $gt: ['$surface_effective_m2', 0] }] }, 1, 0,
        ]}},
      },
    },
  ]);

  const allIds = propAgg.flatMap(r => r.property_ids);
  const [scores, features, hcpList] = await Promise.all([
    PropertyScore.aggregate([
      { $match: { property_id: { $in: allIds } } },
      { $group: {
        _id: '$property_id',
        investment_score:         { $first: '$investment_score' },
        location_score:           { $first: '$location_score' },
        environmental_risk_score: { $first: '$environmental_risk_score' },
      }},
    ]),
    PropertyFeature.aggregate([
      { $match: { property_id: { $in: allIds } } },
      { $group: {
        _id: '$property_id',
        densite_poi_1km: { $first: '$densite_poi_1km' },
        nb_ecoles_1km:   { $first: '$nb_ecoles_1km' },
        nb_hotels_2km:   { $first: '$nb_hotels_2km' },
      }},
    ]),
    HcpSocioeco.find({}, { region: 1, revenu_mensuel_moyen: 1, population_millions: 1, taux_chomage_pct: 1, annee: 1 }).sort({ annee: -1 }),
  ]);

  const scoreById = {};
  scores.forEach(s => { scoreById[s._id] = s; });
  const featById = {};
  features.forEach(f => { featById[f._id] = f; });
  const hcpByRegion = {};
  hcpList.forEach(h => { if (!hcpByRegion[h.region]) hcpByRegion[h.region] = h; });

  const rows = propAgg.map(r => {
    const { region } = r._id;
    const groupScores   = r.property_ids.map(pid => scoreById[pid]).filter(Boolean);
    const groupFeatures = r.property_ids.map(pid => featById[pid]).filter(Boolean);
    const avg = (arr, key) => arr.length ? arr.reduce((s, x) => s + (x[key] || 0), 0) / arr.length : 0;
    const hcp = hcpByRegion[region] || {};

    return {
      prix_m2_moyen:            r.cnt_prix_vente > 0 ? r.sum_prix_vente / r.cnt_prix_vente : 0,
      investment_score:         avg(groupScores, 'investment_score'),
      location_score:           avg(groupScores, 'location_score'),
      environmental_risk_score: avg(groupScores, 'environmental_risk_score'),
      densite_poi_1km:          avg(groupFeatures, 'densite_poi_1km'),
      nb_ecoles_1km:            avg(groupFeatures, 'nb_ecoles_1km'),
      nb_hotels_2km:            avg(groupFeatures, 'nb_hotels_2km'),
      revenu_mensuel_moyen:     hcp.revenu_mensuel_moyen    || 0,
      population_millions:      hcp.population_millions     || 0,
      taux_chomage_pct:         hcp.taux_chomage_pct        || 0,
      loyer_m2_moyen:           0,
      rental_yield:             0,
    };
  });

  const matrix = variables.map(v1 => {
    const row = { variable: v1 };
    variables.forEach(v2 => {
      const arr1 = rows.map(r => r[v1] || 0);
      const arr2 = rows.map(r => r[v2] || 0);
      row[v2] = parseFloat(computePearson(arr1, arr2).toFixed(3));
    });
    return row;
  });

  res.json({ matrix, variables, spearman_available: false });
};
