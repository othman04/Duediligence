import { ALL_QUARTIER_GEOJSON_FEATURES, ALL_COMMUNE_GEOJSON_FEATURES } from '../data/zonesData';
import { getQuartiersOf } from '../data/zonesRegion';

/**
 * List of unique Quartiers present in the ML model dataset
 */
export const MODEL_QUARTIERS: string[] = [
  "Essaouira (Ville/Autre)",
  "Amelkis",
  "Bab Lhmar",
  "Route de l'Ourika",
  "Arset El Houta",
  "Rmila",
  "Route de Casablanca",
  "Agdal",
  "Guéliz",
  "Moulay Lyazid",
  "Route de Safi (Marrakech)",
  "Palmeraie",
  "Route d'Amizmiz",
  "Massira 1",
  "Route de Ouarzazate",
  "Autre Secteur",
  "Route de Fès",
  "Essaouira - Sidi Kaouki",
  "Riad Al Atlas",
  "Camp Al Ghoul",
  "Route de Tahanaout",
  "Médina",
  "Mouassine",
  "Targa",
  "Indéfini",
  "Hay Izdihar",
  "Massira 3",
  "Chrifia",
  "Kaa El Machraa",
  "Arset Ihiri",
  "Sidi Mimoun",
  "Mabrouka",
  "Route De Sidi A. Ghiat",
  "Argan Golf Ressort",
  "Safi (Ville/Autre)",
  "M'hamid",
  "Les Portes de Marrakech",
  "Tanger",
  "Hay Charaf",
  "Azzouzia",
  "Michouar",
  "Sidi Bou Amar",
  "Victor Hugo",
  "Bab Atlas",
  "Afaq",
  "Essaouira - Médina",
  "Allal El Fassi",
  "Hay Al Bahja",
  "Sidi Abbad",
  "Kennaria",
  "Casablanca",
  "Hivernage",
  "Semlalia",
  "Jemaa El Fna",
  "Bab Aylan",
  "Ben Saleh",
  "El Moukef",
  "Massira",
  "Ain Mezouar",
  "Sidi Youssef Ben Ali",
  "Route d'Agadir - Essaouira (Marrakech)",
  "Majorelle",
  "Bin Lkchali",
  "Sakar",
  "Essaouira - Ghazoua",
  "Hay Annahda",
  "Autre",
  "Kaat Ben Nahid",
  "Derb Chtouka",
  "Dar Bouazza",
  "Sanaoubar",
  "Arset Ben Chebli",
  "Chichaoua",
  "Sidi Ben Slimane El Jazouli",
  "Douar Lkoudia",
  "El Jadida",
  "Centre Ville",
  "Azli",
  "Essaouira - Idaougard",
  "Sidi Ghanem",
  "Route De Lalla Takerkoust",
  "Socoma",
  "Ouasis",
  "Bouaakkaz",
  "Bd Moulay Abdellah",
  "Riad Zitoun",
  "Avenue Mohammed VI",
  "Daoudiate",
  "Marrakech",
  "Bab Doukkala",
  "Golf Argana",
  "Av Abdelkrim El Khattabi",
  "Ksibat Nhas",
  "Villas & Maisons De Luxe Marrakech",
  "Bouskoura",
  "Jenan El Ghali",
  "Route de Tamansourt",
  "Berrima",
  "Amerchich",
  "Assif",
  "Zaouia Sidi Ghalem",
  "Es Saada",
  "Massira 2",
  "Sidi Abdellah Ghiat",
  "Rahba Kedima",
  "Jnan Ben Chagra",
  "Marrakech Golf City",
  "Al Haouz",
  "Hay Al Hassani",
  "Safi - Hay Al Matar",
  "Jnane Laafia",
  "Hay Yasmina",
  "Safi - Sidi Bouzid",
  "Douar Chouhada",
  "Bab Ghmat",
  "Safi - Plateau",
  "Assouel",
  "Inara",
  "Issil",
  "Douar Iziki",
  "Terrain Titré D'Une Superficie De",
  "Rouidat",
  "Dar Dmana",
  "Bab Ighli",
  "Lotissement Les Palmiers",
  "Essebtiyen",
  "Av Mohammed V",
  "Hay Inara",
  "Safi - Lamiaa",
  "Tamensourt",
  "Bab Ighli Visite Virtuelle",
  "Route Du Barrage",
  "Kbour Chou",
  "Hay Al Haouz",
  "Rehamna",
  "Agadir",
  "Prestigia",
  "Oujda-Angad",
  "Fassi",
  "Safi - Azib Derai",
  "Youssoufia",
  "Salé",
  "Chwiter",
  "Safi - Jerifat",
  "Zaouiat Lahdar",
  "Boulevard Mohamed Vi",
  "Hay Saada",
  "Arset El Maach",
  "Rabat",
  "Masmoudi",
  "Kechich",
  "Hay Al Massar",
  "Hay Andalous",
  "Al Maaden",
  "Sofia",
  "Benslimane",
  "Kénitra",
  "Hay Lalla Haya",
  "Akioud",
  "Hay Alfadl",
  "Arset Moulay Moussa",
  "Massar",
  "Hay El Bahja",
  "Chtouka- Ait Baha",
  "Safi - Miftah El Kheir",
  "Laksour",
  "Boukar",
  "Route Des Golfs",
  "Jawhar",
  "Skhirate- Témara",
  "Berrechid",
  "Quartier Bab Doukkala",
  "Hay Nahda",
  "Meknès",
  "Sidi Mansour",
  "Jbilat",
  "Marrakech Maroc",
  "Al Maaden - Ain Slim",
  "Arset Moulay Bouaazza",
  "Koudia",
  "Golf Noria",
  "Douar Dlam",
  "Essaouira - Ounagha",
  "Fahs-Anjra",
  "Oulad Salah",
  "Douar Laaskar",
  "Hay Menara",
  "Iziki",
  "Hay Mohammadi",
  "Koudiat Laabid",
  "Errachidia",
  "Arset Sbaia",
  "Boumesmar",
  "Lac Takerkoust",
  "Tassoultante",
  "Arset Lamaach",
  "Route D'Agadir",
  "Hôpital Militaire",
  "Ain Iti",
  "Mohammedia",
  "S.Y.B.A",
  "Bab Taghazout",
  "Hay Zitoun",
  "Bab El Khemis",
  "Hay Hassani",
  "Lalla Takerkoust",
  "Tamesloht",
  "Hay Saada 1",
  "Riad Essalam",
  "Saada-Tissir",
  "Alal El Fassi",
  "Menara",
  "El Hara",
  "Moahmmedia",
  "Mellah",
  "Dar El Bacha",
  "Kasbah",
  "Plaza",
  "Route De Sidi A Ghiat",
  "Quartier Bab Ghmate",
  "Saada",
  "Hay Firdaouss",
  "Avenue Mohamed Vi",
  "El Fadel",
  "Tiznit",
  "Argan Golf",
  "Rouidate",
  "Harti",
  "Taroudannt",
  "Essaada",
  "Bab Douakkala",
  "Jardin De La Koutoubia",
  "Aouatif",
  "Chefchaouen",
  "Avenue Yacoub El Mansour",
  "Golf Argan",
  "Asni",
  "Douar El Guern",
  "Route De Ouarzazat",
  "Al Maaden Alliances",
  "Des Dunes",
  "Hay Chouhada",
  "Moulay Yacoub",
  "Sefrou",
  "Douar El Bared",
  "Oulad Said",
  "Azilal",
  "Ouled Jelal",
  "Béni Mellal",
  "Douar Bouazza",
  "Khémisset"
];

