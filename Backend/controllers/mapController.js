const Property = require('../models/Property');
const mongoose = require('mongoose');

/**
 * GET /api/v1/map/properties
 * GeoJSON des biens immobiliers
 */
exports.getMapProperties = async (req, res) => {
  const { region, ville, type_bien, operation, limit = 5000 } = req.query;
  const match = { geocoded: true };
  if (region)    match.region    = region;
  if (ville)     match.ville     = ville;
  if (type_bien) match.type_bien = type_bien;
  if (operation) match.operation = operation;

  const properties = await Property.find(
    match,
    { id: 1, latitude: 1, longitude: 1, type_bien: 1, operation: 1, prix: 1,
      surface_effective_m2: 1, ville: 1, quartier: 1, titre: 1 }
  ).limit(parseInt(limit)).lean();

  const geojson = {
    type: 'FeatureCollection',
    features: properties.map(p => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [p.longitude, p.latitude],
      },
      properties: {
        id:        p.id,
        type_bien: p.type_bien,
        operation: p.operation,
        prix:      p.prix,
        surface:   p.surface_effective_m2,
        ville:     p.ville,
        quartier:  p.quartier,
        titre:     p.titre,
        prix_m2:   p.surface_effective_m2 > 0 ? Math.round(p.prix / p.surface_effective_m2) : null,
      },
    })),
  };

  res.json(geojson);
};

/**
 * GET /api/v1/map/pois
 * GeoJSON des points d'intérêt (POIs)
 */
exports.getMapPois = async (req, res) => {
  const { ville, type, categorie } = req.query;
  const db = mongoose.connection.db;
  const match = {};
  if (ville)     match.ville     = ville;
  if (type)      match.type      = type;
  if (categorie) match.categorie = categorie;

  const pois = await db.collection('pois').find(match, {
    projection: { osm_id: 1, type: 1, categorie: 1, nom: 1, latitude: 1, longitude: 1, ville: 1 }
  }).limit(10000).toArray();

  const geojson = {
    type: 'FeatureCollection',
    features: pois.filter(p => p.latitude && p.longitude).map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
      properties: { id: p._id, osm_id: p.osm_id, type: p.type, categorie: p.categorie, nom: p.nom, ville: p.ville },
    })),
  };

  res.json(geojson);
};

/**
 * GET /api/v1/map/zones
 * GeoJSON des zones d'aménagement
 */
exports.getMapZones = async (req, res) => {
  const db = mongoose.connection.db;
  const zones = await db.collection('zones').find({}).toArray();

  const features = zones
    .filter(z => z.geometry_json)
    .map(z => {
      let geometry;
      try { geometry = typeof z.geometry_json === 'string' ? JSON.parse(z.geometry_json) : z.geometry_json; }
      catch { return null; }
      return {
        type: 'Feature',
        geometry,
        properties: {
          id:          z._id,
          zone_id:     z.zone_id,
          zoning_code: z.zoning_code,
          designation: z.designation,
          category:    z.category,
        },
      };
    })
    .filter(Boolean);

  res.json({ type: 'FeatureCollection', features });
};

/**
 * GET /api/v1/map/routes
 * GeoJSON des routes
 */
exports.getMapRoutes = async (req, res) => {
  const { ville, highway_type, limit = 2000 } = req.query;
  const db = mongoose.connection.db;
  const match = {};
  if (ville)        match.ville        = ville;
  if (highway_type) match.highway_type = highway_type;

  const routes = await db.collection('routes').find(match, {
    projection: { osm_id: 1, highway_type: 1, name: 1, lat_start: 1, lon_start: 1, lat_end: 1, lon_end: 1, ville: 1 }
  }).limit(parseInt(limit)).toArray();

  const features = routes
    .filter(r => r.lat_start && r.lon_start && r.lat_end && r.lon_end)
    .map(r => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[r.lon_start, r.lat_start], [r.lon_end, r.lat_end]],
      },
      properties: { id: r._id, osm_id: r.osm_id, highway_type: r.highway_type, name: r.name, ville: r.ville },
    }));

  res.json({ type: 'FeatureCollection', features });
};
