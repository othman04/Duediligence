import { useState, useRef, useEffect, useMemo } from 'react';
import { MainLayout } from '../components/MainLayout';
import { useAuthStore } from '../store/authStore';
import { useHistoryStore } from '../store/historyStore';
import axiosInstance from '../lib/axiosIsntance';
import {
  Download, Sparkles, MapPin, Building2, CheckCircle2, AlertCircle,
  Loader2, RefreshCcw, TrendingUp, Map as MapIcon, BarChart3,
  Target, Landmark, Navigation, FileText, ShieldCheck, ClipboardList,
  Info,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { getCommuneNames, getQuartiersOf, findCommune, findQuartier } from '../data/zonesRegion';
import {
  resolveLocation,
  fetchSaleCommuneCenter, fetchSaleQuartierCenter,
  fetchCommuneCenter, fetchQuartierCenter,
} from '../lib/locationApi';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const C = {
  terra:      '#9A421D', terraDark:  '#7A3216', terraDeep:  '#5C240E',
  terraLight: '#C05A30', terraMuted: 'rgba(154,66,29,0.08)', terraGlow: 'rgba(154,66,29,0.15)',
  ink:        '#1A1410', inkSoft:    '#3A3028', inkMuted:   '#7A6E66',
  sand:       '#D0C0A8', sandLight:  '#E8DDD0', sandPale:   '#F0EAE2',
  mist:       '#F4F1EC', paper:      '#FEFCF8', gold:       '#C49A5A',
  success:    '#0F7A54', successBg:  'rgba(15,122,84,0.08)',
  danger:     '#C42020', dangerBg:   'rgba(196,32,32,0.08)',
  warning:    '#C47A05', warningBg:  'rgba(196,122,5,0.08)',
  info:       '#1D5FAD', infoBg:     'rgba(29,95,173,0.08)',
};

// Types de bien — triés alphabétiquement.
const PROPERTY_TYPES = ['Appartement', 'Local commercial', 'Maison', 'Riad', 'Terrain', 'Villa'];

/* ── Zones (ville / quartier) : normalisation & dédoublonnage ────────────────
 * Normalisation tolérante (casse, accents, apostrophes, espaces), identique à
 * `zonesRegion.ts` : garde UNE seule version d'un quartier même si les sources
 * (fichier statique vs résolution serveur) diffèrent de format ("Guéliz" vs
 * "Gueliz", "M'Hamid" vs "Mhamid", …). La première occurrence gagne (la liste
 * canonique statique est toujours passée en premier), sortie triée A→Z (fr).
 * ──────────────────────────────────────────────────────────────────────── */
function normZone(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeZones(names: (string | null | undefined)[]): string[] {
  const seen = new Map<string, string>();
  for (const n of names) {
    if (!n) continue;
    const key = normZone(n);
    if (key && !seen.has(key)) seen.set(key, n);
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'fr'));
}

/** Adresse lisible (Nominatim) — même auto-remplissage que la page d'estimation. */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=fr`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.display_name === 'string' ? data.display_name : null;
  } catch {
    return null;
  }
}

const EQUIPMENT_OPTIONS = [
  { key: 'piscine',         label: 'Piscine' },
  { key: 'parking',         label: 'Parking / Garage' },
  { key: 'securite',        label: 'Sécurité 24/7' },
  { key: 'ascenseur',       label: 'Ascenseur' },
  { key: 'climatisation',   label: 'Climatisation' },
  { key: 'meuble',          label: 'Meublé' },
  { key: 'terrasse',        label: 'Terrasse' },
  { key: 'balcon',          label: 'Balcon' },
  { key: 'cuisine_equipee', label: 'Cuisine équipée' },
  { key: 'concierge',       label: 'Service Concierge' },
  { key: 'chauffage',       label: 'Chauffage central' },
  { key: 'jardin',          label: 'Jardin privatif' },
];

const STEPS = ['1/4 Vérification de l’emplacement…', '2/4 Estimation du prix et du loyer…', '3/4 Analyse de l’investissement…', '4/4 Préparation du rapport…'];

// Références affichées à titre d'information : elles sont verrouillées pour éviter
// qu'une simulation soit présentée à tort comme une donnée bancaire officielle.
const MOROCCO_CREDIT_RULES = {
  bamAverageRate: 5.13,
  boaStartingRate: 4.75,
  maximumDurationYears: 25,
  minimumLoanAmount: 70000,
  acquisitionFeesPct: 6.5,
  insuranceRatePct: 0.30,
  negotiableRateMax: 6.5,
};

// Structure documentaire — sert à la fois de sommaire et de numérotation des sections.
const TOC = [
  { id: 'sec-synthese',  num: '01', label: 'À retenir' },
  { id: 'sec-narratif',  num: '02', label: 'Analyse du bien' },
  { id: 'sec-scoring',   num: '03', label: 'Avis sur l’investissement' },
  { id: 'sec-swot',      num: '04', label: 'Analyse SWOT' },
  { id: 'sec-marche',    num: '05', label: 'Prix et loyer estimés' },
  { id: 'sec-financement', num: '06', label: 'Étude de crédit immobilier' },
  { id: 'sec-geo',       num: '07', label: 'Quartier et services proches' },
  { id: 'sec-methodo',   num: '08', label: 'Informations utiles' },
];

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Auto-zoom : recentre sur lat/lng (zoom 12 après choix ville, 15 après quartier). */
function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom ?? Math.max(map.getZoom(), 13), { animate: true });
  }, [map, lat, lng, zoom]);
  return null;
}

function ReportLocationMap({ lat, lng }: { lat?: number; lng?: number }) {
  if (lat == null || lng == null) return null;
  return (
    <div className="report-location-map">
      <MapContainer center={[lat, lng]} zoom={16} scrollWheelZoom={false} zoomControl={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap"
        />
        <Marker position={[lat, lng]} />
      </MapContainer>
      <div className="report-map-caption">
        <MapPin size={14} />
        <span>Localisation du bien · {lat.toFixed(5)}, {lng.toFixed(5)}</span>
      </div>
    </div>
  );
}

function ScoreBar({ value, max = 100, color = C.terra }: { value: number | null; max?: number; color?: string }) {
  const pct = value != null ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: C.sandLight, borderRadius: 99, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.8s ease' }} />
    </div>
  );
}

function KpiCard({ label, value, sub, accent = false, icon: Icon }: { label: string; value: string; sub?: string; accent?: boolean; icon?: any }) {
  return (
    <div style={{
      background: accent ? `linear-gradient(145deg, ${C.terraDeep}, ${C.terra})` : C.paper,
      border: `1px solid ${accent ? 'transparent' : C.sandLight}`,
      borderRadius: 16, padding: '1.25rem 1.4rem',
      position: 'relative', overflow: 'hidden',
      boxShadow: accent ? '0 8px 28px rgba(154,66,29,0.3)' : '0 2px 8px rgba(26,20,16,0.04)',
    }}>
      {accent && <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '50%', height: '120%', background: 'radial-gradient(ellipse, rgba(255,255,255,0.08) 0%, transparent 65%)', pointerEvents: 'none' }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {Icon && <span className="report-kpi-icon"><Icon size={14} color={accent ? 'rgba(255,255,255,0.7)' : C.terra} /></span>}
        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: accent ? 'rgba(255,255,255,0.7)' : C.terra }}>{label}</div>
      </div>
      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.7rem', fontWeight: 400, color: accent ? C.paper : C.ink, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.74rem', color: accent ? 'rgba(255,255,255,0.65)' : C.inkMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// SectionCard porte désormais le numéro de section (aligné sur le sommaire) et un ancrage id,
// ce qui donne au document la même logique de repérage qu'un rapport imprimé (n° de section / n° de page).
function SectionCard({ id, number, title, icon: Icon, children, accent = false }: { id?: string; number?: string; title: string; icon: any; children: React.ReactNode; accent?: boolean }) {
  return (
    <div id={id} style={{
      background: C.paper, borderRadius: 18, padding: '1.75rem',
      border: `1px solid ${C.sandLight}`, boxShadow: '0 4px 16px rgba(26,20,16,0.04)',
      marginBottom: '1.25rem',
    }} className="report-section">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.25rem', paddingBottom: '0.875rem', borderBottom: `1px solid ${C.sandLight}` }}>
        {number && (
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '0.95rem', color: C.sand, fontWeight: 400, flexShrink: 0 }}>
            {number}
          </span>
        )}
        <div className="report-section-icon" style={{ width: 36, height: 36, borderRadius: 10, background: accent ? `linear-gradient(135deg, ${C.terraDark}, ${C.terra})` : C.terraMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={16} color={accent ? C.paper : C.terra} />
        </div>
        <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.1rem', color: C.ink, margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function AccessibilityRow({ label, value }: { label: string; value: number | null }) {
  const color = value == null ? C.inkMuted : value >= 75 ? C.success : value >= 50 ? C.warning : C.danger;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <div style={{ width: 120, fontSize: '0.78rem', color: C.inkSoft, fontWeight: 500, flexShrink: 0 }}>{label}</div>
      <ScoreBar value={value} color={color} />
      <div style={{ width: 40, textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color }}>{value != null ? `${Math.round(value)}` : 'N/D'}</div>
    </div>
  );
}

function DataRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.sandLight}` }}>
      <span style={{ fontSize: '0.82rem', color: C.inkMuted }}>{label}</span>
      <span style={{ fontSize: '0.88rem', fontWeight: highlight ? 700 : 600, color: highlight ? C.terra : C.ink }}>{value}</span>
    </div>
  );
}

function ReportTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${C.sandLight}`, borderRadius: 10, marginTop: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', color: C.inkSoft }}>
        <thead>
          <tr style={{ background: C.mist }}>
            {headers.map(header => <th key={header} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: C.terra, borderBottom: `1px solid ${C.sandLight}` }}>{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`} style={{ background: index % 2 ? C.paper : '#FFFEFC' }}>
              {row.map((cell, cellIndex) => <td key={cellIndex} style={{ padding: '9px 12px', borderBottom: index === rows.length - 1 ? 'none' : `1px solid ${C.sandLight}`, fontWeight: cellIndex === row.length - 1 ? 700 : 400, color: cellIndex === row.length - 1 ? C.ink : C.inkSoft }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const low = ['FAIBLE', 'LOW', 'BAS'].includes(level?.toUpperCase());
  const high = ['ÉLEVÉ', 'HIGH', 'FORT'].includes(level?.toUpperCase());
  const bg = low ? C.successBg : high ? C.dangerBg : C.warningBg;
  const color = low ? C.success : high ? C.danger : C.warning;
  return (
    <span style={{ padding: '3px 12px', background: bg, color, borderRadius: 999, fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {level || 'MODÉRÉ'}
    </span>
  );
}

function DecisionBadge({ decision }: { decision: string }) {
  const d = (decision || '').toUpperCase();
  const positive = d.includes('ACHETER') || d.includes('RECOMMANDÉ') || d.includes('FAVORABLE');
  const negative = d.includes('ÉVITER') || d.includes('NÉGATIF') || d.includes('DÉCONSEILLÉ');
  const bg = positive ? C.successBg : negative ? C.dangerBg : C.warningBg;
  const color = positive ? C.success : negative ? C.danger : C.warning;
  return (
    <span style={{ padding: '5px 16px', background: bg, color, borderRadius: 999, fontSize: '0.85rem', fontWeight: 700 }}>
      {decision || 'N/A'}
    </span>
  );
}

function fmt(n?: number | null): string {
  return n != null ? Math.round(n).toLocaleString('fr-MA') : 'N/D';
}
function fmtDist(m?: number | null): string {
  if (m == null) return 'N/D';
  return m < 1000 ? `${Math.round(m)} m` : `${(m/1000).toFixed(2)} km`;
}

function calculateLoan(financing: any, estimatedPrice?: number | null, monthlyRent?: number | null) {
  // Le prix de l'étude de crédit est toujours l'estimation du modèle, jamais un montant saisi.
  const price = estimatedPrice || 0;
  const downPayment = Math.min(Math.max(Number(financing?.downPayment) || 0, 0), price);
  const notaryFees = price * ((Number(financing?.notaryFeesPct) || 0) / 100);
  const principal = Math.max(0, price + notaryFees - downPayment);
  const months = Math.max(1, (Number(financing?.durationYears) || 0) * 12);
  const monthlyRate = (Number(financing?.interestRate) || 0) / 1200;
  const debtPayment = monthlyRate > 0 ? principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)) : principal / months;
  const insurance = principal * ((Number(financing?.insuranceRate) || 0) / 1200);
  const monthlyPayment = debtPayment + insurance;
  const income = Number(financing?.monthlyIncome) || 0;
  const debtRatio = income > 0 ? monthlyPayment / income * 100 : null;
  const totalPaid = monthlyPayment * months;
  const cashflow = (monthlyRent || 0) - monthlyPayment - (Number(financing?.monthlyCharges) || 0);
  let balance = principal;
  let firstYearInterest = 0;
  let firstYearPrincipal = 0;
  for (let month = 0; month < Math.min(12, months); month += 1) {
    const interest = balance * monthlyRate;
    const principalPart = Math.min(balance, Math.max(0, debtPayment - interest));
    firstYearInterest += interest;
    firstYearPrincipal += principalPart;
    balance -= principalPart;
  }
  return { price, downPayment, notaryFees, principal, months, monthlyPayment, totalPaid, creditCost: totalPaid - principal, debtRatio, cashflow, firstYearInterest, firstYearPrincipal, remainingAfterYearOne: balance, totalProjectCost: price + notaryFees, equity: downPayment };
}

function CreditStudy({ data }: { data: any }) {
  const financing = data.input?.financing;
  if (!financing?.enabled) return null;
  const l = calculateLoan(financing, data.prediction?.predicted_price, data.location?.predicted_price);
  const existingNetYield = data.investment?.financial_report?.yield?.net_yield_pct;
  const existingCashflow = data.investment?.financial_report?.financing_cashflow?.monthly_cash_flow;
  const ratioStatus = l.debtRatio == null ? 'Revenu non renseigné' : l.debtRatio <= 40 ? 'Capacité indicative confortable' : l.debtRatio <= 45 ? 'À valider avec la banque' : 'Endettement indicatif élevé';
  const ratioColor = l.debtRatio != null && l.debtRatio <= 40 ? C.success : l.debtRatio != null && l.debtRatio <= 45 ? C.warning : C.danger;
  return (
    <SectionCard id="sec-financement" number="06" title="Étude de crédit immobilier" icon={Landmark} accent>
      <p style={{ fontSize: '0.84rem', color: C.inkSoft, lineHeight: 1.6, marginTop: 0 }}>
        Simulation indicative en MAD, calculée avec vos hypothèses. Elle ne constitue ni une offre de crédit ni un accord bancaire.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, margin: '1rem 0' }}>
        <KpiCard label="Montant emprunté" value={`${fmt(l.principal)} MAD`} sub={`Apport : ${fmt(l.downPayment)} MAD`} />
        <KpiCard label="Mensualité estimée" value={`${fmt(l.monthlyPayment)} MAD`} sub={`${financing.durationYears} ans à ${financing.interestRate}%`} accent />
        <KpiCard label="Coût du crédit" value={`${fmt(l.creditCost)} MAD`} sub={`Total remboursé : ${fmt(l.totalPaid)} MAD`} />
        <KpiCard label="Taux d'endettement" value={l.debtRatio == null ? 'N/D' : `${l.debtRatio.toFixed(1)}%`} sub={ratioStatus} />
      </div>
      <ReportTable headers={['Plan de financement', 'Montant']} rows={[
        ['Prix de vente prédit par le modèle', `${fmt(l.price)} MAD`],
        ['Frais d’acquisition retenus', `${fmt(l.notaryFees)} MAD`],
        ['Coût total du projet', `${fmt(l.totalProjectCost)} MAD`],
        ['Apport personnel', `${fmt(l.equity)} MAD`],
        ['Capital financé par la banque', `${fmt(l.principal)} MAD`],
      ]} />
      <ReportTable headers={['Indicateur', 'Votre étude crédit', 'Étude investissement existante']} rows={[
        ['Cash-flow mensuel locatif', `${fmt(l.cashflow)} MAD`, existingCashflow != null ? `${fmt(existingCashflow)} MAD` : 'N/D'],
        ['Rendement net', l.price > 0 ? `${(((data.location?.predicted_price || 0) * 12 - (Number(financing.monthlyCharges) || 0) * 12) / l.price * 100).toFixed(2)}% avant dette` : 'N/D', existingNetYield != null ? `${Number(existingNetYield).toFixed(2)}%` : 'N/D'],
        ['Effort mensuel / revenu', l.debtRatio == null ? 'Renseignez le revenu' : `${l.debtRatio.toFixed(1)}%`, 'N/A'],
      ]} />
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.terra, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>Début d'amortissement · 12 premiers mois</div>
        <ReportTable headers={['Capital remboursé', 'Intérêts estimés', 'Solde après 12 mois']} rows={[[`${fmt(l.firstYearPrincipal)} MAD`, `${fmt(l.firstYearInterest)} MAD`, `${fmt(l.remainingAfterYearOne)} MAD`]]} />
      </div>
      <div style={{ marginTop: 12, padding: '12px 14px', background: C.infoBg, borderRadius: 10, color: C.inkSoft, fontSize: '0.78rem', lineHeight: 1.55 }}>
        <strong style={{ color: ratioColor }}>{ratioStatus}.</strong> {l.principal < MOROCCO_CREDIT_RULES.minimumLoanAmount ? ` Le montant est inférieur au seuil indicatif de ${fmt(MOROCCO_CREDIT_RULES.minimumLoanAmount)} MAD publié par BANK OF AFRICA.` : ' Le montant atteint le seuil indicatif de financement.'} Repère marché : le taux moyen des crédits immobiliers publié par Bank Al‑Maghrib était de 5,13% au T2 2025 ; le taux saisi reste celui à négocier selon votre profil. Vérifiez également l'assurance, les frais de dossier et les conditions de remboursement anticipé avant signature.
      </div>
    </SectionCard>
  );
}

