import { useMemo, useState, useEffect } from 'react';
import { MainLayout } from '../components/MainLayout';
import { useHistoryStore } from '../store/historyStore';
import type { HistoryEntry, EstimationDetails, InvestissementDetails } from '../store/historyStore';
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Filter,
  Home,
  Search,
  ShieldAlert,
  Trash2,
  TrendingUp,
  User,
  UserPlus,
  X,
} from 'lucide-react';

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  terra:      '#9A421D',
  terraDark:  '#7A3216',
  terraDeep:  '#5C240E',
  terraLight: '#C05A30',
  terraMuted: 'rgba(154,66,29,0.09)',
  ink:        '#1A1410',
  inkSoft:    '#3A3028',
  inkMuted:   '#7A6E66',
  sand:       '#D0C0A8',
  sandLight:  '#E8DDD0',
  sandPale:   '#F0EAE2',
  mist:       '#F4F1EC',
  paper:      '#FEFCF8',
  gold:       '#C49A5A',
  success:    '#2E7D32',
  successBg:  '#E8F5E9',
  error:      '#C62828',
  errorBg:    '#FFEBEE',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ZelligeSVG = () => (
  <svg
    aria-hidden="true"
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.022, pointerEvents: 'none', color: C.terra }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <pattern id="zs-hist" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="none" />
        <rect x="10" y="10" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="0.8" />
        <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="0.5" />
        <line x1="40" y1="0" x2="30" y2="10" stroke="currentColor" strokeWidth="0.5" />
        <line x1="0" y1="40" x2="10" y2="30" stroke="currentColor" strokeWidth="0.5" />
        <line x1="40" y1="40" x2="30" y2="30" stroke="currentColor" strokeWidth="0.5" />
        <circle cx="20" cy="20" r="2" fill="currentColor" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#zs-hist)" />
  </svg>
);

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatPrice(v: number) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v))} MAD`;
}

function typeConfig(type: HistoryEntry['type']) {
  switch (type) {
    case 'estimation':
      return { label: 'Estimation', icon: Calculator, color: C.terra, bg: C.terraMuted };
    case 'investissement':
      return { label: 'Investissement & Risque', icon: TrendingUp, color: C.gold, bg: 'rgba(196,154,90,0.10)' };
    case 'rapport':
      return { label: 'Rapport Complet', icon: FileText, color: '#2E7D32', bg: '#E8F5E9' };
    case 'admin':
      return { label: 'Gestion Admin', icon: UserPlus, color: '#1565C0', bg: '#E3F2FD' };
    default:
      return { label: 'Action', icon: Clock, color: C.inkMuted, bg: C.mist };
  }
}

// ─── Details Renderers ────────────────────────────────────────────────────────

function EstimationCard({ d }: { d: EstimationDetails }) {
  const modeLabel = d.mode === 'vente' ? 'Vente' : 'Location';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
      {/* Property info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Mode', val: modeLabel },
          { label: 'Type de bien', val: d.propertyType },
          { label: 'Ville', val: d.city },
          { label: 'Surface', val: `${d.surface} m²` },
          ...(d.rooms ? [{ label: 'Pièces', val: d.rooms }] : []),
          ...(d.bathrooms ? [{ label: 'Salles de bain', val: d.bathrooms }] : []),
          ...(d.neighborhood ? [{ label: 'Quartier', val: d.neighborhood }] : []),
        ].map(({ label, val }) => (
          <div key={label} style={{ background: C.mist, borderRadius: 10, padding: '0.6rem 0.85rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: C.inkMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: C.ink }}>{val}</div>
          </div>
        ))}
      </div>
      {/* Equipment */}
      {d.equipment && d.equipment.length > 0 && (
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C.inkMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Équipements</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {d.equipment.map(eq => (
              <span key={eq} style={{ fontSize: '0.76rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 20, background: C.sandPale, color: C.inkSoft, border: `1px solid ${C.sandLight}` }}>
                {eq}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Results */}
      <div style={{ background: `linear-gradient(135deg, ${C.terraDeep}, ${C.terra})`, borderRadius: 14, padding: '1.25rem 1.5rem', color: C.paper }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.75, marginBottom: '0.5rem' }}>Résultat de l'estimation</div>
        <div style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>{formatPrice(d.estimate)}</div>
        <div style={{ fontSize: '0.82rem', opacity: 0.8 }}>
          Fourchette : {formatPrice(d.low)} – {formatPrice(d.high)}
        </div>
        <div style={{ fontSize: '0.78rem', opacity: 0.7, marginTop: 4 }}>
          Prix au m² : {formatPrice(d.pricePerSqm)}
        </div>
      </div>
    </div>
  );
}

function InvestissementCard({ d }: { d: InvestissementDetails }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Adresse', val: d.address || '—' },
          { label: 'Ville', val: d.city || '—' },
          { label: 'Type', val: d.type || '—' },
          { label: 'Prix', val: d.price > 0 ? formatPrice(d.price) : '—' },
          { label: 'Loyer mensuel', val: d.rent > 0 ? formatPrice(d.rent) : '—' },
          { label: 'Surface', val: d.surface > 0 ? `${d.surface} m²` : '—' },
        ].map(({ label, val }) => (
          <div key={label} style={{ background: C.mist, borderRadius: 10, padding: '0.6rem 0.85rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: C.inkMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: C.ink }}>{val}</div>
          </div>
        ))}
      </div>
      {/* Scores */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <div style={{ background: 'rgba(154,66,29,0.07)', border: `1px solid ${C.sandLight}`, borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.inkMuted, textTransform: 'uppercase', marginBottom: 4 }}>Score Invest.</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: C.terra }}>{d.investmentScore}<span style={{ fontSize: '1rem', fontWeight: 400, color: C.inkMuted }}>/100</span></div>
        </div>
        <div style={{ background: 'rgba(183,121,31,0.07)', border: `1px solid ${C.sandLight}`, borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.inkMuted, textTransform: 'uppercase', marginBottom: 4 }}>Score Risque</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: C.gold }}>{d.riskScore}<span style={{ fontSize: '1rem', fontWeight: 400, color: C.inkMuted }}>/100</span></div>
        </div>
        <div style={{ background: 'rgba(46,125,50,0.07)', border: `1px solid rgba(46,125,50,0.2)`, borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.inkMuted, textTransform: 'uppercase', marginBottom: 4 }}>Rendement brut</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: C.success }}>{d.yieldRate.toFixed(2)}<span style={{ fontSize: '1rem', fontWeight: 400, color: C.inkMuted }}>%</span></div>
        </div>
      </div>
    </div>
  );
}

function RapportCard({ d }: { d: { sections: string[] } }) {
  return (
    <div style={{ paddingTop: '0.5rem' }}>
      <div style={{ fontSize: '0.78rem', color: C.inkMuted, marginBottom: '0.5rem' }}>Sections générées :</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {d.sections.map(s => (
          <span key={s} style={{ fontSize: '0.76rem', padding: '0.25rem 0.65rem', borderRadius: 20, background: '#E8F5E9', color: '#2E7D32', fontWeight: 600, border: '1px solid rgba(46,125,50,0.2)' }}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function AdminCard({ d }: { d: any }) {
  return (
    <div style={{ paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <div style={{ background: C.paper, borderRadius: 10, padding: '0.6rem 0.85rem', border: `1px solid ${C.sandLight}` }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: C.inkMuted, textTransform: 'uppercase' }}>Action</div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: d?.action === 'create_admin' ? C.success : C.error }}>
            {d?.action === 'create_admin' ? 'Création d\'administrateur' : 'Suppression d\'administrateur'}
          </div>
        </div>
        <div style={{ background: C.paper, borderRadius: 10, padding: '0.6rem 0.85rem', border: `1px solid ${C.sandLight}` }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: C.inkMuted, textTransform: 'uppercase' }}>Cible</div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: C.ink }}>{d?.targetName || '—'}</div>
        </div>
        <div style={{ background: C.paper, borderRadius: 10, padding: '0.6rem 0.85rem', border: `1px solid ${C.sandLight}` }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: C.inkMuted, textTransform: 'uppercase' }}>Email Cible</div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: C.ink }}>{d?.targetEmail || '—'}</div>
        </div>
      </div>
    </div>
  );
}

function UserInfoBox({ user }: { user: HistoryEntry['user'] }) {
  return (
    <div style={{
      background: C.paper,
      borderRadius: 12,
      padding: '0.85rem 1.15rem',
      border: `1px solid ${C.sandLight}`,
      marginBottom: '1rem',
      boxShadow: '0 1px 4px rgba(26,20,16,0.03)',
    }}>
      <div style={{
        fontSize: '0.68rem', fontWeight: 700, color: C.inkMuted,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem',
        display: 'flex', alignItems: 'center', gap: 6
      }}>
        <User size={14} style={{ color: C.terra }} /> Informations de l'Utilisateur
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        <div style={{ background: C.mist, padding: '0.5rem 0.75rem', borderRadius: 8 }}>
          <div style={{ fontSize: '0.66rem', color: C.inkMuted, fontWeight: 600, textTransform: 'uppercase' }}>Prénom</div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: C.ink }}>{user.firstName || '—'}</div>
        </div>
        <div style={{ background: C.mist, padding: '0.5rem 0.75rem', borderRadius: 8 }}>
          <div style={{ fontSize: '0.66rem', color: C.inkMuted, fontWeight: 600, textTransform: 'uppercase' }}>Nom</div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: C.ink }}>{user.lastName || '—'}</div>
        </div>
        <div style={{ background: C.mist, padding: '0.5rem 0.75rem', borderRadius: 8 }}>
          <div style={{ fontSize: '0.66rem', color: C.inkMuted, fontWeight: 600, textTransform: 'uppercase' }}>Adresse Email</div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: C.terra }}>{user.email || '—'}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Entry Card ───────────────────────────────────────────────────────────────

function EntryCard({ entry, onRemove }: { entry: HistoryEntry; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = typeConfig(entry.type);
  const Icon = cfg.icon;

  return (
    <div style={{
      background: C.paper,
      border: `1px solid ${C.sandLight}`,
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(26,20,16,0.04)',
      transition: 'box-shadow 0.2s ease',
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '0.875rem',
          padding: '1rem 1.25rem',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(p => !p)}
      >
        {/* Type icon */}
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: cfg.color,
        }}>
          <Icon size={20} />
        </div>

        {/* Main info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: C.ink, whiteSpace: 'nowrap' }}>
              {entry.label}
            </span>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
              padding: '0.15rem 0.5rem', borderRadius: 20,
              background: cfg.bg, color: cfg.color,
            }}>
              {cfg.label}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: C.inkMuted }}>
              <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
              {formatDate(entry.timestamp)}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: C.ink }}>
              {entry.user.firstName} {entry.user.lastName}
            </span>
            <span style={{ fontSize: '0.72rem', color: C.terra, opacity: 0.9 }}>
              ({entry.user.email})
            </span>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Supprimer cet enregistrement"
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: `1px solid ${C.sandLight}`, background: C.paper,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.error, cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.errorBg; e.currentTarget.style.borderColor = C.error; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.paper; e.currentTarget.style.borderColor = C.sandLight; }}
          >
            <Trash2 size={13} />
          </button>
          <div style={{ color: C.inkMuted }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${C.sandLight}`,
          padding: '1.25rem 1.25rem 1.5rem',
          background: C.mist,
        }}>
          {/* Bloc d'informations utilisateur */}
          <UserInfoBox user={entry.user} />

          {entry.type === 'estimation' && <EstimationCard d={entry.details as EstimationDetails} />}
          {entry.type === 'investissement' && <InvestissementCard d={entry.details as InvestissementDetails} />}
          {entry.type === 'rapport' && <RapportCard d={entry.details as { sections: string[] }} />}
          {entry.type === 'admin' && <AdminCard d={entry.details} />}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'estimation' | 'investissement' | 'rapport' | 'admin';

