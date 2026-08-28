/**
 * zonesRegion.ts — Zones STATIQUES de la région Marrakech-Safi (front-end only).
 *
 * Ces listes ne dépendent PAS de la base MongoDB : elles couvrent toute la
 * région Marrakech-Safi (préfecture + 7 provinces), qu'il y ait ou non des
 * annonces enregistrées. Elles alimentent les selects Ville/Commune et Quartier
 * des pages « Estimer un bien » et « Investissement & risque ».
 *
 * - `COMMUNES_REGION` : communes/villes principales avec coordonnées du centre.
 * - `QUARTIERS_PAR_COMMUNE` : quartiers par commune (coordonnées optionnelles ;
 *   si absentes, on tente le centre médian calculé côté serveur, sinon le
 *   centre de la commune est utilisé).
 *
 * Pour ajouter une commune ou un quartier : ajouter simplement une entrée ici,
 * aucune migration ni import n'est nécessaire.
 */

export interface CommuneZone {
  name: string;
  lat: number;
  lng: number;
}

export interface QuartierEntry {
  name: string;
  lat?: number;
  lng?: number;
}

/* ────────────────────────────────────────────────────────────────────
 * Région Marrakech-Safi — communes principales (centre géographique réel)
 * ──────────────────────────────────────────────────────────────── */
export const COMMUNES_REGION: CommuneZone[] = [
  // Préfecture de Marrakech
  { name: 'Marrakech', lat: 31.6295, lng: -7.9811 },
  { name: 'Sidi Bou Othmane', lat: 31.6687, lng: -8.1353 },

  // Province d'Al Haouz
  { name: 'Tahannaout', lat: 31.3386, lng: -7.9572 },
  { name: 'Amizmiz', lat: 31.2504, lng: -8.2259 },
  { name: 'Asni', lat: 31.2539, lng: -7.9997 },
  { name: 'Moulay Brahim', lat: 31.2830, lng: -8.0791 },
  { name: 'Setti Fatma', lat: 31.2711, lng: -7.7109 },
  { name: 'Ourika', lat: 31.3525, lng: -7.8344 },
  { name: 'Ghmate', lat: 31.2833, lng: -7.7500 },
  { name: 'Tameslouht', lat: 31.4500, lng: -8.0767 },
  { name: 'Aït Ourir', lat: 31.3556, lng: -7.3767 },
  { name: 'Touama', lat: 31.4833, lng: -7.7917 },

  // Province de Chichaoua
  { name: 'Chichaoua', lat: 31.5456, lng: -8.7622 },
  { name: 'Sidi Mokhtar', lat: 31.3833, lng: -8.9000 },
  { name: 'Imintanoute', lat: 30.9958, lng: -8.9053 },

  // Province d'El Kelaâ des Sraghna
  { name: 'El Kelaâ des Sraghna', lat: 32.0510, lng: -7.3918 },
  { name: 'Sidi Rahal', lat: 32.0104, lng: -7.3422 },
  { name: 'El Attaouia', lat: 31.8844, lng: -7.9642 },
  { name: 'Ouahat Sidi Brahim', lat: 31.9029, lng: -7.3833 },
  { name: 'Zerkten', lat: 31.6667, lng: -7.5500 },

  // Province d'Essaouira
  { name: 'Essaouira', lat: 31.5085, lng: -9.7595 },
  { name: 'Tamanar', lat: 31.3200, lng: -9.4750 },
  { name: 'Smimou', lat: 31.4142, lng: -9.6042 },
  { name: 'Tidzi', lat: 31.3167, lng: -9.5833 },

  // Province des Rehamna
  { name: 'Benguerir', lat: 32.2419, lng: -7.9465 },
  { name: 'Skhour Rhamna', lat: 32.1500, lng: -8.0833 },
  { name: 'Labrikiyne', lat: 32.0333, lng: -8.2167 },

  // Province de Safi
  { name: 'Safi', lat: 32.2994, lng: -9.2372 },
  { name: 'Souira Kedima', lat: 32.2789, lng: -9.2278 },
  { name: 'Sebt Gzoula', lat: 32.1995, lng: -9.1955 },
  { name: 'Lakouassem', lat: 32.3167, lng: -9.1333 },

  // Province de Youssoufia
  { name: 'Youssoufia', lat: 32.2494, lng: -8.5295 },
  { name: 'Sidi Smail', lat: 32.1333, lng: -8.6833 },
  { name: 'Echemmaia', lat: 32.2667, lng: -8.3531 },
];

