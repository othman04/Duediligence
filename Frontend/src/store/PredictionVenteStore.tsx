import { create } from 'zustand';
import axiosInstance from '../lib/axiosIsntance';

// ─────────────────────────────────────────────────────────────────
// TYPES — Entrées et Sorties de l'API de prédiction ML (Orchestrateur)
// ─────────────────────────────────────────────────────────────────

export interface PredictionPayload {
  // Champs obligatoires
  type_bien: string;
  localisation_quartier: string;
  commune_fr: string;
  latitude: number;
  longitude: number;
  surface_consolidee_m2: number;
  surface_habitable_m2: number;
  total_pieces: number;
  chambres: number;
  salles_bain: number;
  salons: number;
  etages: number;
  etage_semantique: string;

  // Options d'Investissement (Nouveau)
  sale_price?: number;
  rental_price_monthly?: number;

  // Équipements (0 ou 1)
  equipement_ascenseur?: number;
  equipement_balcon?: number;
  equipement_chauffage?: number;
  equipement_climatisation?: number;
  equipement_concierge?: number;
  equipement_cuisine_equipee?: number;
  equipement_meuble?: number;
  equipement_parking?: number;
  equipement_securite?: number;
  equipement_terrasse?: number;
  equipement_piscine?: number;
  equipement_jardin?: number;

  // Scores & Distances (Optionnels)
  score_accessibilite_globale?: number;
  distance_nearest_commodites?: number;
  distance_nearest_supermarket?: number;
  annee?: number;
  mois?: number;
  trimestre?: number;
}

export interface ConfidenceRange {
  low: number;
  high: number;
}

/** Facteur d'impact (SHAP CatBoost) renvoyé par /predict */
export interface ShapFactor {
  feature: string;
  impact_mad: number;
  direction: 'up' | 'down';
}

export interface InputsSummary {
  type_bien: string;
  localisation_quartier: string;
  commune_fr: string;
  surface_m2: number;
  geo_cluster: string;
  quartier_freq: number;
}

export interface OrchestrationResult {
  status: string;
  listing_id: string;
  price_data_source: 'predicted' | 'user_provided';
  actual_sale_price_used: number;
  prediction: {
    predicted_price: number;
    price_per_m2: number;
    confidence_range: ConfidenceRange;
    shap_factors?: ShapFactor[];
    inputs_summary: InputsSummary;
    currency: string;
    model_version?: string;
  };
  investment_analysis: {
    overall_score: number;
    decision: string;
    explanation_text: string;
    rental_data_source: 'not_provided' | 'user_provided';
    financial_report: any | null;
    risk_assessment: any;
    investment_scores: any;
    pillars: {
      financial_score: number;
      market_score: number;
      location_score: number;
      risk_score: number;
    };
  };
  geo_enrichment?: any;
}

// ─────────────────────────────────────────────────────────────────
// STORE ZUSTAND
// ─────────────────────────────────────────────────────────────────

interface PredictionVenteState {
  result: OrchestrationResult | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  predictPrice: (payload: PredictionPayload) => Promise<OrchestrationResult | null>;
  resetPrediction: () => void;
  clearError: () => void;
}

export const usePredictionVenteStore = create<PredictionVenteState>((set) => ({
  result: null,
  isLoading: false,
  error: null,

  predictPrice: async (payload: PredictionPayload) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axiosInstance.post<OrchestrationResult>('/prediction/orchestrate', payload);
      set({ result: data, isLoading: false });
      return data;
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Erreur lors de la prédiction du prix par le modèle ML.';
      set({ error: msg, isLoading: false });
      return null;
    }
  },

  resetPrediction: () => set({ result: null, error: null, isLoading: false }),

  clearError: () => set({ error: null }),
}));
