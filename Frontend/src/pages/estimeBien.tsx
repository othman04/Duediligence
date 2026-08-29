import { useEffect, useState, useRef, useMemo } from "react";
import { getCommuneNames, getQuartiersOf, findCommune, findQuartier } from "../data/zonesRegion";
import { MainLayout } from "../components/MainLayout";
import { useNavigate } from "react-router-dom";
import { usePredictionVenteStore, type PredictionPayload } from "../store/PredictionVenteStore";
import { useHistoryStore } from "../store/historyStore";
import { useAuthStore } from "../store/authStore";
import { resolveQuartier } from "../utils/quartierResolver";
import {
  usePredictionLocationStore,
  type ShapEntry,
} from "../store/PredictionLocationStore";
import {
  fetchCommuneCenter,
  fetchQuartierCenter,
  fetchSaleCommuneCenter,
  fetchSaleQuartierCenter,
  resolveLocation,
} from "../lib/locationApi";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BadgePercent,
  Bath,
  BedDouble,
  Building2,
  Calculator,
  Castle,
  Check,
  CircleParking,
  Cpu,
  DoorOpen,
  FileText,
  Home,
  KeyRound,
  LandPlot,
  Layers,
  Loader2,
  MapPin,
  MapPinned,
  MousePointerClick,
  MoveRight,
  MoveVertical,
  Package,
  RefreshCcw,
  Ruler,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Sofa,
  Sparkles,
  Store,
  Sun,
  Trees,
  TrendingUp,
  Waves,
  type LucideIcon,
} from "lucide-react";

/* ============================================================
   Marrakech Design System Tokens & Palette
   ============================================================ */
const C = {
  terra:      '#9A421D',
  terraDark:  '#7A3216',
  terraDeep:  '#5C240E',
  terraLight: '#C05A30',
  terraSoft:  '#D4774A',
  terraGlow:  'rgba(154,66,29,0.22)',
  terraMuted: 'rgba(154,66,29,0.1)',
  ink:        '#1A1410',
  inkSoft:    '#3A3028',
  inkMuted:   '#7A6E66',
  sand:       '#D0C0A8',
  sandLight:  '#E8DDD0',
  sandPale:   '#F0EAE2',
  mist:       '#F4F1EC',
  mistDeep:   '#ECE7DF',
  paper:      '#FEFCF8',
  gold:       '#C49A5A',
  goldPale:   'rgba(196,154,90,0.12)',
};

const ZelligeSVG = ({ id = 'z-estime', opacity = '0.035' }: { id?: string; opacity?: string }) => (
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

void ZelligeSVG;





/* ============================================================
   Types
   ============================================================ */

type EstimationMode = "location" | "vente";

type PropertyType =
  | "appartement"
  | "villa"
  | "maison"
  | "riad"
  | "terrain"
  | "local-commercial";

/**
 * Commune sélectionnée = valeur exacte de `commune_officielle` en base
 * (liste chargée dynamiquement depuis MongoDB — toute la région Marrakech-Safi).
 */
type City = string;

type FloorType = "semantique" | "position";

type EquipmentKey =
  | "parking"
  | "piscine"
  | "jardin"
  | "terrasse"
  | "ascenseur"
  | "climatisation"
  | "meuble"
  | "securite"
  | "balcon";

/** Période de location choisie (uniquement pour le mode Location) */
type LocationPeriode = 'mensuel' | 'nuitee';

interface FormState {
  mode: EstimationMode | null;
  periode: LocationPeriode | null;
  propertyType: PropertyType | null;
  city: City | null;
  quartier: string | null;
  street: string;
  neighborhood: string;
  coords: { lat: number; lng: number } | null;
  address: string;
  surface: string;
  rooms: string;
  bathrooms: string;
  floorLabel: string;
  floorType: FloorType | null;
  floorPosition: string;
  equipment: EquipmentKey[];
  rentalPriceMonthly: string;
}

interface EstimateResult {
  estimate: number;
  low: number;
  high: number;
  pricePerSqm: number;
}

/* ============================================================
   Données du formulaire
   ============================================================ */

const DEFAULT_STATE: FormState = {
  mode: null,
  periode: null,
  propertyType: null,
  city: null,
  quartier: null,
  street: "",
  neighborhood: "",
  coords: null,
  address: "",
  surface: "",
  rooms: "",
  bathrooms: "",
  floorLabel: "rdc",
  floorType: null,
  floorPosition: "",
  equipment: [],
  rentalPriceMonthly: "",
};

const MODES: { value: EstimationMode; label: string; hint: string }[] = [
  {
    value: "location",
    label: "Estimation pour la location",
    hint: "Prix de location mensuel estimé",
  },
  {
    value: "vente",
    label: "Estimation pour la vente",
    hint: "Prix de vente du bien estimé",
  },
];

const PROPERTY_TYPES: { value: PropertyType; label: string; icon: LucideIcon }[] = [
  { value: "appartement", label: "Appartement", icon: Building2 },
  { value: "villa", label: "Villa", icon: Home },
  { value: "maison", label: "Maison", icon: Home },
  { value: "riad", label: "Riad", icon: Castle },
  { value: "terrain", label: "Terrain", icon: LandPlot },
  { value: "local-commercial", label: "Local commercial", icon: Store },
];

/** Centre par défaut de la carte (Marrakech) en attendant un choix */
const DEFAULT_MAP_CENTER: [number, number] = [31.6295, -7.9811];
const DEFAULT_MAP_ZOOM = 12;

const EQUIPMENT: { value: EquipmentKey; label: string; icon: LucideIcon }[] = [
  { value: "parking", label: "Parking", icon: CircleParking },
  { value: "piscine", label: "Piscine", icon: Waves },
  { value: "jardin", label: "Jardin", icon: Trees },
  { value: "terrasse", label: "Terrasse", icon: Sun },
  { value: "ascenseur", label: "Ascenseur", icon: MoveVertical },
  { value: "climatisation", label: "Climatisation", icon: Snowflake },
  { value: "meuble", label: "Meublé", icon: Sofa },
  { value: "securite", label: "Sécurité", icon: ShieldCheck },
  { value: "balcon", label: "Balcon", icon: DoorOpen },
];

const FLOOR_OPTIONS: { value: string; label: string }[] = [
  { value: "sous-sol", label: "Sous-sol" },
  { value: "rdc", label: "Rez-de-chaussée" },
  { value: "1-2", label: "1er – 2e étage" },
  { value: "3-plus", label: "3e étage et plus" },
];

const MODE_LABEL: Record<EstimationMode, string> = {
  location: "Location",
  vente: "Vente",
};

const PROPERTY_LABEL: Record<PropertyType, string> = {
  appartement: "Appartement",
  villa: "Villa",
  maison: "Maison",
  riad: "Riad",
  terrain: "Terrain",
  "local-commercial": "Local commercial",
};

const EQUIPMENT_LABEL: Record<EquipmentKey, string> = {
  parking: "Parking",
  piscine: "Piscine",
  jardin: "Jardin",
  terrasse: "Terrasse",
  ascenseur: "Ascenseur",
  climatisation: "Climatisation",
  meuble: "Meublé",
  securite: "Sécurité",
  balcon: "Balcon",
};

/* ============================================================
   Moteur d'estimation (formule déterministe)
   ============================================================ */

const BASE_RATES: Record<EstimationMode, Record<string, number>> = {
  location: { marrakech: 120, essaouira: 95, safi: 60 },
  vente: { marrakech: 18000, essaouira: 14500, safi: 9000 },
};

const PROPERTY_MULTIPLIER: Record<PropertyType, number> = {
  appartement: 1,
  villa: 1.15,
  maison: 1,
  riad: 1.25,
  "local-commercial": 1.1,
  terrain: 0.55,
};

const ROOM_INCREMENT = 0.025;
const ROOM_CAP = 0.125;
const BATH_INCREMENT = 0.02;
const BATH_CAP = 0.06;
const EQUIPMENT_INCREMENT = 0.02;
const EQUIPMENT_CAP = 0.15;
const RANGE_MARGIN = 0.08;

const FLOOR_ADJUST: Record<string, number> = {
  "sous-sol": 0.95,
  rdc: 1,
  "1-2": 1.05,
  "3-plus": 1.08,
};

function isTerrain(type: PropertyType | null): boolean {
  return type === "terrain";
}

function formatPrice(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(Math.round(value))} MAD`;
}

function floorAdjustment(state: FormState): number {
  if (!state.propertyType || state.propertyType === "terrain") return 1;

  if (state.mode === "vente" && state.floorType === "position") {
    const position = parseInt(state.floorPosition, 10);
    if (!Number.isNaN(position) && position > 0) {
      return 1 + Math.min(0.12, position * 0.02);
    }
    return 1;
  }

  return FLOOR_ADJUST[state.floorLabel] ?? 1;
}

function computeEstimate(state: FormState): EstimateResult | null {
  if (!state.mode || !state.city || !state.propertyType) return null;

  const surface = parseFloat(state.surface);
  if (!Number.isFinite(surface) || surface <= 0) return null;

  const modeRates = BASE_RATES[state.mode];
  const cityKey = (state.city || "").toLowerCase();
  const rate = modeRates[cityKey] ?? modeRates["marrakech"] ?? (state.mode === "vente" ? 18000 : 120);
  const typeMultiplier = PROPERTY_MULTIPLIER[state.propertyType] ?? 1;

  let multiplier = 1;

  if (state.propertyType !== "terrain") {
    const rooms = parseInt(state.rooms, 10) || 0;
    const baths = parseInt(state.bathrooms, 10) || 0;
    multiplier *= 1 + Math.min(ROOM_CAP, rooms * ROOM_INCREMENT);
    multiplier *= 1 + Math.min(BATH_CAP, baths * BATH_INCREMENT);
  }

  multiplier *= floorAdjustment(state);

  const equipmentCount = state.equipment.length;
  multiplier *= 1 + Math.min(EQUIPMENT_CAP, equipmentCount * EQUIPMENT_INCREMENT);

  const estimate = rate * surface * typeMultiplier * multiplier;

  return {
    estimate,
    pricePerSqm: estimate / surface,
    low: estimate * (1 - RANGE_MARGIN),
    high: estimate * (1 + RANGE_MARGIN),
  };
}

/* ============================================================
   Carte Leaflet — géocodage & composants internes
   ============================================================ */

const pinIcon = L.divIcon({
  className: "",
  html: `<div class="est-pin"><div class="est-pin-body"><span class="est-pin-center"></span></div><span class="est-pin-ring"></span></div>`,
  iconSize: [28, 36],
  iconAnchor: [14, 34],
});

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=fr`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.display_name === "string" ? data.display_name : null;
  } catch {
    return null;
  }
}