/* ---- Quartiers par commune (coordonnées facultatives mais utiles) ---- */
export const QUARTIERS_PAR_COMMUNE: Record<string, QuartierEntry[]> = {
  Marrakech: [
    { name: 'Guéliz', lat: 31.6362, lng: -8.0089 },
    { name: 'Hivernage', lat: 31.6210, lng: -8.0032 },
    { name: 'Menara', lat: 31.6400, lng: -8.0300 },
    { name: 'Targa', lat: 31.6420, lng: -8.0500 },
    { name: 'Massira', lat: 31.6670, lng: -8.0400 },
    { name: 'Daoudiate', lat: 31.6500, lng: -8.0100 },
    { name: 'Nakhil', lat: 31.6540, lng: -8.0660 },
    { name: 'Azli', lat: 31.6770, lng: -8.0230 },
    { name: 'Sidi Ghanem', lat: 31.7000, lng: -8.0100 },
    { name: 'Bab Doukkala', lat: 31.6340, lng: -7.9980 },
    { name: 'Semmar', lat: 31.6880, lng: -8.0410 },
    { name: 'Médina', lat: 31.6258, lng: -7.9891 },
    { name: 'Kasbah', lat: 31.6130, lng: -7.9880 },
    { name: 'Berrima', lat: 31.6180, lng: -7.9930 },
    { name: 'Jemaa El Fna', lat: 31.6258, lng: -7.9898 },
    { name: 'Arset El Maach', lat: 31.6300, lng: -7.9820 },
    { name: 'Palmeraie', lat: 31.6750, lng: -7.9330 },
    { name: 'Bab Ighli', lat: 31.6940, lng: -7.9680 },
    { name: 'Amelkis', lat: 31.6570, lng: -7.9330 },
    { name: 'Riyad Al Andalous', lat: 31.6390, lng: -7.9370 },
    { name: 'Assif B', lat: 31.6470, lng: -8.0000 },
    { name: 'Assif A', lat: 31.6530, lng: -7.9930 },
    { name: 'Amerchkane', lat: 31.6710, lng: -8.0010 },
    { name: 'Bengdiri', lat: 31.6770, lng: -7.9950 },
    { name: 'Mabrouka', lat: 31.6450, lng: -7.9690 },
    { name: "M'Hamid", lat: 31.5911, lng: -8.0478 },
    { name: "Route de l'Ourika", lat: 31.5690, lng: -7.9600 },
    { name: 'Route de Casablanca', lat: 31.6670, lng: -7.9570 },
    { name: 'Route de Fez', lat: 31.6750, lng: -7.9500 },
    { name: 'Annakhil Nord', lat: 31.6640, lng: -8.0720 },
    { name: 'El Ahjar Annakhil', lat: 31.6800, lng: -8.0700 },
    { name: 'Chouiter', lat: 31.6280, lng: -8.1130 },
    { name: 'Abwag', lat: 31.6120, lng: -8.0680 },
    { name: 'Kouass', lat: 31.6150, lng: -8.0830 },
  ],
  Safi: [
    { name: 'Centre-ville', lat: 32.2994, lng: -9.2372 },
    { name: 'Plateau', lat: 32.3040, lng: -9.2330 },
    { name: 'Jrifate', lat: 32.2900, lng: -9.2500 },
    { name: 'Hay Salam', lat: 32.2900, lng: -9.2200 },
  ],
  Essaouira: [
    { name: 'Médina', lat: 31.5125, lng: -9.7700 },
    { name: 'Azlef', lat: 31.5040, lng: -9.7610 },
    { name: 'Al Ghazoua', lat: 31.4560, lng: -9.7410 },
    { name: 'Diabat', lat: 31.4930, lng: -9.7830 },
  ],
  Benguerir: [
    { name: 'Centre-ville', lat: 32.2419, lng: -7.9465 },
    { name: 'UM6P Campus', lat: 32.2510, lng: -7.9440 },
    { name: 'Hay Ennasr', lat: 32.2360, lng: -7.9380 },
  ],
  Youssoufia: [
    { name: 'Centre-ville', lat: 32.2494, lng: -8.5295 },
    { name: 'Hay Majd', lat: 32.2560, lng: -8.5210 },
    { name: 'Quartier Hopital', lat: 32.2430, lng: -8.5310 },
  ],
  'El Kelaâ des Sraghna': [
    { name: 'Centre-ville', lat: 32.0510, lng: -7.3918 },
    { name: 'Hay Riad', lat: 32.0560, lng: -7.3850 },
  ],
  Chichaoua: [{ name: 'Centre-ville', lat: 31.5456, lng: -8.7622 }],
  Tahannaout: [{ name: 'Centre-ville', lat: 31.3386, lng: -7.9572 }],
};

/* ---- Recherche tolérante casse/accents/apostrophes ------------------- */
function normKey(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const communeByNorm = new Map<string, CommuneZone>();
for (const c of COMMUNES_REGION) communeByNorm.set(normKey(c.name), c);

const quartierByNorm = new Map<string, Map<string, QuartierEntry>>();
for (const [commune, list] of Object.entries(QUARTIERS_PAR_COMMUNE)) {
  const inner = new Map<string, QuartierEntry>();
  for (const q of list) inner.set(normKey(q.name), q);
  quartierByNorm.set(normKey(commune), inner);
}

/** Retrouve une commune (casse/accents indifférents) */
export function findCommune(name: string): CommuneZone | undefined {
  return communeByNorm.get(normKey(name));
}

/** Liste ordonnée des noms de communes (toute la région) */
export function getCommuneNames(): string[] {
  return COMMUNES_REGION.map((c) => c.name);
}

/** Quartiers d'une commune (recherche tolérante casse/accents) */
export function getQuartiersOf(communeName: string | null | undefined): QuartierEntry[] {
  if (!communeName) return [];
  const inner = quartierByNorm.get(normKey(communeName));
  return inner ? Array.from(inner.values()) : [];
}

/**
 * Coordonnées d'un quartier : d'abord dans la commune donnée,
 * sinon recherche globale (quartiers homonymes entre villes).
 */
export function findQuartier(
  communeName: string | null | undefined,
  quartier: string
): QuartierEntry | undefined {
  if (!quartier) return undefined;
  const inner = quartierByNorm.get(normKey(communeName || ''));
  const direct = inner?.get(normKey(quartier));
  if (direct) return direct;
  for (const m of quartierByNorm.values()) {
    const hit = m.get(normKey(quartier));
    if (hit) return hit;
  }
  return undefined;
}













