import { useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import { useAnalytiqueStore } from '../store/analytiqueStore';

// ─── Palette Multi-couleurs ───────────────────────────────────────
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
  // Vibrant Graph Palette
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

const PIE_COLORS   = ['#2563EB','#059669','#D97706','#9A421D','#7C3AED','#E11D48','#0D9488'];
const OPERATION_COLORS = ['#2563EB', '#10B981'];

const RISK_COLORS: Record<string, string> = {
  Faible: '#10B981', Modéré: '#F59E0B', Élevé: '#EF4444', Inconnu: '#64748B',
};



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
      {/* Top accent bar for non-accent cards */}
      {!accent && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${C.terra}, ${C.gold})`,
          opacity: 0,
          transition: 'opacity 0.22s ease',
        }}
          className="kpi-accent-bar"
        />
      )}
      {/* Zellige overlay for accent */}
      {accent && (
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.07, pointerEvents: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='none'/%3E%3Crect x='10' y='10' width='20' height='20' fill='none' stroke='%23ffffff' stroke-width='0.4'/%3E%3Ccircle cx='20' cy='20' r='1.5' fill='%23ffffff'/%3E%3C/svg%3E")`,
          backgroundSize: '40px 40px',
        }} />
      )}
      {/* Glare for accent */}
      {accent && (
        <div style={{
          position: 'absolute', top: '-40%', right: '-10%',
          width: '55%', height: '140%',
          background: 'radial-gradient(ellipse, rgba(255,255,255,0.1) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
      )}
      <p style={{
        fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.22em',
        color: accent ? 'rgba(212,196,172,0.85)' : C.terra,
        fontWeight: 700, marginBottom: 10, position: 'relative',
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: "'DM Serif Display', Georgia, serif",
        fontSize: 'clamp(1.4rem,2.2vw,1.9rem)',
        fontWeight: 400, color: accent ? C.paper : C.ink,
        letterSpacing: '-0.015em', position: 'relative', lineHeight: 1.1,
      }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: '0.72rem', color: accent ? 'rgba(212,196,172,0.75)' : C.inkMuted, marginTop: 6, position: 'relative' }}>{sub}</p>}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────
function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      <div style={{ width: 3, height: 36, background: `linear-gradient(180deg, ${C.terra}, ${C.gold})`, borderRadius: 3, flexShrink: 0, marginTop: 2 }} />
      <div>
        <p style={{
          fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.26em',
          color: C.terra, fontWeight: 700, marginBottom: 6,
        }}>{eyebrow}</p>
        <h2 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 'clamp(1.2rem,2.2vw,1.65rem)',
          fontWeight: 400, color: C.ink, letterSpacing: '-0.015em', lineHeight: 1.2,
        }}>{title}</h2>
      </div>
    </div>
  );
}