async function geocode(
  query: string
): Promise<{ lat: number; lng: number; display: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
        query
      )}&limit=1&accept-language=fr`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : null;
    if (!first) return null;
    return {
      lat: parseFloat(first.lat),
      lng: parseFloat(first.lon),
      display: first.display_name ?? "",
    };
  } catch {
    return null;
  }
}

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(
      [lat, lng],
      zoom ?? Math.max(map.getZoom(), 13),
      { animate: true }
    );
  }, [map, lat, lng, zoom]);
  return null;
}

/* ============================================================
   Barre de progression
   ============================================================ */

const STEP_LABELS = [
  "Type d'estimation",
  "Informations",
  "Localisation",
  "Caractéristiques",
  "Équipements",
  "Résultat",
];

const STEP_ICONS = [SlidersHorizontal, Building2, MapPin, Ruler, Package, BadgePercent];

function ProgressSteps({ current }: { current: number }) {
  return (
    <ol style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
      {STEP_LABELS.map((label, index) => {
        const Icon = STEP_ICONS[index];
        const done = index < current;
        const active = index === current;

        return (
          <li
            key={label}
            style={{ display: 'flex', flex: index < STEP_LABELS.length - 1 ? 1 : 'none', alignItems: 'center' }}
            aria-current={active ? 'step' : undefined}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 38, height: 38, borderRadius: '50%',
                  border: `2px solid ${done ? C.terra : active ? C.terra : C.sandLight}`,
                  background: done
                    ? `linear-gradient(145deg, ${C.terraDeep}, ${C.terraLight})`
                    : active
                      ? C.terraMuted
                      : C.mist,
                  color: done ? C.paper : active ? C.terra : C.inkMuted,
                  boxShadow: done
                    ? `0 4px 16px rgba(154,66,29,0.34), 0 1px 0 rgba(255,255,255,0.15) inset`
                    : active
                      ? `0 0 0 5px rgba(154,66,29,0.15), 0 4px 12px rgba(154,66,29,0.18)`
                      : 'none',
                  transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
                  flexShrink: 0,
                }}
              >
                {done ? <Check style={{ width: 15, height: 15, strokeWidth: 3 }} /> : <Icon style={{ width: 14, height: 14 }} />}
              </span>
              <span
                style={{
                  color: active ? C.terra : done ? C.ink : C.inkMuted,
                  fontWeight: active ? 700 : done ? 500 : 400,
                  fontSize: '10.5px',
                  textAlign: 'center',
                  lineHeight: 1.25,
                  transition: 'all 0.25s ease',
                  whiteSpace: 'nowrap',
                }}
                className="hidden sm:block"
              >
                {label}
              </span>
            </div>

            {index < STEP_LABELS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  margin: '0 6px',
                  marginBottom: 20,
                  borderRadius: 999,
                  background: index < current
                    ? `linear-gradient(90deg, ${C.terraDeep}, ${C.terraLight})`
                    : C.sandLight,
                  transition: 'background 0.5s cubic-bezier(0.16,1,0.3,1)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ============================================================
   Étape 1 — Type d'estimation
   ============================================================ */

function StepType({
  state,
  update,
}: {
  state: FormState;
  update: (patch: Partial<FormState>) => void;
}) {
  return (
    <div>
      <div style={{ marginBottom: '0.5rem' }}>
        <p style={{
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.22em',
          textTransform: 'uppercase', color: C.terra, marginBottom: 10,
        }}>
          Type d'estimation
        </p>
        
      </div>
      <p style={{ color: C.inkMuted, fontSize: '0.9rem', marginTop: 8, marginBottom: 32, lineHeight: 1.6 }}>
        Choisissez le type d'estimation, puis continuez pour décrire votre bien.
      </p>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        {MODES.map((mode) => {
          const selected = state.mode === mode.value;
          const Icon = mode.value === 'location' ? KeyRound : BadgeCheck;
          const accentGrad = mode.value === 'location'
            ? `linear-gradient(145deg, ${C.gold}, #E0B87A)`
            : `linear-gradient(145deg, ${C.terraDeep}, ${C.terraLight})`;
          const accentColor = mode.value === 'location' ? C.gold : C.terra;

          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => update({ mode: mode.value, periode: null })}
              style={{
                border: `2px solid ${selected ? accentColor : C.sandLight}`,
                background: selected ? `rgba(154,66,29,0.03)` : C.paper,
                boxShadow: selected
                  ? `0 0 0 4px ${C.terraMuted}, 0 12px 32px rgba(154,66,29,0.14)`
                  : '0 2px 8px rgba(26,20,16,0.05)',
                borderRadius: 18,
                padding: '1.75rem 1.5rem',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (!selected) {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 10px 28px rgba(26,20,16,0.1)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = `rgba(154,66,29,0.35)`;
                }
              }}
              onMouseLeave={e => {
                if (!selected) {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(26,20,16,0.05)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = C.sandLight;
                }
              }}
            >
              {/* Subtle background shimmer when selected */}
              {selected && (
                <span style={{
                  position: 'absolute', inset: 0,
                  background: `radial-gradient(ellipse at 20% 20%, ${C.terraMuted} 0%, transparent 65%)`,
                  pointerEvents: 'none',
                }} />
              )}

              {/* Selection indicator */}
              <span
                style={{
                  position: 'absolute', top: 16, right: 16,
                  width: 22, height: 22, borderRadius: '50%',
                  border: `2px solid ${selected ? accentColor : C.sandLight}`,
                  background: selected ? accentColor : C.paper,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                {selected && <Check style={{ width: 11, height: 11, color: C.paper, strokeWidth: 3 }} />}
              </span>

              {/* Icon */}
              <span
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 52, height: 52, borderRadius: 14,
                  background: selected ? accentGrad : C.sandPale,
                  boxShadow: selected ? `0 6px 18px rgba(154,66,29,0.28), 0 1px 0 rgba(255,255,255,0.2) inset` : 'none',
                  marginBottom: 18, transition: 'all 0.25s ease',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {selected && (
                  <span style={{
                    position: 'absolute', inset: 0,
                    background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.22) 0%, transparent 60%)',
                  }} />
                )}
                <Icon style={{ width: 24, height: 24, color: selected ? C.paper : C.inkMuted, position: 'relative' }} />
              </span>

              <span style={{ display: 'block', fontSize: '1.05rem', fontWeight: 700, color: C.ink, lineHeight: 1.3, marginBottom: 6 }}>
                {mode.label}
              </span>
              <span style={{ display: 'block', fontSize: '0.83rem', color: C.inkMuted, lineHeight: 1.5 }}>
                {mode.hint}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Période de location (2 boutons, design existant) ─────── */}
      {state.mode === 'location' && (
        <div style={{ marginTop: 28 }}>
          <p style={{
            fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: C.ink, marginBottom: 14,
          }}>
            Période de location
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {([
              { value: 'mensuel', label: 'Par mois', hint: 'Loyer mensuel (longue durée)' },
              { value: 'nuitee',  label: 'Par nuit', hint: 'Location de vacances / courte durée' },
            ] as const).map((opt) => {
              const active = state.periode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update({ periode: opt.value })}
                  style={{
                    padding: '10px 22px', borderRadius: 10,
                    border: `1.5px solid ${active ? C.terra : C.sandLight}`,
                    background: active
                      ? `linear-gradient(135deg, ${C.terraDeep}, ${C.terraLight})`
                      : C.mist,
                    color: active ? C.paper : C.inkSoft,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: active ? '0 4px 14px rgba(154,66,29,0.28)' : 'none',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => {
                    if (!active) e.currentTarget.style.borderColor = C.terra;
                  }}
                  onMouseLeave={e => {
                    if (!active) e.currentTarget.style.borderColor = C.sandLight;
                  }}
                >
                  <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700 }}>
                    {opt.label}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.72rem', opacity: 0.85 }}>
                    {opt.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{
        marginTop: 20, padding: '10px 16px',
        background: state.mode ? C.terraMuted : C.mist,
        border: `1px solid ${state.mode ? `rgba(154,66,29,0.25)` : C.sandLight}`,
        borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 8,
        transition: 'all 0.25s ease',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: state.mode ? C.terra : C.inkMuted, flexShrink: 0 }} />
        <p style={{ fontSize: '0.78rem', fontWeight: 500, color: state.mode ? C.terra : C.inkMuted }}>
          {state.mode ? `Estimation sélectionnée : ` : 'Estimation non sélectionnée'}
          {state.mode && <strong>{MODE_LABEL[state.mode]}{state.mode === 'location' && state.periode ? ` · ${state.periode === 'mensuel' ? 'par mois' : 'par nuit'}` : ''}</strong>}
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   Étape 2 — Informations générales
   ============================================================ */

const PROPERTY_COLORS: Record<PropertyType, { bg: string; text: string }> = {
  appartement: { bg: 'rgba(154,66,29,0.1)', text: '#D97706' },
  villa:       { bg: 'rgba(196,154,90,0.16)', text: '#D97706' },
  maison:      { bg: 'rgba(217,119,6,0.1)', text: '#D97706' },
  riad:        { bg: 'rgba(217,119,6,0.1)', text: '#D97706' },
  terrain:     { bg: 'rgba(217,119,6,0.1)', text: '#D97706' },
  'local-commercial': { bg: 'rgba(217,119,6,0.1)', text: '#D97706' },
};

function StepInfo({
  state,
  update,
}: {
  state: FormState;
  update: (patch: Partial<FormState>) => void;
}) {
  return (
    <div>
      <div style={{ marginBottom: '0.5rem' }}>
        <p style={{
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.22em',
          textTransform: 'uppercase', color: C.terra, marginBottom: 8,
        }}>
          Étape 2 · Informations générales
        </p>
        
      </div>
      <p style={{ color: C.inkMuted, fontSize: '0.9rem', marginTop: 6, marginBottom: 28 }}>
        Sélectionnez la catégorie du bien à estimer.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Type de bien */}
        <div>
          <p style={{
            fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: C.ink, marginBottom: 14,
          }}>
            1. Type de bien
          </p>
          <div style={{
            display: 'grid', gap: 12,
            // Responsive : 6 colonnes sur desktop, s'adapte automatiquement
            // (2-3 colonnes) sur mobile au lieu d'écraser les libellés.
            gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))',
            width: '100%',
          }}>
            {PROPERTY_TYPES
              .filter((t) => !(state.mode === "location" && t.value === "terrain"))
              .map(({ value, label, icon: Icon }) => {
              const selected = state.propertyType === value;
              const colorInfo = PROPERTY_COLORS[value];

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => update({ propertyType: value })}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 8,
                    padding: '1.1rem 0.5rem',
                    borderRadius: 16,
                    border: `2px solid ${selected ? C.terra : C.sandLight}`,
                    background: selected ? `rgba(154,66,29,0.04)` : C.paper,
                    boxShadow: selected
                      ? `0 0 0 3px ${C.terraMuted}, 0 8px 20px rgba(154,66,29,0.12)`
                      : '0 2px 6px rgba(26,20,16,0.04)',
                    cursor: 'pointer',
                    transition: 'all 0.22s cubic-bezier(0.16,1,0.3,1)',
                  }}
                  onMouseEnter={e => {
                    if (!selected) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = C.terra;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!selected) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = C.sandLight;
                    }
                  }}
                >
                  <span
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 42, height: 42, borderRadius: 12,
                      background: selected
                        ? `linear-gradient(135deg, ${C.terraDeep}, ${C.terraLight})`
                        : colorInfo.bg,
                      color: selected ? C.paper : colorInfo.text,
                      boxShadow: selected ? '0 4px 14px rgba(154,66,29,0.28)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Icon style={{ width: 20, height: 20 }} />
                  </span>
                  <span style={{
                    fontSize: '0.82rem', fontWeight: selected ? 700 : 600,
                    color: selected ? C.terra : C.ink, textAlign: 'center',
                    lineHeight: 1.2,
                  }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* La sélection de la Ville/Commune a été déplacée dans l'étape
            « Localisation » (regroupement logique de tout ce qui concerne
            la position du bien). */}
      </div>
    </div>
  );
}