/**
 * List of unique Communes present in the ML model dataset
 */
export const MODEL_COMMUNES: string[] = [
  "Marrakech",
  "Zaouia Annahlia",
  "Mechouar Kasbah",
  "Al Ouidane",
  "Tasoultante",
  "Oulad Hassoun",
  "Ouahat Sidi Brahim",
  "Ourika",
  "Tameslouht",
  "Saâda",
  "Sidi Abdallah Ghiat",
  "Sti Fadma",
  "Loudaya",
  "Harbil",
  "Aghouatim",
  "Lalla Takarkoust",
  "Chichaoua",
  "Souihla",
  "Ait Sidi Daoud",
  "Asni",
  "Sidi Ghanem",
  "Imindounit",
  "Ait Faska",
  "Tahannaout",
  "Inconnu",
  "Ijoukak",
  "Agafay",
  "Tamazouzte",
  "Ouled Dlim",
  "Ghmate",
  "Amizmiz",
  "Gmassa",
  "Tamaguert"
];

/**
 * Clean string for diacritics and special chars matching
 */
function normalizeStr(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if a 2D point [lat, lng] is inside a polygon ring
 */
export function isPointInPolygon(point: [number, number], vs: [number, number][]): boolean {
  const x = point[0];
  const y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Calculate Euclidean distance between two lat/lng points
 */
function getDistanceSq(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = lat1 - lat2;
  const dLng = lng1 - lng2;
  return dLat * dLat + dLng * dLng;
}

/**
 * Match a raw address text against model Quartiers
 */
export function findQuartierByText(text: string): string | null {
  if (!text || !text.trim()) return null;

  const normalizedText = normalizeStr(text);

  // 1. Direct match or substring in MODEL_QUARTIERS
  // Sort by length descending to match longer specific names first (e.g., "Route de l'Ourika" before "Ourika")
  const sortedModelQuartiers = [...MODEL_QUARTIERS].sort((a, b) => b.length - a.length);

  for (const q of sortedModelQuartiers) {
    const qNorm = normalizeStr(q);
    if (qNorm.length < 3) continue;

    // Check exact word boundary match or inclusion
    if (normalizedText.includes(qNorm)) {
      return q;
    }
  }

  // 2. Direct match against GeoJSON feature names (which may have composite names like "Camp El Ghoul / Bayard")
  for (const feat of ALL_QUARTIER_GEOJSON_FEATURES) {
    const nameNorm = normalizeStr(feat.name);
    if (normalizedText.includes(nameNorm)) {
      // Find closest matching model quartier name
      const bestModelMatch = MODEL_QUARTIERS.find(mq => normalizeStr(feat.name).includes(normalizeStr(mq)));
      return bestModelMatch || feat.name;
    }
  }

  return null;
}

/**
 * Find quartier by coordinates using polygon intersection or nearest centroid
 */
export function findQuartierByCoords(lat: number, lng: number): { name: string; isExactPolygon: boolean } | null {
  // 1. Polygon intersection test
  for (const feat of ALL_QUARTIER_GEOJSON_FEATURES) {
    if (feat.pts && feat.pts.length >= 3) {
      if (isPointInPolygon([lat, lng], feat.pts)) {
        // Map feature name to exact model quartier name if available
        const featNorm = normalizeStr(feat.name);
        const modelMatch = MODEL_QUARTIERS.find(mq => normalizeStr(mq) === featNorm || featNorm.includes(normalizeStr(mq)));
        return {
          name: modelMatch || feat.name,
          isExactPolygon: true,
        };
      }
    }
  }

  // 2. Nearest centroid fallback
  let minDistance = Infinity;
  let nearestName: string | null = null;

  for (const feat of ALL_QUARTIER_GEOJSON_FEATURES) {
    let featLat = feat.centroid_lat;
    let featLng = feat.centroid_lon;

    if ((!featLat || !featLng) && feat.pts.length > 0) {
      featLat = feat.pts[0][0];
      featLng = feat.pts[0][1];
    }

    if (featLat && featLng) {
      const dist = getDistanceSq(lat, lng, featLat, featLng);
      if (dist < minDistance) {
        minDistance = dist;
        const featNorm = normalizeStr(feat.name);
        const modelMatch = MODEL_QUARTIERS.find(mq => normalizeStr(mq) === featNorm || featNorm.includes(normalizeStr(mq)));
        nearestName = modelMatch || feat.name;
      }
    }
  }

  if (nearestName) {
    return {
      name: nearestName,
      isExactPolygon: false,
    };
  }

  return null;
}

export interface QuartierResolution {
  matchedQuartier: string;
  confidence: 'exact_polygon' | 'text_match' | 'nearest_centroid' | 'default';
  isModelDataset: boolean;
}

/**
 * Primary resolver: takes lat, lng and optional address text and resolves the best matching Quartier from the dataset.
 */
export function resolveQuartier(lat?: number, lng?: number, addressText?: string): QuartierResolution {
  // 1. If lat/lng available, check if point is inside a GeoJSON polygon
  if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
    const coordsMatch = findQuartierByCoords(lat, lng);
    if (coordsMatch && coordsMatch.isExactPolygon) {
      return {
        matchedQuartier: coordsMatch.name,
        confidence: 'exact_polygon',
        isModelDataset: MODEL_QUARTIERS.includes(coordsMatch.name),
      };
    }
  }

  // 2. If address text is provided, try text matching against dataset
  if (addressText && addressText.trim()) {
    const textMatch = findQuartierByText(addressText);
    if (textMatch) {
      return {
        matchedQuartier: textMatch,
        confidence: 'text_match',
        isModelDataset: true,
      };
    }
  }

  // 3. Fallback to nearest centroid by coordinates
  if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
    const coordsMatch = findQuartierByCoords(lat, lng);
    if (coordsMatch) {
      return {
        matchedQuartier: coordsMatch.name,
        confidence: 'nearest_centroid',
        isModelDataset: MODEL_QUARTIERS.includes(coordsMatch.name),
      };
    }
  }

  // 4. Default fallback
  return {
    matchedQuartier: '',
    confidence: 'default',
    isModelDataset: false,
  };
}

