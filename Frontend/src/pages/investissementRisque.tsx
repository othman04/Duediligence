import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, MapPin, TrendingUp, ShieldCheck, Check, AlertCircle, Loader2, MapPinned, BarChart3, Shield, Info, Wallet, Home, Percent, ArrowLeft, RotateCcw, FileText } from 'lucide-react';
import { useInvestmentStore } from '../store/InvestmentStore';
import { MainLayout } from '../components/MainLayout';
import { useHistoryStore } from '../store/historyStore';
import { useAuthStore } from '../store/authStore';
import { MapContainer, Marker, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchCommuneCenter, fetchQuartierCenter, resolveLocation } from '../lib/locationApi';
import { getCommuneNames, getQuartiersOf, findCommune, findQuartier } from '../data/zonesRegion';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList
} from 'recharts';
import prixData from '../data/indicateursPrixData.json';

// Même épingle que l'étape « Localisation » de l'estimation (classe .est-pin
// déjà stylée globalement dans App.css → rendu identique).
const markerIcon = L.divIcon({
  className: '',
  html: `<div class="est-pin"><div class="est-pin-body"><span class="est-pin-center"></span></div><span class="est-pin-ring"></span></div>`,
  iconSize: [28, 36],
  iconAnchor: [14, 34],
});

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
    if (!hasCoordinates) return;
    try { map.flyTo([lat, lng], zoom ?? map.getZoom(), { duration: 0.8 }); } catch { /* noop */ }
  }, [lat, lng, zoom, map]);
  return null;
}

type FormState = {
  address: string; city: string; quartier: string; parcel: string; type: string; price: string;
  rent: string; surface: string; latitude: string; longitude: string;
};

const emptyForm: FormState = { address: '', city: '', quartier: '', parcel: '', type: 'Appartement', price: '', rent: '', surface: '', latitude: '', longitude: '' };
const numberValue = (value: string) => Number(value.replace(/\s+/g, '').replace(',', '.')) || 0;

const C = {
  ink: '#1A1410', inkSoft: '#3C3028', inkMuted: '#68594D',
  paper: '#FFFFFF', sand: '#F5F2EB', sandLight: '#FAF9F5',
  mist: '#F0EFEB',
  terra: '#9A421D', terraLight: '#E8D4CC', terraMuted: '#F4EBE6',
};

function formatPrice(val: number) {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: '10px',
  border: '1px solid #e0dfdb', backgroundColor: '#fff',
  fontSize: '0.95rem',
};