/* ============================================================
   Étape 3 — Localisation (ville + quartier + carte synchronisés)
   ============================================================ */

function StepLocation({
  state,
  update,
}: {
  state: FormState;
  update: (patch: Partial<FormState>) => void;
}) {
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Zoom de recentrage souhaité selon l'action (commune=12, quartier=15)
  const [recenterZoom, setRecenterZoom] = useState<number | undefined>(undefined);

  // Listes STATIQUES de toute la région Marrakech-Safi (fichier front-end
  // `zonesRegion.ts`, indépendant de MongoDB), enrichies dynamiquement si le
  // clic carte désigne une zone absente du fichier.
  const [extraCommunes, setExtraCommunes] = useState<string[]>([]);
  const [extraQuartiers, setExtraQuartiers] = useState<Record<string, string[]>>({});

  const communes = useMemo(
    () => Array.from(new Set([...getCommuneNames(), ...extraCommunes])),
    [extraCommunes]
  );
  const quartiers = useMemo(() => {
    if (!state.city) return [];
    return Array.from(
      new Set([
        ...getQuartiersOf(state.city).map((q) => q.name),
        ...(extraQuartiers[state.city] ?? []),
      ])
    );
  }, [state.city, extraQuartiers]);

  /**
   * Point d'unicité : toute mise à jour de position passe par `setCoords`.
   * lat/lng, adresse, commune et quartier sont ensuite synchronisés.
   */
  const setCoords = async (lat: number, lng: number) => {
    update({ coords: { lat, lng } });
    setError(null);
    const resolved = await reverseGeocode(lat, lng);
    update({
      coords: { lat, lng },
      address: resolved ?? "",
    });

    // Résolution serveur `resolveLocation` → commune + quartier.
    // Utilise les polygones officiels des communes + annonces réelles
    // (denses à Marrakech) → résultats fiables et identiques pour la Vente
    // et la Location. Aucun rattachement « au plus proche » arbitraire.
    resolveLocation(lat, lng)
      .then((res) => {
        const patch: Partial<FormState> = {};
        if (res.commune_officielle) {
          patch.city = res.commune_officielle;
          patch.neighborhood = res.quartier ?? "";
          setExtraCommunes((prev) =>
            prev.includes(res.commune_officielle!) || findCommune(res.commune_officielle!)
              ? prev
              : [...prev, res.commune_officielle!]
          );
        }
        if (res.quartier) {
          patch.quartier = res.quartier;
          if (!patch.city) patch.neighborhood = res.quartier;
          const cityKey = res.commune_officielle ?? state.city ?? "";
          if (cityKey) {
            setExtraQuartiers((prev) => {
              const list = prev[cityKey] ?? [];
              if (list.includes(res.quartier!) || findQuartier(cityKey, res.quartier!)) return prev;
              return { ...prev, [cityKey]: [...list, res.quartier!] };
            });
          }
        }
        if (Object.keys(patch).length) update(patch);
      })
      .catch(() => { /* résolution indisponible : on garde la sélection */ });
  };

  const pickCoords = async (lat: number, lng: number) => {
    setCoords(lat, lng);
  };

  // Sélection manuelle de la commune -> zoom sur son centre.
  // 1) Coordonnées du fichier STATIQUE (immédiat, couvre toute la région
  //    Marrakech-Safi, y compris villes sans annonces en base).
  // 2) Affinage avec le centre médian calculé côté serveur quand disponible.
  const handleCommuneChange = async (commune: string) => {
    if (!commune) {
      update({ city: null, quartier: null });
      return;
    }
    update({ city: commune, quartier: null }); // réinitialise le quartier

    const staticCenter = findCommune(commune);
    if (staticCenter) {
      setRecenterZoom(12);
      update({ coords: { lat: staticCenter.lat, lng: staticCenter.lng } });
    }
    try {
      // Centre réel = médiane des annonces (dataset Vente ou annonces Location)
      const center = state.mode === "vente"
        ? await fetchSaleCommuneCenter(commune)
        : await fetchCommuneCenter(commune);
      if (center.lat != null && center.lng != null) {
        setRecenterZoom(12);
        update({ coords: { lat: center.lat, lng: center.lng } });
      }
    } catch {
      if (!staticCenter) setError("Impossible de centrer la carte sur cette commune.");
    }
  };

  // Sélection manuelle du quartier -> zoom sur son centre RÉEL :
  // 1) centre médian des annonces de CE quartier (base — précision max),
  // 2) sinon coordonnées du fichier statique,
  // 3) sinon centre de la commune (garantit un centrage correct partout).
  const handleQuartierChange = async (quartier: string) => {
    if (!quartier) return;
    update({ quartier });
    try {
      const center = state.mode === "vente"
        ? await fetchSaleQuartierCenter(state.city, quartier)
        : await fetchQuartierCenter(state.city, quartier);
      if (center.lat != null && center.lng != null) {
        setRecenterZoom(15);
        update({ coords: { lat: center.lat, lng: center.lng }, address: "" });
        reverseGeocode(center.lat, center.lng).then((addr) => update({ address: addr ?? "" }));
        return;
      }
    } catch { /* on passe aux fallbacks */ }

    const q = findQuartier(state.city, quartier);
    const c = findCommune(state.city || "");
    setRecenterZoom(15);
    if (q && q.lat != null && q.lng != null) {
      update({ coords: { lat: q.lat, lng: q.lng }, address: "" });
    } else if (c) {
      setRecenterZoom(13);
      update({ coords: { lat: c.lat, lng: c.lng }, address: "" });
    }
  };

  const handleSearch = async () => {
    const query = [state.street, (state.quartier || state.city || "")]
      .filter(Boolean)
      .join(" ");
    if (!query.trim()) {
      setError("Renseignez la rue ou le quartier à rechercher.");
      return;
    }
    setSearching(true);
    setError(null);
    const result = await geocode(query);
    setSearching(false);
    if (result) {
      const resolution = resolveQuartier(result.lat, result.lng, result.display || query);
      // Recherche d'adresse -> même logique que le clic carte :
      // mise à jour coords + résolution Ville/Quartier depuis MongoDB
      update({
        coords: { lat: result.lat, lng: result.lng },
        address: result.display || "",
        neighborhood: resolution.matchedQuartier,
      });
      resolveLocation(result.lat, result.lng)
        .then((res) => {
          const patch: Partial<FormState> = {};
          if (res.commune_officielle) patch.city = res.commune_officielle;
          if (res.quartier) patch.quartier = res.quartier;
          if (Object.keys(patch).length) update(patch);
        })
        .catch(() => { /* résolution indisponible */ });
    } else {
      const resolution = resolveQuartier(undefined, undefined, query);
      update({ neighborhood: resolution.matchedQuartier });
      setError("Adresse exacte non géocodée, le quartier le plus proche dans le dataset a été attribué.");
    }
  };

  const hasManualAddress = state.street.trim() !== "" || state.neighborhood.trim() !== "";
  const showMarker = state.coords !== null;

  return (
    <div>
      <div style={{ marginBottom: '0.5rem' }}>
        <p style={{
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.22em',
          textTransform: 'uppercase', color: C.terra, marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <MapPin style={{ width: 14, height: 14 }} />
          Étape 3 · Localisation
        </p>
        <h2 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          color: C.ink, fontSize: 'clamp(1.6rem,3vw,2.2rem)',
          fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.15,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${C.terraDeep}, ${C.terraLight})`,
            color: C.paper, boxShadow: '0 4px 14px rgba(154,66,29,0.28)',
          }}>
            <MapPinned style={{ width: 22, height: 22 }} />
          </span>
          Localisation du bien
        </h2>
      </div>
      <p style={{ color: C.inkMuted, fontSize: '0.9rem', marginTop: 6, marginBottom: 24 }}>
        Choisissez la commune et le quartier, recherchez une adresse ou cliquez directement sur la carte — latitude, longitude, commune et quartier restent synchronisés.
      </p>

      {/* Grid container: Inputs left (or top), Map right (or main) */}
      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}>
        {/* Left Column: Form & address info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Ville / Quartier / Coordonnées — synchronisés avec la carte */}
          <div style={{
            background: C.paper,
            border: `1px solid ${C.sandLight}`,
            borderRadius: 18,
            padding: '1.25rem 1.5rem',
            boxShadow: '0 2px 8px rgba(26,20,16,0.04)',
          }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink, marginBottom: 14 }}>
              Ville &amp; quartier
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label htmlFor="commune" style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: C.inkMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                  Ville / Commune
                </label>
                <select
                  id="commune"
                  value={state.city ?? ""}
                  onChange={(e) => handleCommuneChange(e.target.value)}
                  style={{
                    width: '100%', height: 44, padding: '0 12px', borderRadius: 10,
                    border: `1.5px solid ${C.sandLight}`, background: C.paper,
                    fontSize: '0.85rem', color: C.ink, outline: 'none', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={e => { e.target.style.borderColor = C.terra; }}
                  onBlur={e => { e.target.style.borderColor = C.sandLight; }}
                >
                  <option value="">— Sélectionnez une commune —</option>
                  {communes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="quartier-select" style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: C.inkMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                  Quartier
                  {!state.city && (
                    <span style={{ fontWeight: 500, textTransform: 'none' }}> — choisissez d'abord une commune</span>
                  )}
                </label>
                <select
                  id="quartier-select"
                  value={state.quartier ?? ""}
                  disabled={!state.city}
                  onChange={(e) => handleQuartierChange(e.target.value)}
                  style={{
                    width: '100%', height: 44, padding: '0 12px', borderRadius: 10,
                    border: `1.5px solid ${C.sandLight}`, background: C.paper,
                    fontSize: '0.85rem', color: C.ink, outline: 'none', cursor: state.city ? 'pointer' : 'not-allowed',
                    opacity: !state.city ? 0.6 : 1,
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={e => { e.target.style.borderColor = C.terra; }}
                  onBlur={e => { e.target.style.borderColor = C.sandLight; }}
                >
                  <option value="">
                    {state.city ? "— Sélectionnez un quartier —" : "—"}
                  </option>
                  {quartiers.map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>

              {/* Latitude / Longitude — lecture seule, auto-remplis */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label htmlFor="lat-ro" style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: C.inkMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                    Latitude
                  </label>
                  <input
                    id="lat-ro"
                    readOnly
                    value={state.coords ? state.coords.lat.toFixed(6) : ""}
                    placeholder="auto"
                    style={{
                      width: '100%', height: 44, padding: '0 12px', borderRadius: 10,
                      border: `1.5px dashed ${C.sand}`, background: C.mist,
                      fontSize: '0.85rem', color: C.inkSoft, outline: 'none',
                      cursor: 'default',
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="lng-ro" style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: C.inkMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                    Longitude
                  </label>
                  <input
                    id="lng-ro"
                    readOnly
                    value={state.coords ? state.coords.lng.toFixed(6) : ""}
                    placeholder="auto"
                    style={{
                      width: '100%', height: 44, padding: '0 12px', borderRadius: 10,
                      border: `1.5px dashed ${C.sand}`, background: C.mist,
                      fontSize: '0.85rem', color: C.inkSoft, outline: 'none',
                      cursor: 'default',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Recherche d'adresse — mode Location uniquement */}
          {state.mode === "location" && (
          <div style={{
            background: C.paper,
            border: `1px solid ${C.sandLight}`,
            borderRadius: 18,
            padding: '1.25rem 1.5rem',
            boxShadow: '0 2px 8px rgba(26,20,16,0.04)',
          }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink, marginBottom: 14 }}>
              Recherche d'adresse
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label htmlFor="street" style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: C.inkMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                  Rue / Avenue
                </label>
                <input
                  id="street"
                  value={state.street}
                  onChange={(e) => update({ street: e.target.value })}
                  placeholder="Ex. Avenue Mohammed V"
                  style={{
                    width: '100%', height: 44, padding: '0 14px', borderRadius: 10,
                    border: `1.5px solid ${C.sandLight}`, background: C.paper,
                    fontSize: '0.85rem', color: C.ink, outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={e => { e.target.style.borderColor = C.terra; e.target.style.boxShadow = `0 0 0 3px ${C.terraMuted}`; }}
                  onBlur={e => { e.target.style.borderColor = C.sandLight; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              <button
                type="button"
                onClick={handleSearch}
                disabled={searching}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  height: 44, padding: '0 1.25rem', borderRadius: 10,
                  background: C.paper, border: `1.5px solid ${C.terra}`,
                  color: C.terra, fontSize: '0.84rem', fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.2s ease', marginTop: 4,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.terra; e.currentTarget.style.color = C.paper; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.paper; e.currentTarget.style.color = C.terra; }}
              >
                {searching ? (
                  <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
                ) : (
                  <Search style={{ width: 16, height: 16 }} />
                )}
                Localiser sur la carte
              </button>
            </div>

            {error && <p style={{ marginTop: 12, fontSize: '0.78rem', color: '#C42020', fontWeight: 600 }}>{error}</p>}
          </div>
          )}

          {(showMarker || hasManualAddress) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '1.125rem 1.25rem', borderRadius: 16,
                background: C.terraMuted, border: `1px solid rgba(154,66,29,0.22)`,
              }}>
                <span style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `linear-gradient(135deg, ${C.terraDeep}, ${C.terraLight})`,
                  color: C.paper, boxShadow: '0 4px 12px rgba(154,66,29,0.28)',
                }}>
                  <MapPin style={{ width: 18, height: 18 }} />
                </span>
                <div>
                  <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.terra, marginBottom: 2 }}>Adresse sélectionnée</p>
                  <p style={{ fontSize: '0.88rem', fontWeight: 700, color: C.ink, lineHeight: 1.35 }}>
                    {state.address || [state.quartier ?? state.neighborhood, state.street, state.city ?? ""].filter(Boolean).join(", ")}
                  </p>
                  {(state.city || state.quartier) && (
                    <p style={{ fontSize: '0.75rem', color: C.inkMuted, marginTop: 4 }}>
                      {[state.quartier, state.city].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>

              {state.neighborhood && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '0.875rem 1.125rem', borderRadius: 14,
                  background: 'rgba(154,66,29,0.06)', border: `1px solid rgba(154,66,29,0.2)`,
                }}>
                  <Sparkles style={{ width: 16, height: 16, color: C.terra, flexShrink: 0 }} />
                  <div style={{ fontSize: '0.8rem', color: C.ink, lineHeight: 1.35 }}>
                    <span style={{ color: C.terra, fontWeight: 700 }}>Quartier Dataset IA associé : </span>
                    <strong>{state.neighborhood}</strong>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Interactive Map */}
        <div style={{
          position: 'relative', height: 420, width: '100%', minWidth: 0, borderRadius: 20, overflow: 'hidden',
          border: `1.5px solid ${C.sandLight}`, boxShadow: '0 8px 24px rgba(26,20,16,0.08)',
        }}>
          <MapContainer
            center={showMarker ? [state.coords!.lat, state.coords!.lng] : DEFAULT_MAP_CENTER}
            zoom={DEFAULT_MAP_ZOOM}
            scrollWheelZoom
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickCatcher onPick={pickCoords} />
            {showMarker && (
              <>
                <Marker position={[state.coords!.lat, state.coords!.lng]} icon={pinIcon} />
                <Recenter lat={state.coords!.lat} lng={state.coords!.lng} zoom={recenterZoom} />
              </>
            )}
          </MapContainer>
          <div style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(254,252,248,0.92)', backdropFilter: 'blur(10px)',
            border: `1px solid ${C.sandLight}`, borderRadius: 999,
            padding: '6px 16px', fontSize: '0.75rem', fontWeight: 700, color: C.ink,
            display: 'flex', alignItems: 'center', gap: 6, zIndex: 1000,
            boxShadow: '0 4px 16px rgba(26,20,16,0.12)',
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }}>
            <MousePointerClick style={{ width: 14, height: 14, color: C.terra }} />
            Cliquez sur la carte pour affiner la position
          </div>
        </div>
      </div>
    </div>
  );
}
/* ============================================================
   Étape 4 — Caractéristiques du bien
   ============================================================ */

const FLOOR_TYPE_OPTIONS: { value: FloorType; label: string }[] = [
  { value: "semantique", label: "Étage sémantique" },
  { value: "position", label: "Position exacte de l'étage" },
];

function StepFeatures({
  state,
  update,
}: {
  state: FormState;
  update: (patch: Partial<FormState>) => void;
}) {
  const terrain = isTerrain(state.propertyType);
  // Types « Terrain » et « Local commercial » : uniquement la surface
  // (pas de chambres, salles de bain ni étage) — vente comme location.
  const noExtras = terrain || state.propertyType === "local-commercial";
// En mode LOCATION : le champ « étage » change de sens selon le type de bien.
  //  - Appartement -> position de l'étage dans l'immeuble
  //  - Villa / Maison -> nombre d'étages dans le bien
  const isLocAppt = state.mode === "location" && state.propertyType === "appartement";
  const isLocVillaMaison = state.mode === "location" && (state.propertyType === "villa" || state.propertyType === "maison");
  const locUsesFloorNumber = isLocAppt || isLocVillaMaison;

  const fieldInputStyle = {
    width: '100%', height: 46, padding: '0 16px', borderRadius: 12,
    border: `1.5px solid ${C.sandLight}`, background: C.paper,
    fontSize: '0.9rem', color: C.ink, outline: 'none',
    transition: 'all 0.2s ease',
  };

  return (
    <div>
      <div style={{ marginBottom: '0.5rem' }}>
        <p style={{
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.22em',
          textTransform: 'uppercase', color: C.terra, marginBottom: 8,
        }}>
          Étape 4 · Caractéristiques
        </p>
        <h2 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          color: C.ink, fontSize: 'clamp(1.6rem,3vw,2.2rem)',
          fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.15,
        }}>
          Caractéristiques du bien
        </h2>
      </div>
      <p style={{ color: C.inkMuted, fontSize: '0.9rem', marginTop: 6, marginBottom: 28 }}>
        Renseignez la surface et la composition de votre bien.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900 }}>
        {/* Dimensions grid */}
        <div style={{
          display: 'grid', gap: 20,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        }}>
          {/* Surface */}
          <div style={{
            background: C.paper, border: `1px solid ${C.sandLight}`,
            borderRadius: 18, padding: '1.25rem', boxShadow: '0 2px 8px rgba(26,20,16,0.04)',
          }}>
            <label htmlFor="surface" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', fontWeight: 700, color: C.ink, marginBottom: 10, textTransform: 'uppercase' }}>
              <Ruler style={{ width: 16, height: 16, color: C.terra }} />
              Surface (m²) <span style={{ color: '#C42020' }}>*</span>
            </label>
            <input
              id="surface"
              type="number"
              min={1}
              step="any"
              inputMode="decimal"
              value={state.surface}
              onChange={(e) => update({ surface: e.target.value })}
              placeholder="Ex. 85"
              style={fieldInputStyle}
              onFocus={e => { e.target.style.borderColor = C.terra; e.target.style.boxShadow = `0 0 0 3px ${C.terraMuted}`; }}
              onBlur={e => { e.target.style.borderColor = C.sandLight; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {!noExtras && (
            <>
              {/* Chambres */}
              <div style={{
                background: C.paper, border: `1px solid ${C.sandLight}`,
                borderRadius: 18, padding: '1.25rem', boxShadow: '0 2px 8px rgba(26,20,16,0.04)',
              }}>
                <label htmlFor="rooms" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', fontWeight: 700, color: C.ink, marginBottom: 10, textTransform: 'uppercase' }}>
                  <BedDouble style={{ width: 16, height: 16, color: C.terra }} />
                  Nombre de chambres
                </label>
                <input
                  id="rooms"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={state.rooms}
                  onChange={(e) => update({ rooms: e.target.value })}
                  placeholder="Ex. 2"
                  style={fieldInputStyle}
                  onFocus={e => { e.target.style.borderColor = C.terra; e.target.style.boxShadow = `0 0 0 3px ${C.terraMuted}`; }}
                  onBlur={e => { e.target.style.borderColor = C.sandLight; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              {/* Salles de bain */}
              <div style={{
                background: C.paper, border: `1px solid ${C.sandLight}`,
                borderRadius: 18, padding: '1.25rem', boxShadow: '0 2px 8px rgba(26,20,16,0.04)',
              }}>
                <label htmlFor="bathrooms" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', fontWeight: 700, color: C.ink, marginBottom: 10, textTransform: 'uppercase' }}>
                  <Bath style={{ width: 16, height: 16, color: C.terra }} />
                  Salles de bain
                </label>
                <input
                  id="bathrooms"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={state.bathrooms}
                  onChange={(e) => update({ bathrooms: e.target.value })}
                  placeholder="Ex. 1"
                  style={fieldInputStyle}
                  onFocus={e => { e.target.style.borderColor = C.terra; e.target.style.boxShadow = `0 0 0 3px ${C.terraMuted}`; }}
                  onBlur={e => { e.target.style.borderColor = C.sandLight; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </>
          )}
        </div>

        {/* Étage (si applicable) */}
        {!noExtras && (
          <div style={{
            background: C.paper, border: `1px solid ${C.sandLight}`,
            borderRadius: 20, padding: '1.5rem', boxShadow: '0 2px 8px rgba(26,20,16,0.04)',
          }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 700, color: C.ink, marginBottom: 14, textTransform: 'uppercase' }}>
              <Layers style={{ width: 16, height: 16, color: C.terra }} />
              {isLocAppt ? "Position de l'étage" : isLocVillaMaison ? "Nombre d'étages du bien" : "Étage du bien"}
            </p>

            {state.mode === "vente" && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                {FLOOR_TYPE_OPTIONS.map((option) => {
                  const active = state.floorType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => update({ floorType: option.value })}
                      style={{
                        padding: '8px 18px', borderRadius: 10, fontSize: '0.83rem', fontWeight: 600,
                        border: `1.5px solid ${active ? C.terra : C.sandLight}`,
                        background: active ? `linear-gradient(135deg, ${C.terraDeep}, ${C.terraLight})` : C.mist,
                        color: active ? C.paper : C.inkSoft,
                        cursor: 'pointer', transition: 'all 0.2s ease',
                        boxShadow: active ? '0 4px 14px rgba(154,66,29,0.28)' : 'none',
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}

            {state.mode === "vente" && state.floorType === "position" ? (
              <div style={{ maxWidth: 280 }}>
                <label htmlFor="floorPosition" style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: C.inkMuted, marginBottom: 6 }}>
                  Numéro d'étage
                </label>
                <input
                  id="floorPosition"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={state.floorPosition}
                  onChange={(e) => update({ floorPosition: e.target.value })}
                  placeholder="Ex. 3"
                  style={fieldInputStyle}
                  onFocus={e => { e.target.style.borderColor = C.terra; e.target.style.boxShadow = `0 0 0 3px ${C.terraMuted}`; }}
                  onBlur={e => { e.target.style.borderColor = C.sandLight; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            ) : locUsesFloorNumber ? (
              <div style={{ maxWidth: 320 }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: C.inkMuted, marginBottom: 6 }}>
                  {isLocAppt ? "Étage où se situe le bien (position)" : "Nombre d'étages dans le bien"}
                </label>
                <input
                  type="number"
                  min={isLocAppt ? 0 : 1}
                  inputMode="numeric"
                  value={state.floorPosition}
                  onChange={(e) => update({ floorPosition: e.target.value })}
                  placeholder={isLocAppt ? "Ex. 2" : "Ex. 2"}
                  style={fieldInputStyle}
                  onFocus={e => { e.target.style.borderColor = C.terra; e.target.style.boxShadow = `0 0 0 3px ${C.terraMuted}`; }}
                  onBlur={e => { e.target.style.borderColor = C.sandLight; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            ) : (
              <div style={{ maxWidth: 320 }}>
                <select
                  value={state.floorLabel}
                  onChange={(e) => update({ floorLabel: e.target.value })}
                  style={{
                    width: '100%', height: 46, padding: '0 16px', borderRadius: 12,
                    border: `1.5px solid ${C.sandLight}`, background: C.paper,
                    fontSize: '0.88rem', color: C.ink, outline: 'none', cursor: 'pointer',
                  }}
                >
                  {FLOOR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {noExtras && (
          <p style={{
            padding: '1rem 1.25rem', borderRadius: 14, background: C.terraMuted,
            border: `1px solid rgba(154,66,29,0.2)`, fontSize: '0.85rem', color: C.terra, fontWeight: 500,
          }}>
            {terrain
              ? "Le type « Terrain » ne nécessite pas de caractéristiques de pièces ou d'étage — seule la surface est requise."
              : "Le type « Local commercial » ne nécessite pas de chambres ni de salles de bain — seule la surface est requise."}
          </p>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Étape 5 — Équipements
   ============================================================ */

function StepEquipment({
  state,
  update,
}: {
  state: FormState;
  update: (patch: Partial<FormState>) => void;
}) {
  const toggle = (value: EquipmentKey) => {
    const has = state.equipment.includes(value);
    update({
      equipment: has
        ? state.equipment.filter((item) => item !== value)
        : [...state.equipment, value],
    });
  };

  return (
    <div>
      <div style={{ marginBottom: '0.5rem' }}>
        <p style={{
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.22em',
          textTransform: 'uppercase', color: C.terra, marginBottom: 8,
        }}>
          Étape 5 · Équipements
        </p>
        <h2 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          color: C.ink, fontSize: 'clamp(1.6rem,3vw,2.2rem)',
          fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.15,
        }}>
          Équipements du bien
        </h2>
      </div>
      <p style={{ color: C.inkMuted, fontSize: '0.9rem', marginTop: 6, marginBottom: 28 }}>
        Sélectionnez les équipements et prestations disponibles (étape optionnelle).
      </p>

      <div style={{
        display: 'grid', gap: 14,
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      }}>
        {EQUIPMENT.map(({ value, label, icon: Icon }) => {
          const checked = state.equipment.includes(value);
          return (
            <label
              key={value}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '1.125rem 1.25rem', borderRadius: 16,
                border: `2px solid ${checked ? C.terra : C.sandLight}`,
                background: checked ? `rgba(154,66,29,0.04)` : C.paper,
                boxShadow: checked
                  ? `0 0 0 3px ${C.terraMuted}, 0 6px 18px rgba(154,66,29,0.12)`
                  : '0 2px 6px rgba(26,20,16,0.04)',
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                if (!checked) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.borderColor = C.terra;
                }
              }}
              onMouseLeave={e => {
                if (!checked) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = C.sandLight;
                }
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(value)}
                style={{
                  width: 18, height: 18, borderRadius: 5, accentColor: C.terra, cursor: 'pointer', flexShrink: 0,
                }}
              />
              <span style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: checked ? C.terraMuted : C.sandPale,
              }}>
                <Icon style={{ width: 17, height: 17, color: checked ? C.terra : C.inkMuted }} />
              </span>
              <span style={{ fontSize: '0.88rem', fontWeight: checked ? 700 : 500, color: checked ? C.terra : C.ink }}>
                {label}
              </span>
            </label>
          );
        })}
      </div>

      <p style={{ marginTop: 24, fontSize: '0.78rem', color: C.inkMuted, fontWeight: 500 }}>
        {state.equipment.length > 0
          ? `${state.equipment.length} équipement${state.equipment.length > 1 ? "s" : ""} sélectionné${
              state.equipment.length > 1 ? "s" : ""
            }`
          : "Aucun équipement sélectionné"}
      </p>
    </div>
  );
}


/* ============================================================
   Étape 6 — Résultat
   ============================================================ */

function InfoTilePremium({
  icon: Icon, label, value,
}: {
  icon: LucideIcon; label: string; value: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '1rem 1.125rem',
      background: C.paper,
      border: `1px solid ${C.sandLight}`,
      borderRadius: 14,
      boxShadow: '0 2px 6px rgba(26,20,16,0.06)',
      transition: 'all 0.2s ease',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 14px rgba(26,20,16,0.09)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 6px rgba(26,20,16,0.06)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      <span style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: C.terraMuted,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5)`,
      }}>
        <Icon style={{ width: 16, height: 16, color: C.terra }} />
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.inkMuted, marginBottom: 3 }}>{label}</p>
        <p style={{ fontSize: '0.84rem', fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
      </div>
    </div>
  );
}