/* ══════════════════════════════════════════════════════════════════
 * Résolution de ZONE 100 % front-end (données statiques GeoJSON)
 * ──────────────────────────────────────────────────────────────────
 * Corrige le bug de sélection de quartier : clic sur Ennakhil /
 * Ménara qui retombait sur Guéliz / Médina.
 *
 * Principes :
 *   1. Un point INCLUS dans le polygone d'un quartier → ce quartier
 *      (nom mappé vers la nomenclature du dataset si possible).
 *   2. Sinon un point inclus dans une commune → commune, et on cherche
 *      le quartier au CENTROÏDE LE PLUS PROCHE uniquement si celui-ci
 *      est à moins de ~2 km (empêche tout rattachement aberrant à
 *      l'autre bout de la ville).
 *   3. Sinon (zone hors couverture statique, ex : province éloignée)
 *      → résultats null ; l'appelant peut relancer une résolution
 *        côté serveur qui couvre toute la région.
 */
export interface ZoneResolution {
  commune: string | null;
  quartier: string | null;
  exact: boolean; // true si quartier trouvé par inclusion de polygone
}

function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLatKm = Math.abs(lat1 - lat2) * 111;
  const dLngKm = Math.abs(lng1 - lng2) * 111 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dLatKm * dLatKm + dLngKm * dLngKm);
}

