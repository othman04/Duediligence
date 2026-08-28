import { create } from 'zustand';
import axiosInstance from '../lib/axiosIsntance';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface InvestPayload {
  sale_price: number;
  rental_price_monthly?: number;
  type_bien: string;
  commune?: string;
  quartier?: string;
  latitude?: number;
  longitude?: number;
}

export interface InvestmentAnalysisResult {
  overall_score: number;
  decision: string;
  explanation_text: string;
  rental_data_source: 'not_provided' | 'user_provided' | 'predicted';
  financial_report: {
    yield: {
      gross_yield_pct: number;
      net_yield_pct: number;
    };
    financing_cashflow: {
      monthly_cash_flow: number;
    };
    roi: {
      annualized_roi_pct: number;
    };
  } | null;
  investment_scores: {
    overall_risk_level: string;
    location_source?: string;
    neighborhood_type?: string;
    explanation: {
      strengths: string[];
      weaknesses: string[];
    };
  };
  spatial_anomaly?: {
    spatial_anomaly: boolean | null;
    spatial_anomaly_score: number | null;
    risk_source: string;
    risk_adjustment: number;
    warnings: string[];
  };
  pillars: {
    financial_score: number;
    market_score: number;
    location_score: number;
    risk_score: number;
  };
}

// ─────────────────────────────────────────────────────────────────
// STORE ZUSTAND
// ─────────────────────────────────────────────────────────────────

interface InvestmentState {
  result: InvestmentAnalysisResult | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  analyzeInvestment: (payload: InvestPayload) => Promise<InvestmentAnalysisResult | null>;
  resetAnalysis: () => void;
  clearError: () => void;
}

export const useInvestmentStore = create<InvestmentState>((set) => ({
  result: null,
  isLoading: false,
  error: null,

  analyzeInvestment: async (payload: InvestPayload) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axiosInstance.post<InvestmentAnalysisResult>('/prediction/analyze-investment', payload);
      set({ result: data, isLoading: false });
      return data;
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Erreur lors de l\'analyse d\'investissement.';
      set({ error: msg, isLoading: false });
      return null;
    }
  },

  resetAnalysis: () => set({ result: null, error: null, isLoading: false }),

  clearError: () => set({ error: null }),
}));
