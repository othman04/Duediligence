/**
 * rapportController.js — Orchid Island Due Diligence v2.5
 *
 * Flux:
 *   1. GeoService /enrich  → enrichissement spatial complet (OSM + Mapbox)
 *   2. MlService /predict  → prix de vente (CatBoost)
 *   3. MlService /location/predict → loyer mensuel (XGBoost)
 *   4. MlService /analyze-investment → scoring investissement & risque
 *   5. Gemini API → rapport narratif expert (9 sections)
 *   6. MongoDB → persistance
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');

const PYTHON_ML_URL   = process.env.ML_SERVICE_URL  || 'http://localhost:8000';
const GEO_SERVICE_URL = process.env.GEO_SERVICE_URL || 'http://localhost:8001';
const GEMINI_API_KEY  = process.env.GEMINI_API_KEY  || '';
const GEMINI_MODEL    = process.env.GEMINI_MODEL    || 'gemini-3.6-flash';

// ── Helper HTTP ──────────────────────────────────────────────────────
async function callService(baseUrl, path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res  = await fetch(`${baseUrl}${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `Service error ${res.status}`);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message, data: null };
  }
}

// ── Rapport Mongoose Schema ──────────────────────────────────────────
let RapportModel;
try {
  RapportModel = mongoose.model('Rapport');
} catch {
  const rapportSchema = new mongoose.Schema({
    userId:       { type: mongoose.Schema.Types.Mixed },
    userSnapshot: { firstName: String, lastName: String, email: String },
    input:        { type: mongoose.Schema.Types.Mixed },
    geo:          { type: mongoose.Schema.Types.Mixed },
    prediction:   { type: mongoose.Schema.Types.Mixed },
    location:     { type: mongoose.Schema.Types.Mixed },
    investment:   { type: mongoose.Schema.Types.Mixed },
    geminiReport: { type: String },
    status:       { type: String, default: 'completed' },
  }, { timestamps: true });
  RapportModel = mongoose.model('Rapport', rapportSchema);
}

// ── Formatage helpers ────────────────────────────────────────────────
const fmt  = (n) => n != null ? Math.round(n).toLocaleString('fr-MA') : 'N/D';
const fmtD = (n, dec = 1) => n != null ? parseFloat(n).toFixed(dec) : 'N/D';
const fmtM = (m) => m != null ? (m < 1000 ? `${Math.round(m)} m` : `${(m/1000).toFixed(2)} km`) : 'N/D';

// ── Prompt Gemini enrichi ────────────────────────────────────────────
function buildGeminiPrompt(input, geo, pred, loc, invest) {
  const prixVal  = pred?.predicted_price;
  const prix     = fmt(prixVal);
  const prixBas  = pred?.confidence_range?.low  ? fmt(pred.confidence_range.low)  : (prixVal ? fmt(prixVal * 0.90) : 'N/D');
  const prixHaut = pred?.confidence_range?.high ? fmt(pred.confidence_range.high) : (prixVal ? fmt(prixVal * 1.10) : 'N/D');

  const loyerVal  = loc?.predicted_price;
  const loyer     = fmt(loyerVal);
  const loyerBas  = loc?.confidence_range?.low  ? fmt(loc.confidence_range.low)  : (loc?.quantile_low  ? fmt(loc.quantile_low)  : (loyerVal ? fmt(loyerVal * 0.85) : 'N/D'));
  const loyerHaut = loc?.confidence_range?.high ? fmt(loc.confidence_range.high) : (loc?.quantile_high ? fmt(loc.quantile_high) : (loyerVal ? fmt(loyerVal * 1.15) : 'N/D'));

  const score       = fmtD(invest?.overall_score, 1);
  const decision    = invest?.decision || 'N/D';
  const rendBrut    = fmtD(invest?.financial_report?.yield?.gross_yield_pct, 2);
  const rendNet     = fmtD(invest?.financial_report?.yield?.net_yield_pct, 2);
  const riskLvl     = invest?.investment_scores?.overall_risk_level || 'MODÉRÉ';
  const locScore    = fmtD(invest?.investment_scores?.location_score, 1);
  const invScore    = fmtD(invest?.investment_scores?.investment_score, 1);
  const mktScore    = fmtD(invest?.investment_scores?.market_score, 1);
  const finScore    = fmtD(invest?.investment_scores?.financial_score, 1);
  const cashflow    = invest?.financial_report?.financing_cashflow?.monthly_cash_flow;
  const strengths   = invest?.investment_scores?.explanation?.strengths?.slice(0,4).join('; ') || 'N/D';
  const weaknesses  = invest?.investment_scores?.explanation?.weaknesses?.slice(0,4).join('; ')|| 'N/D';

  // OSM — distances
  const d = geo?.distances_m || {};
  const distCentre  = fmtM(d.distance_centre_ville);
  const distHosp    = fmtM(d.distance_nearest_hospital);
  const distEcol    = fmtM(d.distance_nearest_school);
  const distSuper   = fmtM(d.distance_nearest_supermarket);
  const distBank    = fmtM(d.distance_nearest_bank);
  const distBus     = fmtM(d.distance_nearest_bus_stop);
  const distSec     = fmtM(d.dist_security_m);
  const distIndus   = fmtM(d.dist_industrial_m);
  const distDam     = fmtM(d.dist_dam_m);

  // Services à proximité (données OpenStreetMap)
  const nbPois  = geo?.pois?.nb_pois_1km ?? 0;
  const counts  = geo?.pois?.counts_by_category || {};

  // Accessibilité
  const acc = geo?.accessibility_scores_0_100 || {};
  const accGlob   = fmtD(acc.score_accessibilite_globale, 0);
  const accSante  = fmtD(acc.score_accessibilite_sante, 0);
  const accEduc   = fmtD(acc.score_accessibilite_education, 0);
  const accTrans  = fmtD(acc.score_accessibilite_transport, 0);
  const accComm   = fmtD(acc.score_accessibilite_commerces, 0);
  const accLois   = fmtD(acc.score_accessibilite_loisirs, 0);
  const accServ   = fmtD(acc.score_accessibilite_services, 0);
  const accRelig  = fmtD(acc.score_accessibilite_religieux, 0);

  return `Tu es un expert senior en due diligence immobilière, analyse de risque et intelligence de marché à Marrakech, Maroc.
Génère un rapport complet, structuré, précis et hautement professionnel en français.
Exploite CHACUNE des données fournies. Ne laisse aucune rubrique vide.

═══════════════════════════════════════════
DONNÉES COMPLÈTES DU DOSSIER
═══════════════════════════════════════════

[A] BIEN IMMOBILIER
- Type        : ${input.propertyType}
- Localisation: ${input.neighbourhood || 'N/D'} — ${input.city || 'Marrakech'}
- Adresse     : ${input.address || 'Non communiquée'}
- Surface totale : ${input.surface} m²  | Habitable : ${input.surfaceHabitable || input.surface} m²
- Composition : ${input.rooms||'N/D'} pièces · ${input.bedrooms||'N/D'} chambres · ${input.bathrooms||'N/D'} SdB · ${input.salons||1} salon(s)
- Étage       : ${input.floor||0} (${input.etagueSemantique||'rez_de_chaussee'})
- Équipements : ${Array.isArray(input.equipment)&&input.equipment.length ? input.equipment.join(', ') : 'Standard'}
- Coordonnées GPS : ${input.latitude?.toFixed(5)}, ${input.longitude?.toFixed(5)}

[B] MODÈLE VENTE — CatBoost
- Prix estimé moyen   : ${prix} MAD
- Fourchette [P10-P90]: ${prixBas} MAD → ${prixHaut} MAD
- Prix/m²             : ${pred?.price_per_m2 ? fmt(pred.price_per_m2) : 'N/D'} MAD/m²

[C] MODÈLE LOCATION — XGBoost
- Loyer mensuel moyen : ${loyer} MAD/mois
- Fourchette [P10-P90]: ${loyerBas} MAD/mois → ${loyerHaut} MAD/mois

[D] SCORING INVESTISSEMENT & RISQUE
- Score global        : ${score}/100
- Décision IA         : ${decision}
- Score Localisation  : ${locScore}/100
- Score Marché        : ${mktScore}/100
- Score Investissement: ${invScore}/100
- Score Financier     : ${finScore}/100
- Niveau de risque    : ${riskLvl}
- Rendement brut      : ${rendBrut}%  | Net : ${rendNet}%
- Cash-flow mensuel   : ${cashflow != null ? fmt(cashflow)+' MAD/mois' : 'N/D'}
- Points forts        : ${strengths}
- Points d'attention  : ${weaknesses}

[E] INTELLIGENCE GÉOSPATIALE OSM
Distances routières clés :
- Centre-ville (Jemaa el-Fna / Guéliz) : ${distCentre}
- Hôpital le plus proche               : ${distHosp}
- École la plus proche                 : ${distEcol}
- Supermarché le plus proche           : ${distSuper}
- Banque/ATM le plus proche            : ${distBank}
- Arrêt de transport le plus proche    : ${distBus}
- Infrastructure de sécurité (police/pompiers): ${distSec}

Facteurs de risque environnemental :
- Zone industrielle la plus proche     : ${distIndus}
- Barrage / ouvrage hydraulique        : ${distDam}

Services repérés dans un rayon de 1 km :
- Nombre total de lieux utiles : ${nbPois}
- Santé : ${counts.sante||0} établissements
- Éducation : ${counts.education||0} établissements
- Transport : ${counts.transport||0} points
- Commerces : ${counts.commerces||0}
- Loisirs : ${counts.loisirs||0}
- Services : ${counts.services||0}
- Lieux de culte : ${counts.religieux||0}

Scores d'accessibilité (0–100) :
- Globale    : ${accGlob}/100  | Santé      : ${accSante}/100
- Éducation  : ${accEduc}/100  | Transport   : ${accTrans}/100
- Commerces  : ${accComm}/100  | Loisirs     : ${accLois}/100
- Services   : ${accServ}/100  | Religieux   : ${accRelig}/100

═══════════════════════════════════════════
RÈGLES DE RÉDACTION IMPORTANTES
═══════════════════════════════════════════

Écris pour une personne qui ne connaît pas l’immobilier ni l’analyse de données.
Utilise des phrases courtes, un vocabulaire courant et des explications concrètes.
Ne cite jamais les noms techniques des modèles (CatBoost, XGBoost, Gemini), ni « POI », « entropie de Shannon », « gravité de Hansen », « scoring multi-piliers », « P10/P90 », « H3 » ou des formules mathématiques.
Remplace-les par des mots simples : « estimation », « fourchette basse/haute », « services proches », « note », « carte ».
Ne prétends pas connaître une information absente des données. Distingue clairement une estimation d’un fait vérifié.

FORMAT EXIGÉ — RAPPORT MARKDOWN SIMPLE

# Rapport immobilier
### Les informations essentielles pour comprendre le bien

---

## 1. À retenir
(Un paragraphe de 4 à 5 lignes : prix de vente estimé, loyer estimé, rendement, risque et avis général. Expliquer simplement ce que cela veut dire.)

---

## 2. Le bien en quelques mots
(Présenter la surface, les pièces, l’étage et les équipements. Dire simplement ce qui peut être un avantage ou un point à vérifier.)

---

## 3. Prix de vente et loyer possibles
(Expliquer l’estimation de vente entre ${prixBas} et ${prixHaut} MAD et le loyer entre ${loyerBas} et ${loyerHaut} MAD/mois. Préciser que ce sont des estimations.)

---

## 4. Ce que l’investissement peut rapporter
(Expliquer le rendement brut ${rendBrut}% et estimé après charges ${rendNet}% avec des mots simples. Expliquer le solde mensuel seulement s’il est disponible.)

---

## 5. Avis et points de vigilance
(Présenter l’avis « ${decision} », le niveau de risque ${riskLvl}, les points forts et les points à surveiller. Chaque point doit dire clairement ce que l’acheteur peut faire.)

---

## 6. Analyse SWOT
(Présenter un tableau simple à 4 parties : Forces, Faiblesses, Opportunités et Menaces. Donner 2 ou 3 éléments concrets par partie, basés uniquement sur les données disponibles.)

---

## 7. Le quartier au quotidien
(Dire si le centre-ville et les services importants sont proches : hôpital ${distHosp}, école ${distEcol}, supermarché ${distSuper}, banque ${distBank}, transport ${distBus}. Présenter les ${nbPois} lieux utiles autour du bien avec une phrase claire, sans indicateur technique.)

---

## 8. Avant de décider
(Donner au maximum 5 actions simples et concrètes : négociation, visite, documents à vérifier et location.)

---

## 9. Conclusion
(Deux à trois phrases claires donnant le conseil final, avec les réserves importantes.)

---
*Rapport généré par l'Intelligence Artificielle d'Orchid Island — Données OSM, CatBoost, XGBoost & Gemini*
`.trim();
}

// ── POST /api/v1/rapport/generate ────────────────────────────────────
exports.generateRapport = async (req, res) => {
  const {
    propertyType, neighbourhood, address, city,
    surface, rooms, bedrooms, bathrooms, floor, equipment,
    latitude, longitude, quartier, commune,
    totalPieces, salons, etages, etagueSemantique, surfaceHabitable,
  } = req.body;

  if (!surface || !propertyType)
    return res.status(400).json({ error: 'surface et propertyType sont obligatoires.' });

  const lat  = parseFloat(latitude)  || 31.6295;
  const lng  = parseFloat(longitude) || -7.9811;
  const surf = parseFloat(surface)   || 80;

  // ── 1. GeoService ─────────────────────────────────────────────────
  const geoRes  = await callService(GEO_SERVICE_URL, '/enrich', 'POST', { latitude: lat, longitude: lng });
  const geoData = geoRes.ok ? geoRes.data : null;
  if (!geoRes.ok) console.warn('[RAPPORT] GeoService indisponible:', geoRes.error);

  // ── 2. Prédiction vente (CatBoost) ────────────────────────────────
  const surfHab   = parseFloat(surfaceHabitable) || surf * 0.9;
  const nPieces   = parseInt(totalPieces)  || parseInt(rooms)   || 3;
  const nChambres = parseInt(bedrooms)     || Math.max(1, nPieces - 1);
  const nSdB      = parseInt(bathrooms)    || 1;
  const nSalons   = parseInt(salons)       || 1;
  const nEtages   = parseInt(etages)       || 0;
  const etSem     = etagueSemantique       || 'rez_de_chaussee';
  const qr        = quartier || neighbourhood || 'Guéliz';
  const com       = commune  || city          || 'Marrakech';

  const mlPayload = {
    type_bien: propertyType,
    localisation_quartier: qr,
    commune_fr: com,
    latitude: lat, longitude: lng,
    surface_consolidee_m2: surf,
    surface_habitable_m2: surfHab,
    total_pieces: nPieces,
    chambres: nChambres,
    salles_bain: nSdB,
    salons: nSalons,
    etages: nEtages,
    etage_semantique: etSem,
    equipement_piscine:         Array.isArray(equipment) && equipment.includes('piscine')         ? 1 : 0,
    equipement_parking:         Array.isArray(equipment) && equipment.includes('parking')         ? 1 : 0,
    equipement_securite:        Array.isArray(equipment) && equipment.includes('securite')        ? 1 : 0,
    equipement_ascenseur:       Array.isArray(equipment) && equipment.includes('ascenseur')       ? 1 : 0,
    equipement_climatisation:   Array.isArray(equipment) && equipment.includes('climatisation')   ? 1 : 0,
    equipement_meuble:          Array.isArray(equipment) && equipment.includes('meuble')          ? 1 : 0,
    equipement_terrasse:        Array.isArray(equipment) && equipment.includes('terrasse')        ? 1 : 0,
    equipement_concierge:       Array.isArray(equipment) && equipment.includes('concierge')       ? 1 : 0,
    equipement_balcon:          Array.isArray(equipment) && equipment.includes('balcon')          ? 1 : 0,
    equipement_chauffage:       Array.isArray(equipment) && equipment.includes('chauffage')       ? 1 : 0,
    equipement_cuisine_equipee: Array.isArray(equipment) && equipment.includes('cuisine_equipee') ? 1 : 0,
    equipement_jardin:          Array.isArray(equipment) && equipment.includes('jardin')          ? 1 : 0,
  };

  if (geoData) {
    if (geoData.distances_m) Object.assign(mlPayload, geoData.distances_m);
    if (geoData.accessibility_scores_0_100) Object.assign(mlPayload, geoData.accessibility_scores_0_100);
  }

  const predRes  = await callService(PYTHON_ML_URL, '/predict', 'POST', mlPayload);
  const predData = predRes.ok ? predRes.data : null;
  if (!predRes.ok) console.warn('[RAPPORT] MlService /predict indisponible:', predRes.error);

  // ── 3. Prédiction loyer (XGBoost) ────────────────────────────────
  const locPayload = {
    periode: 'mensuel',
    type_bien: propertyType,
    quartier: qr,
    commune_officielle: com,
    superficie_m2: surf,
    chambres: nChambres,
    salles_de_bain: nSdB,
    nb_etages: nEtages,
    salons: nSalons,
    equipements: Array.isArray(equipment) ? equipment : [],
  };

  const locRes  = await callService(PYTHON_ML_URL, '/location/predict', 'POST', locPayload);
  const locData = locRes.ok ? locRes.data : null;
  if (!locRes.ok) console.warn('[RAPPORT] MlService /location/predict indisponible:', locRes.error);

  // ── 4. Analyse investissement ─────────────────────────────────────
  const salePrice   = predData?.predicted_price || null;
  const rentalPrice = locData?.predicted_price   || null;

  let propertyFeatures = { latitude: lat, longitude: lng };
  if (geoData) {
    if (geoData.distances_m)              Object.assign(propertyFeatures, geoData.distances_m);
    if (geoData.accessibility_scores_0_100) Object.assign(propertyFeatures, geoData.accessibility_scores_0_100);
    if (geoData.pois) {
      propertyFeatures.nb_pois_1km       = geoData.pois.nb_pois_1km;
      propertyFeatures.entropie_poi_1km  = geoData.pois.entropie_poi_1km;
    }
  }

  let investData = null;
  if (salePrice && salePrice > 0) {
    const invRes = await callService(PYTHON_ML_URL, '/analyze-investment', 'POST', {
      sale_price: salePrice,
      rental_price_monthly: rentalPrice || undefined,
      type_bien: propertyType,
      predicted_price: salePrice,
      property_features: propertyFeatures,
    });
    investData = invRes.ok ? invRes.data : null;
    if (!invRes.ok) console.warn('[RAPPORT] /analyze-investment indisponible:', invRes.error);
  }

  // ── 5. Gemini ─────────────────────────────────────────────────────
  let geminiReport = null;
  if (GEMINI_API_KEY) {
    try {
      const genAI  = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model  = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      const prompt = buildGeminiPrompt(req.body, geoData, predData, locData, investData);
      const result = await model.generateContent(prompt);
      geminiReport = result.response.text();
    } catch (geminiErr) {
      console.error('[RAPPORT] Erreur Gemini:', geminiErr.message);
      geminiReport = buildFallbackReport(req.body, predData, locData, investData, geoData);
    }
  } else {
    console.warn('[RAPPORT] GEMINI_API_KEY absent — rapport de fallback généré');
    geminiReport = buildFallbackReport(req.body, predData, locData, investData, geoData);
  }

  // ── 6. Sauvegarde MongoDB ─────────────────────────────────────────
  let rapportId = null;
  try {
    if (mongoose.connection.readyState === 1) {
      const rapport = await RapportModel.create({
        userId:       req.session?.userId || null,
        userSnapshot: {
          firstName: req.session?.firstName || '',
          lastName:  req.session?.lastName  || '',
          email:     req.session?.email     || '',
        },
        input: req.body, geo: geoData, prediction: predData,
        location: locData, investment: investData, geminiReport,
      });
      rapportId = rapport._id;
    }
  } catch (dbErr) {
    console.warn('[RAPPORT] MongoDB non-bloquant:', dbErr.message);
  }

  // ── 7. Réponse ────────────────────────────────────────────────────
  res.json({
    status: 'success', rapportId,
    input: req.body, geo: geoData,
    prediction: predData, location: locData,
    investment: investData, geminiReport,
    generatedAt: new Date().toISOString(),
  });
};

// ── GET /api/v1/rapport/:id ───────────────────────────────────────────
exports.getRapport = async (req, res) => {
  try {
    const rapport = await RapportModel.findById(req.params.id).lean();
    if (!rapport) return res.status(404).json({ error: 'Rapport non trouvé.' });
    res.json(rapport);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Rapport de fallback (sans Gemini) ────────────────────────────────
function buildFallbackReport(input, pred, loc, invest, geo) {
  const prix     = fmt(pred?.predicted_price);
  const prixBas  = pred?.confidence_range?.low  ? fmt(pred.confidence_range.low)  : (pred?.predicted_price ? fmt(pred.predicted_price * 0.90) : 'N/D');
  const prixHaut = pred?.confidence_range?.high ? fmt(pred.confidence_range.high) : (pred?.predicted_price ? fmt(pred.predicted_price * 1.10) : 'N/D');
  const loyer    = fmt(loc?.predicted_price);
  const loyerBas = loc?.confidence_range?.low  ? fmt(loc.confidence_range.low)  : (loc?.quantile_low  ? fmt(loc.quantile_low)  : (loc?.predicted_price ? fmt(loc.predicted_price  * 0.85) : 'N/D'));
  const loyerHaut= loc?.confidence_range?.high ? fmt(loc.confidence_range.high) : (loc?.quantile_high ? fmt(loc.quantile_high) : (loc?.predicted_price ? fmt(loc.predicted_price  * 1.15) : 'N/D'));
  const score    = fmtD(invest?.overall_score, 1);
  const decision = invest?.decision || 'ANALYSE EN COURS';
  const rendBrut = fmtD(invest?.financial_report?.yield?.gross_yield_pct, 2);
  const rendNet  = fmtD(invest?.financial_report?.yield?.net_yield_pct, 2);
  const riskLvl  = invest?.investment_scores?.overall_risk_level || 'MODÉRÉ';
  const cashflow = invest?.financial_report?.financing_cashflow?.monthly_cash_flow;

  // OSM
  const d = geo?.distances_m || {};
  const distCentre = fmtM(d.distance_centre_ville);
  const distHosp   = fmtM(d.distance_nearest_hospital);
  const distEcol   = fmtM(d.distance_nearest_school);
  const distSuper  = fmtM(d.distance_nearest_supermarket);
  const distBank   = fmtM(d.distance_nearest_bank);
  const distBus    = fmtM(d.distance_nearest_bus_stop);
  const distSec    = fmtM(d.dist_security_m);
  const distIndus  = fmtM(d.dist_industrial_m);
  const distDam    = fmtM(d.dist_dam_m);
  const nbPois     = geo?.pois?.nb_pois_1km ?? 0;
  const counts     = geo?.pois?.counts_by_category || {};
  const acc        = geo?.accessibility_scores_0_100 || {};

  return `# 📋 RAPPORT DE DUE DILIGENCE IMMOBILIÈRE
### Orchid Island — Intelligence Immobilière Multi-Modèle

---

## 1. À retenir

Ce bien de type **${input.propertyType}** situé à **${input.neighbourhood || input.city || 'Marrakech'}** (${input.surface} m²) a été évalué par les modèles ML d'Orchid Island.

- **Prix de vente estimé** : **${prix} MAD** — entre **${prixBas} MAD et ${prixHaut} MAD**
- **Loyer mensuel estimé** : **${loyer} MAD/mois** — entre **${loyerBas} et ${loyerHaut} MAD/mois**
- **Rendement Brut** : **${rendBrut}%** | Rendement Net : **${rendNet}%**
- **Score Global Investissement** : **${score}/100** | Décision : **${decision}**
- **Cash-flow mensuel estimé** : ${cashflow != null ? fmt(cashflow)+' MAD/mois' : 'N/D'}

---

## 2. Le bien en quelques mots

Bien immobilier de type **${input.propertyType}** de **${input.surface} m²** (habitable : ${input.surfaceHabitable || input.surface} m²), composé de **${input.rooms||'N/D'} pièces**, **${input.bedrooms||'N/D'} chambres**, **${input.bathrooms||'N/D'} salles de bain** et **${input.salons||1} salon(s)**, situé au **${input.floor||0}e étage** dans le quartier **${input.neighbourhood||'N/D'}** à **${input.city||'Marrakech'}**.

Équipements déclarés : ${Array.isArray(input.equipment)&&input.equipment.length ? input.equipment.join(', ') : 'Standard'}.

---

## 3. Prix de vente estimé

| Indicateur | Valeur |
|---|---|
| Estimation centrale | **${prix} MAD** |
| Estimation basse | **${prixBas} MAD** |
| Estimation haute | **${prixHaut} MAD** |
| Prix au m² | **${pred?.price_per_m2 ? fmt(pred.price_per_m2) : 'N/D'} MAD/m²** |

---

## 4. Location et rendement

| Indicateur | Valeur |
|---|---|
| Loyer mensuel estimé | **${loyer} MAD/mois** |
| Estimation basse | **${loyerBas} MAD/mois** |
| Estimation haute | **${loyerHaut} MAD/mois** |
| Rendement brut | **${rendBrut}%** |
| Rendement net estimé | **${rendNet}%** |
| Cash-flow mensuel | **${cashflow != null ? fmt(cashflow)+' MAD' : 'N/D'}** |

---

## 5. Avis sur l’investissement

| Dimension | Score |
|---|---|
| Score Global | **${score}/100** |
| Localisation | ${fmtD(invest?.investment_scores?.location_score, 1)}/100 |
| Marché | ${fmtD(invest?.investment_scores?.market_score, 1)}/100 |
| Investissement | ${fmtD(invest?.investment_scores?.investment_score, 1)}/100 |
| Financier | ${fmtD(invest?.investment_scores?.financial_score, 1)}/100 |
| Niveau de risque | **${riskLvl}** |

**Avis général : ${decision}**

Points forts : ${invest?.investment_scores?.explanation?.strengths?.slice(0,4).join(' · ')||'N/D'}

Points d'attention : ${invest?.investment_scores?.explanation?.weaknesses?.slice(0,4).join(' · ')||'N/D'}

---

## 6. Points à vérifier

### 6.1 Risques Spatiaux & Environnementaux
- Zone industrielle la plus proche : **${distIndus}** ${parseFloat(d.dist_industrial_m||9999)<2000 ? '⚠️ Proximité notable' : '✅ Distance sécurisée'}
- Barrage / ouvrage hydraulique : **${distDam}** ${parseFloat(d.dist_dam_m||9999)<5000 ? '⚠️ À surveiller' : '✅ Éloigné'}
- Infrastructure de sécurité : **${distSec}**

### 6.2 Risques Financiers
- Vacance locative estimée : à évaluer selon l'absorption du marché local
- Liquidité : dépend de la fourchette de négociation (${prixBas}–${prixHaut} MAD)

---

## 7. Le quartier au quotidien

### 7.1 Emplacement
- **Distance au centre-ville** : ${distCentre}

### 7.2 Services proches
| Service | Distance |
|---|---|
| Hôpital | ${distHosp} |
| École | ${distEcol} |
| Supermarché | ${distSuper} |
| Banque/ATM | ${distBank} |
| Transport en commun | ${distBus} |
| Police/Pompiers | ${distSec} |

### 7.3 Services autour du bien (1 km)
Dans un rayon de 1 km, la carte repère **${nbPois} lieux utiles** pour la vie quotidienne.
- Santé : ${counts.sante||0} | Écoles : ${counts.education||0} | Transport : ${counts.transport||0}
- Commerces : ${counts.commerces||0} | Loisirs : ${counts.loisirs||0} | Autres services : ${counts.services||0} | Lieux de culte : ${counts.religieux||0}

### 7.4 Facilité d’accès aux services (/100)
| Dimension | Score |
|---|---|
| Globale | ${fmtD(acc.score_accessibilite_globale, 0)}/100 |
| Santé | ${fmtD(acc.score_accessibilite_sante, 0)}/100 |
| Éducation | ${fmtD(acc.score_accessibilite_education, 0)}/100 |
| Transport | ${fmtD(acc.score_accessibilite_transport, 0)}/100 |
| Commerces | ${fmtD(acc.score_accessibilite_commerces, 0)}/100 |
| Loisirs | ${fmtD(acc.score_accessibilite_loisirs, 0)}/100 |
| Services | ${fmtD(acc.score_accessibilite_services, 0)}/100 |
| Religieux | ${fmtD(acc.score_accessibilite_religieux, 0)}/100 |

---

## 8. Avant de décider

1. **Négociation** : Cibler un prix d'achat dans la fourchette basse : **${prixBas} – ${prix} MAD**
2. **Loyer** : Positionner le loyer entre **${loyerBas} et ${loyer} MAD/mois** pour une occupation rapide
3. **Vérifications** : Titre foncier, conformité cadastrale, charges de copropriété
4. **Visite** : Contrôle technique du bien (état des réseaux, isolation, toiture)
5. **Optimisation** : ${parseFloat(rendBrut||0)<5 ? "Envisager une location meublée pour améliorer le rendement" : "Conserver la stratégie locative estimée par XGBoost"}

---

## 9. Conclusion

Profil global : **${parseFloat(score)>=60?'FAVORABLE':parseFloat(score)>=40?'MODÉRÉ':'À SURVEILLER'}** | Décision finale : **${decision}**

Le marché immobilier de Marrakech, porté par le tourisme, les résidents étrangers et le développement des infrastructures, offre des perspectives de valorisation sur le moyen terme. Ce bien, situé à ${distCentre} du centre-ville avec un score d'accessibilité globale de ${fmtD(acc.score_accessibilite_globale,0)}/100, présente un profil ${parseFloat(score)>=60?'attractif pour un investissement locatif ou patrimonial':'qui requiert une due diligence approfondie avant engagement'}.

---
*Rapport généré par Orchid Island — Intelligence Immobilière | ${new Date().toLocaleDateString('fr-FR')} | Données OSM, CatBoost, XGBoost*`;
}