async function downloadProfessionalPdf(data: any, form: any) {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const left = 18;
  const right = 192;
  const terra: [number, number, number] = [154, 66, 29];
  const ink: [number, number, number] = [33, 37, 41];
  const muted: [number, number, number] = [108, 117, 125];
  
  const pred = data.prediction || {};
  const loc = data.location || {};
  const invest = data.investment || {};
  const geo = data.geo || {};
  const acc = geo.accessibility_scores_0_100 || {};
  const scores = invest.investment_scores || {};
  const financial = invest.financial_report || {};
  const distances = geo.distances_m || {};
  const counts = geo.pois?.counts_by_category || {};
  const dossier = data.rapportId?.toString().slice(-8) || 'N/A';
  
  const prixVal  = pred.predicted_price;
  const prixBas  = pred.confidence_range?.low  ?? (prixVal ? prixVal * 0.9 : null);
  const prixHaut = pred.confidence_range?.high ?? (prixVal ? prixVal * 1.1 : null);

  const loyerVal  = loc.predicted_price;
  const loyerBas  = loc.confidence_range?.low  ?? loc.quantile_low  ?? (loyerVal ? loyerVal * 0.85 : null);
  const loyerHaut = loc.confidence_range?.high ?? loc.quantile_high ?? (loyerVal ? loyerVal * 1.15 : null);

  const rendBrut = financial.yield?.gross_yield_pct;
  const rendNet  = financial.yield?.net_yield_pct;
  const cashflow = financial.financing_cashflow?.monthly_cash_flow;

  const strengths  = scores.explanation?.strengths || [];
  const weaknesses = scores.explanation?.weaknesses || [];

  const swotStrengths = strengths.length ? strengths : [scores.location_score != null && scores.location_score >= 70 ? 'Bon emplacement selon les services disponibles.' : 'Les informations du bien sont disponibles pour l’analyse.'];
  const swotWeaknesses = weaknesses.length ? weaknesses : [scores.market_score != null && scores.market_score < 50 ? 'Le positionnement sur le marché demande une attention particulière.' : 'Prévoir une visite complète avant la décision.'];
  const swotOpportunities = [
    rendNet != null ? `Rendement net estimé à ${rendNet.toFixed(2)} %.` : 'Possibilité de préciser la stratégie de location après visite.',
    loyerVal != null ? `Loyer mensuel estimé autour de ${fmt(loyerVal)} MAD.` : 'Le potentiel locatif doit être confirmé avec le marché local.',
  ];
  const swotThreats = [
    scores.overall_risk_level ? `Niveau de risque annoncé : ${scores.overall_risk_level.toLowerCase()}.` : 'Vérifier les risques propres au bien et au quartier.',
    distances.dist_industrial_m != null && distances.dist_industrial_m < 2000 ? `Zone industrielle à ${fmtDist(distances.dist_industrial_m)} : à contrôler lors de la visite.` : 'Vérifier les documents, les charges et l’état technique du bien.',
  ];

  let y = 22;

  const footer = () => {
    const page = doc.getNumberOfPages();
    doc.setDrawColor(222, 226, 230); doc.line(left, 285, right, 285);
    doc.setFontSize(8); doc.setTextColor(...muted);
    doc.text('Orchid Island - Intelligence Immobilière · Confidential Report', left, 290);
    doc.text(`Page ${page}`, right, 290, { align: 'right' });
  };

  const header = () => {
    doc.setFontSize(8); doc.setTextColor(...muted);
    doc.text('Orchid Island — Rapport Complet d’Analyse Immobilière', left, 12);
    doc.text(`Dossier #${dossier}`, right, 12, { align: 'right' });
    doc.setDrawColor(222, 226, 230); doc.line(left, 15, right, 15);
    y = 24;
  };

  const newPage = () => { footer(); doc.addPage(); header(); };
  const ensure = (height: number) => { if (y + height > 278) newPage(); };

  const sectionTitle = (num: string, text: string) => {
    ensure(16);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...terra);
    doc.text(`${num}. ${text}`, left, y);
    y += 4;
    doc.setDrawColor(...terra); doc.setLineWidth(0.3); doc.line(left, y, right, y);
    y += 7;
  };

  const paragraph = (text: string) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...ink);
    const lines = doc.splitTextToSize(text, right - left);
    ensure(lines.length * 4.5 + 4);
    doc.text(lines, left, y);
    y += lines.length * 4.5 + 3;
  };

  const table = (headers: string[], rows: string[][], colWidths?: number[]) => {
    const defaultWidths = headers.map((_, i) => i === 0 ? 90 : (right - left - 90) / Math.max(1, headers.length - 1));
    const widths = colWidths || defaultWidths;

    const renderRow = (values: string[], isHeader = false) => {
      const lines = values.map((val, i) => doc.splitTextToSize(val || '—', widths[i] - 4));
      const maxHeight = Math.max(...lines.map(l => l.length)) * 4.5 + 5;
      ensure(maxHeight + 1);

      let x = left;
      values.forEach((_, i) => {
        doc.setFillColor(...(isHeader ? [250, 245, 243] as [number, number, number] : [255, 255, 255] as [number, number, number]));
        doc.setDrawColor(222, 226, 230);
        doc.rect(x, y, widths[i], maxHeight, 'FD');
        doc.setFont('helvetica', isHeader || i === values.length - 1 ? 'bold' : 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...(isHeader ? terra : ink));
        doc.text(lines[i], x + 2.5, y + 4.5);
        x += widths[i];
      });
      y += maxHeight;
    };

    renderRow(headers, true);
    rows.forEach(r => renderRow(r));
    y += 5;
  };

  // ════════════ PAGE DE GARDE ════════════
  doc.setFillColor(...terra); doc.rect(0, 0, pageWidth, 297, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(26);
  doc.text('RAPPORT DE DUE DILIGENCE', left, 66);
  doc.setFontSize(16); doc.setFont('helvetica', 'normal');
  doc.text('Analyse Immobilière & Financière Complète', left, 77);
  doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.8); doc.line(left, 86, left + 75, 86);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text(`${form.propertyType || 'Bien immobilier'} — ${form.neighbourhood || form.city || 'Marrakech'}`, left, 112);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(13);
  doc.text(`${form.surface || 'N/D'} m² · ${form.city || 'Marrakech'}, Maroc`, left, 122);

  doc.setFontSize(10);
  doc.text(`Référence Dossier : #${dossier}`, left, 155);
  doc.text(`Date d'édition : ${new Date().toLocaleDateString('fr-FR')}`, left, 163);
  doc.text(`Coordonnées GPS : ${form.latitude?.toFixed(5) ?? '31.6295'}, ${form.longitude?.toFixed(5) ?? '-7.9811'}`, left, 171);
  doc.text('Destinataire : Investisseur Privé', left, 179);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('DOCUMENT STRICTEMENT CONFIDENTIEL', left, 235);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text('Propriété intellectuelle d’Orchid Island · Tous droits réservés.', left, 275);

  // ════════════ PAGE 2: À RETENIR ════════════
  doc.addPage(); header();
  sectionTitle('01', 'À retenir · Synthèse Exécutive');
  paragraph(
    `Ce ${form.propertyType?.toLowerCase() || 'bien'} de ${form.surface ?? 'N/D'} m² situé à ${form.neighbourhood || form.city}, Marrakech, a fait l'objet d'une due diligence complète. ` +
    `Son score d'intérêt pour un investissement s'élève à ${invest.overall_score != null ? `${invest.overall_score.toFixed(1)}/100` : 'N/D'}. ` +
    `Le niveau de risque est qualifié de "${(scores.overall_risk_level || 'MODÉRÉ').toLowerCase()}" et la décision globale est "${invest.decision || 'N/A'}".`
  );

  table(['Indicateur Clé', 'Valeur Estimée'], [
    ['Prix de vente estimé (moyen)', `${fmt(prixVal)} MAD (${fmt(pred.price_per_m2)} MAD/m²)`],
    ['Fourchette de prix de vente', `De ${fmt(prixBas)} à ${fmt(prixHaut)} MAD`],
    ['Loyer mensuel estimé (moyen)', `${fmt(loyerVal)} MAD / mois`],
    ['Fourchette de loyer mensuel', `De ${fmt(loyerBas)} à ${fmt(loyerHaut)} MAD / mois`],
    ['Rendement locatif brut', rendBrut != null ? `${rendBrut.toFixed(2)} %` : 'N/D'],
    ['Rendement locatif net estimé', rendNet != null ? `${rendNet.toFixed(2)} %` : 'N/D'],
    ['Cash-flow mensuel estimé', cashflow != null ? `${fmt(cashflow)} MAD / mois` : 'N/D'],
    ['Score global d\'investissement', invest.overall_score != null ? `${invest.overall_score.toFixed(1)} / 100` : 'N/D'],
    ['Proximité des services (1 km)', `${geo.pois?.nb_pois_1km ?? 0} lieux référencés (Score Accès: ${acc.score_accessibilite_globale != null ? Math.round(acc.score_accessibilite_globale) : 'N/D'}/100)`],
    ['Distance du centre-ville', fmtDist(distances.distance_centre_ville)],
  ]);

  // ════════════ PAGE 3: ANALYSE DU BIEN (NARRATIF GEMINI) ════════════
  if (data.geminiReport) {
    newPage();
    sectionTitle('02', 'Analyse Détillée du Bien & Rapport IA');
    const rawReport = data.geminiReport as string;
    const lines = rawReport.split('\n');

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) {
        y += 2;
        return;
      }
      if (trimmed.startsWith('# ')) {
        ensure(10);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...terra);
        doc.text(trimmed.slice(2).replace(/\*\*/g, ''), left, y); y += 7;
      } else if (trimmed.startsWith('## ')) {
        ensure(9);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...terra);
        doc.text(trimmed.slice(3).replace(/\*\*/g, ''), left, y); y += 6;
      } else if (trimmed.startsWith('### ')) {
        ensure(8);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...ink);
        doc.text(trimmed.slice(4).replace(/\*\*/g, ''), left, y); y += 5;
      } else if (trimmed.startsWith('- ') || trimmed.match(/^\d+\.\s/)) {
        const clean = trimmed.replace(/^[-\d.]+\s*/, '').replace(/\*\*/g, '');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...ink);
        const wrapped = doc.splitTextToSize(`•  ${clean}`, right - left - 4);
        ensure(wrapped.length * 4.2 + 2);
        doc.text(wrapped, left + 4, y);
        y += wrapped.length * 4.2 + 1.5;
      } else if (!trimmed.startsWith('|')) {
        const clean = trimmed.replace(/\*\*/g, '');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...ink);
        const wrapped = doc.splitTextToSize(clean, right - left);
        ensure(wrapped.length * 4.2 + 2);
        doc.text(wrapped, left, y);
        y += wrapped.length * 4.2 + 1.5;
      }
    });
  }

  // ════════════ PAGE 4: SCORES & ANALYSE SWOT ════════════
  newPage();
  sectionTitle('03', 'Avis sur l’Investissement & Scores Détaillés');
  table(['Composante de la Note', 'Score (0–100)', 'Évaluation'], [
    ['Note Générale d\'Investissement', invest.overall_score != null ? `${invest.overall_score.toFixed(1)} / 100` : 'N/D', invest.decision || 'En cours'],
    ['Score d\'Emplacement & Urbanisme', scores.location_score != null ? `${scores.location_score.toFixed(1)} / 100` : 'N/D', scores.location_score >= 70 ? 'Excellent' : 'Moyen'],
    ['Score de Prix du Marché', scores.market_score != null ? `${scores.market_score.toFixed(1)} / 100` : 'N/D', scores.market_score >= 60 ? 'Compétitif' : 'À négocier'],
    ['Score de Potentiel de Valorisation', scores.investment_score != null ? `${scores.investment_score.toFixed(1)} / 100` : 'N/D', 'Favorable'],
    ['Score d\'Équilibre Budgétaire', scores.financial_score != null ? `${scores.financial_score.toFixed(1)} / 100` : 'N/D', 'Équilibré'],
  ]);

  if (strengths.length || weaknesses.length) {
    ensure(12);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...terra);
    doc.text('Points Forts & Points d\'Attention', left, y); y += 6;

    const maxLen = Math.max(strengths.length, weaknesses.length);
    const pointRows: string[][] = [];
    for (let i = 0; i < maxLen; i++) {
      pointRows.push([
        strengths[i] ? `[✓] ${strengths[i]}` : '—',
        weaknesses[i] ? `[!] ${weaknesses[i]}` : '—'
      ]);
    }
    table(['Points Forts (Opportunités)', 'Points d\'Attention (Alertes)'], pointRows, [87, 87]);
  }

  sectionTitle('04', 'Analyse SWOT Synthétique');
  const swotRows: string[][] = [];
  const maxSwotLen = Math.max(swotStrengths.length, swotWeaknesses.length, swotOpportunities.length, swotThreats.length);
  for (let i = 0; i < maxSwotLen; i++) {
    swotRows.push([
      swotStrengths[i] || '—',
      swotWeaknesses[i] || '—',
      swotOpportunities[i] || '—',
      swotThreats[i] || '—'
    ]);
  }
  table(['Forces', 'Faiblesses', 'Opportunités', 'Menaces'], swotRows, [43.5, 43.5, 43.5, 43.5]);

  // ════════════ PAGE 5: FINANCES & PRIX ESTIMÉS ════════════
  newPage();
  sectionTitle('05', 'Prix et Loyer Estimés (Valorisation & Finances)');
  table(['Paramètre Vente', 'Valeur Estimée'], [
    ['Prix de Vente Médian', `${fmt(prixVal)} MAD`],
    ['Prix au Mètre Carré (m²)', `${fmt(pred.price_per_m2)} MAD / m²`],
    ['Estimation Basse (Prix plancher)', `${fmt(prixBas)} MAD`],
    ['Estimation Haute (Prix plafond)', `${fmt(prixHaut)} MAD`],
  ]);

  table(['Paramètre Location', 'Valeur Estimée'], [
    ['Loyer Mensuel Estimé', `${fmt(loyerVal)} MAD / mois`],
    ['Loyer Bas Estimé', `${fmt(loyerBas)} MAD / mois`],
    ['Loyer Haut Estimé', `${fmt(loyerHaut)} MAD / mois`],
    ['Rendement Locatif Brut', rendBrut != null ? `${rendBrut.toFixed(2)} %` : 'N/D'],
    ['Rendement Locatif Net', rendNet != null ? `${rendNet.toFixed(2)} %` : 'N/D'],
    ['Cash-Flow Mensuel Estimé', cashflow != null ? `${fmt(cashflow)} MAD / mois` : 'N/D'],
  ]);

  if (form.financing?.enabled) {
    const loan = calculateLoan(form.financing, prixVal, loyerVal);
    sectionTitle('06', 'Étude de Crédit Immobilier');
    table(['Indicateur', 'Simulation personnalisée'], [
      ['Prix prédit par le modèle', `${fmt(loan.price)} MAD`],
      ['Frais d’acquisition retenus', `${fmt(loan.notaryFees)} MAD`],
      ['Coût total du projet', `${fmt(loan.totalProjectCost)} MAD`],
      ['Apport personnel', `${fmt(loan.downPayment)} MAD`],
      ['Montant emprunté (frais inclus)', `${fmt(loan.principal)} MAD`],
      ['Mensualité estimée', `${fmt(loan.monthlyPayment)} MAD`],
      ['Coût total du crédit', `${fmt(loan.creditCost)} MAD`],
      ['Capital remboursé sur 12 mois', `${fmt(loan.firstYearPrincipal)} MAD`],
      ['Intérêts estimés sur 12 mois', `${fmt(loan.firstYearInterest)} MAD`],
      ['Solde estimé après 12 mois', `${fmt(loan.remainingAfterYearOne)} MAD`],
      ['Cash-flow locatif après dette', `${fmt(loan.cashflow)} MAD / mois`],
      ['Taux d’endettement', loan.debtRatio == null ? 'Revenu non renseigné' : `${loan.debtRatio.toFixed(1)} %`],
    ]);
    paragraph('Repère indicatif : le taux moyen des crédits immobiliers publié par Bank Al-Maghrib était de 5,13 % au T2 2025. Cette simulation ne remplace pas l’offre de la banque : assurance, garanties et frais peuvent modifier le coût réel.');
  }

  // ════════════ PAGE 6: GEOGRAPHIE & PROXIMITÉ OSM ════════════
  sectionTitle(form.financing?.enabled ? '07' : '06', 'Quartier et Services Proches (Analyse OSM & Risques)');
  paragraph('L\'analyse géospatiale basée sur OpenStreetMap fournit les distances exactes aux commodités clés et évalue les éventuelles contraintes environnementales.');

  table(['Commodité / Service', 'Distance à pied / route'], [
    ['Centre-ville (Jemaa el-Fna / Guéliz)', fmtDist(distances.distance_centre_ville)],
    ['Hôpital le plus proche', fmtDist(distances.distance_nearest_hospital)],
    ['École / Établissement scolaire', fmtDist(distances.distance_nearest_school)],
    ['Supermarché / Commerce', fmtDist(distances.distance_nearest_supermarket)],
    ['Banque / Distributeur', fmtDist(distances.distance_nearest_bank)],
    ['Arrêt de transport en commun', fmtDist(distances.distance_nearest_bus_stop)],
    ['Poste de Police / Pompiers', fmtDist(distances.dist_security_m)],
  ]);

  table(['Facteur de Risque Environnemental', 'Distance Mesurée', 'Statut / Recommandation'], [
    ['Zone Industrielle', fmtDist(distances.dist_industrial_m), distances.dist_industrial_m != null && distances.dist_industrial_m < 2000 ? 'Attention : Contrôle visuel recommandé' : 'Conforme'],
    ['Barrage / Zone Inondable', fmtDist(distances.dist_dam_m), distances.dist_dam_m != null && distances.dist_dam_m < 3000 ? 'À vérifier lors des visites' : 'Conforme'],
  ], [65, 45, 64]);

  table(['Catégorie de Service (Rayon 1 km)', 'Nombre de Lieux Repérés'], [
    ['Établissements de Santé (Cliniques, Pharmacies)', String(counts.sante ?? 0)],
    ['Éducation (Écoles, Universités)', String(counts.education ?? 0)],
    ['Transports (Arrêts, Gares)', String(counts.transport ?? 0)],
    ['Commerces & Supermarchés', String(counts.commerces ?? 0)],
    ['Loisirs & Espaces Verts', String(counts.loisirs ?? 0)],
    ['Services Financiers & Publics', String(counts.services ?? 0)],
    ['Lieux de Culte', String(counts.religieux ?? 0)],
    ['Total des POIs à 1 km', String(geo.pois?.nb_pois_1km ?? 0)],
  ]);

  // ════════════ PAGE 7: METHODOLOGIE & RECOMMANDATIONS ════════════
  newPage();
  sectionTitle('07', 'Informations Utiles & Recommandations de Négociation');
  paragraph(
    'Avant de finaliser toute transaction immobilière, nous recommandons vivement de procéder aux contrôles suivants :\n' +
    '1. Titre Foncier & Urbanisme : Vérifiez le certificat de propriété auprès de la Conservation Foncière et l\'extrait de plan d\'aménagement.\n' +
    '2. Audit Technique : Inspectez la structure, la plomberie, l\'électricité et la conformité des surfaces habitables.\n' +
    '3. Analyse Financière : Négociez une marge de sécurité de 5% à 10% sur le prix de vente estimé en vous appuyant sur l\'estimation basse.\n' +
    '4. Gestion Locative : Pour les biens destinés à la location, prévoyez une réserve de vacance locative d\'au moins 1 mois par an.'
  );

  table(['Source de Donnée', 'Méthode d\'Analyse / Modèle'], [
    ['Estimation Prix Vente', 'Modèle XGBoost / Random Forest entraîné sur le marché de Marrakech'],
    ['Estimation Loyer', 'Régression quantile ajustée selon le secteur géographique'],
    ['Points d\'Intérêt & Distances', 'OpenStreetMap Overpass API (Temps réel)'],
    ['Rapport & Synthèse IA', 'Moteur Orchid Island AI / Gemini Deep Intelligence'],
  ]);

  footer();
  doc.save(`OrchidIsland_Rapport_Complet_${form.neighbourhood || 'Marrakech'}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Sommaire du document ────────────────────────────────────────────────
// Un rapport institutionnel s'ouvre toujours sur une table des matières :
// elle fixe la structure et permet un repérage rapide, y compris à l'impression.
function TableOfContents({ dossierId, financingEnabled }: { dossierId: string; financingEnabled: boolean }) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <div className="report-toc" style={{ background: C.mist, padding: '1.75rem 2.5rem', borderBottom: `1px solid ${C.sandLight}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.terra }}>Sommaire</div>
        <div style={{ fontSize: '0.72rem', color: C.inkMuted }}>Dossier n° {dossierId}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', columnGap: 24 }}>
        {TOC.filter(item => financingEnabled || item.id !== 'sec-financement').map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => scrollTo(item.id)}
            className="report-toc-link"
            style={{
              display: 'flex', alignItems: 'baseline', gap: 10, width: '100%',
              padding: '7px 0', background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'left', borderBottom: `1px dotted ${C.sand}`,
            }}
          >
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '0.85rem', color: C.terra, flexShrink: 0, width: 22 }}>{String(index + 1).padStart(2, '0')}</span>
            <span style={{ fontSize: '0.85rem', color: C.inkSoft, fontWeight: 500, flex: 1 }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Synthèse exécutive ──────────────────────────────────────────────────
// La partie la plus lue d'un rapport de due diligence : un décideur doit
// pouvoir se forger un avis en 30 secondes, avant de lire le détail.
function ExecutiveSummary({ data }: { data: any }) {
  const invest  = data.investment || {};
  const geo     = data.geo || {};
  const input   = data.input || {};
  const scores  = invest.investment_scores || {};
  const fin     = invest.financial_report || {};
  const acc     = geo.accessibility_scores_0_100 || {};

  const rendNet = fin.yield?.net_yield_pct;
  const risk    = scores.overall_risk_level || 'MODÉRÉ';
  const decision = invest.decision || 'ANALYSE EN COURS';

  return (
    <SectionCard id="sec-synthese" number="01" title="À retenir" icon={ClipboardList} accent>
      <p style={{ fontSize: '0.92rem', lineHeight: 1.75, color: C.inkSoft, margin: '0 0 1.25rem' }}>
        Ce {input.propertyType?.toLowerCase() || 'bien'} de {input.surface ?? 'N/D'} m² se situe à {input.neighbourhood || input.city}, Marrakech.
        Son intérêt pour un investissement est évalué à{' '}
        <strong style={{ color: C.terra }}>{invest.overall_score != null ? `${invest.overall_score.toFixed(1)}/100` : 'N/D'}</strong>.
        Le risque est <strong>{risk.toLowerCase()}</strong> et le rendement locatif net estimé est de{' '}
        <strong style={{ color: C.terra }}>{rendNet != null ? `${rendNet.toFixed(2)}%` : 'N/D'}</strong>.
        Le quartier obtient {acc.score_accessibilite_globale != null ? `${Math.round(acc.score_accessibilite_globale)}/100` : 'N/D'} pour la proximité des services du quotidien.
        Voici l’avis général :
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '14px 18px', background: C.mist, borderRadius: 12, border: `1px solid ${C.sandLight}` }}>
        <DecisionBadge decision={decision} />
        <span style={{ fontSize: '0.8rem', color: C.inkMuted }}>Niveau de risque :</span>
        <RiskBadge level={risk} />
        <span style={{ fontSize: '0.8rem', color: C.inkMuted, marginLeft: 'auto' }}>
          Voir les détails dans les sections suivantes
        </span>
      </div>
    </SectionCard>
  );
}

