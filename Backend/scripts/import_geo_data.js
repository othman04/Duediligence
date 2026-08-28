/**
 * import_geo_data.js
 *
 * Sauvegarde les données géographiques de référence dans MongoDB :
 *   - collection `geo_communes` : polygones des communes (com_fr + ring)
 *
 * Source : Backend/data/communes.geojson
 * Lancement : npm run import:geo   (à exécuter une fois)
 *
 * Le contrôleur locationController lit ces données EN PRIORITÉ depuis
 * MongoDB, avec fallback sur le fichier Backend/data/communes.geojson.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const GEOJSON_PATH = path.join(__dirname, '..', 'data', 'communes.geojson');
const OUT_COLL = 'geo_communes';

async function run() {
  await mongoose.connect(process.env.MONGO_URL, {
    serverSelectionTimeoutMS: 20000,
    socketTimeoutMS: 300000,
  });
  const db = mongoose.connection.db;
  const col = db.collection(OUT_COLL);

  const gj = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf-8'));
  const docs = [];
  for (const feat of gj.features || []) {
    const name = feat?.properties?.com_fr;
    const geom = feat?.geometry || {};
    if (!name) continue;

    const rings = [];
    if (geom.type === 'Polygon') rings.push(...(geom.coordinates || []));
    else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates || []) rings.push(...(poly || []));
    }
    for (const ring of rings) {
      if (Array.isArray(ring) && ring.length >= 3) {
        docs.push({ com_fr: name, ring });
      }
    }
  }

  await col.deleteMany({});
  if (docs.length) await col.insertMany(docs);
  await col.createIndex({ com_fr: 1 });

  console.log(`[import_geo] ${OUT_COLL}: ${docs.length} anneaux de polygones importes`);
  console.log(`[import_geo] communes distinctes: ${new Set(docs.map(d => d.com_fr)).size}`);

  await mongoose.disconnect();
}

run().then(() => process.exit(0)).catch((e) => { console.error('ERR', e); process.exit(1); });
