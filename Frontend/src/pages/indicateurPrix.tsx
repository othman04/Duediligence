import { useState, useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search,
  MapPin,
  Building2,
  TrendingUp,
  Filter,
  ArrowUpDown,
  BarChart3,
  Layers,
  Home,
  Maximize2,
  Plus,
  Minus,
  RotateCcw,
  Expand,
  X
} from 'lucide-react';
import rawData from '../data/indicateursPrixData.json';
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

// ─── Per-Commune Color Palette (distinct, vibrant colors) ──────────────────
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

// ─── Interfaces ─────────────────────────────────────────────────────────────
export interface CommuneData {
  commune_fr: string;
  nombre_biens: number;
  prix_moyen: number | null;
  prix_median: number | null;
  prix_m2_moyen: number | null;
  prix_min: number | null;
  prix_max: number | null;
  prix_par_type: Record<string, number | null>;
  prix_m2_par_type: Record<string, number | null>;
  lat: number;
  lng: number;
}

export interface QuartierData {
  commune_fr: string;
  localisation_quartier: string;
  nombre_biens: number;
  prix_moyen: number | null;
  prix_median: number | null;
  prix_m2_moyen: number | null;
  prix_min: number | null;
  prix_max: number | null;
  prix_par_type: Record<string, number | null>;
  lat: number;
  lng: number;
}

interface PolygonWithBounds {
  item: CommuneData | QuartierData;
  name: string;
  pts: ZonePolygon;
  bounds: L.LatLngBounds;
  isRealGeoJson: boolean;
}
type TabType = 'communes' | 'quartiers';
type ViewMode = 'globale' | 'prix_type' | 'prix_m2_type';

// ─── Formatters ──────────────────────────────────────────────────────────────
const fmtDH = (val: number | null | undefined) => {
  if (val === null || val === undefined || isNaN(val)) return '—';
  if (val >= 1_000_000) {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(val / 1_000_000) + ' M MAD';
  }
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(val) + ' MAD';
};

const fmtM2 = (val: number | null | undefined) => {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(val) + ' MAD/m²';
};

const fmtNum = (val: number | null | undefined) => {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return new Intl.NumberFormat('fr-FR').format(val);
};

// ─── Distinct Multi-Color Choropleth Scale based on Price/m² ──────────────────
export const PRICE_TIERS = [
  { max: 8000, label: '< 8 000 MAD/m²', color: '#2E7D32', border: '#1B5E20' },  // Emerald Green
  { max: 11000, label: '8k – 11k MAD/m²', color: '#00897B', border: '#004D40' },  // Teal / Cyan
  { max: 14000, label: '11k – 14k MAD/m²', color: '#1E88E5', border: '#0D47A1' }, // Royal Sapphire Blue
  { max: 18000, label: '14k – 18k MAD/m²', color: '#F57C00', border: '#E65100' }, // Amber Orange
  { max: Infinity, label: '> 18 000 MAD/m²', color: '#C62828', border: '#B71C1C' },// Crimson Red
];

function getColorByPriceM2(priceM2: number | null): string {
  if (!priceM2) return '#2E7D32';
  if (priceM2 < 8000) return '#2E7D32';   // < 8k: Emerald Green
  if (priceM2 < 11000) return '#00897B';  // 8k - 11k: Teal
  if (priceM2 < 14000) return '#1E88E5';  // 11k - 14k: Royal Blue
  if (priceM2 < 18000) return '#F57C00';  // 14k - 18k: Amber Orange
  return '#C62828';                       // > 18k: Crimson Red
}

function getBorderColorByPriceM2(priceM2: number | null): string {
  if (!priceM2) return '#1B5E20';
  if (priceM2 < 8000) return '#1B5E20';
  if (priceM2 < 11000) return '#004D40';
  if (priceM2 < 14000) return '#0D47A1';
  if (priceM2 < 18000) return '#E65100';
  return '#B71C1C';
}

// Price tier badge for tables
function PriceTierBadge({ val, isM2 = false }: { val: number | null; isM2?: boolean }) {
  if (!val) return <span style={{ color: 'rgba(0,0,0,0.25)', fontSize: '0.78rem' }}>—</span>;
  const color = isM2 ? getColorByPriceM2(val) : (val >= 2_000_000 ? C.terra : C.ink);
  return (
    <span style={{
      fontWeight: 700, color: color,
      fontSize: '0.82rem', letterSpacing: '-0.01em',
    }}>
      {isM2 ? fmtM2(val) : fmtDH(val)}
    </span>
  );
}

// ─── Map Controller Component (Zoom & Fit Bounds handling) ────────────────────
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

// ─── Custom Map Action Buttons (Requirement 11) ───────────────────────────────
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