// ─── Chart Card wrapper ───────────────────────────────────────────
function ChartCard({ children, title, height = 260 }: { children: React.ReactNode; title: string; height?: number }) {
  return (
    <div style={{
      background: C.paper,
      border: `1px solid ${C.sandLight}`,
      borderRadius: 16,
      padding: '1.5rem',
      boxShadow: '0 2px 8px rgba(26,20,16,0.06)',
      transition: 'box-shadow 0.2s ease',
      position: 'relative',
      overflow: 'hidden',
    }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(26,20,16,0.1)'}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(26,20,16,0.06)'}
    >
      {/* Subtle top line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${C.terra}, transparent)`,
        opacity: 0.35,
      }} />
      <p style={{
        fontSize: '0.72rem', fontWeight: 700, color: C.inkMuted,
        letterSpacing: '0.1em', marginBottom: 16, textTransform: 'uppercase',
      }}>{title}</p>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

// ─── FILTER BAR ───────────────────────────────────────────────────
function FilterBar() {
  const { filterOptions, activeFilters, setFilter, resetFilters, isLoading } = useAnalytiqueStore();

  const selStyle = {
    padding: '8px 14px', fontSize: '0.8125rem', color: C.ink,
    background: C.paper, border: `1.5px solid ${C.sandLight}`,
    borderRadius: 10,
    cursor: 'pointer', outline: 'none', fontFamily: "'Inter',sans-serif",
    minWidth: 150,
    boxShadow: '0 1px 4px rgba(26,20,16,0.05)',
    transition: 'all 0.18s ease',
  };

  return (
    <div style={{
      background: C.paper,
      borderBottom: `1px solid ${C.sandLight}`,
      padding: '14px 40px',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
      maxWidth: 1440, margin: '0 auto',
      boxShadow: '0 2px 8px rgba(26,20,16,0.04)',
    }}>
      <span style={{
        fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.22em',
        textTransform: 'uppercase', color: C.terra, marginRight: 4,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ width: 6, height: 6, background: C.terra, borderRadius: '50%', display: 'inline-block' }} />
        Filtres
      </span>

      {/* Région */}
      <select
        style={selStyle}
        value={activeFilters.region}
        onChange={e => setFilter('region', e.target.value)}
        onFocus={e => { e.target.style.borderColor = C.terra; e.target.style.boxShadow = '0 0 0 3px rgba(154,66,29,0.12)'; }}
        onBlur={e => { e.target.style.borderColor = C.sandLight; e.target.style.boxShadow = '0 1px 4px rgba(26,20,16,0.05)'; }}
      >
        <option value="">Toutes les régions</option>
        {filterOptions?.regions.map(r => <option key={r}>{r}</option>)}
      </select>

      {/* Ville */}
      <select
        style={selStyle}
        value={activeFilters.ville}
        onChange={e => setFilter('ville', e.target.value)}
        onFocus={e => { e.target.style.borderColor = C.terra; e.target.style.boxShadow = '0 0 0 3px rgba(154,66,29,0.12)'; }}
        onBlur={e => { e.target.style.borderColor = C.sandLight; e.target.style.boxShadow = '0 1px 4px rgba(26,20,16,0.05)'; }}
      >
        <option value="">Toutes les villes</option>
        {filterOptions?.villes.map(v => <option key={v}>{v}</option>)}
      </select>

      {/* Type de bien */}
      <select
        style={selStyle}
        value={activeFilters.type_bien}
        onChange={e => setFilter('type_bien', e.target.value)}
        onFocus={e => { e.target.style.borderColor = C.terra; e.target.style.boxShadow = '0 0 0 3px rgba(154,66,29,0.12)'; }}
        onBlur={e => { e.target.style.borderColor = C.sandLight; e.target.style.boxShadow = '0 1px 4px rgba(26,20,16,0.05)'; }}
      >
        <option value="">Tous types</option>
        {filterOptions?.types_bien.map(t => <option key={t}>{t}</option>)}
      </select>

      {/* Opération */}
      <select
        style={selStyle}
        value={activeFilters.operation}
        onChange={e => setFilter('operation', e.target.value)}
        onFocus={e => { e.target.style.borderColor = C.terra; e.target.style.boxShadow = '0 0 0 3px rgba(154,66,29,0.12)'; }}
        onBlur={e => { e.target.style.borderColor = C.sandLight; e.target.style.boxShadow = '0 1px 4px rgba(26,20,16,0.05)'; }}
      >
        <option value="">Vente & Location</option>
        {filterOptions?.operations.map(o => <option key={o}>{o}</option>)}
      </select>

      {/* Reset */}
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

      {isLoading && <span style={{ fontSize: '0.75rem', color: C.terra, fontWeight: 500, marginLeft: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, background: C.terra, borderRadius: '50%', animation: 'pulse 1s ease-in-out infinite', opacity: 0.8 }} />
        Chargement…
      </span>}
    </div>
  );
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────
export function VenteContent() {
  const { dashboard, fetchDashboard, fetchFilterOptions, isLoading, error } = useAnalytiqueStore();

  useEffect(() => {
    fetchFilterOptions();
    fetchDashboard();
  }, []);

  const kpis = dashboard?.kpis;
  const byGeo = dashboard?.by_geo ?? [];
  const byType = dashboard?.by_type ?? [];
  const byRisk = dashboard?.by_risk ?? [];
  const priceBuckets = dashboard?.price_buckets ?? [];
  const trend = dashboard?.trend ?? [];
  const hcp = dashboard?.hcp_data ?? [];
  const opportunities = dashboard?.opportunities ?? [];
  const insights = dashboard?.insights ?? [];

  return (
    <div style={{ minHeight: '100vh', background: C.mist, fontFamily: "'Inter',sans-serif", color: C.ink }}>
        <FilterBar />

      {/* ── Loader/Erreur ─────────────────────────────────────── */}
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
        <div style={{ margin: '32px auto', maxWidth: 600, padding: '16px 20px', background: 'rgba(154,66,29,0.07)', borderLeft: `3px solid ${C.terra}`, color: '#7A3216', fontSize: 13 }}>
          {error}
        </div>
      )}

      {dashboard && (
        <main style={{ maxWidth: 1440, margin: '0 auto', padding: '40px 40px 80px' }}>

          {/* ── Insights ─────────────────────────────────────── */}
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
                }}>
                  <span style={{ color: C.terra, fontWeight: 700, marginRight: 6 }}>◆</span>{ins}
                </div>
              ))}
            </div>
          )}

          {/* ── KPIs ─────────────────────────────────────────── */}
          <section style={{ marginBottom: 48 }}>
            <SectionHeader eyebrow="Vue globale" title="Indicateurs clés du marché" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              <KpiCard label="Biens indexés"     value={fmt(kpis?.total_properties)} sub={`${kpis?.vente_count ?? 0} ventes · ${kpis?.location_count ?? 0} locations`} />
              <KpiCard label="Villes couvertes"  value={fmt(kpis?.total_cities)} sub={`${kpis?.total_quartiers ?? 0} quartiers`} />
              <KpiCard label="Prix moyen/m²"     value={`${fmt(kpis?.avg_price_m2)} MAD`} sub="Vente" accent />
              <KpiCard label="Loyer moyen/m²"    value={`${fmt(kpis?.avg_rent_m2)} MAD`} sub="Location" />
              <KpiCard label="Rendement locatif" value={fmtDec(kpis?.rental_yield, 2, ' %')} />
              <KpiCard label="Score invest. moy" value={fmtDec(kpis?.avg_investment_score, 1, ' / 100')} accent />
              <KpiCard label="Score localisation" value={fmtDec(kpis?.avg_location_score, 1, ' / 100')} />
              <KpiCard label="Score risque env."  value={fmtDec(kpis?.avg_risk_score, 1, ' / 100')} />
            </div>
          </section>

          {/* ── Tendance & Prix/m² par zone ──────────────────── */}
          <section style={{ marginBottom: 48 }}>
            <SectionHeader eyebrow="Évolution temporelle" title="Tendance des annonces (24 mois)" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%, 420px),1fr))', gap: 16 }}>

              {/* Tendance (Vente Bleue, Location Verte) */}
              <ChartCard title="Annonces mensuelles — Vente vs Location" height={280}>
                <ResponsiveContainer>
                  <AreaChart data={trend} margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
                    <defs>
                      <linearGradient id="gVente" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.blue}  stopOpacity={0.3} />
                        <stop offset="95%" stopColor={C.blue}  stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gLoc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.green} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(212,196,172,0.25)" />
                    <XAxis dataKey="mois" tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={{ stroke: C.sand }} angle={-35} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={false} />
                    <Tooltip content={<StyledTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="vente_count"    name="Vente"    stroke={C.blue}   fill="url(#gVente)" strokeWidth={2.5} dot={false} />
                    <Area type="monotone" dataKey="location_count" name="Location" stroke={C.green}  fill="url(#gLoc)"   strokeWidth={2.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Prix/m² par zone (Teal) */}
              <ChartCard title="Prix moyen/m² par zone (top 8)" height={280}>
                <ResponsiveContainer>
                  <BarChart data={byGeo} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 80 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(212,196,172,0.25)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={false}
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={false} width={76} />
                    <Tooltip content={<StyledTooltip />} />
                    <Bar dataKey="avg_sale_price_m2" name="MAD/m²" fill={C.teal} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </section>

          {/* ── Types & Opérations & Risques ─────────────────── */}
          <section style={{ marginBottom: 48 }}>
            <SectionHeader eyebrow="Répartition du parc" title="Types de biens, opérations & profil de risque" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>

              {/* Types Multi-Couleurs */}
              <ChartCard title="Répartition par type de bien" height={290}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={byType}
                      dataKey="properties_count"
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

              {/* Opérations (Bleu vs Vert) */}
              <ChartCard title="Vente vs Location" height={290}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={dashboard.by_operation}
                      dataKey="properties_count"
                      nameKey="operation"
                      cx="50%"
                      cy="40%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {dashboard.by_operation?.map((_: any, i: number) => <Cell key={i} fill={OPERATION_COLORS[i % OPERATION_COLORS.length]} />)}
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

              {/* Risques (Vert / Jaune / Rouge) */}
              <ChartCard title="Niveau de risque environnemental" height={290}>
                <ResponsiveContainer>
                  <BarChart data={byRisk} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(212,196,172,0.25)" vertical={false} />
                    <XAxis dataKey="overall_risk_level" tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={{ stroke: C.sand }} />
                    <YAxis tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={false} />
                    <Tooltip content={<StyledTooltip />} />
                    <Bar dataKey="properties_count" name="Biens" radius={[3, 3, 0, 0]}>
                      {byRisk.map((entry, i) => <Cell key={i} fill={RISK_COLORS[entry.overall_risk_level] ?? C.blue} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </section>

          {/* ── Distribution des prix (Gold / Jaune) ────────── */}
          <section style={{ marginBottom: 48 }}>
            <SectionHeader eyebrow="Marché de la vente" title="Distribution des prix de vente" />
            <ChartCard title="Nombre de biens par tranche de prix (MAD)" height={280}>
              <ResponsiveContainer>
                <BarChart data={priceBuckets} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 6" stroke="rgba(212,196,172,0.25)" vertical={false} />
                  <XAxis dataKey="range" tick={{ fontSize: 11, fill: C.inkSoft }} tickLine={false} axisLine={{ stroke: C.sand }} />
                  <YAxis tick={{ fontSize: 11, fill: C.inkSoft }} tickLine={false} axisLine={false} />
                  <Tooltip content={<StyledTooltip />} />
                  <Bar dataKey="count" name="Biens" fill={C.gold} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          {/* ── HCP Données socio-éco (Vert & Coral) ─────────── */}
          {hcp.length > 0 && (
            <section style={{ marginBottom: 48 }}>
              <SectionHeader eyebrow="Contexte socio-économique" title="Données HCP par région" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%, 400px),1fr))', gap: 16 }}>
                <ChartCard title="Revenu mensuel moyen (MAD)" height={260}>
                  <ResponsiveContainer>
                    <BarChart data={hcp} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 120 }}>
                      <CartesianGrid strokeDasharray="3 6" stroke="rgba(212,196,172,0.25)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="region" tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={false} width={116} />
                      <Tooltip content={<StyledTooltip />} />
                      <Bar dataKey="revenu_mensuel_moyen" name="Revenu (MAD)" fill={C.green} radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Taux de chômage (%)" height={260}>
                  <ResponsiveContainer>
                    <BarChart data={hcp} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 120 }}>
                      <CartesianGrid strokeDasharray="3 6" stroke="rgba(212,196,172,0.25)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={false} unit="%" />
                      <YAxis type="category" dataKey="region" tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={false} width={116} />
                      <Tooltip content={<StyledTooltip />} />
                      <Bar dataKey="taux_chomage_pct" name="Chômage (%)" fill={C.coral} radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </section>
          )}

          {/* ── Opportunités d'investissement ────────────────── */}
          {opportunities.length > 0 && (
            <section style={{ marginBottom: 48 }}>
              <SectionHeader eyebrow="Opportunités détectées" title="Zones à fort potentiel d'investissement" />
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: C.ink, color: C.paper }}>
                      {['Zone','Biens','Prix/m² (MAD)','Score invest.','Value Index','Décision'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((opp, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? C.paper : C.mist, borderBottom: `1px solid rgba(212,196,172,0.3)` }}>
                        <td style={{ padding: '11px 16px', fontWeight: 500 }}>{opp.label}</td>
                        <td style={{ padding: '11px 16px' }}>{opp.properties_count}</td>
                        <td style={{ padding: '11px 16px' }}>{fmt(opp.avg_sale_price_m2)} MAD</td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', background: opp.avg_investment_score >= 70 ? 'rgba(76,175,80,0.12)' : 'rgba(255,152,0,0.12)', color: opp.avg_investment_score >= 70 ? '#2E7D32' : '#E65100', fontWeight: 600, borderRadius: 2 }}>
                            {fmtDec(opp.avg_investment_score, 1)}
                          </span>
                        </td>
                        <td style={{ padding: '11px 16px' }}>{opp.value_index ?? '—'}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ display: 'inline-block', padding: '3px 10px', background: opp.decision === 'Acheter' ? C.terra : 'rgba(212,196,172,0.4)', color: opp.decision === 'Acheter' ? C.paper : C.inkSoft, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            {opp.decision}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Score invest. par zone (line) ────────────────── */}
          {byGeo.some(g => g.avg_investment_score != null) && (
            <section style={{ marginBottom: 48 }}>
              <SectionHeader eyebrow="Scores IA" title="Score d'investissement par zone" />
              <ChartCard title="Score moyen d'investissement (0–100) par zone géographique" height={280}>
                <ResponsiveContainer>
                  <BarChart data={byGeo.filter(g => g.avg_investment_score != null)} margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(212,196,172,0.25)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={{ stroke: C.sand }} angle={-30} textAnchor="end" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={false} />
                    <Tooltip content={<StyledTooltip />} />
                    <Bar dataKey="avg_investment_score" name="Score invest." fill={C.purple} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </section>
          )}

        </main>
      )}

      {/* ── Footer ───────────────────────────────────────────── */}

    </div>
  );
}
