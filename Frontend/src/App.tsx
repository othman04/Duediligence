import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/login';
import HomePage from './pages/home';
import AnalytiquePage from './pages/analytiqueCombined';
import EstimeBienPage from './pages/estimeBien';
import InvestissementRisquePage from './pages/investissementRisque';
import IndicateurPrixPage from './pages/indicateurPrixCombined';
import AdminPage from './pages/admin';
import HistoriquePage from './pages/historique';
import RapportPage from './pages/rapport';
import ProfilePage from './pages/profile';
import NonAutorisePage from './pages/nonAutorise';
import logoOrchid from './assets/logoOrchidIsland.png';
import './App.css';

type Role = 'user' | 'admin' | 'superAdmin';

function RoleRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  return user && roles.includes(user.role) ? <>{children}</> : <Navigate to="/non-autorise" replace />;
}

function AppContent() {
  const { fetchMe, isAuthenticated, isCheckingAuth } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // Écran de chargement initial pendant la vérification du cookie de session
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#FEFDFA] flex flex-col justify-center items-center p-6 text-[#241F1B]">
        <div className="bg-[#FEFDFA] p-4 rounded-xl border border-[#D4C4AC]/40 shadow-sm mb-6 animate-pulse">
          <img
            src={logoOrchid}
            alt="Orchid Island"
            className="h-16 w-auto object-contain"
          />
        </div>
        <div className="flex items-center gap-3 text-sm text-[#9A421D] font-medium tracking-wide">
          <svg className="animate-spin h-5 w-5 text-[#9A421D]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Vérification de votre session…
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Page de garde : réservée aux visiteurs non authentifiés. */}
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/analytique" replace /> : <HomePage />}
      />

      {/* Route Login : si connecté -> redirige vers l'espace analytique. */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/analytique" replace /> : <LoginPage />}
      />

      {/* L'ancienne route d'accueil redirige vers l'espace analytique après connexion. */}
      <Route
        path="/home"
        element={isAuthenticated ? <Navigate to="/analytique" replace /> : <Navigate to="/" replace />}
      />

      {/* Route Analytique */}
      <Route
        path="/analytique"
        element={isAuthenticated ? <RoleRoute roles={['superAdmin']}><AnalytiquePage /></RoleRoute> : <Navigate to="/login" replace />}
      />

      {/* Route Estimer un bien */}
      <Route
        path="/estimer-un-bien"
        element={isAuthenticated ? <RoleRoute roles={['admin', 'superAdmin']}><EstimeBienPage /></RoleRoute> : <Navigate to="/login" replace />}
      />

      {/* Route Investissement & Risque */}
      <Route
        path="/investissement-risque"
        element={isAuthenticated ? <RoleRoute roles={['admin', 'superAdmin']}><InvestissementRisquePage /></RoleRoute> : <Navigate to="/login" replace />}
      />

      {/* Route Indicateurs des prix */}
      <Route
        path="/indicateurs-prix"
        element={isAuthenticated ? <RoleRoute roles={['admin', 'superAdmin']}><IndicateurPrixPage /></RoleRoute> : <Navigate to="/login" replace />}
      />

      {/* Route Admin */}
      <Route
        path="/admin"
        element={isAuthenticated ? <RoleRoute roles={['superAdmin']}><AdminPage /></RoleRoute> : <Navigate to="/login" replace />}
      />

      {/* Route Historique */}
      <Route
        path="/historique"
        element={isAuthenticated ? <RoleRoute roles={['superAdmin']}><HistoriquePage /></RoleRoute> : <Navigate to="/login" replace />}
      />

      {/* Route Rapport complet */}
      <Route
        path="/rapport-complet"
        element={isAuthenticated ? <RoleRoute roles={['admin', 'superAdmin']}><RapportPage /></RoleRoute> : <Navigate to="/login" replace />}
      />

      {/* Route Profil */}
      <Route
        path="/profile"
        element={isAuthenticated ? <ProfilePage /> : <Navigate to="/" replace />}
      />

      <Route path="/non-autorise" element={isAuthenticated ? <NonAutorisePage /> : <Navigate to="/login" replace />} />

      {/* Route par défaut */}
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? "/analytique" : "/"} replace />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
