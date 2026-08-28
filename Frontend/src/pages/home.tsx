import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import loginPanel from '../assets/login-panel.png';
import logoOrchid from '../assets/logoOrchidIsland.png';
import dashboardPreview from '../assets/dashboard-preview.png';
import marrakechSkyline from '../assets/marrakech-skyline.png';
import { MainLayout } from '../components/MainLayout';
import { useAuthStore } from '../store/authStore';

// ─── Palette (identique à login.tsx) ──────────────────────────────
// Terracotta : #9A421D   Ink : #241F1B   Mist : #F3F0EB
// Paper : #FEFDFA        Sand : #D4C4AC  Ink-soft : #3D3530

// ─── Keyframes injected once ──────────────────────────────────────
const STYLE = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(22px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulseOrb {
  0%,100% { box-shadow: 0 0 0 0 rgba(154,66,29,0.45); }
  50%      { box-shadow: 0 0 0 6px rgba(154,66,29,0); }
}
@keyframes shimmer {
  from { background-position: -200% center; }
  to   { background-position: 200% center; }
}
@keyframes floatY {
  0%,100% { transform: translateY(0); }
  50%     { transform: translateY(-12px); }
}
@keyframes floatYSoft {
  0%,100% { transform: translateY(0); }
  50%     { transform: translateY(-7px); }
}
@keyframes glowPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(212,196,172,0.35), 0 18px 40px rgba(0,0,0,0.35); }
  50%     { box-shadow: 0 0 0 8px rgba(212,196,172,0), 0 18px 40px rgba(0,0,0,0.35); }
}
@keyframes scrollDot {
  0%   { opacity: 0; transform: translateY(0); }
  30%  { opacity: 1; }
  100% { opacity: 0; transform: translateY(14px); }
}
@keyframes kenBurns {
  from { transform: scale(1); }
  to   { transform: scale(1.08); }
}
.nav-btn { transition: color .18s, background .18s, border-color .18s; }
.nav-btn:hover { color: #9A421D !important; background: rgba(243,240,235,0.75) !important; }
.mod-card { transition: background .22s, box-shadow .22s, transform .22s; }
.mod-card:hover { background: #F3F0EB !important; transform: translateY(-3px); box-shadow: 0 8px 28px rgba(36,31,27,0.09) !important; }
.mod-card:hover .mod-title { color: #9A421D !important; }
.mod-card:hover .mod-arrow { transform: translateX(4px); }
.mod-arrow { transition: transform .22s; }
.footer-link { transition: color .15s; }
.footer-link:hover { color: #D4C4AC !important; }
.home-action:focus-visible, .footer-link:focus-visible { outline: 3px solid #D4C4AC; outline-offset: 4px; }
.reveal { opacity: 0; transform: translateY(28px); transition: opacity .7s ease, transform .7s cubic-bezier(.22,.61,.36,1); will-change: opacity, transform; }
.reveal.is-visible { opacity: 1; transform: translateY(0); }
.pillar-card { transition: transform .25s ease, box-shadow .25s ease; }
.pillar-card:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(36,31,27,0.12); }
.step-card { transition: transform .25s ease, box-shadow .25s ease; }
.step-card:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(36,31,27,0.08); }
.process-pill { transition: background .2s ease, color .2s ease; }
.step-card:hover .process-pill { background: #9A421D !important; color: #FEFDFA !important; }
.hero-badge { animation: floatYSoft 5s ease-in-out infinite; backdrop-filter: blur(10px); }
.hero-insight-panel { display: block; }
.hero-insight-line { transform-origin: left; animation: shimmer 5s linear infinite; background-size: 200% auto; }
.benefit-card { transition: transform .24s ease, box-shadow .24s ease, border-color .24s ease; }
.benefit-card:hover { transform: translateY(-4px); box-shadow: 0 14px 36px rgba(36,31,27,0.09); border-color: rgba(154,66,29,0.35) !important; }
@media (max-width: 980px) {
  .hero-insight-panel { display: none; }
  .footer-hero-grid { grid-template-columns: 1fr !important; }
}
@media (max-width: 640px) {
  .home-header { padding: 16px !important; }
  .home-content { padding-left: 20px !important; padding-right: 20px !important; }
  .home-section { padding-left: 20px !important; padding-right: 20px !important; }
  .hero-actions { width: 100%; }
  .hero-actions .home-action { flex: 1 1 100%; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .01ms !important; }
}
`;

// ─── Hook : révélation au scroll ──────────────────────────────────
function useReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = el.querySelectorAll('.reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold });
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}

// ─── Hook : compteur animé ────────────────────────────────────────
function useCountUp(target: number, duration = 1600, started = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!started) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, started]);
  return value;
}

// ─── Hook : parallaxe léger au scroll ─────────────────────────────
function useParallax(factor = 0.25) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (ref.current) {
          ref.current.style.transform = `translateY(${window.scrollY * factor}px)`;
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [factor]);
  return ref;
}

// ─── SVG Motifs marocains ─────────────────────────────────────────
const ZelligeSVG = ({ id = 'z1', opacity = '0.055' }: { id?: string; opacity?: string }) => (
  <svg aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity }} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id={id} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="none" />
        <rect x="10" y="10" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="0.8" />
        <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="0.5" />
        <line x1="40" y1="0" x2="30" y2="10" stroke="currentColor" strokeWidth="0.5" />
        <line x1="0" y1="40" x2="10" y2="30" stroke="currentColor" strokeWidth="0.5" />
        <line x1="40" y1="40" x2="30" y2="30" stroke="currentColor" strokeWidth="0.5" />
        <circle cx="20" cy="20" r="2" fill="currentColor" />
        <circle cx="0" cy="0" r="1" fill="currentColor" />
        <circle cx="40" cy="0" r="1" fill="currentColor" />
        <circle cx="0" cy="40" r="1" fill="currentColor" />
        <circle cx="40" cy="40" r="1" fill="currentColor" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
);

const DashedCoursesSVG = ({ id = 'd1' }: { id?: string }) => (
  <svg aria-hidden="true" className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id={id} x="0" y="0" width="100%" height="48" patternUnits="userSpaceOnUse">
        <line x1="0" y1="24" x2="100%" y2="24" stroke="currentColor" strokeWidth="1" strokeDasharray="6 10" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
);

const ArchColonnadeSVG = ({ className = 'absolute bottom-0 left-0 w-full opacity-[0.18]', stroke = 'white' }: { className?: string; stroke?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 800 90" xmlns="http://www.w3.org/2000/svg" className={className} preserveAspectRatio="none">
    {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map((i) => (
      <path key={i} d={`M${i*53} 90 L${i*53} 44 Q${i*53+26} 2 ${i*53+52} 44 L${i*53+52} 90`} fill="none" stroke={stroke} strokeWidth="0.7" />
    ))}
  </svg>
);

// ─── Nav items ────────────────────────────────────────────────────
const NAV_ITEMS: Array<{ id: string; label: string; icon: string; featured?: boolean }> = [
  { id: 'analytique',            label: 'Analytique',               icon: '◈' },
  { id: 'estimer-un-bien',       label: 'Estimer un bien',          icon: '◎' },
  { id: 'investissement-risque', label: 'Investissement & risque',  icon: '◆' },
  { id: 'indicateurs-prix',      label: 'Indicateurs des prix',     icon: '◉' },
  { id: 'rapport-complet',       label: 'Rapport complet',          icon: '★', featured: true },
] as const;

const MODULE_DESCS: Record<string, string> = {
  'analytique':            'Tableaux de bord dynamiques et visualisations du marché immobilier en temps réel.',
  'estimer-un-bien':       'Estimation précise par IA basée sur plus de 40 000 transactions Marrakech.',
  'investissement-risque': 'Score d\'attractivité, rentabilité locative et analyse multicritère des risques.',
  'indicateurs-prix':      'Indices de référence par quartier, type de bien et tendances historiques.',
  'rapport-complet':       'Synthèse décisionnelle complète : estimation + score + risques + rapport PDF.',
};

// ─── Stat item avec compteur animé ────────────────────────────────
function StatItem({ value, suffix, label, started }: { value: number; suffix: string; label: string; started: boolean }) {
  const n = useCountUp(value, 1800, started);
  return (
    <div style={{ textAlign: 'center', padding: '8px 12px' }}>
      <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 'clamp(1.9rem,3.4vw,2.6rem)', fontWeight: 300, color: '#9A421D', lineHeight: 1, letterSpacing: '-0.01em' }}>
        {n.toLocaleString('fr-MA')}
        <span style={{ color: '#7A3216', fontSize: '0.6em' }}>{suffix}</span>
      </div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#7A3216', marginTop: 10, fontWeight: 700 }}>
        {label}
      </div>
    </div>
  );
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const goTo = (id: string) => {
    const privateRoutes = ['analytique', 'estimer-un-bien', 'investissement-risque', 'indicateurs-prix', 'rapport-complet'];
    if (privateRoutes.includes(id)) {
      if (!isAuthenticated) {
        navigate('/login');
        return;
      }
      navigate(`/${id}`);
    } else {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const pageRef = useReveal<HTMLElement>();
  const heroImgRef = useParallax(0.22);
  const [statsStarted, setStatsStarted] = useState(false);
  const statsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setStatsStarted(true);
        io.disconnect();
      }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const content = (
      <main ref={pageRef} style={{ minHeight: '100vh', background: '#FEFDFA', color: '#241F1B', fontFamily: "'Inter', sans-serif" }}>
        {/* Inject keyframes */}
        <style>{STYLE}</style>

        {!isAuthenticated && (
          <header className="home-header" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, padding: '24px 32px' }}>
            <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ background: '#FEFDFA', border: '1px solid rgba(212,196,172,0.45)', padding: '6px 7px', display: 'inline-flex', borderRadius: 10 }}>
                  <img src={logoOrchid} alt="Orchid Island" style={{ height: 34, width: 'auto' }} />
                </span>
                <span>
                  <span style={{ display: 'block', fontFamily: "'Source Serif 4', serif", fontSize: '1rem', color: '#FEFDFA' }}>Orchid Island</span>
                  <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(212,196,172,.72)' }}>Due diligence</span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="home-action"
                style={{ padding: '11px 20px', borderRadius: 999, border: '1px solid rgba(212,196,172,.42)', background: 'rgba(254,253,250,.1)', color: '#FEFDFA', fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', cursor: 'pointer', backdropFilter: 'blur(10px)' }}
              >
                Se connecter
              </button>
            </div>
          </header>
        )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HERO                                                        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section style={{ position: 'relative', overflow: 'hidden', minHeight: 680, display: 'flex', alignItems: 'center', background: '#241F1B', color: '#FEFDFA' }}>
        <div ref={heroImgRef} style={{ position: 'absolute', inset: '-12% 0', zIndex: 0, willChange: 'transform' }}>
          <img src={loginPanel} alt="Architecture marocaine" style={{ width: '100%', height: '100%', objectFit: 'cover', animation: 'kenBurns 24s ease-in-out infinite alternate' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(155deg, rgba(36,31,27,0.92) 0%, rgba(154,66,29,0.6) 55%, rgba(36,31,27,0.94) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, color: 'white' }}>
          <ZelligeSVG id="z-hero" opacity="0.055" />
          <DashedCoursesSVG id="d-hero" />
          <ArchColonnadeSVG />
        </div>

        <div className="home-content" style={{ position: 'relative', zIndex: 3, maxWidth: 1280, margin: '0 auto', padding: '100px 32px 80px', width: '100%' }}>
          {/* Eyebrow */}
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.32em', color: 'rgba(212,196,172,0.85)', marginBottom: 22, fontWeight: 400, animation: 'fadeUp .6s ease both' }}>
            Plateforme de due diligence · Marrakech
          </p>

          <h1 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 'clamp(2.8rem,6vw,5rem)', fontWeight: 300, letterSpacing: '-0.015em', lineHeight: 1.06, color: '#FEFDFA', marginBottom: 26, maxWidth: 680, animation: 'fadeUp .7s .1s ease both' }}>
            Décider avec{' '}
            <em style={{ color: '#D4C4AC', fontStyle: 'italic' }}>justesse.</em>
          </h1>

          <p style={{ fontSize: 15, fontWeight: 300, lineHeight: 1.82, color: 'rgba(255,255,255,0.75)', maxWidth: 500, marginBottom: 44, letterSpacing: '0.01em', animation: 'fadeUp .7s .2s ease both' }}>
            Une lecture claire et exigeante du marché immobilier pour estimer,
            investir et sécuriser vos décisions à Marrakech.
          </p>

          <div className="hero-actions" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', animation: 'fadeUp .7s .3s ease both' }}>
            <button
              onClick={() => goTo('rapport-complet')}
              className="home-action"
              style={{ padding: '15px 30px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', background: '#9A421D', color: '#FEFDFA', border: 'none', cursor: 'pointer', transition: 'background .2s, transform .2s', animation: 'glowPulse 3.2s ease-in-out infinite' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#7A3216'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#9A421D'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Lancer un rapport complet
            </button>
            <button
              onClick={() => goTo('processus')}
              className="home-action"
              style={{ padding: '15px 30px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', background: 'rgba(255,255,255,0.08)', color: '#FEFDFA', border: '1px solid rgba(212,196,172,0.45)', cursor: 'pointer', backdropFilter: 'blur(4px)', transition: 'background .2s, border-color .2s, transform .2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.borderColor = 'rgba(212,196,172,0.8)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(212,196,172,0.45)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Découvrir la méthode
            </button>
          </div>

          {/* Badges flottants */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 40, animation: 'fadeUp .7s .45s ease both' }}>
            {[
              { icon: '◈', text: 'IA entraînée sur 40 000+ transactions' },
              { icon: '◉', text: '87 quartiers analysés' },
              { icon: '★', text: 'Rapport en moins de 3 s' },
            ].map(({ icon, text }, i) => (
              <span
                key={text}
                className="hero-badge"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '9px 16px', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
                  color: 'rgba(254,253,250,0.9)', background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(212,196,172,0.3)', borderRadius: 999,
                  animationDelay: `${i * 0.9}s`,
                }}
              >
                <span style={{ color: '#D4C4AC', fontSize: 13 }}>{icon}</span>
                {text}
              </span>
            ))}
          </div>
        </div>

        {/* Panneau analytique flottant */}
        <div
          className="hero-insight-panel"
          style={{
            position: 'absolute', zIndex: 3, right: 'clamp(32px,7vw,110px)', top: 'clamp(120px,18vh,190px)',
            width: 360, padding: 18, borderRadius: 22,
            background: 'linear-gradient(145deg, rgba(254,253,250,0.13), rgba(254,253,250,0.05))',
            border: '1px solid rgba(212,196,172,0.28)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(18px)',
            animation: 'fadeUp .8s .55s ease both, floatY 7s ease-in-out infinite',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <p style={{ margin: '0 0 5px', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'rgba(212,196,172,0.78)', fontWeight: 700 }}>
                Aperçu IA
              </p>
              <strong style={{ display: 'block', fontFamily: "'Source Serif 4', serif", fontSize: '1.35rem', fontWeight: 300, color: '#FEFDFA' }}>
                Villa · Palmeraie
              </strong>
            </div>
            <span style={{ padding: '5px 9px', borderRadius: 999, background: 'rgba(74,222,128,0.12)', color: '#86EFAC', border: '1px solid rgba(134,239,172,0.24)', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Fiable
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Prix estimé', value: '8.4M MAD' },
              { label: 'Score', value: '82/100' },
            ].map((item) => (
              <div key={item.label} style={{ padding: '12px 12px', borderRadius: 14, background: 'rgba(36,31,27,0.36)', border: '1px solid rgba(212,196,172,0.16)' }}>
                <span style={{ display: 'block', color: 'rgba(254,253,250,0.48)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {item.label}
                </span>
                <strong style={{ color: '#FEFDFA', fontSize: 15 }}>{item.value}</strong>
              </div>
            ))}
          </div>

          {[
            { label: 'Rentabilité', value: 78 },
            { label: 'Localisation', value: 91 },
            { label: 'Risque', value: 64 },
          ].map((item, i) => (
            <div key={item.label} style={{ marginTop: i === 0 ? 0 : 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'rgba(254,253,250,0.68)', fontSize: 10 }}>
                <span>{item.label}</span>
                <span>{item.value}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'rgba(254,253,250,0.12)', overflow: 'hidden' }}>
                <div
                  className="hero-insight-line"
                  style={{
                    width: `${item.value}%`, height: '100%', borderRadius: 999,
                    backgroundImage: 'linear-gradient(90deg, #9A421D, #D4C4AC, #9A421D)',
                    animationDelay: `${i * 0.4}s`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Indicateur scroll */}
        <div style={{ position: 'absolute', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.28em', color: 'rgba(254,253,250,0.45)' }}>Découvrir</span>
          <div style={{ width: 22, height: 36, border: '1px solid rgba(212,196,172,0.45)', borderRadius: 12, display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
            <div style={{ width: 3, height: 7, borderRadius: 2, background: '#D4C4AC', animation: 'scrollDot 1.8s ease-in-out infinite' }} />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* STATS BAR — compteurs animés                                */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section style={{ position: 'relative', overflow: 'hidden', background: '#FEFDFA', borderTop: '1px solid rgba(154,66,29,0.16)', borderBottom: '1px solid rgba(154,66,29,0.16)' }}>
        <div style={{ position: 'absolute', inset: 0, color: '#9A421D' }}>
          <ZelligeSVG id="z-stats" opacity="0.035" />
        </div>
        <div
          ref={statsRef}
          style={{
            position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto',
            padding: '44px 32px',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
            gap: 24,
          }}
        >
          <StatItem value={40000} suffix="+" label="Transactions analysées" started={statsStarted} />
          <StatItem value={87} suffix="" label="Quartiers couverts" started={statsStarted} />
          <StatItem value={3} suffix=" s" label="Génération du rapport" started={statsStarted} />
          <StatItem value={98} suffix="%" label="Précision du modèle" started={statsStarted} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* VALUE PROPOSITION — cartes professionnelles                  */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section id="modules" style={{ position: 'relative', overflow: 'hidden', padding: '86px 0', background: '#FEFDFA' }}>
        <div style={{ position: 'absolute', inset: 0, color: '#9A421D' }}>
          <ZelligeSVG id="z-value" opacity="0.022" />
        </div>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          <div className="reveal" style={{ display: 'flex', justifyContent: 'space-between', gap: 32, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 44 }}>
            <div style={{ maxWidth: 610 }}>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.28em', color: '#9A421D', fontWeight: 700, marginBottom: 14 }}>
                Décision augmentée
              </p>
              <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 'clamp(2rem,3.4vw,2.7rem)', fontWeight: 300, letterSpacing: '-0.01em', lineHeight: 1.15, color: '#241F1B', margin: 0 }}>
                Une interface conçue pour transformer les données en décisions.
              </h2>
            </div>
            <p style={{ maxWidth: 360, margin: 0, color: '#3D3530', fontSize: 13.5, lineHeight: 1.75, fontWeight: 300 }}>
              Chaque résultat est structuré pour comparer, vérifier et prioriser rapidement les opportunités immobilières.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
            {[
              { icon: '01', title: 'Lecture financière', desc: 'Rendement, ROI, cash-flow et scénarios sur 10 ans pour mesurer le potentiel réel.' },
              { icon: '02', title: 'Signal de marché', desc: 'Comparaison au prix moyen du quartier et aux références par type de bien.' },
              { icon: '03', title: 'Risque consolidé', desc: 'Score global, alertes spatiales et points de vigilance lisibles en un coup d’œil.' },
              { icon: '04', title: 'Rapport exploitable', desc: 'Synthèse claire pour appuyer une décision d’achat, de négociation ou de rejet.' },
            ].map((item, i) => (
              <article
                key={item.title}
                className="benefit-card reveal"
                style={{
                  transitionDelay: `${i * 0.08}s`,
                  position: 'relative', overflow: 'hidden',
                  minHeight: 220, padding: '30px 26px',
                  background: '#FEFDFA',
                  border: '1px solid rgba(212,196,172,0.7)',
                  boxShadow: '0 4px 18px rgba(36,31,27,0.035)',
                }}
              >
                <div style={{ position: 'absolute', right: -26, top: -26, width: 96, height: 96, borderRadius: '50%', background: 'rgba(154,66,29,0.06)' }} />
                <span style={{ display: 'inline-grid', placeItems: 'center', width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(154,66,29,0.22)', color: '#9A421D', fontFamily: "'Source Serif 4', serif", fontSize: '1.05rem', marginBottom: 24 }}>
                  {item.icon}
                </span>
                <h3 style={{ margin: '0 0 12px', fontFamily: "'Source Serif 4', serif", fontSize: '1.35rem', fontWeight: 300, color: '#241F1B', lineHeight: 1.25 }}>
                  {item.title}
                </h3>
                <p style={{ margin: 0, color: '#3D3530', fontSize: 13, lineHeight: 1.72, fontWeight: 300 }}>
                  {item.desc}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODULES — Grille des 5 sections                            */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '92px 0' }}>
        <div style={{ position: 'absolute', inset: 0, color: '#9A421D' }}>
          <ZelligeSVG id="z-modules" opacity="0.028" />
        </div>

        <div style={{ position: 'relative', maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          {/* En-tête */}
          <div className="reveal" style={{ maxWidth: 560, marginBottom: 60 }}>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.28em', color: '#9A421D', fontWeight: 600, marginBottom: 14 }}>
              Une vision à 360°
            </p>
            <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 'clamp(2rem,3.5vw,2.75rem)', fontWeight: 300, letterSpacing: '-0.01em', lineHeight: 1.15, color: '#241F1B', marginBottom: 16 }}>
              Toutes les dimensions d'un bien,{' '}
              <em style={{ fontStyle: 'italic', color: '#9A421D' }}>réunies ici.</em>
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.78, color: '#3D3530', fontWeight: 300 }}>
              Cinq modules complémentaires pour une due diligence immobilière complète.
              Cliquez sur une carte pour accéder directement à la fonctionnalité.
            </p>
          </div>

          {/* Grille */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', border: '1px solid rgba(212,196,172,0.5)', background: 'rgba(212,196,172,0.4)', gap: '1px' }}>
            {NAV_ITEMS.map(({ id, label, featured, icon }, i) => (
              <button
                key={id}
                className="mod-card reveal"
                onClick={() => goTo(id)}
                style={{
                  position: 'relative',
                  background: '#FEFDFA',
                  padding: '36px 28px 40px',
                  textAlign: 'left',
                  border: 'none',
                  cursor: 'pointer',
                  borderBottom: featured ? '3px solid #9A421D' : '3px solid transparent',
                  boxShadow: 'none',
                  transitionDelay: `${i * 0.08}s`,
                }}
              >
                {/* Numéro */}
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', color: '#9A421D', marginBottom: 18, textTransform: 'uppercase' }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  0{i + 1}
                </span>
                {/* Titre */}
                <span className="mod-title" style={{ display: 'block', fontFamily: "'Source Serif 4', serif", fontSize: 'clamp(1.1rem,1.7vw,1.35rem)', fontWeight: 300, lineHeight: 1.25, color: '#241F1B', marginBottom: 16, transition: 'color .2s' }}>
                  {label}
                </span>
                {/* Desc */}
                <span style={{ display: 'block', fontSize: 12.5, lineHeight: 1.65, color: '#3D3530', fontWeight: 300, marginBottom: 24 }}>
                  {MODULE_DESCS[id]}
                </span>
                {/* CTA */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9A421D' }}>
                  Explorer
                  <svg className="mod-arrow" width="12" height="10" viewBox="0 0 12 10" fill="none">
                    <path d="M7 1l4 4-4 4M1 5h10" stroke="#9A421D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {featured && (
                  <span style={{
                    position: 'absolute', top: 16, right: 16,
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: '#FEFDFA', background: '#9A421D', padding: '3px 8px',
                  }}>
                    Complet
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* RAPPORT COMPLET — mise en avant                            */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section style={{ background: '#F3F0EB', padding: '92px 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, color: '#9A421D' }}>
          <ZelligeSVG id="z-rapport" opacity="0.025" />
        </div>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 56, alignItems: 'center' }}>
            {/* Texte */}
            <div className="reveal">
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.28em', color: '#9A421D', fontWeight: 600, marginBottom: 14 }}>
                La synthèse décisionnelle
              </p>
              <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 'clamp(2rem,3.5vw,2.75rem)', fontWeight: 300, letterSpacing: '-0.01em', lineHeight: 1.15, color: '#241F1B', marginBottom: 18 }}>
                Le Rapport complet
              </h2>
              <p style={{ fontSize: 14, lineHeight: 1.82, color: '#3D3530', fontWeight: 300, maxWidth: 400, marginBottom: 16 }}>
                Une lecture unique et structurée qui combine{' '}
                <strong style={{ color: '#241F1B', fontWeight: 600 }}>estimation du prix</strong>,{' '}
                <strong style={{ color: '#241F1B', fontWeight: 600 }}>score d'investissement</strong>,{' '}
                <strong style={{ color: '#241F1B', fontWeight: 600 }}>analyse des risques</strong>{' '}
                et <strong style={{ color: '#241F1B', fontWeight: 600 }}>rapport PDF généré</strong>{' '}
                — pour avancer avec une information fiable et exploitable.
              </p>
              <p style={{ fontSize: 12, color: '#9A421D', fontWeight: 500, letterSpacing: '0.04em', marginBottom: 32 }}>
                ★ Rapport complet disponible en moins de 3 secondes
              </p>
              <button
                onClick={() => goTo('rapport-complet')}
                style={{ padding: '13px 26px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9A421D', background: 'transparent', border: '1px solid #9A421D', cursor: 'pointer', transition: 'background .2s, color .2s, transform .2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#9A421D'; e.currentTarget.style.color = '#FEFDFA'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9A421D'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                Découvrir le rapport
              </button>
            </div>

            {/* Visuel dashboard */}
            <div className="reveal" style={{ position: 'relative', transitionDelay: '0.15s' }}>
              <div style={{
                position: 'relative', borderRadius: 18, overflow: 'hidden',
                border: '1px solid rgba(212,196,172,0.6)',
                boxShadow: '0 30px 70px rgba(36,31,27,0.22), 0 4px 16px rgba(154,66,29,0.12)',
                animation: 'floatY 7s ease-in-out infinite',
              }}>
                <img
                  src={dashboardPreview}
                  alt="Aperçu du tableau de bord d'analyse"
                  style={{ display: 'block', width: '100%', height: 'auto' }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(36,31,27,0) 60%, rgba(36,31,27,0.25) 100%)', pointerEvents: 'none' }} />
              </div>
              {/* Badge flottant sur le visuel */}
              <div style={{
                position: 'absolute', top: -16, right: -10, zIndex: 2,
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#241F1B', color: '#FEFDFA', padding: '10px 16px', borderRadius: 12,
                border: '1px solid rgba(212,196,172,0.35)',
                boxShadow: '0 14px 34px rgba(36,31,27,0.35)',
                animation: 'floatYSoft 5.5s ease-in-out infinite',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ADE80', animation: 'pulseOrb 2s infinite' }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Analyse en temps réel</span>
              </div>
            </div>
          </div>

          {/* Grille 4 piliers */}
          <div className="reveal" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10, marginTop: 56, transitionDelay: '0.25s' }}>
            {[
              { num: '01', label: 'Estimation\ndu prix',          icon: '◎', highlight: false },
              { num: '02', label: "Score\nd'investissement",       icon: '◆', highlight: false },
              { num: '03', label: 'Analyse\ndes risques',          icon: '◉', highlight: false },
              { num: '04', label: 'Rapport PDF\ncomplet',          icon: '★', highlight: true },
            ].map(({ num, label, icon, highlight }) => (
              <div
                key={num}
                className="pillar-card"
                style={{
                  padding: '28px 22px',
                  border: highlight ? '1px solid #9A421D' : '1px solid #D4C4AC',
                  background: highlight ? '#9A421D' : '#FEFDFA',
                  color: highlight ? '#FEFDFA' : '#241F1B',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', color: highlight ? 'rgba(212,196,172,0.7)' : '#9A421D', marginBottom: 14 }}>
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  {num}
                </span>
                <span style={{ display: 'block', fontFamily: "'Source Serif 4', serif", fontSize: '1.1rem', fontWeight: 300, lineHeight: 1.3, whiteSpace: 'pre-line' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* BANNIÈRE MARRAKECH — image pleine largeur + citation        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section style={{ position: 'relative', overflow: 'hidden', minHeight: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={marrakechSkyline}
          alt="Skyline de Marrakech au coucher du soleil"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', animation: 'kenBurns 26s ease-in-out infinite alternate' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(36,31,27,0.55) 0%, rgba(154,66,29,0.35) 50%, rgba(36,31,27,0.65) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, color: 'white' }}>
          <ZelligeSVG id="z-banner" opacity="0.05" />
        </div>
        <div className="reveal" style={{ position: 'relative', zIndex: 2, maxWidth: 760, textAlign: 'center', padding: '72px 32px' }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.32em', color: 'rgba(212,196,172,0.9)', marginBottom: 20, fontWeight: 500 }}>
            Marrakech · Maroc
          </p>
          <p style={{ fontFamily: "'Source Serif 4', serif", fontSize: 'clamp(1.5rem,3vw,2.3rem)', fontWeight: 300, fontStyle: 'italic', lineHeight: 1.4, color: '#FEFDFA', marginBottom: 22 }}>
            « L'immobilier n'est pas une question de chance,
            c'est une question d'information. »
          </p>
          <div style={{ width: 56, height: 1, background: 'rgba(212,196,172,0.6)', margin: '0 auto' }} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HOW IT WORKS — 3 étapes                                    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section id="processus" style={{ padding: '96px 0', position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, #FEFDFA 0%, #F8F5EE 100%)' }}>
        <div style={{ position: 'absolute', inset: 0, color: '#9A421D' }}>
          <ZelligeSVG id="z-how" opacity="0.025" />
        </div>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', position: 'relative', zIndex: 1 }}>
          <div className="reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.28em', color: '#9A421D', fontWeight: 600, marginBottom: 14 }}>
              Processus
            </p>
            <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 'clamp(1.8rem,3vw,2.5rem)', fontWeight: 300, letterSpacing: '-0.01em', lineHeight: 1.15, color: '#241F1B', marginBottom: 14 }}>
              Comment ça fonctionne ?
            </h2>
            <p style={{ maxWidth: 560, margin: '0 auto', color: '#3D3530', fontSize: 14, lineHeight: 1.75, fontWeight: 300 }}>
              Un parcours court, guidé et lisible : vous renseignez le bien, la plateforme croise les données, puis génère une synthèse exploitable.
            </p>
          </div>

          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
            <div style={{ position: 'absolute', left: 40, right: 40, top: 46, height: 1, background: 'linear-gradient(90deg, transparent, rgba(154,66,29,0.28), transparent)', pointerEvents: 'none' }} />
            {([
              {
                step: '01',
                icon: '⌂',
                title: 'Renseignez le bien',
                desc: 'Adresse, type, surface, prix, loyer estimé et position sur carte. La saisie reste simple, mais suffisamment complète pour une analyse fiable.',
                time: '1 min',
                output: 'Profil du bien',
              },
              {
                step: '02',
                icon: '◈',
                title: 'Croisement des données',
                desc: 'Le moteur compare le bien aux références de Marrakech : quartier, prix/m², type de bien, liquidité du marché et signaux de localisation.',
                time: 'Instantané',
                output: 'Références marché',
              },
              {
                step: '03',
                icon: '◆',
                title: 'Analyse IA',
                desc: 'Les modèles produisent un score d’investissement, des indicateurs financiers, une lecture du risque et des scénarios de rentabilité.',
                time: '< 3 s',
                output: 'Scores & risques',
              },
              {
                step: '04',
                icon: '★',
                title: 'Décision & rapport',
                desc: 'Vous obtenez une synthèse claire pour investir, négocier ou approfondir avec des graphiques, KPIs et justification des résultats.',
                time: 'Final',
                output: 'Rapport exploitable',
              },
            ] as const).map(({ step, icon, title, desc, time, output }, i) => (
              <div
                key={step}
                className="step-card reveal"
                style={{
                  background: '#FEFDFA',
                  padding: '30px 28px 32px',
                  border: '1px solid rgba(212,196,172,0.62)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  transitionDelay: `${i * 0.1}s`,
                  boxShadow: '0 4px 20px rgba(36,31,27,0.035)',
                  minHeight: 300,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', border: '1px solid rgba(154,66,29,0.28)', background: '#F3F0EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9A421D', fontSize: 20 }}>
                      {icon}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#9A421D', textTransform: 'uppercase' }}>
                      Étape {step}
                    </span>
                  </div>
                  <span className="process-pill" style={{ padding: '6px 10px', borderRadius: 999, background: '#F3F0EB', color: '#9A421D', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {time}
                  </span>
                </div>

                <h3 style={{ fontFamily: "'Source Serif 4', serif", fontSize: '1.32rem', fontWeight: 300, color: '#241F1B', marginBottom: 12, lineHeight: 1.25 }}>
                  {title}
                </h3>
                <p style={{ fontSize: 13, lineHeight: 1.72, color: '#3D3530', fontWeight: 300, marginBottom: 22 }}>
                  {desc}
                </p>

                <div style={{ marginTop: 'auto', paddingTop: 18, borderTop: '1px solid rgba(212,196,172,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: '#8B7C6B', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
                    Sortie
                  </span>
                  <strong style={{ color: '#241F1B', fontSize: 12, fontWeight: 700, textAlign: 'right' }}>
                    {output}
                  </strong>
                </div>

                {i < 3 && (
                  <div style={{ position: 'absolute', right: -20, top: 43, zIndex: 2, width: 40, height: 40, background: '#FEFDFA', border: '1px solid rgba(212,196,172,0.62)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(36,31,27,0.08)' }}>
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                      <path d="M7 1l4 4-4 4M1 5h10" stroke="#9A421D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="reveal" style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
            {['Saisie guidée', 'Géolocalisation', 'Modèle de prix', 'Analyse risque', 'Synthèse PDF'].map((label, i) => (
              <div
                key={label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px',
                  background: i === 4 ? '#9A421D' : '#FEFDFA',
                  color: i === 4 ? '#FEFDFA' : '#3D3530',
                  border: i === 4 ? '1px solid #9A421D' : '1px solid rgba(212,196,172,0.55)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                }}
              >
                <span style={{ color: i === 4 ? '#D4C4AC' : '#9A421D', fontFamily: "'Source Serif 4', serif", fontSize: 15 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {label}
              </div>
            ))}
          </div>

          {/* CTA centré */}
          <div className="reveal" style={{ textAlign: 'center', marginTop: 48 }}>
            <button
              onClick={() => goTo('rapport-complet')}
              style={{ padding: '15px 36px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', background: '#9A421D', color: '#FEFDFA', border: 'none', cursor: 'pointer', transition: 'background .2s, transform .2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#7A3216'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#9A421D'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Commencer maintenant
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* FOOTER                                                      */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <footer style={{ position: 'relative', overflow: 'hidden', background: `linear-gradient(100deg, rgba(36,31,27,0.98) 0%, rgba(36,31,27,0.9) 50%, rgba(90,47,28,0.76) 100%), url(${loginPanel}) center / cover`, color: '#FEFDFA', padding: '72px 32px 30px' }}>
        <div style={{ position: 'absolute', inset: 0, color: 'white', background: 'linear-gradient(180deg, rgba(36,31,27,0.1), rgba(36,31,27,0.72))' }}>
          <ZelligeSVG id="z-footer" opacity="0.11" />
          <DashedCoursesSVG id="d-footer" />
        </div>
        <ArchColonnadeSVG className="absolute bottom-0 left-0 w-full opacity-[0.28]" stroke="white" />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto' }}>
          <div className="footer-hero-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(260px, 0.65fr)', gap: 28, alignItems: 'end', paddingBottom: 34, borderBottom: '1px solid rgba(255,255,255,0.18)', marginBottom: 28 }}>
            <div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 11px', border: '1px solid rgba(212,196,172,0.42)', borderRadius: 999, background: 'rgba(254,253,250,0.08)', color: '#D4C4AC', fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D4C4AC', boxShadow: '0 0 0 4px rgba(212,196,172,0.13)' }} /> Intelligence immobilière
              </span>
              <h2 style={{ maxWidth: 640, margin: '16px 0 10px', fontFamily: "'Source Serif 4', serif", fontSize: 'clamp(1.75rem, 3vw, 2.6rem)', fontWeight: 300, lineHeight: 1.08, letterSpacing: '-0.02em' }}>
                Chaque décision mérite une vision plus claire.
              </h2>
              <p style={{ maxWidth: 510, margin: 0, color: 'rgba(254,253,250,0.7)', fontSize: 13, lineHeight: 1.65 }}>
                Orchid Island rassemble les signaux essentiels du marché marocain pour éclairer vos investissements.
              </p>
            </div>
            <div style={{ padding: '18px 20px', border: '1px solid rgba(212,196,172,0.38)', borderRadius: 14, background: 'rgba(36,31,27,0.38)', backdropFilter: 'blur(10px)', boxShadow: '0 14px 36px rgba(0,0,0,0.18)' }}>
              <div style={{ color: '#D4C4AC', fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>Espace sécurisé</div>
              <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: '1.22rem', lineHeight: 1.2, marginBottom: 13 }}>Prêt à étudier votre prochain bien ?</div>
              <button type="button" onClick={() => navigate('/login')} style={{ width: '100%', padding: '11px 16px', border: '1px solid #D4C4AC', borderRadius: 8, background: '#FEFDFA', color: '#5C240E', fontSize: 10, fontWeight: 800, letterSpacing: '0.13em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Se connecter
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.12)', marginBottom: 20 }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ border: '1px solid rgba(212,196,172,0.3)', padding: '5px 6px', display: 'inline-flex' }}>
                <img src={logoOrchid} alt="Orchid Island" style={{ height: 30, width: 'auto', filter: 'brightness(1.05)' }} />
              </span>
              <span>
                <span style={{ display: 'block', fontFamily: "'Source Serif 4', serif", fontSize: '0.95rem', fontWeight: 400, color: '#FEFDFA' }}>
                  Orchid Island
                </span>
                <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(212,196,172,0.55)', marginTop: 2 }}>
                  Due Diligence Immobilière
                </span>
              </span>
            </div>

            {/* Liens */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {NAV_ITEMS.map(({ id, label }) => (
                <button
                  key={id}
                  className="footer-link"
                  onClick={() => goTo(id)}
                  style={{ padding: '4px 10px', fontSize: '10px', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
            © 2026 Orchid Island · Due Diligence Immobilière · Marrakech, Maroc
          </p>
        </div>
      </footer>
      </main>
  );

  return isAuthenticated ? (
    <MainLayout activeId="home">{content}</MainLayout>
  ) : content;
}
