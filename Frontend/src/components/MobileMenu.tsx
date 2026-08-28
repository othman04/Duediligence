import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Calculator, FileText, History,
  LineChart, LogOut, Menu, ShieldCheck, User, UserPlus, X,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import logoOrchid from '../assets/logoOrchidIsland.png';

const NAV_ITEMS = [
  { label: 'Analytique', icon: BarChart3, path: '/analytique', roles: ['superAdmin'] },
  { label: 'Estimer un bien', icon: Calculator, path: '/estimer-un-bien', roles: ['admin', 'superAdmin'] },
  { label: 'Investissement & risque', icon: ShieldCheck, path: '/investissement-risque', roles: ['admin', 'superAdmin'] },
  { label: 'Indicateurs des prix', icon: LineChart, path: '/indicateurs-prix', roles: ['admin', 'superAdmin'] },
  { label: 'Historique', icon: History, path: '/historique', roles: ['superAdmin'] },
  { label: 'Admin', icon: UserPlus, path: '/admin', roles: ['superAdmin'] },
];

// CTA « Rapport complet » : visible pour les mêmes rôles que la sidebar desktop.
const RAPPORT_ROLES = ['admin', 'superAdmin'];

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuthStore();

  const userRole = user?.role || 'user';
  const filteredNav = NAV_ITEMS.filter(item => !item.roles || item.roles.includes(userRole));

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Mobile Header */}
      <header className="mobile-header">
        <button
          className="mobile-menu-toggle"
          onClick={() => setIsOpen(true)}
          aria-label="Ouvrir le menu"
        >
          <Menu size={24} />
        </button>
        <div className="mobile-header-brand">
          <img src={logoOrchid} alt="Orchid Island" className="mobile-logo" />
          <span className="mobile-brand-text">Orchid Island</span>
        </div>
        <div className="mobile-header-spacer" />
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="mobile-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          >
            <motion.aside
              className="mobile-sidebar"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sidebar Header */}
              <div className="mobile-sidebar-header">
                <div className="mobile-sidebar-brand">
                  <img src={logoOrchid} alt="Orchid Island" className="mobile-logo" />
                  <div>
                    <span className="mobile-brand-title">Orchid Island</span>
                    <span className="mobile-brand-subtitle">Due diligence</span>
                  </div>
                </div>
                <button
                  className="mobile-menu-close"
                  onClick={() => setIsOpen(false)}
                  aria-label="Fermer le menu"
                >
                  <X size={24} />
                </button>
              </div>

              {/* User Info */}
              {user && (
                <div className="mobile-user-info">
                  <div className="mobile-user-avatar">
                    <User size={20} />
                  </div>
                  <div className="mobile-user-details">
                    <span className="mobile-user-name">{user.email}</span>
                    <span className="mobile-user-role">{user.role}</span>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <nav className="mobile-nav">
                {filteredNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleNavigate(item.path)}
                    >
                      <Icon size={20} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Logout + CTA Rapport complet */}
              <div className="mobile-sidebar-footer">
                {RAPPORT_ROLES.includes(userRole) && (
                  <button
                    className="mobile-rapport-btn"
                    onClick={() => handleNavigate('/rapport-complet')}
                  >
                    <FileText size={18} />
                    <span>Rapport complet</span>
                  </button>
                )}
                <button
                  className="mobile-logout-btn"
                  onClick={() => { logout(); setIsOpen(false); }}
                >
                  <LogOut size={18} />
                  <span>Déconnexion</span>
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
