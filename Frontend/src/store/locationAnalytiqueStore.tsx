import { create } from 'zustand';
import axiosInstance from '../lib/axiosIsntance';

// ─────────────────────────────────────────────────────────────────
// TYPES — structure renvoyée par /location/dashboard
// (collection précalculée `dashboard_stats_location`)
// ─────────────────────────────────────────────────────────────────

export interface LocationKpis {
  total_annonces:      number;
  total_mensuel:       number;
  total_nuitee:        number;
  total_communes:      number;
  total_quartiers:     number;
  avg_loyer_mensuel:   number | null;
  avg_loyer_m2_mensuel:number | null;
  avg_prix_nuit:       number | null;
  avg_prix_nuit_m2:    number | null;
}

export interface CommuneEntry {
  commune:             string;
  nb:                  number;
  nb_mensuel:          number;
  nb_nuitee:           number;
  loyer_m2_mensuel:    number | null;
  loyer_mensuel_moyen: number | null;
  prix_nuit_moyen:     number | null;
}

export interface TypeEntry {
  type_bien:         string;
  nb:                number;
  nb_mensuel:        number;
  nb_nuitee:         number;
  loyer_m2_mensuel:  number | null;
  prix_nuit_moyen:   number | null;
}

export interface QuartierEntry {
  commune:  string;
  quartier: string;
  nb:       number;
}

export interface PeriodeEntry { periode: string; nb: number; prix_moyen: number }
export interface BucketEntry  { range: string; count: number }
export interface TrendEntry   { mois: string; mensuel: number; nuitee: number }

export interface LocationDashboardData {
  generated_at:    string;
  kpis:            LocationKpis;
  by_commune:      CommuneEntry[];
  by_type:         TypeEntry[];
  by_quartier:     QuartierEntry[];
  by_periode:      PeriodeEntry[];
  buckets_mensuel: BucketEntry[];
  buckets_nuitee:  BucketEntry[];
  trend:           TrendEntry[];
  insights:        string[];
}

export interface LocationFiltersOptions {
  communes:   string[];
  types_bien: string[];
  periodes:   string[];
}

export interface ActiveLocationFilters {
  commune:   string;
  type_bien: string;
  periode:   string;
}

// ─────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────

interface LocationAnalytiqueState {
  // Data
  dashboard:     LocationDashboardData | null;
  filterOptions: LocationFiltersOptions | null;

  // Filtres actifs
  activeFilters: ActiveLocationFilters;

  // Status
  isLoading: boolean;
  error:     string | null;

  // Actions
  fetchFilterOptions: () => Promise<void>;
  fetchDashboard:     (filters?: Partial<ActiveLocationFilters>) => Promise<void>;
  setFilter:          (key: keyof ActiveLocationFilters, value: string) => void;
  resetFilters:       () => void;
  clearError:         () => void;
}

const DEFAULT_FILTERS: ActiveLocationFilters = {
  commune:   '',
  type_bien: '',
  periode:   '',
};

export const useLocationAnalytiqueStore = create<LocationAnalytiqueState>((set, get) => ({
  dashboard:     null,
  filterOptions: null,
  activeFilters: { ...DEFAULT_FILTERS },
  isLoading:     false,
  error:         null,

  // ── Options des filtres (communes/types des annonces Location) ────
  fetchFilterOptions: async () => {
    try {
      const opts = await axiosInstance.get<{ communes: string[]; types_bien: string[] }>(
        '/location/options'
      );
      set({
        filterOptions: {
          communes:   opts.data.communes,
          types_bien: opts.data.types_bien,
          periodes:   ['', 'mois', 'jour'],
        },
      });
    } catch (err: any) {
      set({ error: err.response?.data?.error ?? 'Erreur lors du chargement des filtres.' });
    }
  },

  // ── Dashboard LOCATION précalculé (< 1 s : aucune agrégation live) ─
  fetchDashboard: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const active = { ...get().activeFilters, ...filters };
      const params: Record<string, string> = {};
      if (active.commune)   params.commune   = active.commune;
      if (active.type_bien) params.type_bien = active.type_bien;
      if (active.periode)   params.periode   = active.periode;

      const { data } = await axiosInstance.get<LocationDashboardData>('/location/dashboard', { params });
      set({ dashboard: data, isLoading: false });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.response?.data?.error ?? 'Erreur lors du chargement du tableau de bord.',
      });
    }
  },

  // ── Mise à jour d'un filtre + rechargement automatique ────────────
  setFilter: (key, value) => {
    const updated = { ...get().activeFilters, [key]: value };
    set({ activeFilters: updated });
    get().fetchDashboard(updated);
  },

  resetFilters: () => {
    set({ activeFilters: { ...DEFAULT_FILTERS } });
    get().fetchDashboard(DEFAULT_FILTERS);
  },

  clearError: () => set({ error: null }),
}));