/** Mise à jour du meilleur candidat + proche */
function nearestScore(
  lat: number,
  lng: number,
  name: string,
  cLat: number,
  cLng: number,
  best: { name: string; dist: number } | null
): { name: string; dist: number } | null {
  if (!Number.isFinite(cLat) || !Number.isFinite(cLng)) return best;
  const d = kmBetween(lat, lng, cLat, cLng);
  return !best || d < best.dist ? { name, dist: d } : best;
}

export function resolveZoneFromPoint(lat: number, lng: number): ZoneResolution {
  const pt: [number, number] = [lat, lng];

  // 1) Quartier dont le polygone contient le point → exact
  for (const feat of ALL_QUARTIER_GEOJSON_FEATURES) {
    if (feat.pts && feat.pts.length >= 3 && isPointInPolygon(pt, feat.pts)) {
      const norm = normalizeStr(feat.name);
      const modelMatch = MODEL_QUARTIERS.find(
        (mq) => normalizeStr(mq) === norm || norm.includes(normalizeStr(mq))
      );
      return { commune: null, quartier: modelMatch || feat.name, exact: true };
    }
  }

  // 2) Commune contenant le point
  let communeName: string | null = null;
  for (const feat of ALL_COMMUNE_GEOJSON_FEATURES) {
    if (feat.pts && feat.pts.length >= 3 && isPointInPolygon(pt, feat.pts)) {
      communeName = feat.name;
      break;
    }
  }

  // 3) Quartier le plus proche en combinant :
  //    - les centroïdes des polygones GeoJSON statiques
  //    - les centres de `zonesRegion` (couverture régionale élargie,
  //      y compris Safi/Essaouira/Kelaâ/Youssoufia/Benguerir/Chichaoua,
  //      indépendante de la base de données)
  //    → retourne TOUJOURS le plus proche (pas de null → plus jamais de
  //      case quartier vide ou qui reste bloquée sur la valeur précédente).
  let best: { name: string; dist: number } | null = null;

  for (const feat of ALL_QUARTIER_GEOJSON_FEATURES) {
    if (!feat.pts || feat.pts.length < 3) continue;
    const cLat = typeof feat.centroid_lat === 'number' ? feat.centroid_lat : feat.pts[0][0];
    const cLng = typeof feat.centroid_lon === 'number' ? feat.centroid_lon : feat.pts[0][1];
    const norm = normalizeStr(feat.name);
    const modelMatch = MODEL_QUARTIERS.find(
      (mq) => normalizeStr(mq) === norm || norm.includes(normalizeStr(mq))
    );
    best = nearestScore(lat, lng, modelMatch || feat.name, cLat, cLng, best);
  }

  // Centres statiques de `zonesRegion` : pour la commune détectée, ou (si
  // aucune commune trouvée) balayage des principales villes de la région.
  let staticQuartiers: { name: string; lat?: number; lng?: number }[] =
    communeName ? getQuartiersOf(communeName) : [];
  if (!communeName) {
    for (const city of [
      'Marrakech', 'Safi', 'Essaouira', 'Benguerir', 'Youssoufia',
      'El Kelaâ des Sraghna', 'Chichaoua', 'Tahannaout',
    ]) {
      staticQuartiers = staticQuartiers.concat(getQuartiersOf(city));
    }
  }
  for (const q of staticQuartiers) {
    if (q.lat != null && q.lng != null) {
      best = nearestScore(lat, lng, q.name, q.lat, q.lng, best);
    }
  }

  return {
    commune: communeName,
    quartier: best ? best.name : null,
    exact: false,
  };
}
