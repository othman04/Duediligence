import { create } from 'zustand';
import axiosInstance from '../lib/axiosIsntance';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────
export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'user' | 'admin' | 'superAdmin';
  created_at: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role?: 'admin' | 'superAdmin';
}

export interface LoginPayload {
  email: string;
  password: string;
}

interface AuthState {
  // ── State ──────────────────────────────────────────────────────
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isCheckingAuth: boolean; // Seulement true au tout premier chargement
  error: string | null;

  // ── Actions ────────────────────────────────────────────────────
  createAdminUser: (payload: RegisterPayload) => Promise<User>;
  deleteAdminUser: (id: string) => Promise<void>;
  fetchUsers: () => Promise<User[]>;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  changePassword: (payload: { currentPassword: string; newPassword: string; confirmPassword?: string }) => Promise<void>;
  clearError: () => void;
}

// ─────────────────────────────────────────────────────────────────
// STORE ZUSTAND
// ─────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isCheckingAuth: true,
  error: null,

  // ── REGISTER ────────────────────────────────────────────────────
  // ── LOGIN ───────────────────────────────────────────────────────
  login: async (payload: LoginPayload) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axiosInstance.post('/auth/login', payload);
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        isCheckingAuth: false,
        error: null,
      });
    } catch (err: any) {
      const message = err.response?.data?.error ?? 'Email ou mot de passe invalide.';
      set({ isLoading: false, isCheckingAuth: false, error: message, isAuthenticated: false });
      throw new Error(message);
    }
  },

  // ── LOGOUT ──────────────────────────────────────────────────────
  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await axiosInstance.post('/auth/logout');
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false, isCheckingAuth: false, error: null });
    }
  },

  // ── FETCH ME — Verification silencieuse de la session ──────────
  fetchMe: async () => {
    // Si on a déjà un utilisateur connecté, on ne met PAS isCheckingAuth à true pour éviter le flash
    if (!get().isAuthenticated) {
      set({ isCheckingAuth: true });
    }
    try {
      const { data } = await axiosInstance.get('/auth/me');
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        isCheckingAuth: false,
        error: null,
      });
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isCheckingAuth: false,
        error: null,
      });
    }
  },

  // ── CREATE ADMIN USER (BY LOGGED IN ADMIN) ──────────────────────
  createAdminUser: async (payload: RegisterPayload) => {
    try {
      const { data } = await axiosInstance.post('/auth/create-user', payload);
      return data.user;
    } catch (err: any) {
      if (err.code === 'ERR_NETWORK' || err.code === 'ECONNRESET' || !err.response) {
        throw new Error("Impossible de se connecter au serveur Backend (Port 5000). Assurez-vous que le serveur Backend est bien relancé.");
      }
      const message = err.response?.data?.error ?? "Erreur lors de la création du compte.";
      throw new Error(message);
    }
  },

  // ── DELETE ADMIN USER ───────────────────────────────────────────
  deleteAdminUser: async (id: string) => {
    try {
      await axiosInstance.delete(`/auth/users/${id}`);
    } catch (err: any) {
      const message = err.response?.data?.error ?? "Erreur lors de la suppression de l'administrateur.";
      throw new Error(message);
    }
  },

  // ── FETCH USERS LIST ─────────────────────────────────────────────
  fetchUsers: async () => {
    try {
      const { data } = await axiosInstance.get('/auth/users');
      return data.users || [];
    } catch (err: any) {
      console.warn("Erreur lors de la récupération des utilisateurs du serveur backend:", err.message);
      return [];
    }
  },

  // ── CHANGE PASSWORD ─────────────────────────────────────────────
  changePassword: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      await axiosInstance.put('/auth/change-password', payload);
      set({ isLoading: false, error: null });
    } catch (err: any) {
      const message = err.response?.data?.error ?? "Erreur lors de la modification du mot de passe.";
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  // ── CLEAR ERROR ─────────────────────────────────────────────────
  clearError: () => set({ error: null }),
}));
