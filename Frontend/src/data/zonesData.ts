import communesGeoJsonRaw from './communes_marrakech.geojson?raw';
import quartiersGeoJsonRaw from './quartiers_marrakech.geojson?raw';

const communesGeoJson = typeof communesGeoJsonRaw === 'string' ? JSON.parse(communesGeoJsonRaw) : communesGeoJsonRaw;
const quartiersGeoJson = typeof quartiersGeoJsonRaw === 'string' ? JSON.parse(quartiersGeoJsonRaw) : quartiersGeoJsonRaw;


export type ZonePolygon = [number, number][];

/** Convert GeoJSON [lon, lat] coordinates to Leaflet [lat, lon] coordinates */
function extractPolygonCoordinates(geometry: any): ZonePolygon {
  if (!geometry || !geometry.coordinates || !Array.isArray(geometry.coordinates)) {
    return [];
  }

  try {
    if (geometry.type === 'Polygon') {
      const outerRing = geometry.coordinates[0];
      if (Array.isArray(outerRing)) {
        return outerRing.map((pt: [number, number]) => [pt[1], pt[0]] as [number, number]);
      }
    } else if (geometry.type === 'MultiPolygon') {
      const firstPolyRing = geometry.coordinates[0]?.[0];
      if (Array.isArray(firstPolyRing)) {
        return firstPolyRing.map((pt: [number, number]) => [pt[1], pt[0]] as [number, number]);
      }
    }
  } catch (e) {
    console.warn('Error parsing GeoJSON geometry:', e);
  }
  return [];
}

/** Fallback generator for organic polygons if geometry is absent */
export function genZone(lat: number, lng: number, km: number, sides = 14): ZonePolygon {
  const pts: ZonePolygon = [];
  const latK = 111;
  const lngK = 111 * Math.cos((lat * Math.PI) / 180);
  const seed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453) % 1;
  
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides;
    const variation = 0.86 + 0.18 * Math.sin(angle * 3 + seed * 6.28) + 0.09 * Math.cos(angle * 2 - seed * 3.14);
    const r = km * variation;
    const dLat = (r / latK) * Math.cos(angle);
    const dLng = (r / lngK) * Math.sin(angle);
    pts.push([
      Number((lat + dLat).toFixed(5)),
      Number((lng + dLng).toFixed(5))
    ]);
  }
  return pts;
}

export interface GeoJsonFeatureItem {
  name: string;
  id?: number;
  color_rgb?: [number, number, number];
  area_px?: number;
  centroid_lat?: number;
  centroid_lon?: number;
  pts: ZonePolygon;
}

export const ALL_COMMUNE_GEOJSON_FEATURES: GeoJsonFeatureItem[] = [];
export const COMMUNE_ZONES: Record<string, ZonePolygon> = {};

if (communesGeoJson && Array.isArray(communesGeoJson.features)) {
  communesGeoJson.features.forEach((feat: any) => {
    const name = feat?.properties?.commune_fr || feat?.properties?.nom || feat?.properties?.name;
    const poly = extractPolygonCoordinates(feat?.geometry);
    if (name && poly.length > 0) {
      COMMUNE_ZONES[name] = poly;
      COMMUNE_ZONES[name.trim().toLowerCase()] = poly;
      ALL_COMMUNE_GEOJSON_FEATURES.push({
        name,
        centroid_lat: feat?.properties?.centroid_lat || poly[0][0],
        centroid_lon: feat?.properties?.centroid_lon || poly[0][1],
        pts: poly
      });
    }
  });
}

export const ALL_QUARTIER_GEOJSON_FEATURES: GeoJsonFeatureItem[] = [];
export const QUARTIER_ZONES: Record<string, ZonePolygon> = {};

