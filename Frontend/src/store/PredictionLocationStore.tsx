import { create } from 'zustand';
import axiosInstance from '../lib/axiosIsntance';

// ─────────────────────────────────────────────────────────────────
// TYPES — entrées/sorties de l'API de prédiction LOCATION
// (XGBoost + régression quantile, microservice Python port 8000)
// ─────────────────────────────────────────────────────────────────

export type LocationPeriode = 'mensuel' | 'nuitee';

export interface LocationPredictionPayload {
  periode: LocationPeriode;
  type_bien: string;
  quartier: string | null;
  commune_officielle: string;
  superficie_m2: number;
  chambres: number;
  salles_de_bain: number;
  nb_etages?: number;
  salons?: number;
  capacite?: number | null;
  equipements: string[];
}

export interface ShapEntry {
  feature: string;
  label:   string;
  contribution: number;
}

export interface LocationPredictionResult {
  predicted_price: number;
  price_per_m2: number | null;
  confidence_range: { low: number; high: number };
  shap_values: ShapEntry[];
  inputs_summary: {
    type_bien: string;
    quartier: string | null;
    commune_fr: string;
    surface_m2: number | null;
    periode: LocationPeriode;
  };
  currency: string;
}

// ─────────────────────────────────────────────────────────────────
// STORE ZUSTAND
// ─────────────────────────────────────────────────────────────────

interface PredictionLocationState {
  result: LocationPredictionResult | null;
  isLoading: boolean;
  error: string | null;

  predictLocation: (payload: LocationPredictionPayload) => Promise<LocationPredictionResult | null>;
  resetPrediction: () => void;
  clearError: () => void;
}

export const usePredictionLocationStore = create<PredictionLocationState>((set) => ({
  result: null,
  isLoading: false,
  error: null,

  predictLocation: async (payload: LocationPredictionPayload) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axiosInstance.post<LocationPredictionResult>(
        '/prediction/location',
        payload,
      );
      set({ result: data, isLoading: false });
      return data;
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Erreur lors de la prédiction du loyer par le modèle ML.';
      set({ error: msg, isLoading: false });
      return null;
    }
  },

  resetPrediction: () => set({ result: null, error: null, isLoading: false }),

  clearError: () => set({ error: null }),
}));