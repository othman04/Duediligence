import { useState, useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Building2, MapPin, TrendingUp, Filter, ArrowUpDown, BarChart3,
  Layers, Home, Plus, Minus, RotateCcw, Expand, Search, Calendar, Star
} from 'lucide-react';
import { useLocationAnalytiqueStore } from '../store/locationAnalytiqueStore';
import { ALL_QUARTIER_GEOJSON_FEATURES, ALL_COMMUNE_GEOJSON_FEATURES, type ZonePolygon } from '../data/zonesData';

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  terra: '#9A421D',
  terraDark: '#7A3216',
  terraLight: '#C05A30',
  terraMuted: 'rgba(154,66,29,0.08)',
  ink: '#241F1B',
  inkSoft: '#5A4F46',
  sand: '#D4C4AC',
  sandLight: '#E8DFD0',
  mist: '#F6F3EE',
  paper: '#FEFDFA',
  gold: '#C9941A',
  emerald: '#2E7D32',
  blue: '#0B6FAB',
  orange: '#E67E22',
};

// ─── Per-Commune Color Palette ──────────────────────────────────────────────
const COMMUNE_COLORS: Record<string, { fill: string; stroke: string; light: string }> = {
  'Marrakech':          { fill: '#1E88E5', stroke: '#0D47A1', light: 'rgba(30,136,229,0.12)' },
  'Tasoultante':        { fill: '#00897B', stroke: '#004D40', light: 'rgba(0,137,123,0.12)' },
  'Ourika':             { fill: '#8E24AA', stroke: '#4A148C', light: 'rgba(142,36,170,0.12)' },
  'Mechouar Kasbah':    { fill: '#F57C00', stroke: '#E65100', light: 'rgba(245,124,0,0.12)'  },
  'Tameslouht':         { fill: '#D81B60', stroke: '#880E4F', light: 'rgba(216,27,96,0.12)'  },
  'Saâda':              { fill: '#43A047', stroke: '#1B5E20', light: 'rgba(67,160,71,0.12)'  },
  'Ouahat Sidi Brahim': { fill: '#6D4C41', stroke: '#3E2723', light: 'rgba(109,76,65,0.12)'  },
  'Sidi Abdallah Ghiat':{ fill: '#039BE5', stroke: '#01579B', light: 'rgba(3,155,229,0.12)'  },
};
const DEFAULT_COMMUNE_COLOR = { fill: '#757575', stroke: '#424242', light: 'rgba(117,117,117,0.12)' };
function getCommuneColor(commune: string) {
  return COMMUNE_COLORS[commune] || DEFAULT_COMMUNE_COLOR;
}

// ─── Formatters ──────────────────────────────────────────────────────────────
const fmtMAD = (v: number | null | undefined) =>
  v === null || v === undefined || isNaN(v) ? '—' : new Intl.NumberFormat('fr-FR').format(Math.round(v)) + ' MAD';

const fmtM2 = (v: number | null | undefined) =>
  v === null || v === undefined || isNaN(v) ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v) + ' MAD/m²';

const fmtNum = (v: number | null | undefined) =>
  v === null || v === undefined || isNaN(v) ? '0' : new Intl.NumberFormat('fr-FR').format(v);

// ─── Échelle choroplèthe ─────────────────────────────────────────────────────
export const RENT_TIERS_MONTHLY = [
  { max: 40,  label: '< 40 MAD/m²',    color: '#2E7D32', border: '#1B5E20' },
  { max: 70,  label: '40 – 70 MAD/m²', color: '#00897B', border: '#004D40' },
  { max: 110, label: '70 – 110 MAD/m²',color: '#1E88E5', border: '#0D47A1' },
  { max: 160, label: '110 – 160 MAD/m²',color: '#F57C00', border: '#E65100' },
  { max: Infinity, label: '> 160 MAD/m²', color: '#C62828', border: '#B71C1C' },
];

