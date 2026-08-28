import axiosInstance from './axiosIsntance';

// ─────────────────────────────────────────────────────────────────
// API du volet LOCATION (backend Node → MongoDB)
// ─────────────────────────────────────────────────────────────────

export interface LocationOptions {
  communes: string[];
  types_bien: string[];
}

export interface CenterPoint {
  lat: number | null;
  lng: number | null;
  count?: number;
  zoom?: number;
}

export interface ResolveResult {
  lat: number;
  lng: number;
  commune_officielle: string | null;
  quartier: string | null;
  distance_m: number | null;
}

/** Communes distinctes (champ `commune_officielle`) des annonces Location */
export function fetchLocationOptions() {
  return axiosInstance
    .get<LocationOptions>('/location/options')
    .then((r) => r.data);
}

/** Quartiers distincts d'une commune (filtrage dynamique) */
export function fetchQuartiers(commune: string): Promise<string[]> {
  return axiosInstance
    .get<{ quartiers: string[] }>('/location/quartiers', { params: { commune } })
    .then((r) => r.data.quartiers);
}

/** Centre réel d'une commune = médiane des lat/lng de ses annonces */
export function fetchCommuneCenter(commune: string) {
  return axiosInstance
    .get<CenterPoint & { commune: string }>('/location/commune-center', {
      params: { commune },
    })
    .then((r) => r.data);
}

/**
 * Centre réel d'un quartier = MÉDIANE des annonces de ce quartier en base
 * (pas la moyenne — corrige le bug de décalage type "M'Hamid").
 */
export function fetchQuartierCenter(commune: string | null, quartier: string) {
  return axiosInstance
    .get<CenterPoint & { quartier: string }>('/location/quartier-center', {
      params: { quartier, ...(commune ? { commune } : {}) },
    })
    .then((r) => r.data);
}

/** lat/lng -> commune officielle + quartier le plus proche */
export function resolveLocation(lat: number, lng: number) {
  return axiosInstance
    .post<ResolveResult>('/location/resolve', { lat, lng })
    .then((r) => r.data);
}

// ─────────────────────────────────────────────────────────────────
// Zones du dataset VENTE (collection `dataset_model_ready_cleaned`)
// ─────────────────────────────────────────────────────────────────

export interface SaleZone {
  ville: string;
  count: number;
  quartiers: string[];
}

/** Communes + quartiers distincts du dataset Vente (normalisés casse/accents) */
export function fetchSaleZones() {
  return axiosInstance
    .get<{ zones: SaleZone[] }>('/location/sale-zones')
    .then((r) => r.data.zones);
}

/** Centre réel d'une commune VENTE = médiane des annonces du dataset vente */
export function fetchSaleCommuneCenter(ville: string) {
  return axiosInstance
    .get<CenterPoint>('/location/sale-commune-center', { params: { ville } })
    .then((r) => r.data);
}

/** Centre réel d'un quartier VENTE = médiane des annonces de CE quartier */
export function fetchSaleQuartierCenter(ville: string | null, quartier: string) {
  return axiosInstance
    .get<CenterPoint>('/location/sale-quartier-center', {
      params: { quartier, ...(ville ? { ville } : {}) },
    })
    .then((r) => r.data);
}

/** lat/lng -> commune + quartier le plus proche (dataset VENTE) */
export function resolveSaleLocation(lat: number, lng: number): Promise<ResolveResult> {
  return axiosInstance
    .post<ResolveResult>('/location/sale-resolve', { lat, lng })
    .then((r) => r.data);
}