import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History,
  LineChart,
  LogOut,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import logoOrchidIsland from "../assets/logoOrchidIsland.png";
import { useAuthStore } from "../store/authStore";
import MobileMenu from "./MobileMenu";

/* ─── Palette ────────────────────────────────────────────── */
const C = {
  terra:      '#9A421D',
  terraDark:  '#7A3216',
  terraDeep:  '#5C240E',
  terraLight: '#C05A30',
  terraGlow:  'rgba(154,66,29,0.16)',
  terraMuted: 'rgba(154,66,29,0.08)',
  ink:        '#1A1410',
  inkSoft:    '#3A3028',
  inkMuted:   '#7A6E66',
  sand:       '#D0C0A8',
  sandLight:  '#E8DDD0',
  sandPale:   '#F0EAE2',
  mist:       '#F4F1EC',
  paper:      '#FEFCF8',
  gold:       '#C49A5A',
  goldPale:   'rgba(196,154,90,0.12)',
};

/* ─── Navigation Items ───────────────────────────────────── */
const NAV_ITEMS: {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: "new" | "star";
  roles?: Array<'user' | 'admin' | 'superAdmin'>;
}[] = [

  { label: "Analytique",             icon: BarChart3,   path: "/analytique", roles: ['superAdmin'] },
  { label: "Estimer un bien",        icon: Calculator,  path: "/estimer-un-bien", roles: ['admin', 'superAdmin'] },
  { label: "Investissement & risque",icon: ShieldCheck, path: "/investissement-risque", roles: ['admin', 'superAdmin'] },
  { label: "Indicateurs des prix",   icon: LineChart,   path: "/indicateurs-prix", roles: ['admin', 'superAdmin'] },
  { label: "Historique",             icon: History,     path: "/historique", roles: ['superAdmin'] },
  { label: "Admin",                  icon: UserPlus,    path: "/admin", roles: ['superAdmin'] },

];

/* ─── Zellige SVG background ─────────────────────────────── */
const ZelligeSVG = () => (
  <svg
    aria-hidden="true"
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.022, pointerEvents: 'none', color: C.terra }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <pattern id="zs" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="none" />
        <rect x="10" y="10" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1" />
        <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="0.6" />
        <line x1="40" y1="0" x2="30" y2="10" stroke="currentColor" strokeWidth="0.6" />
        <line x1="0" y1="40" x2="10" y2="30" stroke="currentColor" strokeWidth="0.6" />
        <line x1="40" y1="40" x2="30" y2="30" stroke="currentColor" strokeWidth="0.6" />
        <circle cx="20" cy="20" r="2" fill="currentColor" />
        <circle cx="0"  cy="0"  r="1" fill="currentColor" />
        <circle cx="40" cy="0"  r="1" fill="currentColor" />
        <circle cx="0"  cy="40" r="1" fill="currentColor" />
        <circle cx="40" cy="40" r="1" fill="currentColor" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#zs)" />
  </svg>
);