export const RENT_TIERS_NIGHTLY = [
  { max: 400,  label: '< 400 MAD/nuit',   color: '#2E7D32', border: '#1B5E20' },
  { max: 800,  label: '400 – 800 MAD',    color: '#00897B', border: '#004D40' },
  { max: 1400, label: '800 – 1 400 MAD',  color: '#1E88E5', border: '#0D47A1' },
  { max: 2500, label: '1 400 – 2 500 MAD',color: '#F57C00', border: '#E65100' },
  { max: Infinity, label: '> 2 500 MAD/nuit', color: '#C62828', border: '#B71C1C' },
];

function getColorByRent(val: number | null, isNight = false): string {
  if (!val) return '#2E7D32';
  const tiers = isNight ? RENT_TIERS_NIGHTLY : RENT_TIERS_MONTHLY;
  for (const t of tiers) {
    if (val < t.max) return t.color;
  }
  return '#C62828';
}

function RentBadge({ val, isM2 = true }: { val: number | null; isM2?: boolean }) {
  if (!val) return <span style={{ color: 'rgba(0,0,0,0.25)', fontSize: '0.78rem' }}>—</span>;
  const color = getColorByRent(val, !isM2);
  return (
    <span style={{ fontWeight: 700, color, fontSize: '0.82rem', letterSpacing: '-0.01em' }}>
      {isM2 ? fmtM2(val) : fmtMAD(val)}
    </span>
  );
}

// ─── Interfaces ─────────────────────────────────────────────────────────────
type TabType = 'communes' | 'quartiers';
type PeriodeType = 'mensuel' | 'nuitee';

interface PolygonWithBounds {
  item: any;
  name: string;
  pts: ZonePolygon;
  bounds: L.LatLngBounds;
}

// ─── Map Controller Component ───────────────────────────────────────────────
function MapController({
  targetBounds,
  allBounds,
  onZoomLevelChange
}: {
  targetBounds: L.LatLngBoundsExpression | null;
  allBounds: L.LatLngBoundsExpression | null;
  onZoomLevelChange: (z: number) => void;
}) {
  const map = useMap();

  useMapEvents({
    zoomend: () => {
      onZoomLevelChange(map.getZoom());
    }
  });

  useEffect(() => {
    if (targetBounds) {
      map.fitBounds(targetBounds, { padding: [45, 45], maxZoom: 15, animate: true, duration: 1.0 });
    } else if (allBounds) {
      map.fitBounds(allBounds, { padding: [30, 30], animate: true, duration: 1.0 });
    }
  }, [targetBounds, allBounds, map]);

  return null;
}

// ─── Custom Map Action Buttons ───────────────────────────────────────────────
function CustomMapControls({
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleFullscreen,
  isFullscreen
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}) {
  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, zIndex: 1000,
      display: 'flex', flexDirection: 'column', gap: 6
    }}>
      <button
        onClick={onZoomIn}
        title="Zoom avant"
        style={{
          width: 34, height: 34, borderRadius: 8, background: '#FEFDFA',
          border: `1px solid ${C.sand}`, color: C.ink, display: 'flex',
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          boxShadow: '0 3px 10px rgba(0,0,0,0.1)', transition: 'all 0.15s'
        }}
      >
        <Plus size={16} />
      </button>
      <button
        onClick={onZoomOut}
        title="Zoom arrière"
        style={{
          width: 34, height: 34, borderRadius: 8, background: '#FEFDFA',
          border: `1px solid ${C.sand}`, color: C.ink, display: 'flex',
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          boxShadow: '0 3px 10px rgba(0,0,0,0.1)', transition: 'all 0.15s'
        }}
      >
        <Minus size={16} />
      </button>
      <button
        onClick={onResetZoom}
        title="Recentrer la carte"
        style={{
          width: 34, height: 34, borderRadius: 8, background: '#FEFDFA',
          border: `1px solid ${C.sand}`, color: C.terra, display: 'flex',
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          boxShadow: '0 3px 10px rgba(0,0,0,0.1)', transition: 'all 0.15s'
        }}
      >
        <RotateCcw size={15} />
      </button>
      <button
        onClick={onToggleFullscreen}
        title={isFullscreen ? "Réduire la carte" : "Agrandir la carte"}
        style={{
          width: 34, height: 34, borderRadius: 8, background: C.terra,
          border: 'none', color: '#FEFDFA', display: 'flex',
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          boxShadow: '0 3px 10px rgba(154,66,29,0.3)', transition: 'all 0.15s'
        }}
      >
        <Expand size={15} />
      </button>
    </div>
  );
}