// ── Méthodologie & certification ───────────────────────────────────────
// Une section que l'on retrouve systématiquement dans les rapports d'expertise
// des grandes foncières : sources, limites de l'analyse, et cachet de conformité.
function MethodologyAndCertification({ data }: { data: any }) {
  const osmLive = data.geo?.pois?.overpass_success !== false;
  return (
    <SectionCard id="sec-methodo" number={data.input?.financing?.enabled ? '08' : '07'} title="Informations utiles" icon={ShieldCheck}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.terra, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>D’où viennent les informations ?</div>
          <DataRow label="Prix de vente" value="Estimation à partir de données du marché" />
          <DataRow label="Loyer" value="Estimation à partir de locations comparables" />
          <DataRow label="Quartier et services" value={osmLive ? 'Carte OpenStreetMap' : 'Estimation temporaire'} />
          <DataRow label="Texte du rapport" value="Analyse automatique, relue par vos soins" />
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.terra, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>À garder en tête</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Info size={14} color={C.inkMuted} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: '0.8rem', color: C.inkSoft }}>Les montants sont des estimations. Une visite et une vérification des documents du bien restent nécessaires avant tout achat.</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Info size={14} color={C.inkMuted} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: '0.8rem', color: C.inkSoft }}>Les distances et les services affichés dépendent des informations présentes sur la carte au moment du rapport.</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, paddingTop: '1rem', borderTop: `1px solid ${C.sandLight}` }}>
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.inkMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Document généré par</div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1rem', color: C.ink }}>Orchid Island — Intelligence Immobilière</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.inkMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Statut</div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: C.successBg, color: C.success, borderRadius: 999, fontSize: '0.78rem', fontWeight: 700 }}>
            <CheckCircle2 size={13} /> Rapport généré et vérifié
          </span>
        </div>
      </div>
      <p style={{ fontSize: '0.74rem', color: C.inkMuted, lineHeight: 1.6, marginTop: '1rem', marginBottom: 0 }}>
        Ce document constitue une analyse indicative produite par des modèles de machine learning et ne saurait se substituer à une expertise
        immobilière agréée, une étude de titre foncier ou un avis juridique. Orchid Island décline toute responsabilité quant aux décisions
        d'investissement prises sur la seule base de ce rapport.
      </p>
    </SectionCard>
  );
}