export default function HistoriquePage() {
  const { entries, fetchHistory, clearHistory, removeEntry } = useHistoryStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filtered = useMemo(() => {
    let list = [...entries];
    if (filter !== 'all') list = list.filter(e => e.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.label.toLowerCase().includes(q) ||
        e.user.firstName.toLowerCase().includes(q) ||
        e.user.lastName.toLowerCase().includes(q) ||
        e.user.email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [entries, filter, search]);

  const counts = useMemo(() => ({
    all: entries.length,
    estimation: entries.filter(e => e.type === 'estimation').length,
    investissement: entries.filter(e => e.type === 'investissement').length,
    rapport: entries.filter(e => e.type === 'rapport').length,
    admin: entries.filter(e => e.type === 'admin').length,
  }), [entries]);

  return (
    <MainLayout activeId="historique">
      {/* ═══════ ELEGANT TERRACOTTA & WARM GOLD HEADER ═══════ */}
      <header style={{
        background: 'linear-gradient(135deg, #7A3216 0%, #9A421D 50%, #C05A30 100%)',
        color: '#FEFDFA',
        padding: '2.5rem 3rem 2.25rem',
        position: 'relative',
        overflow: 'visible',
        boxShadow: '0 8px 32px rgba(154,66,29,0.22)'
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.05,
          backgroundImage: 'radial-gradient(#FEFDFA 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px', pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', top: -100, right: -50, width: 450, height: 450,
          background: 'radial-gradient(circle, rgba(254,253,250,0.18) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
           
            <h1 style={{
              fontFamily: "'Source Serif 4', Georgia, serif",
              fontSize: 'clamp(1.8rem, 2.5vw, 2.3rem)',
              fontWeight: 400, color: '#FEFDFA', margin: '0 0 0.4rem 0',
              lineHeight: 1.15
            }}>
              Historique des Actions
            </h1>
            <p style={{
              fontSize: '0.88rem', color: 'rgba(254,253,250,0.85)',
              margin: 0, maxWidth: 640, lineHeight: 1.5
            }}>
              Journal chronologique de toutes les estimations, analyses d'investissement et rapports générés sur la plateforme.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              padding: '0.75rem 1.25rem', borderRadius: 14,
              background: 'rgba(254,253,250,0.12)', backdropFilter: 'blur(6px)',
              border: '1px solid rgba(254,253,250,0.2)', textAlign: 'right'
            }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(254,253,250,0.75)' }}>
                Total Enregistré
              </div>
              <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: '1.4rem', fontWeight: 600, color: '#FEFDFA' }}>
                {entries.length} action{entries.length !== 1 ? 's' : ''}
              </div>
            </div>

            {entries.length > 0 && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowConfirmClear(true)}
                  style={{
                    padding: '0.75rem 1.2rem', borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'rgba(196,32,32,0.25)', backdropFilter: 'blur(6px)',
                    fontSize: '0.82rem', fontWeight: 700, color: '#FEFDFA',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Trash2 size={15} /> Vider l'historique
                </button>
                {showConfirmClear && (
                  <div style={{
                    position: 'absolute', right: 0, top: '110%',
                    background: C.paper, border: `1px solid ${C.sand}`, borderRadius: 12,
                    padding: '1rem', zIndex: 50, minWidth: 240,
                    boxShadow: '0 8px 28px rgba(26,20,16,0.2)', color: C.ink
                  }}>
                    <p style={{ fontSize: '0.82rem', color: C.ink, marginBottom: '0.75rem', fontWeight: 600 }}>Confirmer la suppression de tout l'historique ?</p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => { clearHistory(); setShowConfirmClear(false); }}
                        style={{ flex: 1, padding: '0.5rem', borderRadius: 8, border: 'none', background: C.error, color: C.paper, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                        Confirmer
                      </button>
                      <button type="button" onClick={() => setShowConfirmClear(false)}
                        style={{ flex: 1, padding: '0.5rem', borderRadius: 8, border: `1px solid ${C.sand}`, background: C.paper, color: C.ink, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main style={{ minHeight: '80vh', background: C.paper, color: C.ink, fontFamily: "'Inter', sans-serif", position: 'relative' }}>
        <ZelligeSVG />
        <div style={{ maxWidth: '100%', padding: '2rem 3rem 4rem', position: 'relative' }}>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {([
              { key: 'all', label: 'Tout', icon: Home },
              { key: 'estimation', label: 'Estimations', icon: Calculator },
              { key: 'investissement', label: 'Investissement', icon: ShieldAlert },
              { key: 'rapport', label: 'Rapports', icon: FileText },
              { key: 'admin', label: 'Admin & Comptes', icon: UserPlus },
            ] as { key: FilterType; label: string; icon: typeof Home }[]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                style={{
                  padding: '0.45rem 1rem', borderRadius: 10,
                  border: `1px solid ${filter === key ? C.terra : C.sandLight}`,
                  background: filter === key ? C.terraMuted : C.paper,
                  color: filter === key ? C.terra : C.inkSoft,
                  fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={13} />
                {label}
                <span style={{
                  minWidth: 20, height: 18, borderRadius: 20,
                  background: filter === key ? C.terra : C.sandPale,
                  color: filter === key ? C.paper : C.inkMuted,
                  fontSize: '0.7rem', fontWeight: 700, padding: '0 5px',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {counts[key]}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: C.inkMuted }} />
            <input
              type="text"
              placeholder="Rechercher par action, utilisateur ou email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.25rem',
                borderRadius: 10, border: `1px solid ${C.sand}`, background: C.mist,
                fontSize: '0.875rem', color: C.ink, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.inkMuted, cursor: 'pointer', display: 'flex' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Results */}
          {filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '4rem 2rem',
              border: `1px dashed ${C.sandLight}`, borderRadius: 16,
              background: C.mist,
            }}>
              <Clock size={36} style={{ color: C.sandLight, marginBottom: '1rem' }} />
              <p style={{ fontSize: '1rem', fontWeight: 600, color: C.inkMuted, margin: 0 }}>
                {entries.length === 0 ? 'Aucune action enregistrée pour l\'instant.' : 'Aucun résultat pour cette recherche.'}
              </p>
              <p style={{ fontSize: '0.82rem', color: C.inkMuted, marginTop: '0.5rem' }}>
                {entries.length === 0
                  ? 'Les actions effectuées (estimation, investissement, rapport) apparaîtront ici automatiquement.'
                  : 'Essayez de modifier vos filtres ou votre recherche.'
                }
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Filter result info */}
              {(search || filter !== 'all') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Filter size={13} style={{ color: C.inkMuted }} />
                  <span style={{ fontSize: '0.78rem', color: C.inkMuted }}>
                    {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {filtered.map(entry => (
                <EntryCard key={entry.id} entry={entry} onRemove={() => removeEntry(entry.id)} />
              ))}
            </div>
          )}
        </div>
      </main>
    </MainLayout>
  );
}