// ─── Sortable Header ────────────────────────────────────────────────────────
function SortTh({
  label, field, sortField, sortAsc, onSort, align = 'right', style = {}
}: {
  label: string; field: string; sortField: string; sortAsc: boolean;
  onSort: (f: string) => void; align?: string; style?: React.CSSProperties;
}) {
  const active = sortField === field;
  return (
    <th style={{
      padding: '0.85rem 0.9rem', fontWeight: 600, textAlign: align as any,
      background: active ? 'rgba(154,66,29,0.06)' : 'transparent',
      borderBottom: `2px solid ${active ? C.terra : C.sand}`,
      whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
      transition: 'all 0.15s', fontSize: '0.78rem', ...style
    }}
      onClick={() => onSort(field)}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: active ? C.terra : C.inkSoft }}>
        {label}
        <ArrowUpDown size={11} style={{ opacity: active ? 1 : 0.4 }} />
        {active && (
          <span style={{ fontSize: '0.65rem', color: C.terra, fontWeight: 700 }}>
            {sortAsc ? '↑' : '↓'}
          </span>
        )}
      </span>
    </th>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function IndicateurPrixLocationPage() {
  const { dashboard, isLoading, error, fetchFilterOptions, fetchDashboard } = useLocationAnalytiqueStore();
  const [activeTab, setActiveTab] = useState<TabType>('communes');
  const [periode, setPeriode] = useState<PeriodeType>('mensuel');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCommuneFilter, setSelectedCommuneFilter] = useState<string>('TOUS');

  const [sortField, setSortField] = useState<string>('loyer_m2_mensuel');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  const [selectedItem, setSelectedItem] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [, setCurrentZoom] = useState<number>(11);
  const [isExpandedMap, setIsExpandedMap] = useState<boolean>(false);
  const [mapTileStyle, setMapTileStyle] = useState<'voyager' | 'positron' | 'osm'>('voyager');

  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    fetchFilterOptions();
    fetchDashboard();
  }, [fetchFilterOptions, fetchDashboard]);

  const communes = useMemo(() => dashboard?.by_commune ?? [], [dashboard]);
  const quartiers = useMemo(() => dashboard?.by_quartier ?? [], [dashboard]);
  const kpis = dashboard?.kpis;

  const communeNames = useMemo(() => {
    const list = Array.from(new Set(quartiers.map((q: any) => q.commune))).sort();
    return ['TOUS', ...list];
  }, [quartiers]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchTerm('');
    setSortField(tab === 'communes' ? (periode === 'mensuel' ? 'loyer_m2_mensuel' : 'prix_nuit_moyen') : 'nb');
    setSelectedItem(null);
  };

  const filteredData = useMemo(() => {
    if (activeTab === 'communes') {
      return communes.filter((c: any) =>
        c.commune.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else {
      return quartiers.filter((q: any) => {
        const matchesSearch =
          q.quartier.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.commune.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCommune = selectedCommuneFilter === 'TOUS' || q.commune === selectedCommuneFilter;
        return matchesSearch && matchesCommune;
      });
    }
  }, [activeTab, communes, quartiers, searchTerm, selectedCommuneFilter]);

  const sortedData = useMemo(() => {
    const copy = [...filteredData];
    copy.sort((a: any, b: any) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (valA === null || valA === undefined) valA = sortAsc ? Infinity : -Infinity;
      if (valB === null || valB === undefined) valB = sortAsc ? Infinity : -Infinity;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
    return copy;
  }, [filteredData, sortField, sortAsc]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Compute all polygon bounds for auto-fit zoom
  const { polygonsWithBounds, allBounds } = useMemo(() => {
    const isCommune = activeTab === 'communes';
    const allPts: [number, number][] = [];

    if (isCommune) {
      const items: PolygonWithBounds[] = [];

      for (const feat of ALL_COMMUNE_GEOJSON_FEATURES) {
        const cName = feat.name;
        const cNameClean = cName.toLowerCase().trim();

        const matched = (sortedData as any[]).filter((c: any) => {
          const nameInDb = (c.commune || '').toLowerCase().trim();
          return nameInDb === cNameClean || nameInDb.includes(cNameClean) || cNameClean.includes(nameInDb);
        });

        if (matched.length === 0) continue;

        feat.pts.forEach(p => allPts.push(p));
        const matchedItem = matched[0];
        const itemData = {
          ...matchedItem,
          commune: cName,
          lat: feat.centroid_lat || feat.pts[0][0],
          lng: feat.centroid_lon || feat.pts[0][1]
        };

        const bounds = L.latLngBounds(feat.pts);
        items.push({ item: itemData, name: cName, pts: feat.pts, bounds });
      }

      const bounds = allPts.length ? L.latLngBounds(allPts) : null;
      return { polygonsWithBounds: items, allBounds: bounds };
    }

    // Quartiers Tab
    const items: PolygonWithBounds[] = [];

    for (const feat of ALL_QUARTIER_GEOJSON_FEATURES) {
      const gName = feat.name;
      const gNameNorm = gName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

      const matched = (sortedData as any[]).filter((q: any) => {
        const qNameNorm = (q.quartier || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
        return qNameNorm === gNameNorm || qNameNorm.includes(gNameNorm) || gNameNorm.includes(qNameNorm);
      });

      if (matched.length === 0) continue;

      feat.pts.forEach(p => allPts.push(p));

      const matchedItem = matched[0];
      const itemData = {
        ...matchedItem,
        quartier: gName,
        lat: feat.centroid_lat || feat.pts[0][0],
        lng: feat.centroid_lon || feat.pts[0][1]
      };

      const bounds = L.latLngBounds(feat.pts);
      items.push({ item: itemData, name: gName, pts: feat.pts, bounds });
    }

    const bounds = allPts.length ? L.latLngBounds(allPts) : null;
    return { polygonsWithBounds: items, allBounds: bounds };
  }, [sortedData, activeTab]);

  const selectedItemBounds = useMemo(() => {
    if (!selectedItem) return null;
    const found = polygonsWithBounds.find(p => p.name === selectedItem.name);
    return found ? found.bounds : null;
  }, [selectedItem, polygonsWithBounds]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
    setCurrentPage(1);
  };

  const handleSelectRow = (item: any) => {
    const name = activeTab === 'communes' ? item.commune : item.quartier;
    setSelectedItem({ lat: item.lat || 31.63, lng: item.lng || -7.98, name });
  };

  const currentTiers = periode === 'mensuel' ? RENT_TIERS_MONTHLY : RENT_TIERS_NIGHTLY;

  return (
    <div style={{ minHeight: '100vh', background: '#F8F6F0', color: C.ink, fontFamily: "'Inter', sans-serif" }}>

      {/* ═══════ ELEGANT TERRACOTTA & WARM GOLD HEADER ═══════ */}
      <header style={{
        background: 'linear-gradient(135deg, #7A3216 0%, #9A421D 50%, #C05A30 100%)',
        color: '#FEFDFA',
        padding: '2.5rem 2.5rem 2.25rem',
        position: 'relative',
        overflow: 'hidden',
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

        <div style={{ maxWidth: 1650, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem' }}>
            <div>
           
              <h1 style={{
                fontFamily: "'Source Serif 4', serif", fontSize: 'clamp(1.8rem, 3.2vw, 2.7rem)',
                fontWeight: 400, lineHeight: 1.15, letterSpacing: '-0.015em', margin: 0, color: '#FEFDFA'
              }}>
                Indicateurs &amp; Cartographie des Loyers
              </h1>
              
              <p style={{
                fontSize: '0.92rem', color: 'rgba(254,253,250,0.85)', margin: '0.6rem 0 0',
                maxWidth: 680, fontWeight: 300, lineHeight: 1.6
              }}>
                Analyse choroplèthe par polygones géographiques réels. Visualisez et comparez le niveau de loyer mensuel au m² ou le prix nuitée par secteur.
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', paddingTop: '0.25rem' }}>
              <div style={{ display: 'flex', background: 'rgba(254,253,250,0.15)', padding: 4, borderRadius: 12, border: '1px solid rgba(254,253,250,0.3)' }}>
                {(['mensuel', 'nuitee'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => {
                      setPeriode(p);
                      setSortField(activeTab === 'communes' ? (p === 'mensuel' ? 'loyer_m2_mensuel' : 'prix_nuit_moyen') : 'nb');
                    }}
                    style={{
                      padding: '0.55rem 1.1rem', borderRadius: 9, cursor: 'pointer', border: 'none',
                      background: periode === p ? '#FEFDFA' : 'transparent',
                      color: periode === p ? C.terraDark : '#FEFDFA', fontWeight: 700, fontSize: '0.82rem',
                      transition: 'all 0.2s', boxShadow: periode === p ? '0 3px 10px rgba(0,0,0,0.15)' : 'none'
                    }}
                  >
                    {p === 'mensuel' ? 'Loyer Mensuel' : 'Prix Par Nuit'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* KPI Cards Banner */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem', marginTop: '2rem'
          }}>
            {[
              { label: 'Annonces Location',        value: fmtNum(kpis?.total_annonces),     icon: <Home size={16} /> },
              { label: 'Location mensuelle',       value: fmtNum(kpis?.total_mensuel),      icon: <Calendar size={16} /> },
              { label: 'Location par nuitée',      value: fmtNum(kpis?.total_nuitee),        icon: <Star size={16} /> },
              { label: 'Communes couvertes',       value: fmtNum(kpis?.total_communes),      icon: <Building2 size={16} /> },
              { label: 'Quartiers référencés',     value: fmtNum(kpis?.total_quartiers),     icon: <Layers size={16} /> },
              { label: 'Loyer / m² mensuel moyen', value: fmtM2(kpis?.avg_loyer_m2_mensuel), icon: <TrendingUp size={16} /> },
            ].map((kpi, i) => (
              <div key={i} style={{
                background: 'rgba(254,253,250,0.12)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(254,253,250,0.22)',
                padding: '1rem 1.15rem', borderRadius: 14,
                boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: '0.4rem' }}>
                  <span style={{ color: '#FCE7D7' }}>{kpi.icon}</span>
                  <span style={{
                    fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em',
                    color: 'rgba(254,253,250,0.8)', fontWeight: 600
                  }}>
                    {kpi.label}
                  </span>
                </div>
                <strong style={{
                  fontSize: '1.38rem', color: '#FEFDFA',
                  fontFamily: "'Source Serif 4', serif", fontWeight: 400, letterSpacing: '-0.02em'
                }}>
                  {kpi.value}
                </strong>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ═══════ MAIN FULL-WIDTH EXPANDED SPLIT LAYOUT ═══════ */}
      <div style={{ maxWidth: 1650, margin: '0 auto', padding: '1.75rem 1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>

        {isLoading && (
          <div style={{ width: '100%', padding: '3rem', textAlign: 'center', color: C.inkSoft }}>
            Chargement des indicateurs de prix de location…
          </div>
        )}

        {error && (
          <div style={{ width: '100%', padding: '2rem', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 12, color: '#991B1B' }}>
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* ─── LEFT PANEL: TABLE & FILTERS (50% WIDTH) ─── */}
            <div style={{ flex: '1 1 48%', minWidth: 340, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Control Bar */}
              <div style={{
                background: C.paper, border: `1px solid ${C.sand}`, borderRadius: 16,
                padding: '1.2rem 1.35rem', boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
                  <div style={{ display: 'inline-flex', background: C.mist, padding: 4, borderRadius: 12, border: `1px solid ${C.sandLight}` }}>
                    {([
                      { id: 'communes', label: `Communes (${communes.length})`, icon: <Building2 size={14} /> },
                      { id: 'quartiers', label: `Quartiers (${quartiers.length})`, icon: <MapPin size={14} /> },
                    ] as { id: TabType; label: string; icon: React.ReactNode }[]).map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        style={{
                          padding: '0.55rem 1.15rem', fontSize: '0.83rem',
                          fontWeight: activeTab === tab.id ? 600 : 500,
                          color: activeTab === tab.id ? C.paper : C.inkSoft,
                          background: activeTab === tab.id
                            ? 'linear-gradient(135deg, #9A421D, #C05A30)'
                            : 'transparent',
                          border: 'none', borderRadius: 9, cursor: 'pointer', transition: 'all 0.18s',
                          display: 'flex', alignItems: 'center', gap: 7,
                          boxShadow: activeTab === tab.id ? '0 3px 10px rgba(154,66,29,0.3)' : 'none'
                        }}
                      >
                        {tab.icon} {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', alignItems: 'center' }}>
                  <div style={{ flex: '1 1 240px', position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.terra, pointerEvents: 'none' }} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                      placeholder={activeTab === 'communes' ? 'Rechercher une commune…' : 'Rechercher un quartier ou commune…'}
                      style={{
                        width: '100%', padding: '0.6rem 0.85rem 0.6rem 2.3rem', fontSize: '0.84rem',
                        borderRadius: 9, border: `1px solid ${C.sand}`, background: C.mist,
                        color: C.ink, outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {activeTab === 'quartiers' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Filter size={13} style={{ color: C.terra, flexShrink: 0 }} />
                      {communeNames.map(name => {
                        const isAll = name === 'TOUS';
                        const active = selectedCommuneFilter === name;
                        const col = isAll ? null : getCommuneColor(name);
                        return (
                          <button
                            key={name}
                            onClick={() => { setSelectedCommuneFilter(name); setCurrentPage(1); }}
                            style={{
                              padding: '0.3rem 0.75rem', fontSize: '0.76rem', fontWeight: active ? 700 : 500,
                              borderRadius: 20, border: active
                                ? `1.5px solid ${col?.stroke || C.terraDark}`
                                : `1px solid ${C.sand}`,
                              background: active
                                ? (col?.fill || C.terra)
                                : C.paper,
                              color: active ? '#FEFDFA' : C.inkSoft,
                              cursor: 'pointer', transition: 'all 0.15s'
                            }}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Data Table */}
              <div style={{
                background: C.paper, border: `1px solid ${C.sand}`, borderRadius: 16,
                overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                display: 'flex', flexDirection: 'column'
              }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                    <thead>
                      <tr style={{ background: C.mist }}>
                        {activeTab === 'communes' ? (
                          <>
                            <SortTh label="Commune" field="commune" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                            <SortTh label="Annonces" field="nb" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
                            <SortTh label="Loyer Moyen" field="loyer_mensuel_moyen" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
                            <SortTh label="Loyer / m²" field="loyer_m2_mensuel" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
                            <SortTh label="Nuitée Moyenne" field="prix_nuit_moyen" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
                          </>
                        ) : (
                          <>
                            <SortTh label="Commune" field="commune" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                            <SortTh label="Quartier" field="quartier" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                            <SortTh label="Annonces" field="nb" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
                            <SortTh label="Loyer Moyen" field="loyer_mensuel_moyen" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
                            <SortTh label="Loyer / m²" field="loyer_m2_mensuel" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
                            <SortTh label="Nuitée Moyenne" field="prix_nuit_moyen" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedData.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: C.inkSoft }}>
                            Aucun élément ne correspond à votre recherche.
                          </td>
                        </tr>
                      ) : (
                        paginatedData.map((item: any, idx: number) => {
                          const name = activeTab === 'communes' ? item.commune : item.quartier;
                          const isSelected = selectedItem?.name === name;
                          const isHovered = hoveredName === name;

                          return (
                            <tr
                              key={idx}
                              onClick={() => handleSelectRow(item)}
                              onMouseEnter={() => setHoveredName(name)}
                              onMouseLeave={() => setHoveredName(null)}
                              style={{
                                borderBottom: `1px solid ${C.sandLight}`,
                                background: isSelected
                                  ? 'rgba(154,66,29,0.1)'
                                  : isHovered
                                    ? 'rgba(154,66,29,0.03)'
                                    : 'transparent',
                                cursor: 'pointer', transition: 'all 0.12s'
                              }}
                            >
                              {activeTab === 'communes' ? (
                                <>
                                  <td style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: C.ink }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: getCommuneColor(item.commune).fill
                                      }} />
                                      {item.commune}
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.85rem 0.9rem', textAlign: 'right', fontWeight: 500, color: C.inkSoft }}>
                                    {fmtNum(item.nb)}
                                  </td>
                                  <td style={{ padding: '0.85rem 0.9rem', textAlign: 'right' }}>
                                    <RentBadge val={item.loyer_mensuel_moyen} isM2={false} />
                                  </td>
                                  <td style={{ padding: '0.85rem 0.9rem', textAlign: 'right' }}>
                                    <RentBadge val={item.loyer_m2_mensuel} isM2={true} />
                                  </td>
                                  <td style={{ padding: '0.85rem 0.9rem', textAlign: 'right' }}>
                                    <RentBadge val={item.prix_nuit_moyen} isM2={false} />
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td style={{ padding: '0.85rem 0.9rem', color: C.inkSoft, fontSize: '0.8rem' }}>
                                    {item.commune}
                                  </td>
                                  <td style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: C.ink }}>
                                    {item.quartier}
                                  </td>
                                  <td style={{ padding: '0.85rem 0.9rem', textAlign: 'right', fontWeight: 500, color: C.inkSoft }}>
                                    {fmtNum(item.nb)}
                                  </td>
                                  <td style={{ padding: '0.85rem 0.9rem', textAlign: 'right' }}>
                                    <RentBadge val={item.loyer_mensuel_moyen} isM2={false} />
                                  </td>
                                  <td style={{ padding: '0.85rem 0.9rem', textAlign: 'right' }}>
                                    <RentBadge val={item.loyer_m2_mensuel} isM2={true} />
                                  </td>
                                  <td style={{ padding: '0.85rem 0.9rem', textAlign: 'right' }}>
                                    <RentBadge val={item.prix_nuit_moyen} isM2={false} />
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div style={{
                  display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.85rem 1.25rem', borderTop: `1px solid ${C.sandLight}`, background: C.mist, gap: '0.75rem'
                }}>
                  <div style={{ fontSize: '0.78rem', color: C.inkSoft }}>
                    Affichage de {Math.min((currentPage - 1) * pageSize + 1, sortedData.length)} à {Math.min(currentPage * pageSize, sortedData.length)} sur {sortedData.length} éléments
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      style={{
                        padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: 600,
                        borderRadius: 6, border: `1px solid ${C.sand}`, background: C.paper,
                        color: currentPage === 1 ? C.sand : C.ink, cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Précédent
                    </button>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: C.ink }}>
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      style={{
                        padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: 600,
                        borderRadius: 6, border: `1px solid ${C.sand}`, background: C.paper,
                        color: currentPage === totalPages ? C.sand : C.ink, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── RIGHT PANEL: INTERACTIVE LEAFLET MAP (50% WIDTH) ─── */}
            <div style={{
              flex: '1 1 48%', minWidth: 340, height: isExpandedMap ? '85vh' : 720,
              position: 'relative', borderRadius: 18, overflow: 'hidden',
              border: `1.5px solid ${C.sand}`, boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
              transition: 'height 0.3s ease'
            }}>
              <MapContainer
                ref={mapRef}
                center={[31.6295, -7.9811]}
                zoom={11}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                  url={
                    mapTileStyle === 'voyager'
                      ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
                      : mapTileStyle === 'positron'
                        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
                        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                  }
                />

                <MapController
                  targetBounds={selectedItemBounds}
                  allBounds={allBounds}
                  onZoomLevelChange={setCurrentZoom}
                />

                {polygonsWithBounds.map((poly) => {
                  const name = poly.name;
                  const item = poly.item;
                  const isSelected = selectedItem?.name === name;
                  const isHovered = hoveredName === name;

                  const rentVal = periode === 'mensuel' ? (item.loyer_m2_mensuel ?? null) : (item.prix_nuit_moyen ?? null);
                  const fillColor = getColorByRent(rentVal, periode === 'nuitee');

                  return (
                    <Polygon
                      key={name}
                      positions={poly.pts}
                      eventHandlers={{
                        click: () => {
                          handleSelectRow(item);
                        },
                        mouseover: () => setHoveredName(name),
                        mouseout: () => setHoveredName(null)
                      }}
                      pathOptions={{
                        fillColor,
                        fillOpacity: isSelected ? 0.75 : isHovered ? 0.65 : 0.45,
                        color: isSelected ? C.terraDark : isHovered ? C.terra : '#424242',
                        weight: isSelected ? 3 : isHovered ? 2 : 1,
                      }}
                    >
                      <Tooltip sticky>
                        <div style={{ padding: 4, fontFamily: "'Inter', sans-serif" }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: C.ink, marginBottom: 4 }}>
                            {name}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: C.inkSoft, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <div>Annonces : <strong>{fmtNum(item.nb)}</strong></div>
                            <div>Loyer / m² mensuel : <strong>{fmtM2(item.loyer_m2_mensuel)}</strong></div>
                            <div>Loyer moyen mensuel : <strong>{fmtMAD(item.loyer_mensuel_moyen)}</strong></div>
                            <div>Prix nuitée moyen : <strong>{fmtMAD(item.prix_nuit_moyen)}</strong></div>
                          </div>
                        </div>
                      </Tooltip>
                    </Polygon>
                  );
                })}
              </MapContainer>

              {/* Controls Overlay */}
              <CustomMapControls
                onZoomIn={() => mapRef.current?.zoomIn()}
                onZoomOut={() => mapRef.current?.zoomOut()}
                onResetZoom={() => setSelectedItem(null)}
                onToggleFullscreen={() => setIsExpandedMap(!isExpandedMap)}
                isFullscreen={isExpandedMap}
              />

              {/* Map Tile Switcher */}
              <div style={{
                position: 'absolute', top: 16, left: 16, zIndex: 1000,
                background: 'rgba(254,253,250,0.92)', backdropFilter: 'blur(8px)',
                border: `1px solid ${C.sand}`, borderRadius: 10, padding: 3,
                display: 'flex', gap: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.08)'
              }}>
                {(['voyager', 'positron', 'osm'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setMapTileStyle(st)}
                    style={{
                      padding: '0.35rem 0.65rem', fontSize: '0.72rem', fontWeight: 600,
                      borderRadius: 7, border: 'none', cursor: 'pointer',
                      background: mapTileStyle === st ? C.terra : 'transparent',
                      color: mapTileStyle === st ? '#FEFDFA' : C.inkSoft,
                      transition: 'all 0.15s', textTransform: 'capitalize'
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Legend Overlay */}
              <div style={{
                position: 'absolute', bottom: 16, left: 16, zIndex: 1000,
                background: 'rgba(254,253,250,0.94)', backdropFilter: 'blur(10px)',
                border: `1px solid ${C.sand}`, borderRadius: 12, padding: '0.75rem 1rem',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxWidth: 280
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.ink, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Échelle Choroplèthe · {periode === 'mensuel' ? 'Loyer Mensuel (MAD/m²)' : 'Nuitée (MAD/nuit)'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {currentTiers.map((t, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.73rem', color: C.inkSoft }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: t.color, border: `1px solid ${t.border}` }} />
                      <span>{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}