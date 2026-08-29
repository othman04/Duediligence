import { useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import { useLocationAnalytiqueStore } from '../store/locationAnalytiqueStore';

// ─── Palette — IDENTIQUE à analytique.tsx (conservée pixel-par-pixel) ─
const C = {
  ink:        '#1A1410',
  inkDeep:    '#120F0D',
  terra:      '#9A421D',
  terraLight: '#C05A30',
  terraDeep:  '#5C240E',
  terraMuted: 'rgba(154,66,29,0.1)',
  sand:       '#D0C0A8',
  sandLight:  '#E8DDD0',
  sandPale:   '#F0EAE2',
  mist:       '#F4F1EC',
  paper:      '#FEFCF8',
  inkSoft:    '#3A3028',
  inkMuted:   '#7A6E66',
  gold:       '#C49A5A',
  blue:       '#2563EB',
  blueLight:  '#60A5FA',
  green:      '#059669',
  greenLight: '#34D399',
  amber:      '#D97706',
  amberLight: '#FCD34D',
  purple:     '#7C3AED',
  teal:       '#0D9488',
  coral:      '#E11D48',
};

const PIE_COLORS       = ['#2563EB','#059669','#D97706','#9A421D','#7C3AED','#E11D48','#0D9488'];
const OPERATION_COLORS = ['#2563EB', '#10B981'];
const PERIODE_LABEL: Record<string, string> = { mois: 'Mensuel', jour: 'Nuitée' };

// ─── Helpers ──────────────────────────────────────────────────────
const fmt   = (n: number | null | undefined, suffix = '') =>
  n == null ? '—' : `${Number(n).toLocaleString('fr-FR')}${suffix}`;
const fmtDec = (n: number | null | undefined, d = 1, suffix = '') =>
  n == null ? '—' : `${Number(n).toFixed(d)}${suffix}`;

// ─── Tooltip personnalisé Recharts ────────────────────────────────
const StyledTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.paper, border: `1px solid ${C.sand}`, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(36,31,27,0.12)' }}>
      <p style={{ fontWeight: 600, color: C.ink, marginBottom: 6, fontFamily: "'Source Serif 4',serif" }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || C.terra, margin: '2px 0' }}>
          {p.name}: <strong>{Number(p.value).toLocaleString('fr-FR')}</strong>
        </p>
      ))}
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{
      background: accent
        ? `linear-gradient(145deg, ${C.terraDeep}, ${C.terra})`
        : C.paper,
      border: `1px solid ${accent ? C.terra : C.sandLight}`,
      borderRadius: 16,
      padding: '1.4rem 1.5rem',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: accent
        ? '0 8px 28px rgba(154,66,29,0.28)'
        : '0 2px 8px rgba(26,20,16,0.06)',
      transition: 'all 0.22s ease',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = accent
          ? '0 14px 40px rgba(154,66,29,0.36)'
          : '0 8px 24px rgba(26,20,16,0.1)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = accent
          ? '0 8px 28px rgba(154,66,29,0.28)'
          : '0 2px 8px rgba(26,20,16,0.06)';
      }}
    >
      <div style={{ position: 'relative', zIndex: 2 }}>
        <p style={{
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: accent ? C.paper : C.inkMuted,
          marginBottom: 6, opacity: 0.9,
        }}>{label}</p>
        <p style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 'clamp(1.5rem,2.5vw,1.9rem)', fontWeight: 400,
          color: accent ? C.paper : C.ink, lineHeight: 1.15,
          marginBottom: accent ? 2 : 0,
        }}>{value}</p>
        {sub && (
          <p style={{
            fontSize: '0.75rem', color: accent ? 'rgba(255,255,255,0.8)' : C.inkMuted,
            marginTop: 4, lineHeight: 1.4,
          }}>{sub}</p>
        )}
            </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────
function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <p style={{
        fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.22em',
        textTransform: 'uppercase', color: C.terra, marginBottom: 6,
      }}>{eyebrow}</p>
      <h2 style={{
        fontFamily: "'DM Serif Display', Georgia, serif",
        color: C.ink, fontSize: 'clamp(1.25rem,2.5vw,1.6rem)',
        fontWeight: 400, letterSpacing: '-0.01em', lineHeight: 1.15,
      }}>{title}</h2>
    </div>
  );
}

// ─── Chart Card ───────────────────────────────────────────────────
function ChartCard({ title, height = 280, children }: { title: string; height?: number; children: React.ReactNode }) {
  return (
    <div style={{
      background: C.paper, border: `1px solid ${C.sandLight}`,
      borderRadius: 20, padding: '1.5rem 1.75rem',
      boxShadow: '0 2px 8px rgba(26,20,16,0.04)',
    }}>
      <p style={{
        fontSize: '0.78rem', fontWeight: 600, color: C.inkSoft,
        marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.terra, flexShrink: 0 }} />
        {title}
      </p>
      <div style={{ height: `${height}px` }}>
        {children}
      </div>
    </div>
  );
}