function ReportViewer({ data }: { data: any }) {
  const pred   = data.prediction || {};
  const loc    = data.location   || {};
  const invest = data.investment  || {};
  const geo    = data.geo        || {};
  const input  = data.input      || {};
  const scores = invest.investment_scores || {};
  const fin    = invest.financial_report  || {};
  const acc    = geo.accessibility_scores_0_100 || {};
  const d      = geo.distances_m || {};
  const counts = geo.pois?.counts_by_category || {};

  const dossierId  = data.rapportId?.toString().slice(-8) || '2026-ML';

  const prixVal    = pred.predicted_price;
  const prixBas    = pred.confidence_range?.low  ?? (prixVal ? prixVal * 0.90 : null);
  const prixHaut   = pred.confidence_range?.high ?? (prixVal ? prixVal * 1.10 : null);
  const loyerVal   = loc.predicted_price;
  const loyerBas   = loc.confidence_range?.low   ?? loc.quantile_low  ?? (loyerVal ? loyerVal * 0.85 : null);
  const loyerHaut  = loc.confidence_range?.high  ?? loc.quantile_high ?? (loyerVal ? loyerVal * 1.15 : null);
  const rendBrut   = fin.yield?.gross_yield_pct;
  const rendNet    = fin.yield?.net_yield_pct;
  const cashflow   = fin.financing_cashflow?.monthly_cash_flow;
  const strengths  = scores.explanation?.strengths?.slice(0,5) || [];
  const weaknesses = scores.explanation?.weaknesses?.slice(0,5) || [];
  const swotStrengths = strengths.length ? strengths : [scores.location_score != null && scores.location_score >= 70 ? 'Bon emplacement selon les services disponibles.' : 'Les informations du bien sont disponibles pour l’analyse.'];
  const swotWeaknesses = weaknesses.length ? weaknesses : [scores.market_score != null && scores.market_score < 50 ? 'Le positionnement sur le marché demande une attention particulière.' : 'Prévoir une visite complète avant la décision.'];
  const swotOpportunities = [
    rendNet != null ? `Rendement net estimé à ${rendNet.toFixed(2)} %.` : 'Possibilité de préciser la stratégie de location après visite.',
    loyerVal != null ? `Loyer mensuel estimé autour de ${fmt(loyerVal)} MAD.` : 'Le potentiel locatif doit être confirmé avec le marché local.',
  ];
  const swotThreats = [
    scores.overall_risk_level ? `Niveau de risque annoncé : ${scores.overall_risk_level.toLowerCase()}.` : 'Vérifier les risques propres au bien et au quartier.',
    d.dist_industrial_m != null && d.dist_industrial_m < 2000 ? `Zone industrielle à ${fmtDist(d.dist_industrial_m)} : à contrôler lors de la visite.` : 'Vérifier les documents, les charges et l’état technique du bien.',
  ];

  return (
    <div className="professional-report" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── Couverture document ───────────────────────────────────── */}
      <div className="report-cover" style={{
        background: `linear-gradient(145deg, ${C.terraDeep} 0%, ${C.terra} 60%, ${C.gold} 100%)`,
        borderRadius: '18px 18px 0 0', padding: '2.5rem 2.5rem 2rem',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.06, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect x='10' y='10' width='20' height='20' fill='none' stroke='%23fff' stroke-width='0.5'/%3E%3Ccircle cx='20' cy='20' r='1.5' fill='%23fff'/%3E%3C/svg%3E\")", backgroundSize: '40px 40px', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', marginBottom: 8 }}>
              Orchid Island — Intelligence Immobilière
            </div>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: C.paper, margin: 0, lineHeight: 1.15 }}>
              Rapport immobilier simplifié
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.88rem', marginTop: 6 }}>
              {input.propertyType} · {input.neighbourhood || input.city} · {input.surface} m²
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', flexShrink: 0 }}>
            <div>Date : <strong style={{ color: C.paper }}>{new Date().toLocaleDateString('fr-FR')}</strong></div>
            <div style={{ marginTop: 4 }}>Dossier : <strong style={{ color: C.paper }}>#{dossierId}</strong></div>
            <div style={{ marginTop: 4 }}>Coordonnées : <strong style={{ color: C.paper }}>{input.latitude?.toFixed(4)}, {input.longitude?.toFixed(4)}</strong></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 22, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.2)', position: 'relative', flexWrap: 'wrap' }}>
          {[
            { label: 'Préparé pour', value: 'Investisseur privé' },
            { label: 'Préparé par', value: 'Orchid Island · Analyse ML' },
            { label: 'Classification', value: 'Confidentiel — Usage interne' },
          ].map(({ label, value }) => (
            <div key={label} style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.85)' }}>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
              <div style={{ fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sommaire ──────────────────────────────────────────────── */}
      <TableOfContents dossierId={dossierId} financingEnabled={Boolean(input.financing?.enabled)} />

      {/* ── KPIs Synthétiques ─────────────────────────────────────── */}
      <div style={{ background: C.mist, padding: '1.75rem', borderLeft: `4px solid ${C.terra}`, marginBottom: 4 }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.terra, marginBottom: 14 }}>Indicateurs clés</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <KpiCard label="Prix de vente estimé" icon={TrendingUp} value={prixVal ? `${fmt(prixVal)} MAD` : 'N/D'} sub={`Entre ${fmt(prixBas)} et ${fmt(prixHaut)} MAD`} accent />
          <KpiCard label="Loyer mensuel estimé" icon={Landmark} value={loyerVal ? `${fmt(loyerVal)} MAD/mois` : 'N/D'} sub={`Entre ${fmt(loyerBas)} et ${fmt(loyerHaut)} MAD/mois`} />
          <KpiCard label="Rendement locatif" icon={BarChart3} value={rendBrut != null ? `${rendBrut.toFixed(2)}%` : 'N/D'} sub={`Après charges estimées : ${rendNet != null ? rendNet.toFixed(2)+'%' : 'N/D'}`} />
          <KpiCard label="Intérêt pour investir" icon={Target} value={invest.overall_score != null ? `${invest.overall_score.toFixed(1)}/100` : 'N/D'} sub={`Solde mensuel estimé : ${cashflow != null ? fmt(cashflow)+' MAD' : 'N/D'}`} />
          <KpiCard label="Services proches (1 km)" icon={MapIcon} value={String(geo.pois?.nb_pois_1km ?? 0)} sub={`Écoles, commerces, santé… · Proximité : ${acc.score_accessibilite_globale != null ? Math.round(acc.score_accessibilite_globale)+'/100' : 'N/D'}`} />
          <KpiCard label="Distance du centre" icon={Navigation} value={fmtDist(d.distance_centre_ville)} sub="Jemaa el-Fna / Guéliz" />
        </div>
      </div>

      {/* ── Corps du rapport ─────────────────────────────────────────*/}
      <div style={{ background: C.paper, padding: '2rem 2.5rem', borderRadius: '0 0 18px 18px', border: `1px solid ${C.sandLight}`, borderTop: 'none' }}>

        {/* Section 01 — Synthèse exécutive */}
        <ExecutiveSummary data={data} />

        {/* Section 02 — Synthèse narrative Gemini */}
        {data.geminiReport && (
          <SectionCard id="sec-narratif" number="02" title="Analyse du bien" icon={Sparkles} accent>
            <div style={{
              lineHeight: 1.8, color: C.inkSoft, fontSize: '0.88rem',
              fontFamily: 'system-ui, sans-serif',
            }}>
              {data.geminiReport.split('\n').map((line: string, i: number, lines: string[]) => {
                if (line.startsWith('# '))    return <h2 key={i} style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.3rem', color: C.ink, margin: '1.5rem 0 0.5rem', borderBottom: `2px solid ${C.sandLight}`, paddingBottom: 8 }}>{line.slice(2)}</h2>;
                if (line.startsWith('## '))   return <h3 key={i} style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.05rem', color: C.terra, margin: '1.2rem 0 0.4rem', display: 'flex', alignItems: 'center', gap: 6 }}>{line.slice(3)}</h3>;
                if (line.startsWith('### '))  return <h4 key={i} style={{ fontSize: '0.88rem', fontWeight: 700, color: C.inkSoft, margin: '0.8rem 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{line.slice(4)}</h4>;
                if (line.startsWith('---'))   return <hr key={i} style={{ border: 'none', borderTop: `1px solid ${C.sandLight}`, margin: '1.25rem 0' }} />;
                if (line.startsWith('| ')) {
                  const cells = line.split('|').filter(c => c.trim() !== '');
                  const isSep = cells.every(c => /^[-:]+$/.test(c.trim()));
                  const isHeader = /^\|\s*[-:]+/.test(lines[i + 1] || '');
                  if (isSep) return null;
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: `repeat(${cells.length}, 1fr)`, gap: 1, marginBottom: 1, background: C.sandLight }}>
                      {cells.map((c, j) => (
                        <div key={j} style={{ padding: '6px 12px', background: isHeader ? C.inkSoft : (i % 2 === 0 ? C.paper : C.mist), fontSize: '0.8rem', fontWeight: isHeader ? 700 : 400, color: isHeader ? C.paper : C.inkSoft }}>{c.trim().replace(/\*\*/g, '')}</div>
                      ))}
                    </div>
                  );
                }
                const bold = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                if (line.startsWith('- ') || line.match(/^\d+\.\s/)) return <div key={i} style={{ paddingLeft: 16, marginBottom: 4, position: 'relative', color: C.inkSoft }} dangerouslySetInnerHTML={{ __html: `<span style="position:absolute;left:0;color:${C.terra}">•</span> ${bold.replace(/^[-\d.]+\s/, '')}` }} />;
                if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
                return <p key={i} style={{ margin: '0 0 4px', color: C.inkSoft }} dangerouslySetInnerHTML={{ __html: bold }} />;
              }).filter(Boolean)}
            </div>
          </SectionCard>
        )}

        {/* Section 03 — Scoring visuel */}
        <SectionCard id="sec-scoring" number="03" title="Avis sur l’investissement" icon={BarChart3}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: '0.88rem', color: C.inkMuted }}>Avis général</span>
                <DecisionBadge decision={invest.decision} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: '0.88rem', color: C.inkMuted }}>Niveau de risque</span>
                <RiskBadge level={scores.overall_risk_level} />
              </div>
              <AccessibilityRow label="Note générale" value={invest.overall_score} />
              <AccessibilityRow label="Emplacement" value={scores.location_score} />
              <AccessibilityRow label="Prix du marché" value={scores.market_score} />
              <AccessibilityRow label="Potentiel" value={scores.investment_score} />
              <AccessibilityRow label="Budget" value={scores.financial_score} />
            </div>
            <div>
              {strengths.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.success, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Points Forts</div>
                  {strengths.map((s: string, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <CheckCircle2 size={14} color={C.success} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: '0.8rem', color: C.inkSoft }}>{s}</span>
                    </div>
                  ))}
                </div>
              )}
              {weaknesses.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.danger, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Points d'Attention</div>
                  {weaknesses.map((w: string, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <AlertCircle size={14} color={C.warning} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: '0.8rem', color: C.inkSoft }}>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard id="sec-swot" number="04" title="Analyse SWOT" icon={Target}>
          <p style={{ fontSize: '0.84rem', color: C.inkSoft, lineHeight: 1.6, margin: '0 0 8px' }}>
            Cette analyse résume les éléments positifs, les limites, les opportunités et les risques à prendre en compte avant votre décision.
          </p>
          <ReportTable
            headers={['Forces', 'Faiblesses']}
            rows={Array.from({ length: Math.max(swotStrengths.length, swotWeaknesses.length) }, (_, i) => [swotStrengths[i] || '—', swotWeaknesses[i] || '—'])}
          />
          <ReportTable
            headers={['Opportunités', 'Menaces / risques']}
            rows={Array.from({ length: Math.max(swotOpportunities.length, swotThreats.length) }, (_, i) => [swotOpportunities[i] || '—', swotThreats[i] || '—'])}
          />
        </SectionCard>

        {/* Section 05 — Données financières */}
        <div id="sec-marche" style={{ scrollMarginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: '0.75rem' }}>
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '0.95rem', color: C.sand }}>05</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: C.inkMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Prix et loyer estimés</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <SectionCard title="Prix de vente" icon={TrendingUp}>
              <DataRow label="Estimation centrale" value={`${fmt(prixVal)} MAD`} highlight />
              <DataRow label="Estimation basse" value={`${fmt(prixBas)} MAD`} />
              <DataRow label="Estimation haute" value={`${fmt(prixHaut)} MAD`} />
              <DataRow label="Prix au m²"              value={`${fmt(pred.price_per_m2)} MAD/m²`} />
            </SectionCard>
            <SectionCard title="Location" icon={Landmark}>
              <DataRow label="Loyer mensuel estimé" value={`${fmt(loyerVal)} MAD/mois`} highlight />
              <DataRow label="Estimation basse" value={`${fmt(loyerBas)} MAD/mois`} />
              <DataRow label="Estimation haute" value={`${fmt(loyerHaut)} MAD/mois`} />
              <DataRow label="Rendement brut"          value={rendBrut != null ? `${rendBrut.toFixed(2)}%` : 'N/D'} />
              <DataRow label="Rendement net"           value={rendNet  != null ? `${rendNet.toFixed(2)}%`  : 'N/D'} />
              <DataRow label="Cash-flow mensuel"       value={cashflow != null ? `${fmt(cashflow)} MAD` : 'N/D'} highlight />
            </SectionCard>
          </div>
        </div>

        <CreditStudy data={data} />

        {/* Section 07 — Distances OSM */}
        <SectionCard id="sec-geo" number={input.financing?.enabled ? '07' : '06'} title="Quartier et services proches" icon={MapIcon}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <ReportLocationMap lat={input.latitude} lng={input.longitude} />
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.terra, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Temps et distances utiles</div>
              <p style={{ fontSize: '0.78rem', color: C.inkMuted, lineHeight: 1.5, margin: '0 0 8px' }}>Ces distances aident à comprendre ce qui est facilement accessible depuis le bien.</p>
              <ReportTable headers={['Service', 'Distance']} rows={[
                ['Centre-ville (Jemaa el-Fna)', fmtDist(d.distance_centre_ville)],
                ['Hôpital le plus proche', fmtDist(d.distance_nearest_hospital)],
                ['École la plus proche', fmtDist(d.distance_nearest_school)],
                ['Supermarché le plus proche', fmtDist(d.distance_nearest_supermarket)],
                ['Banque / distributeur', fmtDist(d.distance_nearest_bank)],
                ['Arrêt de transport', fmtDist(d.distance_nearest_bus_stop)],
                ['Police / pompiers', fmtDist(d.dist_security_m)],
              ]} />
              <div style={{ marginTop: 12, padding: '10px 12px', background: C.dangerBg, borderRadius: 10, border: `1px solid rgba(196,32,32,0.15)` }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C.danger, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Facteurs de Risque Environnemental</div>
                <ReportTable headers={['Élément à vérifier', 'Distance']} rows={[
                  ['Zone industrielle', fmtDist(d.dist_industrial_m)],
                  ['Barrage / ouvrage hydraulique', fmtDist(d.dist_dam_m)],
                ]} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.terra, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Services dans un rayon de 1 km</div>
              <p style={{ fontSize: '0.78rem', color: C.inkMuted, lineHeight: 1.5, margin: '0 0 10px' }}>Il s’agit des lieux utiles repérés autour du bien : santé, écoles, transports, commerces et loisirs.</p>
              <ReportTable headers={['Type de service', 'Nombre repéré']} rows={[
                ['Santé', String(counts.sante ?? 0)],
                ['Écoles et éducation', String(counts.education ?? 0)],
                ['Transport', String(counts.transport ?? 0)],
                ['Commerces', String(counts.commerces ?? 0)],
                ['Loisirs', String(counts.loisirs ?? 0)],
                ['Autres services', String(counts.services ?? 0)],
                ['Lieux de culte', String(counts.religieux ?? 0)],
                ['Total', String(geo.pois?.nb_pois_1km ?? 0)],
              ]} />
              <div style={{ display: 'none' }}>
                {[
                  { label: 'Santé',     count: counts.sante,     icon: '🏥' },
                  { label: 'Éducation', count: counts.education,  icon: '🎓' },
                  { label: 'Transport', count: counts.transport,   icon: '🚌' },
                  { label: 'Commerces', count: counts.commerces,   icon: '🛒' },
                  { label: 'Loisirs',   count: counts.loisirs,    icon: '🎭' },
                  { label: 'Services',  count: counts.services,    icon: '🏦' },
                  { label: 'Religieux', count: counts.religieux,   icon: '🕌' },
                ].map(({ label, count }) => (
                  <div key={label} style={{ background: C.paper, border: `1px solid ${C.sandLight}`, borderRadius: 8, padding: '9px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: C.inkSoft }}>{label}</span>
                    <strong style={{ fontSize: '0.88rem', color: C.terra }}>{count ?? 0}</strong>
                  </div>
                ))}
                <div style={{ background: C.mist, borderRadius: 10, padding: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: C.inkMuted, fontWeight: 500 }}>Total des services</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: C.terra }}>{geo.pois?.nb_pois_1km ?? 0}</div>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.terra, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Facilité d’accès aux services</div>
              <p style={{ fontSize: '0.78rem', color: C.inkMuted, lineHeight: 1.5, margin: '0 0 8px' }}>Plus la note est élevée, plus ce service est facile à trouver à proximité.</p>
              <ReportTable headers={['Service', 'Note sur 100']} rows={[
                ['Note générale', acc.score_accessibilite_globale != null ? `${Math.round(acc.score_accessibilite_globale)}/100` : 'N/D'],
                ['Santé', acc.score_accessibilite_sante != null ? `${Math.round(acc.score_accessibilite_sante)}/100` : 'N/D'],
                ['Éducation', acc.score_accessibilite_education != null ? `${Math.round(acc.score_accessibilite_education)}/100` : 'N/D'],
                ['Transport', acc.score_accessibilite_transport != null ? `${Math.round(acc.score_accessibilite_transport)}/100` : 'N/D'],
                ['Commerces', acc.score_accessibilite_commerces != null ? `${Math.round(acc.score_accessibilite_commerces)}/100` : 'N/D'],
                ['Loisirs', acc.score_accessibilite_loisirs != null ? `${Math.round(acc.score_accessibilite_loisirs)}/100` : 'N/D'],
              ]} />
            </div>
          </div>
        </SectionCard>

        {/* Section 06 — Méthodologie & certification */}
        <MethodologyAndCertification data={data} />

        {/* Footer */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: `1px solid ${C.sandLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: '0.72rem', color: C.inkMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={13} /> Document confidentiel — Dossier n° {dossierId} — Reproduction interdite sans autorisation.
          </div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C.terra, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Orchid Island — Due Diligence · {new Date().toLocaleDateString('fr-FR')}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem 1rem', borderRadius: 12,
  border: `1px solid ${C.sand}`, background: C.mist, fontSize: '0.9rem', color: C.ink,
  outline: 'none', fontFamily: 'inherit',
};

export default function RapportPage() {
  const currentUser = useAuthStore((s) => s.user);
  const addHistory  = useHistoryStore((s) => s.addEntry);
  const reportRef   = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    propertyType: 'Appartement', city: 'Marrakech', neighbourhood: 'Guéliz',
    address: '', surface: '110', surfaceHabitable: '100',
    rooms: '4', bedrooms: '2', bathrooms: '2', salons: '1', floor: '2',
    latitude: 31.6295, longitude: -7.9811,
    equipment: ['climatisation', 'parking', 'cuisine_equipee'] as string[],
    financing: {
      enabled: false, downPayment: '', durationYears: '20',
      interestRate: String(MOROCCO_CREDIT_RULES.bamAverageRate), insuranceRate: String(MOROCCO_CREDIT_RULES.insuranceRatePct), notaryFeesPct: String(MOROCCO_CREDIT_RULES.acquisitionFeesPct),
      monthlyIncome: '', monthlyCharges: '',
    },
  });

  const [isLoading,    setIsLoading]    = useState(false);
  const [loadingStep,  setLoadingStep]  = useState(0);
  const [reportData,   setReportData]   = useState<any>(null);
  const [error,        setError]        = useState<string | null>(null);

  // Zoom de recentrage souhaité (ville → 12, quartier → 15) — cf. page d'estimation.
  const [recenterZoom, setRecenterZoom] = useState<number | undefined>(undefined);
  // Zones découvertes dynamiquement via clic carte (hors fichier statique).
  const [extraCommunes, setExtraCommunes] = useState<string[]>([]);
  const [extraQuartiers, setExtraQuartiers] = useState<Record<string, string[]>>({});

  // Selects : fichier statique (toute la région Marrakech-Safi) enrichi par les
  // zones découvertes au clic carte → dédoublonné (une seule version par nom)
  // et trié alphabétiquement.
  const communes = useMemo(
    () => dedupeZones([...getCommuneNames(), ...extraCommunes]),
    [extraCommunes]
  );
  const quartiers = useMemo(() => {
    if (!form.city) return [] as string[];
    return dedupeZones([
      ...getQuartiersOf(form.city).map((q) => q.name),
      ...(extraQuartiers[form.city] ?? []),
    ]);
  }, [form.city, extraQuartiers]);

  // ── Ville sélectionnée → recentre la carte (mêmes sources que l'estimation :
  //    centre réel dataset vente → dataset location → centre statique) ──────
  const handleCityChange = async (commune: string) => {
    if (!commune) {
      setForm(p => ({ ...p, city: '', neighbourhood: '' }));
      return;
    }
    // Premier quartier canonique (tri A→Z) sélectionné automatiquement :
    // garantit un couple ville/quartier cohérent pour les 3 modèles.
    const firstQuartier = dedupeZones(getQuartiersOf(commune).map((q) => q.name))[0] ?? '';
    setForm(p => ({ ...p, city: commune, neighbourhood: firstQuartier }));

    const staticCenter = findCommune(commune);
    if (staticCenter) {
      setRecenterZoom(12);
      setForm(p => ({ ...p, latitude: staticCenter.lat, longitude: staticCenter.lng }));
    }
    try {
      const center = await fetchSaleCommuneCenter(commune);
      if (center.lat != null && center.lng != null) {
        setRecenterZoom(12);
        setForm(p => ({ ...p, latitude: center.lat as number, longitude: center.lng as number }));
        return;
      }
    } catch { /* on tente le dataset location */ }
    try {
      const center = await fetchCommuneCenter(commune);
      if (center.lat != null && center.lng != null) {
        setRecenterZoom(12);
        setForm(p => ({ ...p, latitude: center.lat as number, longitude: center.lng as number }));
      }
    } catch {
      if (!staticCenter) setError('Impossible de centrer la carte sur cette ville.');
    }
  };

  // ── Quartier sélectionné → zoom sur son centre réel (vente → location →
  //    statique → centre de la commune), zoom 15 ─────────────────────────────
  const handleQuartierChange = async (quartier: string) => {
    if (!quartier) return;
    setForm(p => ({ ...p, neighbourhood: quartier }));
    const city = form.city;
    try {
      const center = await fetchSaleQuartierCenter(city, quartier);
      if (center.lat != null && center.lng != null) {
        setRecenterZoom(15);
        setForm(p => ({ ...p, latitude: center.lat as number, longitude: center.lng as number }));
        return;
      }
    } catch { /* fallback dataset location */ }
    try {
      const center = await fetchQuartierCenter(city, quartier);
      if (center.lat != null && center.lng != null) {
        setRecenterZoom(15);
        setForm(p => ({ ...p, latitude: center.lat as number, longitude: center.lng as number }));
        return;
      }
    } catch { /* fallback statique */ }
    const q = findQuartier(city, quartier);
    const c = findCommune(city || '');
    if (q && q.lat != null && q.lng != null) {
      setRecenterZoom(15);
      setForm(p => ({ ...p, latitude: q.lat as number, longitude: q.lng as number }));
    } else if (c) {
      setRecenterZoom(13);
      setForm(p => ({ ...p, latitude: c.lat, longitude: c.lng }));
    }
  };

  // ── Clic carte → coordonnées + auto-remplissage ville / quartier / adresse.
  //    Même résolution serveur (`resolveLocation`) que la page d'estimation :
  //    les noms obtenus sont identiques → cohérence garantie pour les 3 modèles.
  const handleMapClick = async (lat: number, lng: number) => {
    setRecenterZoom(undefined);
    setForm(p => ({ ...p, latitude: lat, longitude: lng }));
    reverseGeocode(lat, lng).then((addr) => { if (addr) setForm(p => ({ ...p, address: addr })); });
    try {
      const res = await resolveLocation(lat, lng);
      if (res.commune_officielle) {
        const commune = res.commune_officielle;
        setExtraCommunes(prev =>
          prev.includes(commune) || findCommune(commune) ? prev : [...prev, commune]
        );
        const quartier = res.quartier;
        if (quartier) {
          setExtraQuartiers(prev => {
            const list = prev[commune] ?? [];
            if (list.includes(quartier) || findQuartier(commune, quartier)) return prev;
            return { ...prev, [commune]: [...list, quartier] };
          });
        }
        setForm(p => ({
          ...p,
          city: commune,
          neighbourhood: quartier ?? p.neighbourhood,
        }));
      } else if (res.quartier) {
        setForm(p => ({ ...p, neighbourhood: res.quartier as string }));
      }
    } catch { /* résolution indisponible : on garde la sélection */ }
  };

  const toggleEquipment = (key: string) => {
    setForm(prev => ({
      ...prev,
      equipment: prev.equipment.includes(key) ? prev.equipment.filter(k => k !== key) : [...prev.equipment, key],
    }));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.city || !form.neighbourhood) {
      setError('Sélectionnez la ville et le quartier (ou cliquez sur la carte) avant de générer le rapport.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setLoadingStep(0);

    const intervals = STEPS.map((_, i) => setTimeout(() => setLoadingStep(i), i * 1400));

    try {
      const res = await axiosInstance.post('/rapport/generate', {
        ...form,
        surface: parseFloat(form.surface),
        surfaceHabitable: parseFloat(form.surfaceHabitable),
        rooms: parseInt(form.rooms),
        bedrooms: parseInt(form.bedrooms),
        bathrooms: parseInt(form.bathrooms),
        salons: parseInt(form.salons),
        floor: form.floor,
        totalPieces: parseInt(form.rooms),
        etages: parseInt(form.floor) || 0,
        etagueSemantique: parseInt(form.floor) > 0 ? 'etage_situation' : 'rez_de_chaussee',
        quartier: form.neighbourhood,
        commune: form.city,
      });
      intervals.forEach(clearTimeout);
      setReportData(res.data);

      if (currentUser) {
        addHistory({
          type: 'rapport',
          label: `Due Diligence — ${form.propertyType} ${form.surface}m² · ${form.neighbourhood}`,
          user: { id: currentUser._id, firstName: currentUser.firstName, lastName: currentUser.lastName, email: currentUser.email },
          details: { sections: ['Synthèse Exécutive', 'Analyse Experte', 'Scoring', 'Valeur Marché', 'Géospatial OSM', 'Méthodologie'] },
        });
      }
    } catch (err: any) {
      intervals.forEach(clearTimeout);
      if (err.code === 'ERR_NETWORK') setError("Erreur connexion Backend (:5000). Vérifiez que le serveur est démarré.");
      else setError(err.response?.data?.error || err.message || "Erreur lors de la génération.");
    } finally {
      setIsLoading(false);
      setLoadingStep(0);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      if (!reportData) return;
      await downloadProfessionalPdf(reportData, form);
    } catch { window.print(); }
  };

  return (
    <MainLayout activeId="rapport-complet">
      <style>{`
        .report-section, .report-toc, .report-cover { page-break-inside: avoid; }
        @media print {
          .report-section { break-inside: avoid; }
        }
        .report-toc-link:hover span:last-child { color: ${C.terra}; }
      `}</style>
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
              fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)',
              fontWeight: 400, color: '#FEFDFA', margin: '0 0 0.4rem 0',
              lineHeight: 1.15
            }}>
              Rapport de Due Diligence Immobilière
            </h1>
            <p style={{
              fontSize: '0.88rem', color: 'rgba(254,253,250,0.85)',
              margin: 0, maxWidth: 680, lineHeight: 1.5
            }}>
              Évaluation multidimensionnelle combinant prédictions ML de prix et de loyer, analyse géospatiale des commodités et synthèse IA experte.
            </p>
          </div>

         
        </div>
      </header>

      <div style={{ minHeight: '80vh', background: C.mist, padding: '2.5rem 2rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          {/* Formulaire */}
          {!reportData && (
            <form onSubmit={handleGenerate} style={{ background: C.paper, borderRadius: 24, padding: '2.25rem', border: `1px solid ${C.sandLight}`, boxShadow: '0 12px 40px rgba(26,20,16,0.06)' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: C.ink, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building2 color={C.terra} size={20} /> Caractéristiques du bien à expertiser
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginBottom: 24 }}>
                {/* Type de bien — options triées alphabétiquement */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: C.inkSoft, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type de bien</label>
                  <select value={form.propertyType} onChange={e => setForm(p => ({ ...p, propertyType: e.target.value }))} style={inputStyle}>
                    {PROPERTY_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                {/* Ville — select auto-rempli : toute la région Marrakech-Safi (fichier
                    statique zonesRegion) + zones découvertes au clic carte, dédoublonnées
                    et triées alphabétiquement. */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: C.inkSoft, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ville / Commune</label>
                  <select value={form.city} onChange={e => handleCityChange(e.target.value)} style={inputStyle}>
                    <option value="">— Sélectionnez une ville —</option>
                    {communes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Quartier — dépend de la ville. Une seule version par quartier (formats
                    normalisés/dédoublonnés), tri alphabétique. Le couple ville/quartier
                    choisi est envoyé tel quel aux 3 modèles (vente, location mensuelle,
                    investissement). */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: C.inkSoft, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Quartier{!form.city && <span style={{ fontWeight: 500, textTransform: 'none' }}> — choisissez d’abord une ville</span>}
                  </label>
                  <select value={form.neighbourhood} disabled={!form.city} onChange={e => handleQuartierChange(e.target.value)} style={{ ...inputStyle, opacity: form.city ? 1 : 0.6, cursor: form.city ? 'pointer' : 'not-allowed' }}>
                    <option value="">{form.city ? '— Sélectionnez un quartier —' : '— Choisissez d’abord une ville —'}</option>
                    {quartiers.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
                {[
                  { label: 'Adresse (optionnel)', key: 'address',          type: 'text' },
                  { label: 'Surface totale (m²)', key: 'surface',          type: 'number' },
                  { label: 'Surface habitable (m²)', key: 'surfaceHabitable', type: 'number' },
                  { label: 'Nb. pièces',          key: 'rooms',            type: 'number' },
                  { label: 'Nb. chambres',         key: 'bedrooms',         type: 'number' },
                  { label: 'Salles de bain',       key: 'bathrooms',        type: 'number' },
                  { label: 'Salons',               key: 'salons',           type: 'number' },
                  { label: 'Étage',                key: 'floor',            type: 'number' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: C.inkSoft, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
                    <input type={type} value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={inputStyle} min={type === 'number' ? 0 : undefined} />
                  </div>
                ))}
              </div>

              {/* Équipements */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: C.ink, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Équipements & Prestations
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
                  {EQUIPMENT_OPTIONS.map(eq => {
                    const checked = form.equipment.includes(eq.key);
                    return (
                      <button type="button" key={eq.key} onClick={() => toggleEquipment(eq.key)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.55rem 0.8rem', borderRadius: 10, border: `1.5px solid ${checked ? C.terra : C.sandLight}`, background: checked ? C.terraMuted : C.paper, color: checked ? C.terra : C.inkSoft, fontSize: '0.82rem', fontWeight: checked ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s ease' }}>
                        <CheckCircle2 size={14} style={{ opacity: checked ? 1 : 0.3, flexShrink: 0 }} />
                        {eq.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 24, padding: '1.25rem', borderRadius: 16, border: `1px solid ${form.financing.enabled ? C.terra : C.sandLight}`, background: form.financing.enabled ? C.terraMuted : C.mist }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 700, color: C.ink }}><Landmark size={18} color={C.terra} /> Financement par crédit immobilier</div>
                    <div style={{ fontSize: '0.78rem', color: C.inkMuted, marginTop: 4 }}>Ajoutez une étude de crédit personnalisée et sa comparaison au rapport d'investissement.</div>
                  </div>
                  <button type="button" onClick={() => setForm(p => ({ ...p, financing: { ...p.financing, enabled: !p.financing.enabled } }))} style={{ border: 'none', borderRadius: 999, padding: '0.55rem 1rem', background: form.financing.enabled ? C.terra : C.sand, color: C.paper, fontWeight: 700, cursor: 'pointer' }}>
                    {form.financing.enabled ? 'Oui, avec crédit' : 'Non, achat comptant'}
                  </button>
                </div>
                {form.financing.enabled && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 10 }}>
                      <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 99, alignItems: 'center', justifyContent: 'center', background: C.terra, color: C.paper, fontSize: '0.72rem', fontWeight: 800 }}>1</span>
                      <span style={{ fontSize: '0.76rem', color: C.terra, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Situation financière de l’emprunteur</span>
                    </div>
                    <p style={{ margin: '0 0 12px', fontSize: '0.77rem', color: C.inkMuted, lineHeight: 1.5 }}>Ces données servent à apprécier l’effort mensuel et la capacité d’endettement. Tous les montants sont en dirhams marocains.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
                      {[
                        { label: 'Apport personnel', unit: 'MAD', key: 'downPayment', hint: 'Réduit directement le capital financé.' },
                        { label: 'Revenu net mensuel', unit: 'MAD / mois', key: 'monthlyIncome', hint: 'Nécessaire au calcul du taux d’endettement.' },
                        { label: 'Charges du bien', unit: 'MAD / mois', key: 'monthlyCharges', hint: 'Charges non couvertes par le loyer estimé.' },
                      ].map(({ label, unit, key, hint }) => (
                        <div key={key}>
                          <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, color: C.inkSoft, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}><span>{label}</span><span style={{ color: C.inkMuted, fontWeight: 600 }}>{unit}</span></label>
                          <input type="number" min="0" step="any" value={(form.financing as any)[key]} onChange={e => setForm(p => ({ ...p, financing: { ...p.financing, [key]: e.target.value } }))} style={inputStyle} />
                          {hint && <span style={{ display: 'block', fontSize: '0.67rem', color: C.inkMuted, marginTop: 3 }}>{hint}</span>}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: '#ECE7E0', border: `1px solid ${C.sandLight}`, fontSize: '0.78rem', color: C.inkSoft, display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                      <ShieldCheck size={16} color={C.terra} style={{ flexShrink: 0, marginTop: 1 }} /><span><strong style={{ color: C.ink }}>Prix du bien — estimation modèle.</strong> Le prix de vente prédit est verrouillé et alimentera automatiquement le montant financé lors de la génération. Aucun prix manuel n’est utilisé.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 10 }}>
                      <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 99, alignItems: 'center', justifyContent: 'center', background: C.terra, color: C.paper, fontSize: '0.72rem', fontWeight: 800 }}>2</span>
                      <span style={{ fontSize: '0.76rem', color: C.terra, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Conditions de crédit à négocier</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
                      <div style={{ padding: '14px', borderRadius: 12, background: C.paper, border: `1px solid ${C.sandLight}` }}>
                        <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, color: C.inkSoft, marginBottom: 8 }}><span>Taux nominal annuel</span><span style={{ color: C.terra, fontSize: '0.9rem' }}>{form.financing.interestRate}%</span></label>
                        <input type="range" min={MOROCCO_CREDIT_RULES.boaStartingRate} max={MOROCCO_CREDIT_RULES.negotiableRateMax} step="0.05" value={form.financing.interestRate} onChange={e => setForm(p => ({ ...p, financing: { ...p.financing, interestRate: e.target.value } }))} style={{ width: '100%', accentColor: C.terra }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.67rem', color: C.inkMuted }}><span>{MOROCCO_CREDIT_RULES.boaStartingRate}% · plancher</span><span>{MOROCCO_CREDIT_RULES.negotiableRateMax}% · plafond</span></div>
                        <div style={{ fontSize: '0.68rem', color: C.inkMuted, marginTop: 8 }}>Un taux plus bas réduit la mensualité et le coût total du crédit.</div>
                      </div>
                      <div style={{ padding: '14px', borderRadius: 12, background: C.paper, border: `1px solid ${C.sandLight}` }}>
                        <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, color: C.inkSoft, marginBottom: 8 }}><span>Durée de remboursement</span><span style={{ color: C.terra, fontSize: '0.9rem' }}>{form.financing.durationYears} ans</span></label>
                        <input type="range" min="5" max={MOROCCO_CREDIT_RULES.maximumDurationYears} step="1" value={form.financing.durationYears} onChange={e => setForm(p => ({ ...p, financing: { ...p.financing, durationYears: e.target.value } }))} style={{ width: '100%', accentColor: C.terra }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.67rem', color: C.inkMuted }}><span>5 ans</span><span>25 ans max.</span></div>
                        <div style={{ fontSize: '0.68rem', color: C.inkMuted, marginTop: 8 }}>Une durée plus longue réduit la mensualité mais augmente le coût total.</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 14 }}>
                      {[
                        ['Apport', '↑ apport · ↓ montant financé · ↓ mensualité'],
                        ['Revenu', '↑ revenu · ↓ taux d’endettement'],
                        ['Taux', '↑ taux · ↑ mensualité · ↑ coût total'],
                        ['Durée', '↑ durée · ↓ mensualité · ↑ coût total'],
                      ].map(([label, text]) => <div key={label} style={{ padding: '10px 12px', borderLeft: `3px solid ${C.gold}`, background: 'rgba(196,154,90,0.08)', borderRadius: '0 8px 8px 0' }}><div style={{ fontSize: '0.67rem', fontWeight: 800, color: C.terra, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div><div style={{ fontSize: '0.7rem', color: C.inkSoft, marginTop: 3 }}>{text}</div></div>)}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 14 }}>
                      {[
                        ['Taux moyen BAM (T2 2025)', `${MOROCCO_CREDIT_RULES.bamAverageRate}%`],
                        ['Assurance annuelle retenue', `${MOROCCO_CREDIT_RULES.insuranceRatePct}%`],
                        ['Frais d’acquisition retenus', `${MOROCCO_CREDIT_RULES.acquisitionFeesPct}%`],
                        ['Montant minimum indicatif BOA', `${fmt(MOROCCO_CREDIT_RULES.minimumLoanAmount)} MAD`],
                      ].map(([label, value]) => <div key={label} style={{ padding: '10px 12px', borderRadius: 10, background: '#ECE7E0', border: `1px solid ${C.sandLight}` }}><div style={{ fontSize: '0.67rem', color: C.inkMuted }}>{label} · verrouillé</div><strong style={{ color: C.ink, fontSize: '0.85rem' }}>{value}</strong></div>)}
                    </div>
                    <p style={{ margin: '12px 0 0', fontSize: '0.72rem', color: C.inkMuted, lineHeight: 1.45 }}>Les indicateurs de synthèse — montant financé, mensualité, taux d’endettement et coût total du crédit — sont calculés dans le rapport à partir du prix prédit et de vos paramètres. Les conditions définitives restent soumises à l’accord de la banque.</p>
                  </>
                )}
              </div>

              {/* Carte */}
              {/* Carte — même logique que les pages d'estimation : clic → auto-remplissage
                  ville/quartier/adresse (résolution serveur) + auto-zoom (ville 12, quartier 15). */}
              <div style={{ marginBottom: 28 }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: C.ink, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <MapPin size={15} color={C.terra} /> Emplacement GPS (cliquez sur la carte : ville, quartier et adresse se remplissent automatiquement)
                </label>
                <div style={{ height: 320, borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.sand}`, boxShadow: '0 4px 16px rgba(26,20,16,0.06)' }}>
                  <MapContainer center={[form.latitude, form.longitude]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[form.latitude, form.longitude]} />
                    <ClickCatcher onPick={handleMapClick} />
                    <Recenter lat={form.latitude} lng={form.longitude} zoom={recenterZoom} />
                  </MapContainer>
                </div>
                <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: '0.78rem', color: C.inkMuted }}>
                  <span>Lat : <strong>{form.latitude.toFixed(5)}</strong></span>
                  <span>Lng : <strong>{form.longitude.toFixed(5)}</strong></span>
                </div>
              </div>

              {error && (
                <div style={{ padding: '12px 16px', background: C.dangerBg, border: '1px solid rgba(196,32,32,0.25)', borderRadius: 12, color: C.danger, fontSize: '0.85rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AlertCircle size={18} /><span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '1rem', borderRadius: 14, background: `linear-gradient(135deg, ${C.terraDark}, ${C.terra})`, color: C.paper, fontSize: '1rem', fontWeight: 700, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 28px rgba(154,66,29,0.35)', transition: 'all 0.2s ease' }}>
                {isLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>{STEPS[loadingStep]}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    <span>Générer le rapport complet de due diligence</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Affichage rapport */}
          {reportData && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <button type="button" onClick={() => setReportData(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.6rem 1.2rem', borderRadius: 10, background: C.paper, border: `1px solid ${C.sand}`, color: C.inkSoft, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                  <RefreshCcw size={15} /> Nouvelle expertise
                </button>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={handleDownloadPDF} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.75rem 1.5rem', borderRadius: 12, background: `linear-gradient(135deg, ${C.terraDark}, ${C.terra})`, color: C.paper, fontSize: '0.9rem', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 6px 20px rgba(154,66,29,0.3)' }}>
                    <Download size={18} /> Télécharger PDF
                  </button>
                </div>
              </div>

      <div ref={reportRef} className="report-export-area">
                <ReportViewer data={reportData} />
              </div>
            </div>
          )}

        </div>
      </div>
    </MainLayout>
  );
}