function StepResult({ state, onReset }: { state: FormState; onReset: () => void }) {
  const navigate = useNavigate();
  const { result: mlResult, isLoading: mlLoading, error: mlError, predictPrice } = usePredictionVenteStore();
  const {
    result: locResult,
    isLoading: locLoading,
    error: locError,
    predictLocation,
  } = usePredictionLocationStore();
  const localResult = computeEstimate(state);
  const addEntry = useHistoryStore((s) => s.addEntry);
  const currentUser = useAuthStore((s) => s.user);

  const hasRecordedRef = useRef(false);
  const lastStateKeyRef = useRef<string>('');
  const currentStateKey = JSON.stringify(state);

  if (lastStateKeyRef.current !== currentStateKey) {
    lastStateKeyRef.current = currentStateKey;
    hasRecordedRef.current = false;
  }

  // ── VENTE : prédiction CatBoost ──────────────────────────────────────────
  useEffect(() => {
    if (state.mode === 'vente') {
      const propTypeMap: Record<string, string> = {
        appartement: 'Appartement',
        villa: 'Villa',
        maison: 'Maison',
        riad: 'Riad',
        terrain: 'Terrain',
        'local-commercial': 'Local commercial',
      };

      const latDefault = DEFAULT_MAP_CENTER[0];
      const lngDefault = DEFAULT_MAP_CENTER[1];

      const quartierResolved = state.quartier || resolveQuartier(
        state.coords?.lat ?? latDefault,
        state.coords?.lng ?? lngDefault,
        state.neighborhood || state.address || state.street
      ).matchedQuartier;

      const payload: PredictionPayload = {
        type_bien: state.propertyType ? propTypeMap[state.propertyType] || 'Appartement' : 'Appartement',
        localisation_quartier: quartierResolved || state.neighborhood.trim() || 'Guéliz',
        commune_fr: state.city || 'Marrakech',
        latitude: state.coords?.lat ?? latDefault,
        longitude: state.coords?.lng ?? lngDefault,
        surface_consolidee_m2: parseFloat(state.surface) || 100,
        surface_habitable_m2: parseFloat(state.surface) || 90,
        total_pieces: (parseInt(state.rooms) || 2) + (parseInt(state.bathrooms) || 1) + 1,
        chambres: parseInt(state.rooms) || 2,
        salles_bain: parseInt(state.bathrooms) || 1,
        salons: 1,
        etages: parseInt(state.floorPosition) || 1,
        etage_semantique: state.floorLabel || 'etage_situation',
        equipement_ascenseur: state.equipment.includes('ascenseur') ? 1 : 0,
        equipement_balcon: state.equipment.includes('balcon') ? 1 : 0,
        equipement_climatisation: state.equipment.includes('climatisation') ? 1 : 0,
        equipement_meuble: state.equipment.includes('meuble') ? 1 : 0,
        equipement_parking: state.equipment.includes('parking') ? 1 : 0,
        equipement_securite: state.equipment.includes('securite') ? 1 : 0,
        equipement_terrasse: state.equipment.includes('terrasse') ? 1 : 0,
        equipement_piscine: state.equipment.includes('piscine') ? 1 : 0,
        equipement_jardin: state.equipment.includes('jardin') ? 1 : 0,
      };

      predictPrice(payload);

    }
  }, [state, predictPrice]);

  // ── LOCATION : XGBoost + régression quantile + contributions SHAP ─────
  useEffect(() => {
    if (state.mode === 'location') {
      const propTypeMap: Record<string, string> = {
        appartement: 'Appartement',
        villa: 'Villa',
        maison: 'Maison',
        riad: 'Riad / Villa',
        terrain: 'Terrain',
        'local-commercial': 'Magasin / Commerce',
      };
      predictLocation({
        periode: state.periode === 'nuitee' ? 'nuitee' : 'mensuel',
        type_bien: state.propertyType ? propTypeMap[state.propertyType] || 'Appartement' : 'Appartement',
        quartier: state.quartier || state.neighborhood.trim() || null,
        commune_officielle: state.city || 'Marrakech',
        superficie_m2: parseFloat(state.surface) || 80,
        chambres: parseInt(state.rooms) || 2,
        salles_de_bain: parseInt(state.bathrooms) || 1,
        nb_etages: parseInt(state.floorPosition) || 0,
        salons: 1,
        capacite: null,
        equipements: state.equipment,
      });
    }
  }, [state, predictLocation]);

  // Résultat effectif : ML Vente / ML Location / fallback local
  const activeResult = state.mode === 'location' ? locResult : mlResult;
  const activeError = state.mode === 'location' ? locError : mlError;
  const isLoading = state.mode === 'location' ? locLoading : mlLoading;

  const finalPrice =
    state.mode === 'location'
      ? locResult?.predicted_price ?? localResult?.estimate ?? 0
      : mlResult?.prediction?.predicted_price ?? localResult?.estimate ?? 0;

  const finalPriceM2 =
    state.mode === 'location'
      ? locResult?.price_per_m2 ?? localResult?.pricePerSqm ?? 0
      : mlResult?.prediction?.price_per_m2 ?? localResult?.pricePerSqm ?? 0;

  const finalLow =
    state.mode === 'location'
      ? locResult?.confidence_range?.low ?? localResult?.low ?? 0
      : mlResult?.prediction?.confidence_range?.low ?? localResult?.low ?? 0;

  const finalHigh =
    state.mode === 'location'
      ? locResult?.confidence_range?.high ?? localResult?.high ?? 0
      : mlResult?.prediction?.confidence_range?.high ?? localResult?.high ?? 0;
  // SHAP : Location → contributions du modèle XGBoost ; Vente → facteurs
  // CatBoost natifs (`shap_factors`, impact en MAD). Même rendu pour les deux.
  const shapValues: ShapEntry[] =
    state.mode === 'location'
      ? locResult?.shap_values ?? []
      : (mlResult?.prediction?.shap_factors ?? []).map((f) => ({
          feature: f.feature,
          label: f.feature,
          contribution: f.impact_mad,
        }));

  // Enregistrer le VRAI résultat (ML ou Local) dans l'historique une seule fois après la fin des calculs
  useEffect(() => {
    if (state.mode === 'vente') {
      if (mlLoading) return;
      if (!mlResult && !mlError) return;
    } else if (state.mode === 'location') {
      if (locLoading) return;
      if (!locResult && !locError) return;
    }

    if (finalPrice > 0 && currentUser && !hasRecordedRef.current) {
      hasRecordedRef.current = true;
      addEntry({
        type: 'estimation',
        label: `Estimation ${state.mode === 'vente' ? 'vente' : 'location'} — ${state.propertyType ? PROPERTY_LABEL[state.propertyType] : '—'} à ${state.city || '—'}`,
        user: {
          id: currentUser._id,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          email: currentUser.email,
        },
        details: {
          mode: state.mode as 'vente' | 'location',
          propertyType: state.propertyType ? PROPERTY_LABEL[state.propertyType] : '—',
          city: state.city || '—',
          neighborhood: state.quartier || state.neighborhood || undefined,
          surface: state.surface,
          rooms: state.rooms || undefined,
          bathrooms: state.bathrooms || undefined,
          equipment: state.equipment.map((k) => EQUIPMENT_LABEL[k]),
          address: state.address || undefined,
          estimate: finalPrice,
          low: finalLow,
          high: finalHigh,
          pricePerSqm: finalPriceM2,
        },
      });
    }
  }, [state, mlLoading, mlResult, mlError, locLoading, locResult, locError, localResult, finalPrice, finalLow, finalHigh, finalPriceM2, currentUser, addEntry]);

  // Chargement ML (Vente & Location)
  if (isLoading) {
    return (
      <div style={{ padding: '4rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <Loader2 style={{ width: 42, height: 42, color: C.terra, animation: 'spin 1s linear infinite' }} />
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: C.ink, marginBottom: 4 }}>
            {state.mode === 'location' ? "Analyse par l'IA XGBoost en cours..." : "Analyse par l'IA CatBoost en cours..."}
          </h3>
          <p style={{ fontSize: '0.85rem', color: C.inkMuted }}>
            {state.mode === 'location'
              ? 'Notre modèle de location (XGBoost + régression quantile) évalue votre bien selon ses caractéristiques et son quartier.'
              : "Notre modèle Machine Learning évalue votre bien selon 67 variables et critères géographiques."}
          </p>
        </div>
      </div>
    );
  }

  if (!localResult && !activeResult) {
    return (
      <div style={{ padding: '3rem 0', textAlign: 'center', color: C.inkMuted }}>
        Impossible de calculer une estimation avec les informations fournies.
      </div>
    );
  }

  const location =
    state.address ||
    [state.quartier ?? state.neighborhood, state.street, state.city ?? '']
      .filter(Boolean)
      .join(', ');

  // Recalcul des repères d'étage LOCATION (même logique que StepFeatures)
  const isLocAppt = state.mode === "location" && state.propertyType === "appartement";
  const isLocVillaMaison = state.mode === "location" && (state.propertyType === "villa" || state.propertyType === "maison");
  const locUsesFloorNumber = isLocAppt || isLocVillaMaison;

  const floorLabel =
    state.mode === 'vente' && state.floorType === 'position'
      ? `Étage ${state.floorPosition || '—'} (position exacte)`
      : locUsesFloorNumber
        ? isLocAppt
          ? `${state.floorPosition ? `Étage ${state.floorPosition}` : '—'} (position)`
          : `${state.floorPosition ? `${state.floorPosition} étage${Number(state.floorPosition) > 1 ? 's' : ''}` : '—'} (nombre d'étages)`
        : FLOOR_OPTIONS.find((o) => o.value === state.floorLabel)?.label;

  const terrain = isTerrain(state.propertyType);
  const propertyIcon =
    PROPERTY_TYPES.find((p) => p.value === state.propertyType)?.icon ?? Building2;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.terra, marginBottom: 6 }}>Résultat</p>
          <h2 style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            color: C.ink, fontSize: 'clamp(1.5rem,2.5vw,2rem)',
            fontWeight: 400, letterSpacing: '-0.02em',
          }}>
            Votre estimation
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {state.mode === 'vente' && mlResult && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', background: 'rgba(154,66,29,0.12)',
              border: `1px solid ${C.terra}`, borderRadius: 999,
              fontSize: '0.7rem', fontWeight: 700, color: C.terra,
            }}>
              <Cpu style={{ width: 13, height: 13 }} /> Modèle ML CatBoost
            </span>
          )}
          {state.mode === 'location' && locResult && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', background: 'rgba(154,66,29,0.12)',
              border: `1px solid ${C.terra}`, borderRadius: 999,
              fontSize: '0.7rem', fontWeight: 700, color: C.terra,
            }}>
              <Cpu style={{ width: 13, height: 13 }} /> Modèle ML XGBoost + quantile
            </span>
          )}
          <span style={{
            padding: '4px 14px',
            background: C.terraMuted,
            border: `1px solid rgba(154,66,29,0.25)`,
            borderRadius: 999,
            fontSize: '0.68rem', fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: C.terra,
          }}>
            {state.mode ? MODE_LABEL[state.mode] : ''}
          </span>
        </div>
      </div>

      {activeError && (
        <div style={{
          padding: '10px 16px', background: 'rgba(196,32,32,0.08)',
          border: '1px solid rgba(196,32,32,0.25)', borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 10, color: '#C42020',
          fontSize: '0.82rem', marginBottom: 16,
        }}>
          <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>Une erreur s'est produite lors de la connexion au service ML Python. Estimation indicative locale affichée.</span>
        </div>
      )}

      {/* Premium result card */}
      <div style={{
        background: `linear-gradient(145deg, ${C.terraDeep} 0%, ${C.terraDark} 30%, ${C.terra} 65%, ${C.terraLight} 100%)`,
        borderRadius: 22,
        padding: '2rem 2.25rem',
        color: C.paper,
        boxShadow: `0 20px 56px rgba(154,66,29,0.38), 0 1px 0 rgba(255,255,255,0.1) inset`,
        position: 'relative', overflow: 'hidden',
        marginBottom: 24,
      }}>
        {/* Zellige overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='none'/%3E%3Crect x='10' y='10' width='20' height='20' fill='none' stroke='%23ffffff' stroke-width='0.4'/%3E%3Ccircle cx='20' cy='20' r='1.5' fill='%23ffffff'/%3E%3C/svg%3E")`,
          backgroundSize: '40px 40px',
          opacity: 0.06, pointerEvents: 'none',
        }} />
        {/* Glare */}
        <div style={{
          position: 'absolute', top: '-30%', right: '-5%',
          width: '45%', height: '130%',
          background: 'radial-gradient(ellipse, rgba(255,255,255,0.09) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, position: 'relative' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', opacity: 0.75 }}>
            Prix {state.mode === 'location'
              ? (state.periode === 'nuitee' ? 'de location par nuit' : 'de location mensuelle')
              : 'de vente estimé'}
          </p>
          {(state.mode === 'vente' && mlResult) || (state.mode === 'location' && locResult) ? (
            <span style={{ fontSize: '0.72rem', opacity: 0.85, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles style={{ width: 12, height: 12 }} /> Prédiction IA
            </span>
          ) : null}
        </div>

        <p style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 'clamp(2.4rem,5vw,3.2rem)',
          fontWeight: 400, letterSpacing: '-0.02em',
          lineHeight: 1.1, marginBottom: mlResult?.price_data_source ? 8 : 20,
          position: 'relative',
        }}>
          {formatPrice(finalPrice)}
        </p>

        {mlResult?.price_data_source && (
          <div style={{ marginBottom: 20, display: 'inline-block', padding: '4px 10px', background: 'rgba(255,255,255,0.15)', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600 }}>
            Source du prix : {mlResult.price_data_source === 'predicted' ? 'Prédiction IA' : 'Fourni par l\'utilisateur'}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem 2rem', marginBottom: 16, position: 'relative' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.83rem', opacity: 0.9 }}>
            <Ruler style={{ width: 14, height: 14 }} />
            {formatPrice(finalPriceM2)} / m²
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.83rem', opacity: 0.9 }}>
            <TrendingUp style={{ width: 14, height: 14 }} />
            {formatPrice(finalLow)} – {formatPrice(finalHigh)}
          </span>
        </div>

        <p style={{ fontSize: '0.72rem', opacity: 0.6, display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          <MoveRight style={{ width: 12, height: 12 }} />
          Estimation indicative — hors frais de notaire et taxes.
        </p>
      </div>

      {/* Info tiles grid */}
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', marginBottom: 20 }}>

        <InfoTilePremium icon={MapPin} label="Localisation" value={location || '—'} />
        <InfoTilePremium icon={Ruler} label="Surface" value={`${state.surface} m²`} />
        <InfoTilePremium
          icon={Building2}
          label="Ville"
          value={state.city || '—'}
        />
        <InfoTilePremium
          icon={propertyIcon}
          label="Type de bien"
          value={state.propertyType ? PROPERTY_LABEL[state.propertyType] : '—'}
        />

        {!terrain && (
          <>
            <InfoTilePremium icon={BedDouble} label="Chambres" value={state.rooms || '—'} />
            <InfoTilePremium icon={Bath} label="Salles de bain" value={state.bathrooms || '—'} />
            <InfoTilePremium icon={Layers} label="Étage" value={floorLabel ?? '—'} />
          </>
        )}
      </div>

      {state.equipment.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: C.ink, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Équipements</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {state.equipment.map((key) => {
              const Icon = EQUIPMENT.find((e) => e.value === key)?.icon;
              return (
                <span
                  key={key}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px',
                    borderRadius: 999,
                    border: `1px solid rgba(154,66,29,0.22)`,
                    background: C.terraMuted,
                    fontSize: '0.75rem', fontWeight: 600, color: C.terra,
                  }}
                >
                  {Icon && <Icon style={{ width: 12, height: 12 }} />}
                  {EQUIPMENT_LABEL[key]}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Facteurs d'impact (SHAP) — Vente & Location ─────────── */}
      {shapValues.length > 0 && (
        <div style={{
          background: C.paper, border: `1px solid ${C.sandLight}`,
          borderRadius: 20, padding: '1.5rem 1.75rem',
          boxShadow: '0 2px 8px rgba(26,20,16,0.04)', marginBottom: 24,
        }}>
          <p style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: '0.78rem', fontWeight: 700, color: C.ink,
            marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            <Cpu style={{ width: 16, height: 16, color: C.terra }} />
            Facteurs d'impact sur le prix
          </p>
          <p style={{ fontSize: '0.8rem', color: C.inkMuted, marginBottom: 18 }}>
            Contributions SHAP du modèle : ce qui augmente
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#1F5C3F', margin: '0 6px', verticalAlign: 'middle' }} />
            ou diminue
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#7A2E22', margin: '0 6px', verticalAlign: 'middle' }} />
            le {state.mode === 'location' ? 'loyer' : 'prix de vente'} estimé{state.mode === 'location' ? '' : ' (MAD)'}.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(() => {
              const maxAbs = Math.max(...shapValues.map((s) => Math.abs(s.contribution)), 1);
              return shapValues.map((s) => {
                const positive = s.contribution >= 0;
                const pct = (Math.abs(s.contribution) / maxAbs) * 50;
                return (
                  <div key={s.feature} style={{ display: 'grid', gridTemplateColumns: 'minmax(96px, 170px) 1fr minmax(64px, 90px)', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: C.inkSoft, textAlign: 'right' }}>
                      {s.label}
                    </span>
                    <div style={{ position: 'relative', height: 18 }}>
                      {/* axe central */}
                      <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: C.sandLight }} />
                      {positive ? (
                        <div style={{
                          position: 'absolute', left: '50%', top: 2, bottom: 2,
                          width: `${pct}%`, background: '#1F5C3F', borderRadius: '0 6px 6px 0',
                        }} />
                      ) : (
                        <div style={{
                          position: 'absolute', right: '50%', top: 2, bottom: 2,
                          width: `${pct}%`, background: '#7A2E22', borderRadius: '6px 0 0 6px',
                        }} />
                      )}
                    </div>
                    <span style={{
                      fontSize: '0.78rem', fontWeight: 700,
                      color: positive ? '#1F5C3F' : '#7A2E22',
                    }}>
                      {positive ? '+' : '−'}{formatPrice(Math.abs(s.contribution))}
                    </span>
                  </div>
                );
              });
            })()}
          </div>

          <p style={{ marginTop: 14, fontSize: '0.72rem', color: C.inkMuted }}>
            Lecture : une barre verte signifie que ce facteur tire le loyer vers le haut par rapport à un bien de référence ; une barre rouge le tire vers le bas.
          </p>
        </div>
      )}

      {/* ── Lien vers le Rapport complet (génération IA + PDF uniquement là-bas) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => navigate('/rapport-complet')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '0.7rem 1.75rem',
            borderRadius: 12,
            fontSize: '0.85rem', fontWeight: 700,
            color: C.paper,
            background: `linear-gradient(135deg, ${C.terraDark}, ${C.terraLight})`,
            border: 'none', cursor: 'pointer',
            transition: 'all 0.22s ease',
            boxShadow: '0 8px 24px rgba(154,66,29,0.3)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 14px 36px rgba(154,66,29,0.38)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(154,66,29,0.3)';
          }}
        >
          <FileText style={{ width: 15, height: 15 }} />
          Continuer vers le Rapport complet
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={onReset}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '0.7rem 1.75rem',
            borderRadius: 12,
            fontSize: '0.875rem', fontWeight: 600,
            color: C.inkSoft,
            background: C.paper,
            border: `1.5px solid ${C.sand}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 6px rgba(26,20,16,0.06)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = C.terra;
            e.currentTarget.style.color = C.terra;
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(26,20,16,0.1)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = C.sand;
            e.currentTarget.style.color = C.inkSoft;
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(26,20,16,0.06)';
          }}
        >
          <RefreshCcw style={{ width: 15, height: 15 }} />
          Nouvelle estimation
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Parcours principal
   ============================================================ */

const TOTAL_STEPS = 6;

function stepError(index: number, state: FormState): string | null {
  switch (index) {
    case 0:
      if (!state.mode) return "Sélectionnez un type d'estimation pour continuer.";
      if (state.mode === 'location' && !state.periode) {
        return "Choisissez la période de location (par mois ou par nuit) pour continuer.";
      }
      return null;
    case 1:
      return state.propertyType
        ? null
        : "Sélectionnez le type de bien pour continuer.";
    case 2: {
      const manual = state.street.trim() !== "" || state.neighborhood.trim() !== "";
      if (state.coords || manual) return null;
      return "Indiquez une adresse ou placez un point sur la carte.";
    }
    case 3: {
      const surface = parseFloat(state.surface);
      if (state.surface.trim() === "" || !Number.isFinite(surface) || surface <= 0) {
        return "Saisissez une surface valide (supérieure à 0 m²).";
      }
      return null;
    }
    case 4:
      return null;
    default:
      return null;
  }
}

const STEP_HISTORY_LABELS: Record<number, string> = {
  0: "Type d'estimation sélectionné",
  1: "Type de bien sélectionné",
  2: "Localisation renseignée",
  3: "Caractéristiques saisies",
  4: "Équipements sélectionnés",
};

function EstimationFlow() {
  const [state, setState] = useState<FormState>(DEFAULT_STATE);
  const [step, setStep] = useState(0);

  const addEntry  = useHistoryStore((s) => s.addEntry);
  const currentUser = useAuthStore((s) => s.user);

  const update = (patch: Partial<FormState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  };

  const error = stepError(step, state);

  const handleNext = () => {
    if (error) return;
    // ── Enregistrer le franchissement de chaque étape (sauf la dernière qui est gérée dans StepResult)
    if (currentUser && step < TOTAL_STEPS - 1) {
      const stepLabel = STEP_HISTORY_LABELS[step] ?? `Étape ${step + 1} complétée`;
      const modePart  = state.mode    ? ` (${state.mode === 'vente' ? 'Vente' : 'Location'})` : '';
      const typePart  = state.propertyType ? ` · ${PROPERTY_LABEL[state.propertyType]}` : '';
      const cityPart  = state.city    ? ` · ${state.city}` : '';
      addEntry({
        type: 'estimation',
        label: `${stepLabel}${modePart}${typePart}${cityPart}`,
        user: {
          id:        currentUser._id,
          firstName: currentUser.firstName,
          lastName:  currentUser.lastName,
          email:     currentUser.email,
        },
        details: {
          step,
          stepName: stepLabel,
          mode:          state.mode ?? undefined,
          propertyType:  state.propertyType ? PROPERTY_LABEL[state.propertyType] : undefined,
          city:          state.city ?? undefined,
          neighborhood:  state.quartier || state.neighborhood || undefined,
          surface:       state.surface || undefined,
          rooms:         state.rooms || undefined,
          bathrooms:     state.bathrooms || undefined,
          equipment:     state.equipment.length > 0 ? state.equipment.map((k) => EQUIPMENT_LABEL[k]) : undefined,
        },
      });
    }
    // Terrain / Local commercial : pas d'étape équipements → on va au résultat
    const skipsEquipment = state.propertyType === "terrain" || state.propertyType === "local-commercial";
    setStep((s) => {
      let next = s + 1;
      if (next === 4 && skipsEquipment) next = 5;
      return Math.min(TOTAL_STEPS - 1, next);
    });
  };

  const handleBack = () => {
    const skipsEquipment = state.propertyType === "terrain" || state.propertyType === "local-commercial";
    setStep((s) => {
      let prev = s - 1;
      if (prev === 4 && skipsEquipment) prev = 3;
      return Math.max(0, prev);
    });
  };

  const handleReset = () => {
    setState(DEFAULT_STATE);
    setStep(0);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: C.mist,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div aria-hidden style={{
        pointerEvents: 'none', position: 'absolute',
        top: 0, left: 0, right: 0, height: '45%',
        background: `linear-gradient(180deg, rgba(154,66,29,0.06) 0%, transparent 100%)`,
      }} />
      <div aria-hidden style={{
        pointerEvents: 'none', position: 'absolute',
        top: '10%', right: '-8%',
        width: '35vw', height: '35vw', maxWidth: 400, maxHeight: 400,
        borderRadius: '50%',
        background: `radial-gradient(ellipse, rgba(196,154,90,0.08) 0%, transparent 70%)`,
        filter: 'blur(60px)',
      }} />

      <div style={{ position: 'relative', width: '100%', padding: '1.25rem 1.5rem', margin: 0 }}>

        {/* Main card */}
        <main style={{
          background: 'rgba(254,252,248,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid rgba(208,192,168,0.6)`,
          borderRadius: 20,
          padding: '1.5rem 1.75rem',
          boxShadow: '0 16px 48px rgba(26,20,16,0.08), 0 1px 0 rgba(255,255,255,0.8) inset',
        }}>
          <ProgressSteps current={step} />

          <div style={{ marginTop: 24 }}>
            <div key={step} style={{ animation: 'fadeSlideUp 0.32s cubic-bezier(0.16,1,0.3,1) both' }}>
              {step === 0 && <StepType state={state} update={update} />}
              {step === 1 && <StepInfo state={state} update={update} />}
              {step === 2 && <StepLocation state={state} update={update} />}
              {step === 3 && <StepFeatures state={state} update={update} />}
              {step === 4 && <StepEquipment state={state} update={update} />}
              {step === 5 && <StepResult state={state} onReset={handleReset} />}
            </div>
          </div>

          {/* Footer nav */}
          <div style={{
            marginTop: 24,
            borderTop: `1px solid ${C.sandLight}`,
            paddingTop: 16,
          }}>
            {step < TOTAL_STEPS - 1 ? (
              <>
                {error && (
                  <p style={{
                    textAlign: 'center', fontSize: '0.82rem', fontWeight: 600,
                    color: '#C42020', marginBottom: 14, minHeight: 20,
                  }} aria-live="polite">
                    {error}
                  </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  {step > 0 ? (
                    <button
                      onClick={handleBack}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '0.6rem 1.25rem',
                        borderRadius: 10, fontSize: '0.875rem', fontWeight: 500,
                        color: C.inkMuted, background: 'transparent', border: 'none',
                        cursor: 'pointer', transition: 'all 0.18s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.sandLight; e.currentTarget.style.color = C.ink; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.inkMuted; }}
                    >
                      <ArrowLeft style={{ width: 15, height: 15 }} />
                      Retour
                    </button>
                  ) : <span />}

                  <button
                    onClick={handleNext}
                    disabled={Boolean(error)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '0.72rem 2rem',
                      borderRadius: 12, fontSize: '0.875rem', fontWeight: 600,
                      color: C.paper,
                      background: Boolean(error)
                        ? C.sand
                        : `linear-gradient(135deg, ${C.terraDark}, ${C.terraLight})`,
                      border: 'none', cursor: Boolean(error) ? 'not-allowed' : 'pointer',
                      opacity: Boolean(error) ? 0.6 : 1,
                      transition: 'all 0.22s ease',
                      boxShadow: Boolean(error) ? 'none' : '0 8px 24px rgba(154,66,29,0.3), 0 1px 0 rgba(255,255,255,0.12) inset',
                      minWidth: 150,
                    }}
                    onMouseEnter={e => {
                      if (!Boolean(error)) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 14px 36px rgba(154,66,29,0.38)';
                      }
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = Boolean(error) ? 'none' : '0 8px 24px rgba(154,66,29,0.3)';
                    }}
                  >
                    {step === 4 ? 'Voir le résultat' : 'Suivant'}
                    <ArrowRight style={{ width: 15, height: 15 }} />
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <button
                  onClick={handleBack}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '0.6rem 1.25rem',
                    borderRadius: 10, fontSize: '0.875rem', fontWeight: 500,
                    color: C.inkMuted, background: 'transparent', border: 'none', cursor: 'pointer',
                    transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.sandLight; e.currentTarget.style.color = C.ink; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.inkMuted; }}
                >
                  <ArrowLeft style={{ width: 15, height: 15 }} />
                  Retour
                </button>
                <span style={{ fontSize: '0.75rem', color: C.inkMuted }}>
                  Étape {step + 1} sur {TOTAL_STEPS}
                </span>
              </div>
            )}
          </div>
        </main>

        <footer style={{ marginTop: 20, textAlign: 'center', fontSize: '0.72rem', color: C.inkMuted }}>
          Estimation indicative à titre informatif — hors frais de notaire et taxes.
        </footer>
      </div>
    </div>
  );
}

export default function EstimeBien() {
  return (
    <MainLayout activeId="estimer-un-bien">
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
              Estimer un Bien Immobilier
            </h1>
            <p style={{
              fontSize: '0.88rem', color: 'rgba(254,253,250,0.85)',
              margin: 0, maxWidth: 640, lineHeight: 1.5
            }}>
              Estimez précisément la valeur locative ou le prix de vente de votre bien grâce à nos algorithmes prédictifs et analyses géospatiales.
            </p>
          </div>

         
        </div>
      </header>
      <EstimationFlow />
    </MainLayout>
  );
}
