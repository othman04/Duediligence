/**
 * precompute_location_stats.js
 *
 * Précalcule les statistiques LOCATION (page Analytique) dans la collection
 * `dashboard_stats_location`. À lancer UNE FOIS après chaque import :
 *   npm run precompute:location
 *
 * La page Analytique lit ensuite cette collection → plus aucune agrégation
 * live coûteuse sur `properties` (chargement < 1 s).
 */
require('dotenv').config();
const mongoose = require('mongoose');

const OUT_COLL = 'dashboard_stats_location';
const SRC = 'properties';
const MATCH = { operation: 'Location' };

function fmtK(v) {
  return v >= 1000 ? `${v / 1000}k` : `${v}`;
}

function bucketEntries(rows, bounds) {
  const byId = {};
  for (const r of rows) byId[r._id] = r.count;
  const out = [];
  for (let i = 0; i < bounds.length; i++) {
    const b = bounds[i];
    const count = byId[b] ?? 0;
    const next = bounds[i + 1];
    out.push({ range: next ? `${fmtK(b)}–${fmtK(next)}` : `${fmtK(b)}+`, count });
  }
  const defs = rows.filter((r) => typeof r._id !== 'number');
  for (const d of defs) out.push({ range: String(d._id), count: d.count });
  return out;
}