// ─── Sortable Column Header ───────────────────────────────────────────────────
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
export default function IndicateurPrixPage() {
  const [activeTab, setActiveTab] = useState<TabType>('communes');
  const [viewMode, setViewMode] = useState<ViewMode>('globale');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCommuneFilter, setSelectedCommuneFilter] = useState<string>('TOUS');

  const [sortField, setSortField] = useState<string>('prix_m2_moyen');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  const [selectedItem, setSelectedItem] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(11);
  const [isExpandedMap, setIsExpandedMap] = useState<boolean>(false);
  const [mapTileStyle, setMapTileStyle] = useState<'voyager' | 'positron' | 'osm'>('voyager');
  // Quartier map: commune chip filter
  const [mapCommuneFilter, setMapCommuneFilter] = useState<string>('TOUS');

  const mapRef = useRef<L.Map | null>(null);

  const communes = useMemo(() => {
    return (rawData.communes as CommuneData[]).filter(c => (c.nombre_biens || 0) >= 20);
  }, []);

  const quartiers = rawData.quartiers as QuartierData[];
  const propertyTypes = rawData.property_types as string[];

  const communeNames = useMemo(() => {
    const list = Array.from(new Set(quartiers.map(q => q.commune_fr))).sort();
    return ['TOUS', ...list];
  }, [quartiers]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchTerm('');
    setSortField('prix_m2_moyen');
    setSelectedItem(null);
  };

  const filteredData = useMemo(() => {
    if (activeTab === 'communes') {
      return communes.filter(c =>
        c.commune_fr.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else {
      return quartiers.filter(q => {
        const matchesSearch =
          q.localisation_quartier.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.commune_fr.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCommune = selectedCommuneFilter === 'TOUS' || q.commune_fr === selectedCommuneFilter;
        return matchesSearch && matchesCommune;
      });
    }
  }, [activeTab, communes, quartiers, searchTerm, selectedCommuneFilter]);

  const sortedData = useMemo(() => {
    const copy = [...filteredData];
    copy.sort((a: any, b: any) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField.startsWith('type_')) {
        const tName = sortField.replace('type_', '');
        if (viewMode === 'prix_m2_type' && activeTab === 'communes') {
          valA = a.prix_m2_par_type?.[tName] ?? 0;
          valB = b.prix_m2_par_type?.[tName] ?? 0;
        } else {
          valA = a.prix_par_type?.[tName] ?? 0;
          valB = b.prix_par_type?.[tName] ?? 0;
        }
      }

      if (valA === null || valA === undefined) valA = sortAsc ? Infinity : -Infinity;
      if (valB === null || valB === undefined) valB = sortAsc ? Infinity : -Infinity;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
    return copy;
  }, [filteredData, sortField, sortAsc, viewMode, activeTab]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const summaryMetrics = useMemo(() => {
    const totalBiens = sortedData.reduce((acc, curr: any) => acc + (curr.nombre_biens || 0), 0);
    const validPrix = sortedData.filter((d: any) => d.prix_moyen);
    const avgPrix = validPrix.length
      ? Math.round(validPrix.reduce((acc, curr: any) => acc + curr.prix_moyen, 0) / validPrix.length)
      : 0;
    const validM2 = sortedData.filter((d: any) => d.prix_m2_moyen);
    const avgM2 = validM2.length
      ? Math.round(validM2.reduce((acc, curr: any) => acc + curr.prix_m2_moyen, 0) / validM2.length)
      : 0;
    const maxM2 = validM2.length ? Math.max(...validM2.map((d: any) => d.prix_m2_moyen)) : 0;

    return { totalBiens, avgPrix, avgM2, maxM2, count: sortedData.length };
  }, [sortedData]);

  // Compute all polygon bounds for auto-fit zoom (STRICTLY ALL GeoJSON features)
  const { polygonsWithBounds, allBounds } = useMemo(() => {
    const isCommune = activeTab === 'communes';
    const allPts: [number, number][] = [];

    if (isCommune) {
      const items: PolygonWithBounds[] = [];

      for (const feat of ALL_COMMUNE_GEOJSON_FEATURES) {
        const cName = feat.name;
        const cNameClean = cName.toLowerCase().trim();

        const matched = (sortedData as CommuneData[]).filter(c => {
          const nameInDb = c.commune_fr.toLowerCase().trim();
          return nameInDb === cNameClean || nameInDb.includes(cNameClean) || cNameClean.includes(nameInDb);
        });

        // ← Skip communes with no real price data in the dataset
        if (matched.length === 0) continue;

        feat.pts.forEach(p => allPts.push(p));

        const avgM2 = Math.round(matched.reduce((acc, curr) => acc + (curr.prix_m2_moyen || 0), 0) / matched.length);
        const avgPrix = Math.round(matched.reduce((acc, curr) => acc + (curr.prix_moyen || 0), 0) / matched.length);
        const avgMed = Math.round(matched.reduce((acc, curr) => acc + (curr.prix_median || curr.prix_moyen || 0), 0) / matched.length);
        const totalBiens = matched.reduce((acc, curr) => acc + (curr.nombre_biens || 0), 0);

        const itemData: CommuneData = {
          commune_fr: cName,
          prix_m2_moyen: avgM2,
          prix_moyen: avgPrix,
          prix_median: avgMed,
          nombre_biens: totalBiens,
          prix_min: matched[0].prix_min,
          prix_max: matched[0].prix_max,
          prix_par_type: matched[0].prix_par_type || {},
          prix_m2_par_type: matched[0].prix_m2_par_type || {},
          lat: feat.centroid_lat || feat.pts[0][0],
          lng: feat.centroid_lon || feat.pts[0][1]
        };

        const bounds = L.latLngBounds(feat.pts);
        items.push({ item: itemData, name: cName, pts: feat.pts, bounds, isRealGeoJson: true });
      }

      const bounds = allPts.length ? L.latLngBounds(allPts) : null;
      return { polygonsWithBounds: items, allBounds: bounds };
    }

    // Quartiers Tab: Render GeoJSON features from quartiers_marrakech.geojson AND dataset items
    const items: PolygonWithBounds[] = [];
    const processedNames = new Set<string>();

    // 1. Process features from ALL_QUARTIER_GEOJSON_FEATURES
    for (const feat of ALL_QUARTIER_GEOJSON_FEATURES) {
      const gName = feat.name;
      const gNameNorm = gName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const cleanParentheses = gName.split('(')[0].trim().toLowerCase();
      const slashParts = gName.split('/').map(p => p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase());

      const matched = (sortedData as QuartierData[]).filter(q => {
        const qName = q.localisation_quartier.trim().toLowerCase();
        const qNameNorm = q.localisation_quartier.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
        return qNameNorm === gNameNorm || qName === cleanParentheses || slashParts.includes(qNameNorm) || qNameNorm.includes(gNameNorm) || gNameNorm.includes(qNameNorm);
      });

      if (matched.length === 0) continue; // Skip features with no data

      feat.pts.forEach(p => allPts.push(p));

      const avgM2 = Math.round(matched.reduce((acc, curr) => acc + (curr.prix_m2_moyen || 0), 0) / matched.length);
      const avgPrix = Math.round(matched.reduce((acc, curr) => acc + (curr.prix_moyen || 0), 0) / matched.length);
      const avgMed = Math.round(matched.reduce((acc, curr) => acc + (curr.prix_median || curr.prix_moyen || 0), 0) / matched.length);
      const totalBiens = matched.reduce((acc, curr) => acc + (curr.nombre_biens || 0), 0);

      const itemData: QuartierData = {
        localisation_quartier: gName,
        commune_fr: matched[0].commune_fr || 'Marrakech',
        prix_m2_moyen: avgM2,
        prix_moyen: avgPrix,
        prix_median: avgMed,
        nombre_biens: totalBiens,
        prix_min: matched[0].prix_min,
        prix_max: matched[0].prix_max,
        prix_par_type: matched[0].prix_par_type || {},
        lat: feat.centroid_lat || feat.pts[0][0],
        lng: feat.centroid_lon || feat.pts[0][1]
      };

      matched.forEach(m => processedNames.add(m.localisation_quartier.toLowerCase().trim()));
      const bounds = L.latLngBounds(feat.pts);
      items.push({ item: itemData, name: gName, pts: feat.pts, bounds, isRealGeoJson: true });
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
    const name = activeTab === 'communes' ? item.commune_fr : item.localisation_quartier;
    setSelectedItem({ lat: item.lat, lng: item.lng, name });
  };



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
                  Indicateurs & Cartographie des Prix
                </h1>
                
                <p style={{
                  fontSize: '0.92rem', color: 'rgba(254,253,250,0.85)', margin: '0.6rem 0 0',
                  maxWidth: 680, fontWeight: 300, lineHeight: 1.6
                }}>
                  Analyse choroplèthe par polygones géographiques réels. Visualisez et comparez le niveau de prix au m² pour chaque secteur.
                </p>
              </div>
            </div>

            {/* KPI Cards Banner */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem', marginTop: '2rem'
            }}>
              {[
                {
                  label: activeTab === 'communes' ? 'Communes Référencées' : 'Quartiers Référencés',
                  value: fmtNum(summaryMetrics.count),
                  icon: <Building2 size={16} />
                },
                {
                  label: 'Volume de Biens Analysés',
                  value: fmtNum(summaryMetrics.totalBiens),
                  icon: <Home size={16} />
                },
                {
                  label: 'Prix Moyen Global',
                  value: fmtDH(summaryMetrics.avgPrix),
                  icon: <TrendingUp size={16} />
                },
                {
                  label: 'Prix / m² Moyen Global',
                  value: fmtM2(summaryMetrics.avgM2),
                  icon: <Layers size={16} />
                },
                {
                  label: 'Prix / m² Maximal',
                  value: fmtM2(summaryMetrics.maxM2),
                  icon: <Maximize2 size={16} />
                },
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Vue :
                  </span>
                  <select
                    value={viewMode}
                    onChange={e => { setViewMode(e.target.value as ViewMode); setCurrentPage(1); }}
                    style={{
                      padding: '0.5rem 0.9rem', fontSize: '0.82rem', fontWeight: 500, borderRadius: 8,
                      border: `1px solid ${C.sand}`, background: C.paper, color: C.ink,
                      cursor: 'pointer', outline: 'none', boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                    }}
                  >
                    <option value="globale">Statistiques Globales</option>
                    <option value="prix_type">Prix Moyen par Type (MAD)</option>
                    {activeTab === 'communes' && <option value="prix_m2_type">Prix m² par Type (MAD/m²)</option>}
                  </select>
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
                              : C.mist,
                            color: active ? '#fff' : C.inkSoft,
                            cursor: 'pointer', transition: 'all 0.15s',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            boxShadow: active ? `0 2px 8px ${col?.light || 'rgba(0,0,0,0.15)'}` : 'none'
                          }}
                        >
                          {!isAll && (
                            <span style={{
                              width: 7, height: 7, borderRadius: '50%',
                              background: active ? 'rgba(255,255,255,0.9)' : col?.fill,
                              display: 'inline-block', flexShrink: 0
                            }} />
                          )}
                          {isAll ? 'Toutes' : name}
                        </button>
                      );
                    })}
                  </div>
                )}

                <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: C.inkSoft }}>
                  Affichage <strong>{paginatedData.length}</strong> / <strong>{sortedData.length}</strong>
                </span>
              </div>
            </div>

            {/* Data Table */}
            <div style={{
              background: C.paper, border: `1px solid ${C.sand}`, borderRadius: 16,
              overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
            }}>
              <div style={{ overflowX: 'auto', maxHeight: '620px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr style={{ background: C.mist }}>
                      <SortTh
                        label="Commune" field="commune_fr"
                        sortField={sortField} sortAsc={sortAsc} onSort={handleSort}
                        align="left"
                        style={{ width: activeTab === 'communes' ? '32%' : '24%', fontWeight: 700 }}
                      />

                      {activeTab === 'quartiers' && (
                        <SortTh
                          label="Quartier" field="localisation_quartier"
                          sortField={sortField} sortAsc={sortAsc} onSort={handleSort}
                          align="left" style={{ width: '30%' }}
                        />
                      )}

                      {viewMode === 'globale' && (
                        <>
                          <SortTh label="Prix Moyen" field="prix_moyen" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
                          <SortTh label="Prix Médian" field="prix_median" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
                          <SortTh label="Prix / m²" field="prix_m2_moyen" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
                        </>
                      )}

                      {(viewMode === 'prix_type' || viewMode === 'prix_m2_type') && (
                        propertyTypes.map(t => (
                          <SortTh
                            key={t} label={t} field={`type_${t}`}
                            sortField={sortField} sortAsc={sortAsc} onSort={handleSort}
                          />
                        ))
                      )}

                      <th style={{ padding: '0.85rem 0.9rem', textAlign: 'center', width: 50, fontSize: '0.73rem', color: C.inkSoft, borderBottom: `2px solid ${C.sand}` }}>
                        Carte
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan={12} style={{ padding: '4rem', textAlign: 'center', color: C.inkSoft }}>
                          <MapPin size={36} style={{ color: C.sand, display: 'block', margin: '0 auto 0.85rem' }} />
                          Aucun secteur ne correspond à vos critères de recherche.
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((item: any, idx: number) => {
                        const name = activeTab === 'communes' ? item.commune_fr : item.localisation_quartier;
                        const isSelected = selectedItem?.name === name;
                        const rowBg = isSelected
                          ? 'linear-gradient(90deg, rgba(154,66,29,0.09) 0%, rgba(154,66,29,0.03) 100%)'
                          : idx % 2 === 0 ? C.paper : '#FAF7F2';

                        return (
                          <tr
                            key={idx}
                            onClick={() => handleSelectRow(item)}
                            style={{
                              borderBottom: `1px solid ${C.sandLight}`,
                              cursor: 'pointer',
                              background: rowBg,
                              transition: 'background 0.12s',
                              borderLeft: isSelected ? `4px solid ${C.terra}` : '4px solid transparent'
                            }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.mist; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = idx % 2 === 0 ? C.paper : '#FAF7F2'; }}
                          >
                            <td style={{ padding: '0.85rem 0.95rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                  width: 10, height: 10, borderRadius: 3, flexShrink: 0,
                                  background: getColorByPriceM2(item.prix_m2_moyen),
                                  border: `1px solid ${getBorderColorByPriceM2(item.prix_m2_moyen)}`
                                }} />
                                <span style={{ fontWeight: 600, color: C.ink, fontSize: '0.85rem' }}>{item.commune_fr}</span>
                              </div>
                            </td>

                            {activeTab === 'quartiers' && (
                              <td style={{ padding: '0.85rem 0.95rem', color: C.inkSoft, fontWeight: 500 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <MapPin size={12} style={{ color: C.terra, flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.83rem' }}>{(item as QuartierData).localisation_quartier}</span>
                                </div>
                              </td>
                            )}

                            {viewMode === 'globale' && (
                              <>
                                <td style={{ padding: '0.85rem 0.95rem', textAlign: 'right' }}>
                                  <PriceTierBadge val={item.prix_moyen} />
                                </td>
                                <td style={{ padding: '0.85rem 0.95rem', textAlign: 'right', color: C.inkSoft, fontSize: '0.82rem' }}>
                                  {item.prix_median ? fmtDH(item.prix_median) : '—'}
                                </td>
                                <td style={{ padding: '0.85rem 0.95rem', textAlign: 'right' }}>
                                  <PriceTierBadge val={item.prix_m2_moyen} isM2 />
                                </td>
                              </>
                            )}

                            {viewMode === 'prix_type' && (
                              propertyTypes.map(t => (
                                <td key={t} style={{ padding: '0.85rem 0.7rem', textAlign: 'right' }}>
                                  <PriceTierBadge val={item.prix_par_type?.[t]} />
                                </td>
                              ))
                            )}

                            {viewMode === 'prix_m2_type' && (
                              propertyTypes.map(t => (
                                <td key={t} style={{ padding: '0.85rem 0.7rem', textAlign: 'right' }}>
                                  <PriceTierBadge val={item.prix_m2_par_type?.[t]} isM2 />
                                </td>
                              ))
                            )}

                            <td style={{ padding: '0.85rem 0.8rem', textAlign: 'center' }}>
                              <button
                                onClick={e => { e.stopPropagation(); handleSelectRow(item); }}
                                title="Localiser la zone sur la carte"
                                style={{
                                  background: isSelected ? C.terra : C.mist,
                                  color: isSelected ? C.paper : C.terra,
                                  border: `1px solid ${isSelected ? C.terra : C.sand}`,
                                  borderRadius: 8, width: 30, height: 30,
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', transition: 'all 0.15s'
                                }}
                              >
                                <MapPin size={13} />
                              </button>
                            </td>
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
                padding: '0.85rem 1.35rem', background: C.mist, borderTop: `1px solid ${C.sand}`,
                fontSize: '0.8rem', gap: '0.6rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: C.inkSoft }}>
                  <span>Lignes par page :</span>
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    style={{ padding: '0.25rem 0.55rem', borderRadius: 6, border: `1px solid ${C.sand}`, background: C.paper, color: C.ink }}
                  >
                    {[10, 15, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                  <span style={{ color: C.inkSoft }}>
                    Page <strong style={{ color: C.ink }}>{currentPage}</strong> sur <strong style={{ color: C.ink }}>{totalPages}</strong>
                  </span>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {[
                      { label: '←', disabled: currentPage === 1, fn: () => setCurrentPage(p => Math.max(1, p - 1)) },
                      { label: '→', disabled: currentPage === totalPages, fn: () => setCurrentPage(p => Math.min(totalPages, p + 1)) }
                    ].map(btn => (
                      <button
                        key={btn.label}
                        disabled={btn.disabled}
                        onClick={btn.fn}
                        style={{
                          padding: '0.35rem 0.7rem', border: `1px solid ${C.sand}`, borderRadius: 6,
                          background: btn.disabled ? C.mist : C.paper,
                          color: btn.disabled ? C.sand : C.ink,
                          cursor: btn.disabled ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600
                        }}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Synchronized Price Tier Legend Card */}
            <div style={{
              background: C.paper, border: `1px solid ${C.sand}`, borderRadius: 14,
              padding: '0.9rem 1.2rem', display: 'flex', flexWrap: 'wrap', gap: '0.85rem', alignItems: 'center'
            }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Échelle des Prix / m² :
              </span>
              {PRICE_TIERS.map(tier => (
                <span key={tier.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', color: C.ink, fontWeight: 500 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: tier.color, display: 'inline-block', border: `1px solid ${tier.border}` }} />
                  {tier.label}
                </span>
              ))}
            </div>

          </div>

          {/* ─── RIGHT PANEL: MAP ─── */}
          <div style={{ flex: '1 1 50%', minWidth: 350, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              position: 'sticky', top: '1.25rem',
              background: C.paper, border: `1px solid ${C.sand}`, borderRadius: 18, overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column',
              height: isExpandedMap ? '92vh' : '820px', transition: 'height 0.3s ease'
            }}>
              {/* Map Header Bar */}
              <div style={{
                padding: '0.85rem 1.25rem',
                background: 'linear-gradient(135deg, #7A3216 0%, #9A421D 100%)',
                color: C.paper, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={17} style={{ color: '#FCE7D7' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                    {activeTab === 'communes' ? 'Polygones des Communes' : 'Polygones des Quartiers'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {/* Map Style Selector */}
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 2 }}>
                    {[
                      { id: 'voyager', label: 'Plan Clair' },
                      { id: 'positron', label: 'Minimal' },
                      { id: 'osm', label: 'OSM Plan' }
                    ].map(st => (
                      <button
                        key={st.id}
                        onClick={() => setMapTileStyle(st.id as any)}
                        style={{
                          background: mapTileStyle === st.id ? '#FEFDFA' : 'transparent',
                          color: mapTileStyle === st.id ? C.terraDark : 'rgba(254,253,250,0.85)',
                          border: 'none', borderRadius: 6, padding: '0.2rem 0.55rem',
                          fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
                        }}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  {selectedItem && (
                    <span style={{
                      fontSize: '0.74rem', background: 'rgba(254,253,250,0.22)',
                      border: '1px solid rgba(254,253,250,0.4)',
                      padding: '0.2rem 0.65rem', borderRadius: 20, color: '#FEFDFA', fontWeight: 600
                    }}>
                      ◉ {selectedItem.name}
                    </span>
                  )}
                </div>
              </div>

              {/* ── Quartiers: Commune chip filter bar inside the map ── */}
              {activeTab === 'quartiers' && (
                <div style={{
                  padding: '0.6rem 1.1rem', background: C.mist,
                  borderBottom: `1px solid ${C.sandLight}`,
                  display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap'
                }}>
                  <Layers size={12} style={{ color: C.terra, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 2 }}>Commune :</span>
                  {['TOUS', ...Object.keys(COMMUNE_COLORS)].map(name => {
                    // Only show communes that actually exist in the data
                    if (name !== 'TOUS' && !quartiers.some(q => q.commune_fr === name)) return null;
                    const active = mapCommuneFilter === name;
                    const col = name !== 'TOUS' ? getCommuneColor(name) : null;
                    return (
                      <button
                        key={name}
                        onClick={() => setMapCommuneFilter(name)}
                        style={{
                          padding: '0.22rem 0.6rem', fontSize: '0.72rem', fontWeight: active ? 700 : 500,
                          borderRadius: 20,
                          border: active ? `1.5px solid ${col?.stroke || C.terraDark}` : `1px solid ${C.sand}`,
                          background: active ? (col?.fill || C.terra) : C.paper,
                          color: active ? '#fff' : C.inkSoft,
                          cursor: 'pointer', transition: 'all 0.14s',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          boxShadow: active ? `0 1px 6px ${col?.light || 'rgba(0,0,0,0.15)'}` : 'none'
                        }}
                      >
                        {col && <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? 'rgba(255,255,255,0.85)' : col.fill, display: 'inline-block' }} />}
                        {name === 'TOUS' ? 'Toutes' : name}
                      </button>
                    );
                  })}
                  {mapCommuneFilter !== 'TOUS' && (
                    <button
                      onClick={() => setMapCommuneFilter('TOUS')}
                      style={{
                        marginLeft: 2, padding: '0.22rem 0.5rem', fontSize: '0.7rem',
                        borderRadius: 20, border: `1px solid ${C.sand}`,
                        background: 'transparent', color: C.terra, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 3
                      }}
                    >
                      <X size={10} /> Effacer
                    </button>
                  )}
                </div>
              )}

              {/* Map Container Area */}
              <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
                <MapContainer
                  ref={mapRef}
                  center={[31.6295, -7.9811]}
                  zoom={11}
                  zoomControl={false}
                  style={{ width: '100%', height: '100%' }}
                >
                  <MapController
                    targetBounds={selectedItemBounds}
                    allBounds={allBounds}
                    onZoomLevelChange={setCurrentZoom}
                  />

                  {/* Clean, Bright Map Plan Tile Layer */}
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url={
                      mapTileStyle === 'voyager'
                        ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        : mapTileStyle === 'osm'
                        ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    }
                  />

                  {/* ── COMMUNES TAB: Choropleth Polygons ── */}
                  {activeTab === 'communes' && polygonsWithBounds.map(({ item, name, pts }, idx) => {
                    const isSelected = selectedItem?.name === name;
                    const isHovered = hoveredName === name;
                    const hasActiveFocus = hoveredName !== null || selectedItem !== null;
                    const hasRealData = item.nombre_biens > 45;
                    const color = getColorByPriceM2(item.prix_m2_moyen);
                    const baseBorder = getBorderColorByPriceM2(item.prix_m2_moyen);
                    const strokeColor = isSelected ? '#7A3216' : (isHovered ? '#1A1714' : baseBorder);
                    const fillOpacity = isSelected ? 0.72 : (isHovered ? 0.62 : (hasActiveFocus ? 0.25 : (hasRealData ? 0.44 : 0.18)));
                    const weight = isSelected ? 3.5 : (isHovered ? 2.8 : (hasRealData ? 1.8 : 1.2));
                    const strokeOpacity = isSelected ? 1.0 : (isHovered ? 1.0 : (hasRealData ? 0.88 : 0.55));
                    const showLabel = isSelected || isHovered || (currentZoom >= 12 && hasRealData);
                    return (
                      <Polygon
                        key={`${name}-commune-${idx}`}
                        positions={pts}
                        pathOptions={{
                          color: strokeColor, fillColor: color, fillOpacity,
                          weight, opacity: strokeOpacity, lineCap: 'round', lineJoin: 'round'
                        }}
                        eventHandlers={{
                          mouseover: () => setHoveredName(name),
                          mouseout: () => setHoveredName(null),
                          click: () => setSelectedItem({ lat: item.lat, lng: item.lng, name })
                        }}
                      >
                        <Tooltip sticky direction="top" opacity={0.97}>
                          <div style={{ fontFamily: "'Inter', sans-serif", width: 230, padding: '4px 2px' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: C.ink, marginBottom: 4 }}>{name}</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: C.terra, background: 'rgba(154,66,29,0.08)', padding: '0.25rem 0.55rem', borderRadius: 6, display: 'inline-block', marginBottom: 6 }}>
                              {fmtM2(item.prix_m2_moyen)}
                            </div>
                            <div style={{ borderTop: `1px solid ${C.sandLight}`, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {[['Prix moyen', fmtDH(item.prix_moyen)], ['Prix médian', fmtDH(item.prix_median)], ['Biens analysés', fmtNum(item.nombre_biens)]].map(([k,v]) => (
                                <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                                  <span style={{ color: C.inkSoft }}>{k} :</span>
                                  <strong style={{ color: C.ink }}>{v}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        </Tooltip>
                        {showLabel && (
                          <Tooltip permanent direction="center" className="smart-polygon-label">
                            <div style={{
                              textAlign: 'center', pointerEvents: 'none',
                              background: isSelected ? C.terra : 'rgba(254,253,250,0.96)',
                              color: isSelected ? '#FEFDFA' : C.ink,
                              padding: isSelected ? '4px 10px' : '3px 7px',
                              borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.16)',
                              border: `1px solid ${isSelected ? C.terraDark : C.sand}`
                            }}>
                              <div style={{ fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{name}</div>
                              <div style={{ fontWeight: 800, fontSize: '0.68rem', color: isSelected ? '#FCE7D7' : C.terra }}>
                                {fmtM2(item.prix_m2_moyen)}
                              </div>
                            </div>
                          </Tooltip>
                        )}
                      </Polygon>
                    );
                  })}

                  {/* ── QUARTIERS TAB: Vector Polygon Boundaries ── */}
                  {activeTab === 'quartiers' && polygonsWithBounds
                    .filter(({ item }) => mapCommuneFilter === 'TOUS' || (item as QuartierData).commune_fr === mapCommuneFilter)
                    .map(({ item, name, pts }, idx) => {
                      const qItem = item as QuartierData;
                      const isSelected = selectedItem?.name === name;
                      const isHovered = hoveredName === name;
                      const hasActiveFocus = hoveredName !== null || selectedItem !== null;
                      const col = getCommuneColor(qItem.commune_fr);
                      const color = col.fill;
                      const baseBorder = col.stroke;
                      const strokeColor = isSelected ? '#1A1714' : (isHovered ? '#3A2E28' : baseBorder);
                      
                      const fillOpacity = isSelected ? 0.75 : (isHovered ? 0.65 : (hasActiveFocus ? 0.28 : 0.48));
                      const weight = isSelected ? 3.5 : (isHovered ? 2.8 : 1.8);
                      const strokeOpacity = isSelected ? 1.0 : (isHovered ? 1.0 : 0.88);
                      const showLabel = isSelected || isHovered || currentZoom >= 12;

                      return (
                        <Polygon
                          key={`${name}-quartier-poly-${idx}`}
                          positions={pts}
                          pathOptions={{
                            color: strokeColor,
                            fillColor: color,
                            fillOpacity,
                            weight,
                            opacity: strokeOpacity,
                            lineCap: 'round',
                            lineJoin: 'round'
                          }}
                          eventHandlers={{
                            mouseover: () => setHoveredName(name),
                            mouseout: () => setHoveredName(null),
                            click: () => setSelectedItem({ lat: qItem.lat, lng: qItem.lng, name })
                          }}
                        >
                          <Tooltip sticky direction="top" opacity={0.97}>
                            <div style={{ fontFamily: "'Inter', sans-serif", width: 235, padding: '4px 2px' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: C.ink, marginBottom: 2 }}>{name}</div>
                              <div style={{ fontSize: '0.72rem', color: C.inkSoft, marginBottom: 6 }}>Commune : {qItem.commune_fr}</div>
                              <div style={{
                                fontSize: '1.08rem', fontWeight: 800, color: C.terra,
                                background: 'rgba(154,66,29,0.08)', padding: '0.25rem 0.55rem',
                                borderRadius: 6, display: 'inline-block', marginBottom: 6
                              }}>
                                {fmtM2(qItem.prix_m2_moyen)}
                              </div>
                              <div style={{ borderTop: `1px solid ${C.sandLight}`, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {[
                                  ['Prix moyen', fmtDH(qItem.prix_moyen)],
                                  ['Prix médian', fmtDH(qItem.prix_median)],
                                  ['Biens analysés', fmtNum(qItem.nombre_biens)]
                                ].map(([k, v]) => (
                                  <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                                    <span style={{ color: C.inkSoft }}>{k} :</span>
                                    <strong style={{ color: C.ink }}>{v}</strong>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </Tooltip>

                          {showLabel && (
                            <Tooltip permanent direction="center" className="smart-polygon-label">
                              <div style={{
                                textAlign: 'center', pointerEvents: 'none',
                                background: isSelected ? C.terra : 'rgba(254,253,250,0.96)',
                                color: isSelected ? '#FEFDFA' : C.ink,
                                padding: isSelected ? '4px 10px' : '3px 7px',
                                borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.16)',
                                border: `1px solid ${isSelected ? C.terraDark : C.sand}`
                              }}>
                                <div style={{ fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{name}</div>
                                <div style={{ fontWeight: 800, fontSize: '0.68rem', color: isSelected ? '#FCE7D7' : C.terra }}>
                                  {fmtM2(qItem.prix_m2_moyen)}
                                </div>
                              </div>
                            </Tooltip>
                          )}
                        </Polygon>
                      );
                    })}
                </MapContainer>

                {/* Requirement 11: Discreet Map Controls */}
                <CustomMapControls
                  onZoomIn={() => mapRef.current?.zoomIn()}
                  onZoomOut={() => mapRef.current?.zoomOut()}
                  onResetZoom={() => {
                    setSelectedItem(null);
                    if (allBounds) mapRef.current?.fitBounds(allBounds, { padding: [30, 30] });
                  }}
                  onToggleFullscreen={() => setIsExpandedMap(!isExpandedMap)}
                  isFullscreen={isExpandedMap}
                />

                {/* ── Bottom Legend ── */}
                {activeTab === 'communes' && (
                  <div style={{
                    position: 'absolute', bottom: 18, left: 18, zIndex: 1000,
                    background: 'rgba(254,253,250,0.94)', backdropFilter: 'blur(8px)',
                    border: `1px solid ${C.sand}`, borderRadius: 12, padding: '0.75rem 1.1rem',
                    boxShadow: '0 4px 18px rgba(0,0,0,0.1)', maxWidth: 380
                  }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.ink, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                      Prix moyen / m²
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.72rem', color: C.inkSoft, fontWeight: 600 }}>&lt; 8k</span>
                      <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', flex: 1, minWidth: 160, border: `1px solid ${C.sand}` }}>
                        {['#2E7D32','#00897B','#1E88E5','#F57C00','#C62828'].map(c => <div key={c} style={{ flex: 1, background: c }} />)}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: C.inkSoft, fontWeight: 600 }}>&gt; 18k MAD/m²</span>
                    </div>
                  </div>
                )}

                {activeTab === 'quartiers' && (
                  <div style={{
                    position: 'absolute', bottom: 18, left: 18, zIndex: 1000,
                    background: 'rgba(254,253,250,0.94)', backdropFilter: 'blur(8px)',
                    border: `1px solid ${C.sand}`, borderRadius: 12, padding: '0.65rem 0.95rem',
                    boxShadow: '0 4px 18px rgba(0,0,0,0.1)', maxWidth: 260
                  }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.ink, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                      Code Couleur (Communes)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {Object.entries(COMMUNE_COLORS)
                        .filter(([name]) => quartiers.some(q => q.commune_fr === name))
                        .map(([name, col]) => (
                          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: col.fill, border: `1.5px solid ${col.stroke}`, display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.72rem', color: C.ink, fontWeight: mapCommuneFilter === name ? 700 : 400 }}>{name}</span>
                          </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Map Footer Note */}
              <div style={{
                padding: '0.7rem 1.2rem', background: C.mist, borderTop: `1px solid ${C.sand}`,
                fontSize: '0.75rem', color: C.inkSoft, textAlign: 'center'
              }}>
                Survolez ou cliquez sur une zone polygonale pour consulter ses indicateurs de prix au m².
              </div>
            </div>
          </div>

        </div>
      </div>
  );
}