export default function InvestissementRisquePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const { analyzeInvestment, result, isLoading, error, resetAnalysis } = useInvestmentStore();

  const addEntry    = useHistoryStore((s) => s.addEntry);
  const currentUser = useAuthStore((s) => s.user);
  const hasRecordedRef = useRef(false);

  const update = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  // ── Zones STATIQUES région Marrakech-Safi (fichier front-end, même source
  // que l'estimation Location) — enrichies si le clic carte désigne une zone
  // non présente dans le fichier. ─────────────────────────────────────────────
  const [extraCommunes, setExtraCommunes] = useState<string[]>([]);
  const [extraQuartiers, setExtraQuartiers] = useState<Record<string, string[]>>({});

  const villesDisponibles = useMemo(
    () => Array.from(new Set([...getCommuneNames(), ...extraCommunes])),
    [extraCommunes]
  );
  const quartiersDeVille = useMemo(() => {
    if (!form.city) return [];
    return Array.from(
      new Set([
        ...getQuartiersOf(form.city).map((q) => q.name),
        ...(extraQuartiers[form.city] ?? []),
      ])
    );
  }, [form.city, extraQuartiers]);

  // Ville choisie → zoom immédiat sur son centre (fichier statique),
  // puis affinage avec la médiane des annonces quand disponible.
  const handleVilleChange = async (ville: string) => {
    update('city', ville);
    update('quartier', '');
    const staticCenter = findCommune(ville);
    if (staticCenter) {
      update('latitude', staticCenter.lat.toFixed(6));
      update('longitude', staticCenter.lng.toFixed(6));
    }
    try {
      const c = await fetchCommuneCenter(ville);
      if (c.lat != null && c.lng != null) {
        update('latitude', c.lat.toFixed(6));
        update('longitude', c.lng.toFixed(6));
      }
    } catch { /* on garde la saisie existante */ }
  };

  // Quartier choisi → centre RÉEL : médiane des annonces de CE quartier
  // (même logique que l'estimation Location, corrige le décalage type M'Hamid),
  // sinon coordonnées du fichier statique, sinon centre de la commune.
  const handleQuartierChange = async (quartier: string) => {
    update('quartier', quartier);
    if (!form.city) return;
    try {
      const c = await fetchQuartierCenter(form.city, quartier);
      if (c.lat != null && c.lng != null) {
        update('latitude', c.lat.toFixed(6));
        update('longitude', c.lng.toFixed(6));
        return;
      }
    } catch { /* fallbacks */ }
    const q = findQuartier(form.city, quartier);
    const cmn = findCommune(form.city);
    if (q && q.lat != null && q.lng != null) {
      update('latitude', q.lat.toFixed(6));
      update('longitude', q.lng.toFixed(6));
    } else if (cmn) {
      update('latitude', cmn.lat.toFixed(6));
      update('longitude', cmn.lng.toFixed(6));
    }
  };

  // Clic carte → lat/lng + résolution automatique commune/quartier
  // Résolution serveur `resolveLocation` (polygones officiels + annonces
  // réelles, denses à Marrakech) — même source que l'estimation Location,
  // fiable et cohérente.
  const handleMapPick = async (lat: number, lng: number) => {
    update('latitude', lat.toFixed(6));
    update('longitude', lng.toFixed(6));
    try {
      const res = await resolveLocation(lat, lng);
      const commune = res.commune_officielle;
      if (commune) {
        setExtraCommunes((prev) =>
          prev.includes(commune) || findCommune(commune) ? prev : [...prev, commune]
        );
        update('city', commune);
      }
      if (res.quartier) {
        const cityKey = commune ?? form.city ?? '';
        if (cityKey) {
          setExtraQuartiers((prev) => {
            const list = prev[cityKey] ?? [];
            if (list.includes(res.quartier!) || findQuartier(cityKey, res.quartier!)) return prev;
            return { ...prev, [cityKey]: [...list, res.quartier!] };
          });
        }
        update('quartier', res.quartier);
      }
    } catch { /* résolution indisponible : on garde la saisie */ }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    hasRecordedRef.current = false; // reset pour permettre un nouvel enregistrement
    setSubmitted(true);
    await analyzeInvestment({
      sale_price: numberValue(form.price),
      rental_price_monthly: numberValue(form.rent) || undefined,
      type_bien: form.type,
      commune: form.city,
      quartier: form.quartier,
      latitude: numberValue(form.latitude) || undefined,
      longitude: numberValue(form.longitude) || undefined,
    });
  };

  // ── Enregistrer dans l'historique quand le résultat ML arrive ──────────────
  useEffect(() => {
    if (result && !isLoading && currentUser && !hasRecordedRef.current) {
      hasRecordedRef.current = true;
      addEntry({
        type: 'investissement',
        label: `Analyse investissement — ${form.type}${form.city ? ` à ${form.city}` : ''}${form.quartier ? ` · ${form.quartier}` : ''}`,
        user: {
          id:        currentUser._id,
          firstName: currentUser.firstName,
          lastName:  currentUser.lastName,
          email:     currentUser.email,
        },
        details: {
          address:         form.address,
          city:            form.city,
          type:            form.type,
          price:           numberValue(form.price),
          rent:            numberValue(form.rent),
          surface:         numberValue(form.surface),
          yieldRate:       result.financial_report?.yield?.gross_yield_pct ?? 0,
          investmentScore: result.overall_score ?? 0,
          riskScore:       0,
        },
      });
    }
  }, [result, isLoading, currentUser, addEntry, form]);


  const fields: { key: keyof FormState; label: string; placeholder: string; type?: string; wide?: boolean; readOnly?: boolean }[] = [
    { key: 'parcel', label: 'N° parcelle cadastrale', placeholder: 'Ex. 42/781' },
    { key: 'price', label: 'Prix demandé (MAD)', placeholder: 'Ex. 1 250 000', type: 'number' },
    { key: 'rent', label: 'Loyer mensuel estimé (MAD)', placeholder: 'Ex. 8 500', type: 'number' },
    { key: 'surface', label: 'Surface (m²)', placeholder: 'Ex. 85', type: 'number' },
    { key: 'latitude', label: 'Latitude (Sélection via carte)', placeholder: 'Cliquez sur la carte', type: 'text', readOnly: true },
    { key: 'longitude', label: 'Longitude (Sélection via carte)', placeholder: 'Cliquez sur la carte', type: 'text', readOnly: true },
  ];

  const latitude = numberValue(form.latitude) || 31.6295;
  const longitude = numberValue(form.longitude) || -7.9811;

  // ─── Data for Charts ────────────────────────────────────────────────────────
  const radarData = result?.pillars ? [
    { subject: 'Finance', score: Math.round(result.pillars.financial_score), fullMark: 100 },
    { subject: 'Marché', score: Math.round(result.pillars.market_score), fullMark: 100 },
    { subject: 'Localisation', score: Math.round(result.pillars.location_score), fullMark: 100 },
    { subject: 'Risque', score: Math.round(result.pillars.risk_score), fullMark: 100 },
  ] : [];

  const pieData = result ? [
    { name: 'Score', value: Math.round(result.overall_score || 0) },
    { name: 'Reste', value: 100 - Math.round(result.overall_score || 0) }
  ] : [];
  const pieColors = [C.terra, C.sandLight];

  // ─── Derived financial metrics (Intelligence Financière) ───────────────────
  const price = numberValue(form.price);
  const rent = numberValue(form.rent);
  const fr = result?.financial_report;

  const grossYield = fr?.yield?.gross_yield_pct ?? 0;
  const netYield = fr?.yield?.net_yield_pct ?? 0;
  const noi = rent * 12 * 0.75; // revenu net estimé (≈25% de charges d'exploitation)

  const apport = price * 0.20;
  const emprunte = price * 0.80;
  const tauxMensuel = 0.05 / 12;
  const nbMois = 25 * 12;
  const mensualite = emprunte > 0
    ? (emprunte * tauxMensuel * Math.pow(1 + tauxMensuel, nbMois)) / (Math.pow(1 + tauxMensuel, nbMois) - 1)
    : 0;
  const cashFlowMensuel = fr?.financing_cashflow?.monthly_cash_flow ?? (rent - mensualite);

  const roiAnnualise = fr?.roi?.annualized_roi_pct ?? 0;
  const plusValueLatente = price * Math.pow(1 + roiAnnualise / 100, 10) - price;
  const cashFlowTotal10 = cashFlowMensuel * 12 * 10;
  const profitTotal = plusValueLatente + Math.max(0, cashFlowTotal10);

  // ─── Monte Carlo scenarios (derived from profit total) ─────────────────────
  const monteCarloData = [
    { scenario: 'Pessimiste', profit: Math.round(profitTotal * 0.45), color: '#dc2626' },
    { scenario: 'Réaliste', profit: Math.round(profitTotal), color: C.terra },
    { scenario: 'Optimiste', profit: Math.round(profitTotal * 1.55), color: '#16a34a' },
  ];
  const ecartType = Math.round(Math.abs(profitTotal) * 0.35);
  const coefVariation = profitTotal > 0 ? ((ecartType / profitTotal) * 100).toFixed(2) : '0';
  const riskScore = result?.pillars?.risk_score ?? 50;
  const probPerte = Math.min(
    95,
    Math.max(1, ((100 - riskScore) * 0.15) + (cashFlowMensuel < 0 ? 8 : 0))
  ).toFixed(2);

  // ─── Spatial indicators (donut charts) — adaptés aux données du projet ──────
  const donutColor = (v: number) => v >= 70 ? '#16a34a' : v >= 50 ? '#f59e0b' : '#ef4444';

  // Marché : comparaison Prix/m² du bien vs moyenne du quartier (réel, plus fixé à 50)
  const surfaceNum = numberValue(form.surface);
  const userPriceM2 = surfaceNum > 0 ? price / surfaceNum : 0;
  const userLat = numberValue(form.latitude) || 0;
  const userLng = numberValue(form.longitude) || 0;
  const quartiers: any[] = (prixData as any).quartiers || [];

  const marketInfo = (() => {
    if (!quartiers.length) return { value: Math.round(result?.pillars?.market_score ?? 50), desc: 'Prix vs moyenne quartier & demande' };
    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const nameKey = norm(form.address || form.city || '');
    // 1. correspondance par nom (adresse ou ville)
    let ref: any = nameKey
      ? quartiers.find((q) => {
          const qn = norm(q.localisation_quartier || '');
          return qn === nameKey || qn.includes(nameKey) || nameKey.includes(qn);
        })
      : null;
    // 2. quartier le plus proche par lat/lng
    if (!ref && userLat && userLng) {
      let best: any = null; let bestD = Infinity;
      for (const q of quartiers) {
        if (q.lat == null || q.lng == null) continue;
        const d = (q.lat - userLat) ** 2 + (q.lng - userLng) ** 2;
        if (d < bestD) { bestD = d; best = q; }
      }
      ref = best;
    }
    if (!ref) return { value: Math.round(result?.pillars?.market_score ?? 50), desc: 'Prix vs moyenne quartier & demande' };

    const avgM2 = ref.prix_m2_moyen || 0;
    let ratio: number | null = null;
    if (userPriceM2 > 0 && avgM2 > 0) {
      ratio = userPriceM2 / avgM2;
    } else {
      const avgType = ref.prix_par_type?.[form.type] || ref.prix_moyen || 0;
      if (price > 0 && avgType > 0) ratio = price / avgType;
    }
    if (ratio == null) return { value: Math.round(result?.pillars?.market_score ?? 50), desc: 'Prix vs moyenne quartier & demande' };

    // ratio < 1 = bon plan (sous la moyenne) → score > 50 ; ratio > 1 = surévalué → score < 50
    let score = 50 + (1 - ratio) * 60;
    // demande : plus de biens listés = marché liquide (léger bonus)
    const nb = ref.nombre_biens || 0;
    score += Math.min(8, Math.log10(nb + 1) * 2);
    score = Math.max(5, Math.min(95, Math.round(score)));

    const fmtM2 = (v: number) => new Intl.NumberFormat('fr-MA').format(Math.round(v));
    const avgLabel = userPriceM2 > 0 ? `${fmtM2(userPriceM2)} vs ${fmtM2(avgM2)} MAD/m²` : `Prix vs moyenne ${ref.localisation_quartier || ''}`;
    return { value: score, desc: `${avgLabel} · ${ref.localisation_quartier || 'quartier'}` };
  })();

  const spatialIndicators = result?.pillars ? [
    { title: 'LOCALISATION', value: Math.round(result.pillars.location_score), desc: 'Densité et proximité des POIs' },
    { title: 'MARCHÉ', value: marketInfo.value, desc: marketInfo.desc },
    { title: 'FINANCE', value: Math.round(result.pillars.financial_score), desc: 'Rendement et rentabilité du bien' },
  ] : [];

  // ─── Risque global (adapté : pas de titres fonciers, basé sur overall_risk_level + anomalie spatiale)
  const rawRiskLevel = (result?.investment_scores?.overall_risk_level || 'modéré').toLowerCase();
  const risqueGlobalLabel = rawRiskLevel.includes('faible') || rawRiskLevel.includes('low')
    ? 'RISQUE FAIBLE'
    : rawRiskLevel.includes('élev') || rawRiskLevel.includes('high') || rawRiskLevel.includes('fort')
      ? 'RISQUE ÉLEVÉ'
      : 'RISQUE MODÉRÉ';
  const risqueGlobalTone = risqueGlobalLabel === 'RISQUE FAIBLE' ? '#16a34a'
    : risqueGlobalLabel === 'RISQUE ÉLEVÉ' ? '#dc2626' : '#f59e0b';
  const anomalieDetectee = result?.spatial_anomaly?.spatial_anomaly === true;
  const risqueDesc = [
    result?.investment_scores?.neighborhood_type ? `Quartier : ${result.investment_scores.neighborhood_type}` : null,
    result?.spatial_anomaly?.risk_source || null,
  ].filter(Boolean).join(' · ') || 'Évaluation basée sur les scores du modèle ML';

  const locationLabel = form.city || 'Marrakech';
  const propertyLabel = `${form.type}${form.surface ? ` • ${form.surface} m²` : ''}`;
  const confidencePct = Math.round(result?.overall_score ?? 0);

  const recommendationLabel = (() => {
    const d = (result?.decision || '').toLowerCase();
    if (d.includes('invest') || d.includes('favorable') || d.includes('acheter')) return 'INVESTIR';
    if (d.includes('éviter') || d.includes('risqué') || d.includes('défavorable')) return 'ÉVITER';
    return 'ÉTUDIER PLUS EN DÉTAIL';
  })();
  const recommendationTone = recommendationLabel === 'INVESTIR' ? '#16a34a'
    : recommendationLabel === 'ÉVITER' ? '#dc2626' : '#b8860b';

  const pourquoiText = result?.explanation_text || [
    ...(result?.investment_scores?.explanation?.strengths || []).map((s) => `• ${s}`),
    ...(result?.investment_scores?.explanation?.weaknesses || []).map((s) => `• ${s}`),
  ].join('  ');

  return (
    <MainLayout activeId="investissement-risque">
      {/* ═══════ ELEGANT TERRACOTTA & WARM GOLD HEADER ═══════ */}
      <header style={{
        background: 'linear-gradient(135deg, #7A3216 0%, #9A421D 50%, #C05A30 100%)',
        color: '#FEFDFA',
        padding: '2.5rem 3rem 2.25rem',
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

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
         
            <h1 style={{
              fontFamily: "'Source Serif 4', Georgia, serif",
              fontSize: 'clamp(1.8rem, 2.5vw, 2.3rem)',
              fontWeight: 400, color: '#FEFDFA', margin: '0 0 0.4rem 0',
              lineHeight: 1.15
            }}>
              Investissement &amp; Risque
            </h1>
            <p style={{
              fontSize: '0.88rem', color: 'rgba(254,253,250,0.85)',
              margin: 0, maxWidth: 640, lineHeight: 1.5
            }}>
              Analyse complète du potentiel financier, du rendement locatif, des simulations Monte Carlo et des risques géospatiaux.
            </p>
          </div>

         
        </div>
      </header>

      <div className="ir-page">
        <div className={submitted ? 'ir-layout ir-layout--result' : 'ir-layout'}>

        {!submitted && (
        <section className="ir-card ir-form-card">
          <div className="ir-card-title"><div className="ir-icon"><Calculator size={19} /></div><div><h2>Informations du bien</h2><p>Renseignez les données disponibles pour obtenir une estimation.</p></div></div>
          <form onSubmit={handleSubmit} className="ir-form">
            <label style={{ gridColumn: '1 / -1', display: 'block', fontWeight: 600, color: '#3C3028', marginBottom: '4px' }}>Ville / Commune<select required value={form.city} onChange={(event) => handleVilleChange(event.target.value)} style={selectStyle}><option value="">— Sélectionnez une commune —</option>{villesDisponibles.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
            <label style={{ gridColumn: '1 / -1', display: 'block', fontWeight: 600, color: '#3C3028', marginBottom: '4px' }}>Quartier<select value={form.quartier} disabled={!form.city} onChange={(event) => handleQuartierChange(event.target.value)} style={{ ...selectStyle, opacity: form.city ? 1 : 0.6, cursor: form.city ? 'pointer' : 'not-allowed' }}><option value="">{form.city ? '— Sélectionnez un quartier —' : '— Choisissez d’abord une commune —'}</option>{quartiersDeVille.map((q) => <option key={q} value={q}>{q}</option>)}</select></label>
            <label style={{ gridColumn: '1 / -1', display: 'block', fontWeight: 600, color: '#3C3028', marginBottom: '4px' }}>Type de bien<select value={form.type} onChange={(event) => update('type', event.target.value)} style={selectStyle}><option value="Appartement">Appartement</option><option value="Villa">Villa</option><option value="Maison">Maison</option><option value="Terrain">Terrain</option><option value="Local commercial">Local commercial</option></select></label>
            <div className="ir-grid">{fields.map((field) => <label key={field.key} className={field.wide ? 'ir-wide' : ''}>{field.label}<input required={field.key !== 'parcel' && field.key !== 'latitude' && field.key !== 'longitude' && field.key !== 'rent'} type={field.type || 'text'} min={field.type === 'number' ? '0' : undefined} step={field.key === 'latitude' || field.key === 'longitude' ? 'any' : undefined} placeholder={field.placeholder} value={form[field.key]} onChange={(event) => !field.readOnly && update(field.key, event.target.value)} readOnly={field.readOnly} style={field.readOnly ? { backgroundColor: '#f9f8f6', cursor: 'not-allowed', color: '#68594D' } : {}} /></label>)}</div>
            <button className="ir-submit" type="submit"><TrendingUp size={17} /> Lancer l'analyse</button>
          </form>
        </section>
        )}
        {!submitted ? (
          <section className="ir-card ir-result-card">
            {/* ── Design identique à l'étape « Localisation » de l'estimation ── */}
            <div style={{ marginBottom: '0.5rem' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.terra, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin style={{ width: 14, height: 14 }} /> Localisation
              </p>
              <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", color: C.ink, fontSize: 'clamp(1.4rem,2vw,1.8rem)', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                Position du bien
              </h2>
            </div>
            <p style={{ color: C.inkMuted, fontSize: '0.85rem', marginTop: 4, marginBottom: 16 }}>
              Les zones se remplissent automatiquement quand vous cliquez sur la carte — et inversement.
            </p>

            <div style={{ position: 'relative', height: 'min(420px, 55vh)', borderRadius: 18, overflow: 'hidden', border: `1.5px solid ${C.sandLight}`, boxShadow: '0 8px 24px rgba(26,20,16,0.08)' }}>
              <MapContainer center={[latitude, longitude]} zoom={12} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <ClickCatcher onPick={handleMapPick} />
                <Marker position={[latitude, longitude]} icon={markerIcon} />
                <Recenter lat={latitude} lng={longitude} />
              </MapContainer>
              <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', background: 'rgba(254,252,248,0.92)', backdropFilter: 'blur(10px)', border: `1px solid ${C.sandLight}`, borderRadius: 999, padding: '5px 14px', fontSize: '0.72rem', fontWeight: 700, color: C.ink, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 1000, boxShadow: '0 4px 16px rgba(26,20,16,0.12)' }}>
                <MapPin size={13} style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: 5, color: C.terra }} />
                Cliquez sur la carte pour définir la position
              </div>
            </div>
          </section>
        ) : (
          <section className="ir-card ir-result-card" style={{ background: 'transparent', boxShadow: 'none', padding: 0, position: 'static', border: 'none' }}>

          <div className="ir-result-nav">
            <button type="button" className="ir-back-button" onClick={() => { setSubmitted(false); resetAnalysis(); }}><ArrowLeft size={15} /> Retour</button>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button type="button" onClick={() => navigate('/rapport-complet')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 10, padding: '0.62rem 0.95rem', background: C.terra, color: C.paper, fontWeight: 700, cursor: 'pointer' }}><FileText size={15} /> Générer le rapport</button>
              <button type="button" className="ir-new-analysis" onClick={() => { setSubmitted(false); resetAnalysis(); setForm(emptyForm); }}><RotateCcw size={15} /> Nouvelle analyse</button>
            </div>
          </div>
          {isLoading && (
            <div className="ir-loading-card">
              <Loader2 className="animate-spin" size={36} color={C.terra} />
              <p className="ir-loading-title">Analyse d'investissement en cours...</p>
              <p className="ir-loading-sub">Nos modèles ML évaluent la rentabilité, le marché et les risques.</p>
            </div>
          )}
          {error && !isLoading && (
            <div className="ir-error-card">
              <div className="ir-error-icon"><AlertCircle size={18} /></div>
              <div>
                <p className="ir-error-title">Une erreur est survenue</p>
                <p className="ir-error-text">{error}</p>
              </div>
            </div>
          )}
          {result && !isLoading && (
            <div className="ir-analysis">
              {/* ── Carte d'analyse principale (header + recommandation + pourquoi + radar) ─ */}
              <section className="ir-analysis-card">
                <header className="ir-an-header">
                  <div className="ir-an-title">
                    <span className="ir-an-kicker">Analyse</span>
                    <h2>Analyse — {locationLabel}</h2>
                    <p>{propertyLabel || 'Bien immobilier'}</p>
                  </div>
                  <div className="ir-an-price">
                    <span className="ir-an-price-label">Prix d'acquisition</span>
                    <strong>{formatPrice(price)}</strong>
                    <span className="ir-an-saved"><Check size={12} /> Rapport sauvegardé</span>
                  </div>
                </header>

                <div className="ir-an-metrics">
                  <div className="ir-an-metric">
                    <span className="ir-an-metric-label">Recommandation du système</span>
                    <span className="ir-an-badge" style={{ background: recommendationTone }}>
                      <AlertCircle size={15} /> {recommendationLabel}
                    </span>
                  </div>
                  <div className="ir-an-metric">
                    <span className="ir-an-metric-label">Niveau de confiance</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <strong className="ir-an-confidence">{confidencePct}%</strong>
                      <div style={{ width: 60, height: 60 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%" cy="50%"
                              innerRadius={20} outerRadius={28}
                              startAngle={90} endAngle={-270}
                              dataKey="value"
                              stroke="none"
                            >
                              {pieData.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ir-an-body">
                  <div className="ir-an-why">
                    <h3>Pourquoi ?</h3>
                    <p>{pourquoiText}</p>
                  </div>
                  {result.pillars && (
                    <div className="ir-an-radar">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="68%" data={radarData}>
                          <PolarGrid stroke="#e5ded3" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: C.inkSoft, fontSize: 12, fontWeight: 600 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar name="Score" dataKey="score" stroke={C.terra} fill={C.terra} fillOpacity={0.35} />
                          <RechartsTooltip
                            contentStyle={{ borderRadius: 8, border: `1px solid ${C.sandLight}`, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                            itemStyle={{ color: C.terra, fontWeight: 700 }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <footer className="ir-an-footer">
                  <BarChart3 size={16} color={C.terra} /> <span>Intelligence Financière</span>
                </footer>
              </section>

              {/* ── Intelligence Financière : 3 cartes ──────────────────────────────── */}
              {fr ? (
                <section className="ir-fin-section">
                  <div className="ir-section-head"><BarChart3 size={18} color={C.terra} /><h3>Intelligence Financière</h3></div>
                  <div className="ir-fin-grid">
                    <article className="ir-fin-card">
                      <div className="ir-fin-card-head">
                        <div className="ir-fin-icon"><Percent size={16} /></div>
                        <h4>Rendement Locatif</h4>
                      </div>
                      <ul>
                        <li><span>Brut</span><strong className="ir-accent">{grossYield.toFixed(2)}%</strong></li>
                        <li><span>Net</span><strong>{netYield.toFixed(2)}%</strong></li>
                        <li><span>NOI (Revenu Net)</span><strong>{formatPrice(noi)}<em>/an</em></strong></li>
                      </ul>
                    </article>
                    <article className="ir-fin-card">
                      <div className="ir-fin-card-head">
                        <div className="ir-fin-icon"><Wallet size={16} /></div>
                        <h4>Cash Flow &amp; Financement</h4>
                      </div>
                      <ul>
                        <li><span>Apport personnel (20%)</span><strong>{formatPrice(apport)}</strong></li>
                        <li><span>Mensualité crédit</span><strong>{formatPrice(mensualite)}<em>/mois</em></strong></li>
                        <li><span>Cash Flow Mensuel</span>
                          <strong className={cashFlowMensuel >= 0 ? 'ir-pos' : 'ir-neg'}>
                            {formatPrice(cashFlowMensuel)}
                          </strong>
                        </li>
                      </ul>
                    </article>
                    <article className="ir-fin-card">
                      <div className="ir-fin-card-head">
                        <div className="ir-fin-icon"><Home size={16} /></div>
                        <h4>ROI (Horizon 10 ans)</h4>
                      </div>
                      <ul>
                        <li><span>ROI Annualisé</span><strong className="ir-accent">{roiAnnualise.toFixed(2)}%</strong></li>
                        <li><span>Plus-value latente</span><strong>{formatPrice(plusValueLatente)}</strong></li>
                        <li><span>Profit Total</span><strong>{formatPrice(profitTotal)}</strong></li>
                      </ul>
                    </article>
                  </div>
                </section>
              ) : (
                <div className="ir-fin-info">
                  <Info size={16} color={C.terra} />
                  <span>L'analyse financière détaillée (ROI, Rendement, Cash Flow) est indisponible car aucun loyer n'a été estimé.</span>
                </div>
              )}

              {/* ── Scénarios de Monte Carlo : bar chart + métriques ──────────────── */}
              <section className="ir-mc-section">
                <div className="ir-section-head"><TrendingUp size={18} color={C.terra} /><h3>Scénarios de Monte Carlo <span className="ir-section-sub">(Profit Total sur 10 ans)</span></h3></div>
                <div className="ir-mc-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monteCarloData} margin={{ top: 24, right: 16, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d4" vertical={false} />
                      <XAxis dataKey="scenario" tick={{ fill: C.inkSoft, fontSize: 12, fontWeight: 600 }} axisLine={{ stroke: '#e0d8cc' }} tickLine={false} />
                      <YAxis tick={{ fill: C.inkMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                      <RechartsTooltip
                        cursor={{ fill: 'rgba(154,66,29,0.06)' }}
                        contentStyle={{ borderRadius: 8, border: `1px solid ${C.sandLight}`, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        formatter={(v: any) => [formatPrice(Number(v)), 'Profit estimé'] as [string, string]}
                      />
                      <Bar dataKey="profit" radius={[6, 6, 0, 0]} maxBarSize={92}>
                        {monteCarloData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        <LabelList dataKey="profit" position="top" formatter={(v: any) => `${Math.round(Number(v) / 1000)}k`} style={{ fill: C.inkMuted, fontSize: 11, fontWeight: 600 } as any} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="ir-mc-metrics">
                  <div><span className="ir-mc-label">Probabilité de perte</span><strong>{probPerte}%</strong></div>
                  <div><span className="ir-mc-label">Coefficient de variation</span><strong>{coefVariation}%</strong></div>
                  <div><span className="ir-mc-label">Écart-type (σ)</span><strong>{formatPrice(ecartType)}</strong></div>
                </div>
              </section>

              {/* ── Indicateurs Spatiaux & Risques : donuts + Risque Foncier ────────── */}
              <section className="ir-spatial-section">
                <div className="ir-section-head"><TrendingUp size={18} color={C.terra} /><h3>Indicateurs Spatiaux & Risques</h3></div>
                <div className="ir-spatial-grid">
                  {spatialIndicators.map((ind) => {
                    const color = donutColor(ind.value);
                    const status = ind.value >= 70 ? 'Excellent' : ind.value >= 50 ? 'Correct' : 'Vigilance';
                    const donutData = [
                      { name: 'Score', value: ind.value },
                      { name: 'Reste', value: 100 - ind.value },
                    ];
                    return (
                      <article className="ir-donut-card" key={ind.title}>
                        <div className="ir-donut-wrap">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={donutData}
                                cx="50%" cy="50%"
                                innerRadius={44} outerRadius={58}
                                startAngle={90} endAngle={-270}
                                dataKey="value"
                                stroke="none"
                                paddingAngle={2}
                                cornerRadius={3}
                              >
                                <Cell fill={color} />
                                <Cell fill={C.mist} />
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="ir-donut-center">
                            <span className="ir-donut-value" style={{ color }}>{ind.value}</span>
                            <span className="ir-donut-unit">/100</span>
                          </div>
                        </div>
                        <strong className="ir-donut-title">{ind.title}</strong>
                        <span className="ir-donut-status" style={{ color, background: `${color}14`, borderColor: `${color}33` }}>{status}</span>
                        <p className="ir-donut-desc">{ind.desc}</p>
                      </article>
                    );
                  })}

                  <article className="ir-risk-card">
                    <div className="ir-risk-head">
                      <Shield size={18} color={C.terra} />
                      <strong>Risque Global</strong>
                    </div>
                    <span
                      className="ir-risk-badge"
                      style={{
                        color: risqueGlobalTone,
                        borderColor: `${risqueGlobalTone}4D`,
                        background: `${risqueGlobalTone}14`,
                      }}
                    >
                      <ShieldCheck size={13} /> {risqueGlobalLabel}
                    </span>
                    <p className="ir-risk-desc">{risqueDesc}</p>
                    {anomalieDetectee && (
                      <p className="ir-risk-warn"><AlertCircle size={12} /> Anomalie spatiale détectée par le modèle</p>
                    )}
                    {result?.spatial_anomaly?.warnings && result.spatial_anomaly.warnings.length > 0 && (
                      <p className="ir-risk-warn"><AlertCircle size={12} /> {result.spatial_anomaly.warnings.join(' ')}</p>
                    )}
                  </article>
                </div>
              </section>
            </div>
          )}
        </section>
      )}
    </div>
  </div>
</MainLayout>
  );
}