/* ─── Sidebar Content ────────────────────────────────────── */
function SidebarContent({
  isCollapsed,
  onNavigate
}: {
  isCollapsed: boolean;
  onNavigate?: () => void;
}) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      navigate('/login');
    }
  };

  const isActive = (path: string) =>
    location.pathname === path.split('#')[0] ||
    (path.startsWith('/home#') && location.pathname === '/home');

  const handleNav = (path: string) => {
    onNavigate?.();
    navigate(path.split('#')[0]);
    if (path.includes('#')) {
      setTimeout(() => {
        document.getElementById(path.split('#')[1])?.scrollIntoView({ behavior: 'smooth' });
      }, 120);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: C.paper,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <ZelligeSVG />

      {/* ── Brand header ──────────────────────── */}
      <div
        style={{
          padding: isCollapsed ? '0.75rem 0' : '0 0 1.125rem',
          borderBottom: `1px solid ${C.sandLight}`,
          position: 'relative',
          flexShrink: 0,
          transition: 'padding 0.3s ease',
        }}
      >
        {/* Top gradient accent */}
        <div style={{
          height: '3px',
          background: `linear-gradient(90deg, ${C.terraDark}, ${C.gold}, ${C.terraLight}, transparent)`,
          marginBottom: isCollapsed ? '0.5rem' : '1.25rem',
        }} />

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.35rem',
          padding: isCollapsed ? '0 0.5rem' : '0 1.25rem',
          textAlign: 'center',
        }}>
          <img
            src={logoOrchidIsland}
            alt="Orchid Island Logo"
            style={{
              height: isCollapsed ? 38 : 52,
              width: 'auto',
              maxHeight: 56,
              objectFit: 'contain',
              margin: '0 auto',
              transition: 'height 0.3s ease',
            }}
          />
          {!isCollapsed && (
            <p style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: C.terra,
              opacity: 0.85,
              whiteSpace: 'nowrap',
            }}>
              Due diligence
            </p>
          )}
        </div>
      </div>

      {/* ── Navigation ────────────────────────── */}
      <nav style={{ padding: isCollapsed ? '1rem 0.5rem' : '1.125rem 0.875rem 0.5rem', flex: 1 }}>
        {!isCollapsed && (
          <p style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: C.inkMuted,
            padding: '0 0.5rem',
            marginBottom: '0.5rem',
            opacity: 0.7,
          }}>
            Navigation
          </p>
        )}

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {NAV_ITEMS.filter(item => !item.roles || item.roles.includes(user?.role || 'user')).map((item) => {
            const active = isActive(item.path);
            const Icon   = item.icon;
            return (
              <li key={item.label}>
                <motion.button
                  type="button"
                  title={isCollapsed ? item.label : undefined}
                  onClick={() => handleNav(item.path)}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    gap: '0.75rem',
                    width: '100%',
                    padding: isCollapsed ? '0.625rem 0' : '0.625rem 0.875rem',
                    borderRadius: 11,
                    fontSize: '0.845rem',
                    fontWeight: active ? 600 : 500,
                    color: active ? C.terra : C.inkSoft,
                    background: active
                      ? `linear-gradient(135deg, rgba(154,66,29,0.1) 0%, rgba(154,66,29,0.06) 100%)`
                      : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    textAlign: 'left',
                    transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLButtonElement).style.background = C.sandLight;
                      (e.currentTarget as HTMLButtonElement).style.color = C.ink;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.color = C.inkSoft;
                    }
                  }}
                >
                  {/* Active indicator */}
                  {active && (
                    <motion.span
                      layoutId="active-indicator"
                      style={{
                        position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                        width: 3, height: '55%', borderRadius: '0 3px 3px 0',
                        background: `linear-gradient(180deg, ${C.terra}, ${C.terraLight})`,
                      }}
                    />
                  )}

                  {/* Icon container */}
                  <span style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: active
                      ? `rgba(154,66,29,0.14)`
                      : C.sandPale,
                    transition: 'all 0.18s ease',
                  }}>
                    <Icon style={{ width: 16, height: 16, color: active ? C.terra : C.inkMuted }} />
                  </span>

                  {!isCollapsed && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>}

                  {/* Badge */}
                  {!isCollapsed && item.badge === 'star' && (
                    <span style={{
                      width: 22, height: 22, borderRadius: 7,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `linear-gradient(135deg, ${C.terra}, ${C.terraLight})`,
                      flexShrink: 0,
                      boxShadow: `0 3px 10px rgba(154,66,29,0.32)`,
                    }}>
                      <Sparkles style={{ width: 11, height: 11, color: C.paper }} />
                    </span>
                  )}
                </motion.button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Rapport CTA ────────────────────────── */}
      <div style={{ padding: isCollapsed ? '0.5rem 0.5rem 0' : '0.75rem 0.875rem 0' }}>
        <motion.button
          type="button"
          title={isCollapsed ? "Rapport complet" : undefined}
          onClick={() => handleNav('/rapport-complet')}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.98 }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '0.5rem',
            width: '100%',
            padding: isCollapsed ? '0.75rem 0' : '0.75rem 1rem',
            borderRadius: 12,
            fontSize: '0.75rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: C.paper,
            background: `linear-gradient(135deg, ${C.terraDeep}, ${C.terra} 60%, ${C.terraLight})`,
            border: 'none', cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(154,66,29,0.34), 0 1px 0 rgba(255,255,255,0.12) inset',
            position: 'relative', overflow: 'hidden',
          }}
        >
          <span style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.12) 0%, transparent 60%)',
            pointerEvents: 'none',
          }} />
         
          {!isCollapsed && <span style={{ position: 'relative', whiteSpace: 'nowrap' }}>Rapport complet</span>}
        </motion.button>
      </div>

      {/* ── Divider ──────────────────────────── */}
      <div style={{
        height: 1,
        background: `linear-gradient(90deg, transparent, ${C.sandLight}, transparent)`,
        margin: isCollapsed ? '0.75rem 0.5rem' : '1.125rem 0.875rem 0.875rem',
      }} />

      {/* ── User Profile ─────────────────────── */}
      <div style={{ padding: isCollapsed ? '0 0.5rem 1.25rem' : '0 0.875rem 1.25rem', position: 'relative' }}>
        <button
          type="button"
          title={isCollapsed ? (user ? `${user.firstName} ${user.lastName}` : 'Adil') : undefined}
          onClick={() => setProfileOpen(p => !p)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '0.75rem',
            width: '100%',
            padding: isCollapsed ? '0.5rem 0' : '0.625rem 0.875rem',
            borderRadius: 12,
            background: C.mist,
            border: `1px solid ${C.sandLight}`,
            cursor: 'pointer', textAlign: 'left',
            transition: 'all 0.18s ease',
            boxShadow: '0 1px 4px rgba(26,20,16,0.04)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = C.sandLight;
            e.currentTarget.style.borderColor = C.sand;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = C.mist;
            e.currentTarget.style.borderColor = C.sandLight;
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(145deg, ${C.terraDeep}, ${C.terra})`,
            color: C.paper, fontSize: '0.8rem', fontWeight: 700,
            boxShadow: '0 3px 10px rgba(154,66,29,0.28)',
            position: 'relative', overflow: 'hidden',
          }}>
            <span style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.2) 0%, transparent 60%)',
            }} />
            <span style={{ position: 'relative' }}>
              {user?.firstName ? user.firstName[0].toUpperCase() : 'A'}
            </span>
          </div>

          {!isCollapsed && (
            <>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: C.ink, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user ? `${user.firstName} ${user.lastName}` : 'Adil'}
                </p>
                <p style={{ fontSize: '0.7rem', color: C.terra, marginTop: 1, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email || 'admin@gmail.com'}
                </p>
              </div>
              <motion.div
                animate={{ rotate: profileOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown style={{ width: 14, height: 14, color: C.inkMuted }} />
              </motion.div>
            </>
          )}
        </button>

        {/* Profile dropdown */}
        <AnimatePresence>
          {profileOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute', bottom: '100%',
                left: isCollapsed ? '0.25rem' : '0.875rem',
                right: isCollapsed ? '0.25rem' : '0.875rem',
                background: C.paper, border: `1px solid ${C.sand}`,
                borderRadius: 12, padding: '0.375rem',
                boxShadow: '0 -10px 28px rgba(26,20,16,0.12)',
                marginBottom: '0.25rem',
                zIndex: 50,
              }}
            >
              {/* Mon Profil */}
              <button
                type="button"
                onClick={() => { setProfileOpen(false); navigate('/profile'); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start',
                  gap: '0.625rem',
                  width: '100%', padding: '0.5rem 0.75rem',
                  borderRadius: 8, background: 'transparent', border: 'none',
                  fontSize: '0.8rem', fontWeight: 500, color: C.inkSoft,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = C.mist;
                  e.currentTarget.style.color = C.ink;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = C.inkSoft;
                }}
              >
                <User style={{ width: 14, height: 14, color: C.terra }} />
                {!isCollapsed && 'Mon Profil'}
              </button>

              {/* Divider */}
              <div style={{ height: 1, background: C.sandLight, margin: '0.25rem 0' }} />

              {/* Déconnexion */}
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start',
                  gap: '0.625rem',
                  width: '100%', padding: '0.5rem 0.75rem',
                  borderRadius: 8, background: 'transparent', border: 'none',
                  fontSize: '0.8rem', fontWeight: 500, color: '#C42020',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#FEF2F2';
                  e.currentTarget.style.color = '#9A1515';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#C42020';
                }}
              >
                <LogOut style={{ width: 14, height: 14 }} />
                {!isCollapsed && 'Déconnexion'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── SidebarLayout ───────────────────────────────────────── */
interface SidebarLayoutProps { children: ReactNode; }

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  return (
    <>
      {/* Header + drawer mobile : visibles uniquement ≤ 1023px (CSS). */}
      <MobileMenu />
      <div style={{ display: 'flex', minHeight: '100vh', background: '#EDE8DF' }}>
      {/* Collapsible Sidebar */}
      <aside className="app-sidebar" style={{
        width: isCollapsed ? 76 : 272,
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        borderRight: `1px solid #E8DDD0`,
        background: '#FEFCF8',
        boxShadow: '3px 0 24px rgba(26,20,16,0.06)',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 30
      }}>
        {/* Toggle Collapse Icon Button "<-" / "->" */}
        <button
          type="button"
          onClick={() => setIsCollapsed(prev => !prev)}
          title={isCollapsed ? "Déplier le menu (<-)" : "Replier le menu (->)"}
          style={{
            position: 'absolute',
            top: 22,
            right: -14,
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: C.terra,
            color: '#FEFCF8',
            border: '2px solid #FEFCF8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(154,66,29,0.35)',
            zIndex: 40,
            transition: 'transform 0.2s ease, background 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.background = C.terraDark;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.background = C.terra;
          }}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <SidebarContent isCollapsed={isCollapsed} />
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      </div>
    </>
  );
}