// ─── Filter Bar (Location) ────────────────────────────────────────
function FilterBar() {
  const {
    filterOptions, activeFilters, setFilter, resetFilters,
    isLoading,
  } = useLocationAnalytiqueStore();

  const selStyle: React.CSSProperties = {
    minWidth: 160, height: 40, padding: '0 12px', borderRadius: 10,
    border: `1.5px solid ${C.sandLight}`, background: C.paper,
    fontSize: '0.82rem', color: C.ink, outline: 'none', cursor: 'pointer',
  };

  return (
    <div style={{
      maxWidth: 1440, margin: '0 auto', padding: '24px 40px 0',
      display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
      borderBottom: `1px solid ${C.sandLight}`,
    }}>
      <select
        style={selStyle}
        value={activeFilters.commune}
        onChange={e => setFilter('commune', e.target.value)}
      >
        <option value="">Toutes les communes</option>
        {(filterOptions?.communes ?? []).map(v => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>

      <select
        style={selStyle}
        value={activeFilters.type_bien}
        onChange={e => setFilter('type_bien', e.target.value)}
      >
        <option value="">Tous types</option>
        {(filterOptions?.types_bien ?? []).map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <select
        style={selStyle}
        value={activeFilters.periode}
        onChange={e => setFilter('periode', e.target.value)}
      >
        <option value="">Toutes périodes</option>
        <option value="mois">Mensuel</option>
        <option value="jour">Nuitée</option>
      </select>

      <button
        onClick={resetFilters}
        disabled={isLoading}
        style={{
          padding: '8px 18px', fontSize: '0.72rem', fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: C.terra, background: 'transparent',
          border: `1.5px solid ${C.terra}`, borderRadius: 10,
          cursor: 'pointer', transition: 'all .18s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = C.terra; e.currentTarget.style.color = C.paper; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.terra; }}
      >
        Réinitialiser
            </button>
    </div>
  );
}

// ─── Vue LOCATION ─────────────────────────────────────────────────
export function LocationContent() {
  const { dashboard, fetchDashboard, fetchFilterOptions, isLoading, error } = useLocationAnalytiqueStore();

  useEffect(() => {
    fetchFilterOptions();
    fetchDashboard();
  }, []);

  const kpis = dashboard?.kpis;
  const byCommune = dashboard?.by_commune ?? [];
  const byType = dashboard?.by_type ?? [];
  const byPeriode = (dashboard?.by_periode ?? []).map(p => ({ ...p, label: PERIODE_LABEL[p.periode] ?? p.periode }));
  const bucketsMensuel = dashboard?.buckets_mensuel ?? [];
  const bucketsNuitee = dashboard?.buckets_nuitee ?? [];
  const trend = dashboard?.trend ?? [];
  const insights = dashboard?.insights ?? [];

  return (
    <div style={{ minHeight: '100vh', background: C.mist, fontFamily: "'Inter',sans-serif", color: C.ink }}>
      <FilterBar />

      {/* ── Loader/Erreur ── */}
      {isLoading && !dashboard && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400, flexDirection: 'column', gap: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            border: `3px solid ${C.sandLight}`,
            borderTopColor: C.terra,
            animation: 'spin 0.9s linear infinite',
          }} />
          <p style={{ fontSize: '0.83rem', color: C.terra, fontWeight: 500 }}>Chargement du tableau de bord…</p>
        </div>
      )}

      {error && (
        <div style={{ margin: '32px auto', maxWidth: 600, padding: '16px 20px', background: 'rgba(154,66,29,0.07)', borderLeft: `3px solid ${C.terra}`, color: '#7A3216', fontSize: 13 }}>{error}</div>
      )}

      {dashboard && (
        <main style={{ maxWidth: 1440, margin: '0 auto', padding: '40px 40px 80px' }}>

          {/* ── Insights ── */}
          {insights.length > 0 && (
            <div style={{ marginBottom: 36, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {insights.map((ins, i) => (
                <div key={i} style={{
                  flex: '1 1 280px', padding: '12px 18px',
                  background: C.paper,
                  border: `1px solid ${C.sandLight}`,
                  borderLeft: `3px solid ${C.terra}`,
                  borderRadius: '0 12px 12px 0',
                  fontSize: '0.8rem', lineHeight: 1.65, color: C.inkSoft,
                  boxShadow: '0 2px 6px rgba(26,20,16,0.05)',
                }}><span style={{ color: C.terra, fontWeight: 700, marginRight: 6 }}>◆</span>{ins}</div>
              ))}
            </div>
          )}

          {/* ── KPIs ── */}
          <section style={{ marginBottom: 48 }}>
            <SectionHeader eyebrow="Vue globale · Location" title="Indicateurs clés du marché locatif" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              <KpiCard label="Annonces de location" value={fmt(kpis?.total_annonces)}
                sub={`${fmt(kpis?.total_mensuel)} mensuelles · ${fmt(kpis?.total_nuitee)} nuitées`} accent />
              <KpiCard label="Communes couvertes" value={fmt(kpis?.total_communes)}
                sub={`${fmt(kpis?.total_quartiers)} quartiers`} />
              <KpiCard label="Loyer moyen/m²" value={`${fmt(kpis?.avg_loyer_m2_mensuel)} MAD`}
                sub="Location mensuelle" accent />
              <KpiCard label="Loyer mensuel moyen" value={`${fmt(kpis?.avg_loyer_mensuel)} MAD`}
                sub="Toutes surfaces" />
              <KpiCard label="Prix moyen / nuit" value={`${fmt(kpis?.avg_prix_nuit)} MAD`}
                sub="Location de vacances" />
              <KpiCard label="Prix nuit / m²" value={fmtDec(kpis?.avg_prix_nuit_m2, 1, ' MAD')}
                sub="Nuitée" />
                        </div>
          </section>

          {/* ── Tendance temporelle (AreaChart) ── */}
          <section style={{ marginBottom: 48 }}>
            <SectionHeader eyebrow="Évolution du parc locatif" title="Annonces mensuelles vs nuitées dans le temps" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <ChartCard title="Évolution des annonces (par mois)" height={280}>
                <ResponsiveContainer>
                  <AreaChart data={trend} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <defs>
                      <linearGradient id="gMensLoc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.blue} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gNuitLoc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.green} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(212,196,172,0.25)" />
                    <XAxis dataKey="mois" tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={{ stroke: C.sand }} angle={-35} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={false} />
                    <Tooltip content={<StyledTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="mensuel" name="Loyers (mensuel)" stroke={C.blue} fill="url(#gMensLoc)" strokeWidth={2.5} dot={false} />
                    <Area type="monotone" dataKey="nuitee" name="Nuitées" stroke={C.green} fill="url(#gNuitLoc)" strokeWidth={2.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Loyer m² par commune (Teal) */}
              <ChartCard title="Loyer moyen/m² par commune (mensuel)" height={280}>
                <ResponsiveContainer>
                  <BarChart data={byCommune.filter(c => c.loyer_m2_mensuel != null).slice(0, 8)} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 80 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(212,196,172,0.25)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="commune" tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={false} width={76} />
                    <Tooltip content={<StyledTooltip />} />
                    <Bar dataKey="loyer_m2_mensuel" name="MAD/m²" fill={C.teal} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </section>

          {/* ── Types & Périodes ── */}
          <section style={{ marginBottom: 48 }}>
            <SectionHeader eyebrow="Répartition du parc locatif" title="Types de biens & périodes de location" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>

              {/* Types Multi-Couleurs */}
              <ChartCard title="Répartition par type de bien" height={290}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={byType}
                      dataKey="nb"
                      nameKey="type_bien"
                      cx="50%"
                      cy="40%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {byType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<StyledTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, color: C.inkSoft, paddingTop: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Mensuel vs Nuitée (Bleu vs Vert) */}
              <ChartCard title="Location mensuelle vs nuitée" height={290}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={byPeriode}
                      dataKey="nb"
                      nameKey="label"
                      cx="50%"
                      cy="40%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {byPeriode.map((_, i) => <Cell key={i} fill={OPERATION_COLORS[i % OPERATION_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<StyledTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, color: C.inkSoft, paddingTop: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Annonces par commune (top 8) */}
              <ChartCard title="Nombre d'annonces par commune" height={260}>
                <ResponsiveContainer>
                  <BarChart data={byCommune.slice(0, 8)} margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(212,196,172,0.25)" vertical={false} />
                    <XAxis dataKey="commune" tick={{ fontSize: 9, fill: C.inkSoft }} tickLine={false} axisLine={{ stroke: C.sand }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: C.inkMuted }} tickLine={false} axisLine={false} />
                    <Tooltip content={<StyledTooltip />} />
                    <Bar dataKey="nb" name="Annonces" fill={C.amber} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </section>
{/* ── Distributions de prix ── */}
          <section style={{ marginBottom: 48 }}>
            <SectionHeader eyebrow="Distribution des loyers" title="Structure des prix du marché locatif" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%, 400px),1fr))', gap: 16 }}>
              <ChartCard title="Loyers mensuels par tranche (MAD)" height={280}>
                <ResponsiveContainer>
                  <BarChart data={bucketsMensuel} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(212,196,172,0.25)" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={{ stroke: C.sand }} angle={-25} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11, fill: C.inkSoft }} tickLine={false} axisLine={false} />
                    <Tooltip content={<StyledTooltip />} />
                    <Bar dataKey="count" name="Annonces" fill={C.gold} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Prix par nuitée — tranches (MAD)" height={280}>
                <ResponsiveContainer>
                  <BarChart data={bucketsNuitee} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(212,196,172,0.25)" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={{ stroke: C.sand }} angle={-25} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11, fill: C.inkSoft }} tickLine={false} axisLine={false} />
                    <Tooltip content={<StyledTooltip />} />
                    <Bar dataKey="count" name="Annonces" fill={C.coral} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </section>

        </main>
      )}

      {/* ── Footer ── */}
      <footer style={{
        background: C.inkDeep,
        color: C.paper,
        padding: '24px 40px',
        textAlign: 'center',
        borderTop: `1px solid rgba(255,255,255,0.05)`,
      }}>
        <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.3)' }}>
          © 2026 Orchid Island · Analytique · Marrakech-Safi · Volet Location
        </p>
      </footer>
    </div>
  );
}
