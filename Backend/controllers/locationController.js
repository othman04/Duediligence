/**
 * locationController.js
 *
 * Volet LOCATION — endpoints pour l'étape "Localisation" (Estimer un bien)
 * et pour la page Analytique (statistiques précalculées).
 *
 * Convention : les annonces Location vivent dans la collection unifiée
 * `properties` avec `operation = 'Location'` (même convention que Vente).
 * `periode_norm` distingue "mois" (mensuel) de "jour" (nuitée).
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const PROP_COLL = 'properties';

// ── Géométrie des communes — chargée une seule fois ──────────────────────
// Source 1 (prioritaire) : collection MongoDB `geo_communes` (import via
//   scripts/import_geo_data.js) — les données vivent dans la base.
// Source 2 (fallback)    : Backend/data/communes.geojson.
const GEOJSON_PATH = path.join(__dirname, '..', 'data', 'communes.geojson');

let COMMUNE_POLYS = null;

async function loadCommunesFromMongo() {
  try {
    const docs = await mongoose.connection.db
      .collection('geo_communes')
      .find({}, { projection: { com_fr: 1, ring: 1, _id: 0 } })
      .toArray();
    if (!docs.length) return null;
    return docs
      .filter((d) => d.com_fr && Array.isArray(d.ring) && d.ring.length >= 3)
      .map((d) => ({ name: d.com_fr, ring: d.ring }));
  } catch {
    return null; // base indisponible -> fallback fichier
  }
}

async function loadCommunes() {
  if (COMMUNE_POLYS) return COMMUNE_POLYS;

  // 1) MongoDB (données sauvegardées en base)
  const fromDb = await loadCommunesFromMongo();
  if (fromDb && fromDb.length) {
    COMMUNE_POLYS = fromDb;
    return COMMUNE_POLYS;
  }

  // 2) Fallback : fichier local Backend/data/communes.geojson
  const gj = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf-8'));
  const polys = [];
  for (const feat of gj.features || []) {
    const name = feat?.properties?.com_fr;
    if (!name) continue;
    const geom = feat.geometry || {};
    const rings = [];
    if (geom.type === 'Polygon') rings.push(...(geom.coordinates || []));
    else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates || []) rings.push(...(poly || []));
    }
    for (const ring of rings) {
      if (Array.isArray(ring) && ring.length >= 3) polys.push({ name, ring });
    }
  }
  COMMUNE_POLYS = polys;
  return polys;
}

function pointInRing(lng, lat, ring) {
  let inside = false;
  const n = ring.length;
  let j = n - 1;
  for (let i = 0; i < n; i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

async function communeFromPoint(lat, lng) {
  const polys = await loadCommunes();
  for (const { name, ring } of polys) {
    if (pointInRing(lng, lat, ring)) return name;
  }
  return null;
}

// ── Helpers statistiques ────────────────────────────────────────────────
const median = (arr) => {
  if (!arr || !arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const round = (v, d = 0) => (Number.isFinite(v) ? Number(v.toFixed(d)) : null);

/**
 * Centre réel d'une commune / d'un quartier = MÉDIANE des lat/long des
 * annonces Location (pas la moyenne : une annonce mal géocodée ne doit pas
 * déplacer le centre — correctif pour les noms contenant une apostrophe).
 */
