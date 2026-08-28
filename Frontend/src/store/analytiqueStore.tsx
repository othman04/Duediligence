import { create } from 'zustand';
import axiosInstance from '../lib/axiosIsntance';

// ─────────────────────────────────────────────────────────────────
// TYPES — reprend la structure exacte renvoyée par le backend
// ─────────────────────────────────────────────────────────────────

export interface AnalyticsKpis {
  total_properties:     number;
  total_cities:         number;
  total_quartiers:      number;
  vente_count:          number;
  location_count:       number;
  scored_count:         number;
  avg_price_m2:         number;
  avg_rent_m2:          number;
  rental_yield:         number | null;
  avg_investment_score: number | null;
  avg_location_score:   number | null;
  avg_risk_score:       number | null;
}

export interface GeoEntry {
  label:                string;
  properties_count:     number;
  avg_sale_price_m2:    number;
  avg_investment_score: number | null;
  rental_yield:         number | null;
}

export interface TypeEntry   { type_bien: string; properties_count: number; }
export interface OpEntry     { operation: string; properties_count: number; }
export interface RiskEntry   { overall_risk_level: string; properties_count: number; }
export interface BucketEntry { range: string; count: number; }
export interface TrendEntry  { mois: string; vente_count: number; location_count: number; }
export interface HcpEntry    { region: string; revenu_mensuel_moyen: number; population_millions: number; taux_chomage_pct: number; }

export interface Opportunity {
  label:                string;
  properties_count:     number;
  avg_sale_price_m2:    number;
  avg_investment_score: number;
  rental_yield:         number | null;
  value_index:          number | null;
  decision:             'Acheter' | 'Surveiller';
}

export interface DashboardData {
  kpis:         AnalyticsKpis;
  by_geo:       GeoEntry[];
  by_type:      TypeEntry[];
  by_operation: OpEntry[];
  by_risk:      RiskEntry[];
  price_buckets: BucketEntry[];
  trend:        TrendEntry[];
  hcp_data:     HcpEntry[];
  opportunities: Opportunity[];
  insights:     string[];
}

export interface FiltersOptions {
  regions:    string[];
  villes:     string[];
  types_bien: string[];
  operations: string[];
}

export interface ActiveFilters {
  region:     string;
  ville:      string;
  type_bien:  string;
  operation:  string;
}

// ─────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────

interface AnalytiqueState {
  // Data
  dashboard:     DashboardData | null;
  filterOptions: FiltersOptions | null;

  // Filters actifs
  activeFilters: ActiveFilters;

  // Status
  isLoading:   boolean;
  error:       string | null;

  // Actions
  fetchFilterOptions:  () => Promise<void>;
  fetchDashboard:      (filters?: Partial<ActiveFilters>) => Promise<void>;
  setFilter:           (key: keyof ActiveFilters, value: string) => void;
  resetFilters:        () => void;
  clearError:          () => void;
}

const DEFAULT_FILTERS: ActiveFilters = {
  region:    '',
  ville:     '',
  type_bien: '',
  operation: '',
};

export const useAnalytiqueStore = create<AnalytiqueState>((set, get) => ({
  dashboard:     null,
  filterOptions: null,
  activeFilters: { ...DEFAULT_FILTERS },
  isLoading:     false,
  error:         null,

  // ── Filtres disponibles (dropdowns) ────────────────────────────
  fetchFilterOptions: async () => {
    try {
      const { data } = await axiosInstance.get<FiltersOptions>('/analytics/filters');
      set({ filterOptions: data });
    } catch (err: any) {
      set({ error: err.response?.data?.error ?? 'Erreur lors du chargement des filtres.' });
    }
  },

  // ── Dashboard summary complet ────────────────────────────────
  fetchDashboard: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const active = { ...get().activeFilters, ...filters };
      const params: Record<string, string> = {};
      if (active.region)    params.region    = active.region;
      if (active.ville)     params.ville     = active.ville;
      if (active.type_bien) params.type_bien = active.type_bien;
      if (active.operation) params.operation = active.operation;

      const { data } = await axiosInstance.get<DashboardData>('/analytics/dashboard-summary', { params });
      set({ dashboard: data, isLoading: false });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.response?.data?.error ?? 'Erreur lors du chargement du tableau de bord.',
      });
    }
  },

  // ── Mise à jour d'un filtre + rechargement autom. ────────────
  setFilter: (key, value) => {
    const updated = { ...get().activeFilters, [key]: value };
    // Si on change de région, réinitialiser la ville
    if (key === 'region') updated.ville = '';
    set({ activeFilters: updated });
    get().fetchDashboard(updated);
  },

  // ── Reset ────────────────────────────────────────────────────
  resetFilters: () => {
    set({ activeFilters: { ...DEFAULT_FILTERS } });
    get().fetchDashboard(DEFAULT_FILTERS);
  },

  clearError: () => set({ error: null }),
}));