async function run() {
  await mongoose.connect(process.env.MONGO_URL, {
    serverSelectionTimeoutMS: 20000,
    socketTimeoutMS: 300000,
  });
  const db = mongoose.connection.db;
  const coll = db.collection(SRC);
  const out = db.collection(OUT_COLL);

  console.log('[precompute] agrégation des stats location ...');

  // ── Totaux & moyennes globales ─────────────────────────────────────────
  const [globalAgg] = await Promise.all([
    coll.aggregate([
      { $match: MATCH },
      { $group: { _id: null,
        total: { $sum: 1 },
        mensuel: { $sum: { $cond: [{ $eq: ['$periode_norm', 'mois'] }, 1, 0] } },
        nuitee: { $sum: { $cond: [{ $eq: ['$periode_norm', 'jour'] }, 1, 0] } },
        sum_loyer: { $sum: { $ifNull: ['$prix_mensuel_dh', 0] } },
        cnt_loyer: { $sum: { $cond: [{ $ne: ['$prix_mensuel_dh', null] }, 1, 0] } },
        sum_nuit: { $sum: { $ifNull: ['$prix_nuit_dh', 0] } },
        cnt_nuit: { $sum: { $cond: [{ $ne: ['$prix_nuit_dh', null] }, 1, 0] } },
        sum_m2_mens: { $sum: { $cond: [
          { $and: [{ $eq: ['$periode_norm', 'mois'] }, { $gt: [{ $ifNull: ['$surface_m2', 0] }, 0] }] },
          '$surface_m2', 0,
        ] } },
        sum_m2_nuit: { $sum: { $cond: [
          { $and: [{ $eq: ['$periode_norm', 'jour'] }, { $gt: [{ $ifNull: ['$surface_m2', 0] }, 0] }] },
          '$surface_m2', 0,
        ] } },
      } },
    ]).toArray(),
  ]);
  const g = globalAgg[0] || {};

  const averages = {
    loyer_mensuel: g.cnt_loyer ? Math.round(g.sum_loyer / g.cnt_loyer) : null,
    loyer_m2_mensuel: g.sum_m2_mens ? Math.round(g.sum_loyer / g.sum_m2_mens) : null,
    prix_nuit: g.cnt_nuit ? Math.round(g.sum_nuit / g.cnt_nuit) : null,
    prix_nuit_m2: g.sum_m2_nuit ? Math.round(g.sum_nuit / g.sum_m2_nuit) : null,
  };
  console.log('[1] global', JSON.stringify({ total: g.total, mensuel: g.mensuel, nuitee: g.nuitee }));

  // ── Agrégations par dimension ────────────────────────────────────────
  const [byPeriode, byTypeRaw, byCommuneRaw, byQuartierRaw] = await Promise.all([
    coll.aggregate([
      { $match: MATCH },
      { $group: {
        _id: '$periode_norm',
        nb: { $sum: 1 },
        prix_moyen: { $avg: { $ifNull: ['$prix_mensuel_dh', '$prix_nuit_dh'] } },
      } },
    ]).toArray(),

    coll.aggregate([
      { $match: MATCH },
      { $group: {
        _id: '$type_bien',
        nb: { $sum: 1 },
        nb_mensuel: { $sum: { $cond: [{ $eq: ['$periode_norm', 'mois'] }, 1, 0] } },
        nb_nuitee: { $sum: { $cond: [{ $eq: ['$periode_norm', 'jour'] }, 1, 0] } },
        sum_prix_mensuel: { $sum: { $ifNull: ['$prix_mensuel_dh', 0] } },
        cnt_prix_mensuel: { $sum: { $cond: [{ $ne: ['$prix_mensuel_dh', null] }, 1, 0] } },
        sum_m2_mens: { $sum: { $cond: [
          { $and: [{ $eq: ['$periode_norm', 'mois'] }, { $gt: [{ $ifNull: ['$surface_m2', 0] }, 0] }] },
          '$surface_m2', 0,
        ] } },
        sum_prix_nuit: { $sum: { $ifNull: ['$prix_nuit_dh', 0] } },
        cnt_prix_nuit: { $sum: { $cond: [{ $ne: ['$prix_nuit_dh', null] }, 1, 0] } },
      } },
      { $sort: { nb: -1 } },
    ]).toArray(),

    coll.aggregate([
      { $match: MATCH },
      { $group: {
        _id: '$commune_officielle',
        nb: { $sum: 1 },
        nb_mensuel: { $sum: { $cond: [{ $eq: ['$periode_norm', 'mois'] }, 1, 0] } },
        nb_nuitee: { $sum: { $cond: [{ $eq: ['$periode_norm', 'jour'] }, 1, 0] } },
        sum_prix_mensuel: { $sum: { $ifNull: ['$prix_mensuel_dh', 0] } },
        cnt_prix_mensuel: { $sum: { $cond: [{ $ne: ['$prix_mensuel_dh', null] }, 1, 0] } },
        sum_m2_mens: { $sum: { $cond: [
          { $and: [{ $eq: ['$periode_norm', 'mois'] }, { $gt: [{ $ifNull: ['$surface_m2', 0] }, 0] }] },
          '$surface_m2', 0,
        ] } },
        sum_prix_nuit: { $sum: { $ifNull: ['$prix_nuit_dh', 0] } },
        cnt_prix_nuit: { $sum: { $cond: [{ $ne: ['$prix_nuit_dh', null] }, 1, 0] } },
      } },
      { $sort: { nb: -1 } },
    ]).toArray(),

    coll.aggregate([
      { $match: MATCH },
      { $group: {
        _id: { commune: '$commune_officielle', quartier: '$quartier' },
        nb: { $sum: 1 },
      } },
      { $sort: { '_id.commune': 1, nb: -1 } },
    ]).toArray(),
  ]);

  const by_periode = byPeriode
    .filter((p) => p._id)
    .map((p) => ({ periode: p._id, nb: p.nb, prix_moyen: Math.round(p.prix_moyen || 0) }));

  const by_type = byTypeRaw
    .filter((t) => t._id)
    .map((t) => ({
      type_bien: t._id,
      nb: t.nb,
      nb_mensuel: t.nb_mensuel,
      nb_nuitee: t.nb_nuitee,
      loyer_m2_mensuel: t.sum_m2_mens ? Math.round(t.sum_prix_mensuel / t.sum_m2_mens) : null,
      prix_nuit_moyen: t.cnt_prix_nuit ? Math.round(t.sum_prix_nuit / t.cnt_prix_nuit) : null,
    }));

  const by_commune = byCommuneRaw
    .filter((c) => c._id)
    .map((c) => ({
      commune: c._id,
      nb: c.nb,
      nb_mensuel: c.nb_mensuel,
      nb_nuitee: c.nb_nuitee,
      loyer_m2_mensuel: c.sum_m2_mens ? Math.round(c.sum_prix_mensuel / c.sum_m2_mens) : null,
      loyer_mensuel_moyen: c.cnt_prix_mensuel ? Math.round(c.sum_prix_mensuel / c.cnt_prix_mensuel) : null,
      prix_nuit_moyen: c.cnt_prix_nuit ? Math.round(c.sum_prix_nuit / c.cnt_prix_nuit) : null,
    }));

  const by_quartier = byQuartierRaw
    .filter((q) => q._id && q._id.quartier && q._id.commune)
    .map((q) => ({ commune: q._id.commune, quartier: q._id.quartier, nb: q.nb }))
    .sort((a, b) => b.nb - a.nb);

  console.log('[2] dimensions OK', JSON.stringify({ p: by_periode.length, t: by_type.length, c: by_commune.length, q: by_quartier.length }));

  // ── Buckets de prix ────────────────────────────────────────────────────
  const MENS_BOUNDS = [0, 2000, 4000, 6000, 8000, 10000, 15000, 20000, 30000, 50000];
  const NUIT_BOUNDS = [0, 200, 400, 600, 800, 1000, 1500, 3000, 8000];

  const [bucketsMensuel, bucketsNuitee] = await Promise.all([
    coll.aggregate([
      { $match: { operation: 'Location', periode_norm: 'mois', prix_mensuel_dh: { $gt: 0 } } },
      {
        $bucket: {
          groupBy: '$prix_mensuel_dh',
          boundaries: MENS_BOUNDS,
          default: '50k+',
          output: { count: { $sum: 1 } },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray(),
    coll.aggregate([
      { $match: { operation: 'Location', periode_norm: 'jour', prix_nuit_dh: { $gt: 0 } } },
      {
        $bucket: {
          groupBy: '$prix_nuit_dh',
          boundaries: NUIT_BOUNDS,
          default: '8k+',
          output: { count: { $sum: 1 } },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray(),
  ]);

  // ── Tendance temporelle (par mois) ────────────────────────────────────
  const trendRaw = await coll.aggregate([
    { $match: { operation: 'Location', date_annonce: { $ne: null } } },
    { $group: {
      _id: { $dateToString: { format: '%Y-%m', date: '$date_annonce' } },
      mensuel: { $sum: { $cond: [{ $eq: ['$periode_norm', 'mois'] }, 1, 0] } },
      nuitee: { $sum: { $cond: [{ $eq: ['$periode_norm', 'jour'] }, 1, 0] } },
    } },
    { $sort: { _id: 1 } },
  ]).toArray();
  const trend = trendRaw
    .filter((t) => t._id)
    .map((t) => ({ mois: t._id, mensuel: t.mensuel, nuitee: t.nuitee }));

  // ── Insights ──────────────────────────────────────────────────────────
  const insights = [];
  if (averages.loyer_mensuel) {
    insights.push(`Loyer mensuel moyen de ${averages.loyer_mensuel.toLocaleString('fr-FR')} MAD sur la région Marrakech-Safi.`);
  }
  if (averages.prix_nuit) {
    insights.push(`Prix moyen d'une nuitée : ${averages.prix_nuit.toLocaleString('fr-FR')} MAD.`);
  }
  if (by_commune.length) {
    const top = by_commune[0];
    insights.push(`La commune « ${top.commune} » concentre ${top.nb.toLocaleString('fr-FR')} annonces de location (m&eacute;diane du parc).`);
  }

  const doc = {
    _id: 'global',
    generated_at: new Date().toISOString(),
    counts: {
      total: g.total || 0,
      mensuel: g.mensuel || 0,
      nuitee: g.nuitee || 0,
      communes: by_commune.length,
      quartiers: by_quartier.length,
      types: by_type.length,
    },
    averages,
    by_periode,
    by_type,
    by_commune,
    by_quartier,
    buckets_mensuel: bucketEntries(bucketsMensuel, MENS_BOUNDS),
    buckets_nuitee: bucketEntries(bucketsNuitee, NUIT_BOUNDS),
    trend,
    insights,
  };

  await out.deleteMany({});
  await out.insertOne(doc);

  const final = await out.findOne({ _id: 'global' });
  console.log('[done] dashboard_stats_location générée', JSON.stringify({
    total: final.counts.total,
    mensuel: final.counts.mensuel,
    nuitee: final.counts.nuitee,
    communes: final.counts.communes,
    quartiers: final.counts.quartiers,
    buckets_m: final.buckets_mensuel.length,
    buckets_n: final.buckets_nuitee.length,
    trend: final.trend.length,
  }));

  await mongoose.disconnect();
}

run().then(() => { console.log('precompute:location termine'); process.exit(0); })
  .catch((e) => { console.error('ERR', e); process.exit(1); });