async function medianCenter(commune, quartier) {
  const match = { operation: 'Location' };
  if (commune) match.commune_officielle = commune;
  if (quartier) {
    match.quartier = { $regex: new RegExp(`^\\s*${escapeRegex(quartier)}\\s*$`, 'i') };
  }
  const rows = await mongoose.connection.db.collection(PROP_COLL).aggregate([
    { $match: match },
    { $project: { lat: '$latitude', lng: '$longitude', _id: 0 } },
  ]).toArray();
  const lats = rows.map((r) => r.lat).filter((v) => Number.isFinite(v));
  const lngs = rows.map((r) => r.lng).filter((v) => Number.isFinite(v));
  return {
    lat: round(median(lats), 6),
    lng: round(median(lngs), 6),
    count: Math.min(lats.length, lngs.length),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 1. GET /api/v1/location/options
//    Communes + types distincts des annonces Location
// ─────────────────────────────────────────────────────────────────────────
exports.getOptions = async (req, res) => {
  const col = mongoose.connection.db.collection(PROP_COLL);
  const [communes, types] = await Promise.all([
    col.distinct('commune_officielle', { operation: 'Location' }),
    col.distinct('type_bien', { operation: 'Location' }),
  ]);
  res.json({
    communes: communes.filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr')),
    types_bien: types.filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr')),
  });
};

// ─────────────────────────────────────────────────────────────────────────
// 2. GET /api/v1/location/quartiers?commune=X
//    Quartiers distincts de la commune (liste filtrée dynamiquement)
// ─────────────────────────────────────────────────────────────────────────
exports.getQuartiers = async (req, res) => {
  const { commune } = req.query;
  const col = mongoose.connection.db.collection(PROP_COLL);
  const match = { operation: 'Location' };
  if (commune) match.commune_officielle = commune;
  const quartiers = await col.distinct('quartier', match);
  res.json({
    quartiers: quartiers.filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr')),
  });
};

// ─────────────────────────────────────────────────────────────────────────
// 3. GET /api/v1/location/commune-center?commune=X
//    Centre = médiane des annonces de la commune
// ─────────────────────────────────────────────────────────────────────────
exports.getCommuneCenter = async (req, res) => {
  const { commune } = req.query;
  if (!commune) return res.status(400).json({ error: 'commune requis' });
  const center = await medianCenter(commune, null);
  if (!center.lat || !center.lng) {
    return res.status(404).json({ error: 'Aucune annonce pour cette commune' });
  }
  res.json({ commune, ...center, zoom: 12 });
};

// ─────────────────────────────────────────────────────────────────────────
// 4. GET /api/v1/location/quartier-center?commune=X&quartier=Y
//    Centre réel = MÉDIANE des annonces du quartier.
//    Gère correctement les noms avec apostrophe (M'Hamid) : la requête
//    cible EXACTEMENT le quartier (regex échappée, fin de chaîne).
// ─────────────────────────────────────────────────────────────────────────
exports.getQuartierCenter = async (req, res) => {
  const { commune, quartier } = req.query;
  if (!quartier) return res.status(400).json({ error: 'quartier requis' });
  const center = await medianCenter(commune, quartier);
  if (!center.lat || !center.lng) {
    return res.status(404).json({ error: 'Aucune annonce pour ce quartier' });
  }
  res.json({ commune: commune || null, quartier, ...center, zoom: 15 });
};

// ─────────────────────────────────────────────────────────────────────────
// 5. POST /api/v1/location/resolve  body: { lat, lng }
//    → commune (point-in-polygon communes.geojson)
//    → quartier le plus proche ($geoNear restreint à la commune)
// ─────────────────────────────────────────────────────────────────────────
exports.resolveLocation = async (req, res) => {
  const lat = parseFloat(req.body?.lat);
  const lng = parseFloat(req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat/lng requis' });
  }

  const commune = await communeFromPoint(lat, lng);
  const col = mongoose.connection.db.collection(PROP_COLL);
  // $geoNear doit être le PREMIER stage du pipeline : la restriction
  // (commune + operation) passe par l'option `query`, pas par un $match.
  const nearQuery = { operation: 'Location', geo: { $ne: null } };
  if (commune) nearQuery.commune_officielle = commune;

  const nearest = await col
    .aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distance_m',
          spherical: true,
          key: 'geo',
          query: nearQuery,
        },
      },
      { $limit: 1 },
      { $project: { quartier: 1, commune_officielle: 1, _id: 0 } },
    ])
    .toArray();

  res.json({
    lat,
    lng,
    commune_officielle: commune || nearest[0]?.commune_officielle || null,
    quartier: nearest[0]?.quartier || null,
    distance_m: nearest[0]?.distance_m != null ? Math.round(nearest[0].distance_m) : null,
  });
};

