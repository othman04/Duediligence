import { create } from 'zustand';
import axiosInstance from '../lib/axiosIsntance';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ActionType = 'estimation' | 'investissement' | 'rapport' | 'admin';

export interface EstimationDetails {
  // Progression (enregistrement par étape)
  step?: number;
  stepName?: string;

  // Champs finaux
  mode?: 'vente' | 'location';
  propertyType?: string;
  city?: string;
  neighborhood?: string;
  surface?: string;
  rooms?: string;
  bathrooms?: string;
  equipment?: string[];
  address?: string;
  estimate?: number;
  low?: number;
  high?: number;
  pricePerSqm?: number;
}

export interface InvestissementDetails {
  address: string;
  city: string;
  type: string;
  price: number;
  rent: number;
  surface: number;
  yieldRate: number;
  investmentScore: number;
  riskScore: number;
}

export interface RapportDetails {
  sections: string[];
}

export type ActionDetails = EstimationDetails | InvestissementDetails | RapportDetails;

export interface HistoryEntry {
  id: string;
  type: ActionType;
  label: string;
  timestamp: string; // ISO string
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  details: ActionDetails;
}

interface HistoryState {
  entries: HistoryEntry[];
  isLoading: boolean;
  error: string | null;
  fetchHistory: () => Promise<void>;
  addEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => Promise<void>;
  clearHistory: () => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
}

const mapBackendEntry = (item: any): HistoryEntry => ({
  id: item._id || item.id || String(Math.random()),
  type: item.type,
  label: item.label,
  timestamp: item.createdAt || item.timestamp || new Date().toISOString(),
  user: {
    id: item.userId || item.user?.id || '',
    firstName: item.userSnapshot?.firstName || item.user?.firstName || 'Utilisateur',
    lastName: item.userSnapshot?.lastName || item.user?.lastName || '',
    email: item.userSnapshot?.email || item.user?.email || '',
  },
  details: item.details || {},
});

// ─── Store ───────────────────────────────────────────────────────────────────

export const useHistoryStore = create<HistoryState>((set) => ({
  entries: [],
  isLoading: false,
  error: null,

  fetchHistory: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axiosInstance.get('/history');
      const formatted = (data.entries || []).map(mapBackendEntry);
      set({ entries: formatted, isLoading: false });
    } catch (err: any) {
      console.warn("Impossible de charger l'historique du serveur backend:", err.message);
      set({ isLoading: false, error: err.message });
    }
  },

  addEntry: async (entry) => {
    try {
      const { data } = await axiosInstance.post('/history', {
        type: entry.type,
        label: entry.label,
        details: entry.details,
      });

      const newEntry = data.entry ? mapBackendEntry(data.entry) : {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
      };

      set((state) => ({
        entries: [newEntry, ...state.entries].slice(0, 100),
      }));
    } catch (err: any) {
      console.warn("Erreur lors de l'enregistrement de l'action dans l'historique backend:", err.message);
      // Fallback local
      const fallbackEntry: HistoryEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
      };
      set((state) => ({
        entries: [fallbackEntry, ...state.entries].slice(0, 100),
      }));
    }
  },

  clearHistory: async () => {
    try {
      await axiosInstance.delete('/history');
      set({ entries: [] });
    } catch (err: any) {
      console.warn("Erreur vider l'historique backend:", err.message);
      set({ entries: [] });
    }
  },

  removeEntry: async (id: string) => {
    try {
      await axiosInstance.delete(`/history/${id}`);
      set((state) => ({
        entries: state.entries.filter((e) => e.id !== id),
      }));
    } catch (err: any) {
      console.warn("Erreur suppression entrée backend:", err.message);
      set((state) => ({
        entries: state.entries.filter((e) => e.id !== id),
      }));
    }
  },
}));