if (quartiersGeoJson && Array.isArray(quartiersGeoJson.features)) {
  quartiersGeoJson.features.forEach((feat: any) => {
    const poly = extractPolygonCoordinates(feat?.geometry);
    if (poly.length > 0) {
      const mainName = feat?.properties?.name || feat?.properties?.nom_zone;

      if (mainName) {
        ALL_QUARTIER_GEOJSON_FEATURES.push({
          name: mainName,
          id: feat?.properties?.id,
          color_rgb: feat?.properties?.color_rgb,
          area_px: feat?.properties?.area_px,
          centroid_lat: feat?.properties?.centroid_lat,
          centroid_lon: feat?.properties?.centroid_lon,
          pts: poly
        });

        // Full name
        QUARTIER_ZONES[mainName] = poly;
        QUARTIER_ZONES[mainName.trim().toLowerCase()] = poly;

        // Clean parenthetical annotations like "(en développement)"
        const cleanParentheses = mainName.replace(/\s*\(.*?\)/g, '').trim();
        if (cleanParentheses && cleanParentheses !== mainName) {
          QUARTIER_ZONES[cleanParentheses] = poly;
          QUARTIER_ZONES[cleanParentheses.toLowerCase()] = poly;
        }

        // Split slash separated composite names like "Douar El Askar / Azli" -> "Douar El Askar", "Azli"
        if (mainName.includes('/')) {
          const parts = mainName.split('/');
          parts.forEach((p: string) => {
            const pClean = p.trim();
            if (pClean) {
              QUARTIER_ZONES[pClean] = poly;
              QUARTIER_ZONES[pClean.toLowerCase()] = poly;
            }
          });
        }
      }

      // Legacy fallback properties if present
      const nomZone = feat?.properties?.nom_zone;
      const quartiersRegroupes = feat?.properties?.quartiers_regroupes;
      if (nomZone) {
        QUARTIER_ZONES[nomZone] = poly;
        QUARTIER_ZONES[nomZone.trim().toLowerCase()] = poly;
      }
      if (Array.isArray(quartiersRegroupes)) {
        quartiersRegroupes.forEach((qName: string) => {
          if (qName) {
            QUARTIER_ZONES[qName] = poly;
            QUARTIER_ZONES[qName.trim().toLowerCase()] = poly;
          }
        });
      }
    }
  });
}

/** Get accurate GeoJSON polygon for a commune or quartier */
export function getZonePolygon(
  name: string,
  lat: number,
  lng: number,
  nombreBiens: number,
  isCommune: boolean
): ZonePolygon {
  if (!name) return genZone(lat, lng, 1, 14);

  const cleanName = name.trim();
  const lowerName = cleanName.toLowerCase();

  const lookupDict = isCommune ? COMMUNE_ZONES : QUARTIER_ZONES;
  
  // Exact match or lowercase match
  let polygon = lookupDict[cleanName] || lookupDict[lowerName];

  // Try substring/partial matching if exact key not found
  if (!polygon) {
    const keys = Object.keys(lookupDict);
    const foundKey = keys.find(k => k.toLowerCase().includes(lowerName) || lowerName.includes(k.toLowerCase()));
    if (foundKey) {
      polygon = lookupDict[foundKey];
    }
  }

  if (polygon && polygon.length >= 3) {
    return polygon;
  }

  // Organic smooth fallback if no polygon available in GeoJSON
  const km = isCommune
    ? Math.min(Math.max(Math.sqrt(nombreBiens / 300) * 1.8, 1.4), 6.5)
    : Math.min(Math.max(Math.sqrt(nombreBiens / 120) * 0.75, 0.45), 2.2);

  return genZone(lat, lng, km, 14);
}

/** Check if a commune or quartier has a real GeoJSON geometry polygon */
export function isGeoJsonZone(name: string, isCommune: boolean): boolean {
  if (!name) return false;
  const cleanName = name.trim();
  const lowerName = cleanName.toLowerCase();
  const lookupDict = isCommune ? COMMUNE_ZONES : QUARTIER_ZONES;

  if (lookupDict[cleanName] || lookupDict[lowerName]) return true;
  const keys = Object.keys(lookupDict);
  return keys.some(k => k.toLowerCase().includes(lowerName) || lowerName.includes(k.toLowerCase()));
}