// ─────────────────────────────────────────────────────────────────────────
// 6. GET /api/v1/location/dashboard
//    Lecture directe de `dashboard_stats_location` (précalculé).
//    Aucune agrégation live sur `properties` → chargement < 1 s.
// ─────────────────────────────────────────────────────────────────────────
exports.getLocationDashboard = async (req, res) => {
  const col = mongoose.connection.db.collection('dashboard_stats_location');
  const globalStat = await col.findOne({ _id: 'global' });
  if (!globalStat) {
    return res.status(404).json({
      error: 'Statistiques location non générées. Lancer : npm run precompute:location',
    });
  }

  const { commune, quartier, type_bien, periode } = req.query;

  let byCommune = globalStat.by_commune || [];
  let byType = globalStat.by_type || [];
  let byQuartier = globalStat.by_quartier || [];

  if (commune) {
    byCommune = byCommune.filter((c) => c.commune === commune);
    byQuartier = byQuartier.filter((q) => q.commune === commune);
  }
  if (quartier) byQuartier = byQuartier.filter((q) => q.quartier === quartier);
  if (type_bien) byType = byType.filter((t) => t.type_bien === type_bien);

  const counts = { ...globalStat.counts };
  if (periode === 'mois') counts.total = counts.mensuel;
  if (periode === 'jour') counts.total = counts.nuitee;

  res.json({
    generated_at: globalStat.generated_at,
    kpis: {
      total_annonces: counts.total || globalStat.counts.total,
      total_mensuel: counts.mensuel ?? globalStat.counts.mensuel,
      total_nuitee: counts.nuitee ?? globalStat.counts.nuitee,
      total_communes: globalStat.counts.communes,
      total_quartiers: globalStat.counts.quartiers,
      avg_loyer_mensuel: globalStat.averages.loyer_mensuel,
      avg_loyer_m2_mensuel: globalStat.averages.loyer_m2_mensuel,
      avg_prix_nuit: globalStat.averages.prix_nuit,
      avg_prix_nuit_m2: globalStat.averages.prix_nuit_m2,
    },
    by_commune: byCommune,
    by_type: byType,
    by_quartier: byQuartier,
    by_periode: globalStat.by_periode || [],
    buckets_mensuel: globalStat.buckets_mensuel || [],
    buckets_nuitee: globalStat.buckets_nuitee || [],
    trend: globalStat.trend || [],
    insights: globalStat.insights || [],
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/location/sale-zones — communes + quartiers distincts du dataset
// VENTE (collection `dataset_model_ready_cleaned`, colonnes `commune_fr` /
// `localisation_quartier`). Normalisation insensible à la casse/accents :
// "Marrakeche" et "marrakeche" sont fusionnés sous leur forme la plus fréquente.
const _stripAccents = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

exports.getSaleZones = async (req, res) => {
  try {
    const col = mongoose.connection.db.collection("dataset_model_ready_cleaned");
    const rows = await col
      .find({}, { projection: { commune_fr: 1, localisation_quartier: 1, _id: 0 } })
      .toArray();

    // clé normalisée -> { canon: forme la plus fréquente, quartiers: Map }
    const villes = new Map();
    for (const r of rows) {
      const ville = r.commune_fr;
      if (!ville || !String(ville).trim()) continue;
      const kV = _stripAccents(ville);
      if (!villes.has(kV)) villes.set(kV, { canon: new Map(), quartiers: new Map() });
      const v = villes.get(kV);
      v.canon.set(String(ville).trim(), (v.canon.get(String(ville).trim()) || 0) + 1);

      const q = r.localisation_quartier;
      if (!q || !String(q).trim()) continue;
      const kQ = _stripAccents(q);
      if (!v.quartiers.has(kQ)) v.quartiers.set(kQ, { canon: new Map() });
      const qEntry = v.quartiers.get(kQ);
      qEntry.canon.set(String(q).trim(), (qEntry.canon.get(String(q).trim()) || 0) + 1);
    }

    const mostFrequent = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const sumCounts = (m) => [...m.values()].reduce((a, b) => a + b, 0);

    const zones = [...villes.values()]
      .map((v) => ({
        ville: mostFrequent(v.canon),
        count: sumCounts(v.canon),
        quartiers: [...v.quartiers.values()]
          .map((q) => ({ nom: mostFrequent(q.canon), count: sumCounts(q.canon) }))
          .sort((a, b) => b.count - a.count)
          .map((q) => q.nom),
      }))
      .sort((a, b) => b.count - a.count);

    res.json({ zones });
  } catch (e) {
    res.status(500).json({ error: "Impossible de lire les zones Vente", detail: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Zones VENTE : centre réel + résolution clic carte
// Source : dataset_model_ready_cleaned (latitude/longitude par annonce).
// Cache mémoire chargé une seule fois (~57k lignes × 4 champs).
// ─────────────────────────────────────────────────────────────────────────────
const SALE_DATASET = "dataset_model_ready_cleaned";
let SALE_POINTS = null;

async function getSalePoints() {
  if (SALE_POINTS) return SALE_POINTS;
  const rows = await mongoose.connection.db
    .collection(SALE_DATASET)
    .find(
      { latitude: { $ne: null }, longitude: { $ne: null } },
      { projection: { commune_fr: 1, localisation_quartier: 1, latitude: 1, longitude: 1, _id: 0 } }
    )
    .toArray();
  SALE_POINTS = rows.map((r) => ({
    vk: _stripAccents(r.commune_fr),           // clé commune normalisée
    qk: _stripAccents(r.localisation_quartier), // clé quartier normalisée
    v: String(r.commune_fr || "").trim(),
    q: String(r.localisation_quartier || "").trim(),
    lat: Number(r.latitude),
    lng: Number(r.longitude),
  })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  return SALE_POINTS;
}

function _medianSale(vals) {
  if (!vals.length) return null;
  const s = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const m = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return Math.round(m * 1e6) / 1e6;
}

// GET /api/v1/location/sale-commune-center?ville=X
// Centre de la commune = MÉDIANE des annonces du dataset Vente.
exports.getSaleCommuneCenter = async (req, res) => {
  try {
    const { ville } = req.query;
    if (!ville) return res.status(400).json({ error: "ville requis" });
    const pts = await getSalePoints();
    const vk = _stripAccents(ville);
    const sel = pts.filter((p) => p.vk === vk);
    if (!sel.length) return res.status(404).json({ error: "Aucune annonce Vente pour cette commune" });
    res.json({
      lat: _medianSale(sel.map((p) => p.lat)),
      lng: _medianSale(sel.map((p) => p.lng)),
      count: sel.length,
      zoom: 11,
    });
  } catch (e) {
    res.status(500).json({ error: "Erreur centre commune vente", detail: e.message });
  }
};

// GET /api/v1/location/sale-quartier-center?ville=X&quartier=Y
// Centre RÉEL du quartier = MÉDIANE des annonces de CE quartier.
exports.getSaleQuartierCenter = async (req, res) => {
  try {
    const { ville, quartier } = req.query;
    if (!quartier) return res.status(400).json({ error: "quartier requis" });
    const pts = await getSalePoints();
    let sel = pts.filter((p) => p.qk === _stripAccents(quartier));
    if (!sel.length) return res.status(404).json({ error: "Aucune annonce Vente pour ce quartier" });
    // Même orthographe dans plusieurs communes ? On affine avec la ville.
    if (ville) {
      const vk = _stripAccents(ville);
      const narrowed = sel.filter((p) => p.vk === vk);
      if (narrowed.length) sel = narrowed;
    }
    res.json({
      lat: _medianSale(sel.map((p) => p.lat)),
      lng: _medianSale(sel.map((p) => p.lng)),
      count: sel.length,
      zoom: 15,
    });
  } catch (e) {
    res.status(500).json({ error: "Erreur centre quartier vente", detail: e.message });
  }
};

// POST /api/v1/location/sale-resolve  body: { lat, lng }
// Clic carte (mode Vente) → commune via polygones + quartier le plus proche
// parmi les ANNONCES DE VENTE réelles de cette commune (distance haversine).
exports.resolveSaleLocation = async (req, res) => {
  try {
    const lat = parseFloat(req.body?.lat);
    const lng = parseFloat(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "lat/lng requis" });
    }
    const commune = await communeFromPoint(lat, lng);
    const pts = await getSalePoints();
    let pool = pts;
    if (commune) {
      const vk = _stripAccents(commune);
      const filtered = pts.filter((p) => p.vk === vk);
      if (filtered.length) pool = filtered; // sinon fallback sur tout le dataset
    }
    let best = null;
    const R = 6371000;
    const rad = Math.PI / 180;
    for (const p of pool) {
      const dLat = (p.lat - lat) * rad;
      const dLng = (p.lng - lng) * rad;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat * rad) * Math.cos(p.lat * rad) * Math.sin(dLng / 2) ** 2;
      const d = 2 * R * Math.asin(Math.sqrt(a));
      if (!best || d < best.d) best = { d, p };
    }
    res.json({
      lat,
      lng,
      commune_officielle: commune || best?.p.v || null,
      quartier: best ? best.p.q : null,
      distance_m: best ? Math.round(best.d) : null,
    });
  } catch (e) {
    res.status(500).json({ error: "Erreur résolution vente", detail: e.message });
  }
};