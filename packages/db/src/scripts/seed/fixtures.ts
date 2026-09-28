// Seed v1 fixtures (§33). Reference geography, organisation and 12 synthetic projects across five
// states, each with enough geometry for the GIS pipeline and the demo hooks of §33.6.
//
// Codes below state level are `SYN-…` until data/lgd is fetched (§33.2 fallback). State codes use
// LGD numbering. [VERIFY] every state code against LGD, and every village → district mapping.
// ALL coordinates below are SYNTHETIC placeholders laid out near the named places so maps look
// plausible — they are not traced boundaries (§33.2: replace with the team's traced alignment).

import type { AcquisitionType, JurisdictionLevel, ProjectCategory, RequiringBodyType, Role } from '@bhoomisetu/shared';

export const STATES = [
  { code: '27', name: 'Maharashtra', nameLocal: 'महाराष्ट्र' },
  { code: '29', name: 'Karnataka', nameLocal: 'ಕರ್ನಾಟಕ' },
  { code: '24', name: 'Gujarat', nameLocal: 'ગુજરાત' },
  { code: '08', name: 'Rajasthan', nameLocal: 'राजस्थान' },
  { code: '09', name: 'Uttar Pradesh', nameLocal: 'उत्तर प्रदेश' },
];

export const DISTRICTS = [
  { code: 'SYN-MH-PUNE', stateCode: '27', name: 'Pune', nameLocal: 'पुणे' },
  { code: 'SYN-MH-SATARA', stateCode: '27', name: 'Satara', nameLocal: 'सातारा' },
  { code: 'SYN-MH-NAGPUR', stateCode: '27', name: 'Nagpur', nameLocal: 'नागपूर' },
  { code: 'SYN-MH-GADCHIROLI', stateCode: '27', name: 'Gadchiroli', nameLocal: 'गडचिरोली' },
  { code: 'SYN-KA-BELAGAVI', stateCode: '29', name: 'Belagavi', nameLocal: 'ಬೆಳಗಾವಿ' },
  { code: 'SYN-KA-DHARWAD', stateCode: '29', name: 'Dharwad', nameLocal: 'ಧಾರವಾಡ' },
  { code: 'SYN-GJ-AHMEDABAD', stateCode: '24', name: 'Ahmedabad', nameLocal: 'અમદાવાદ' },
  { code: 'SYN-RJ-JAISALMER', stateCode: '08', name: 'Jaisalmer', nameLocal: 'जैसलमेर' },
  { code: 'SYN-UP-GBN', stateCode: '09', name: 'Gautam Buddh Nagar', nameLocal: 'गौतम बुद्ध नगर' },
];

export const SUB_DISTRICTS = [
  { code: 'SYN-MH-PUNE-HAVELI', districtCode: 'SYN-MH-PUNE', name: 'Haveli', nameLocal: 'हवेली' },
  { code: 'SYN-MH-PUNE-BHOR', districtCode: 'SYN-MH-PUNE', name: 'Bhor', nameLocal: 'भोर' },
  { code: 'SYN-MH-PUNE-MULSHI', districtCode: 'SYN-MH-PUNE', name: 'Mulshi', nameLocal: 'मुळशी' },
  { code: 'SYN-MH-SATARA-KHANDALA', districtCode: 'SYN-MH-SATARA', name: 'Khandala', nameLocal: 'खंडाळा' },
  { code: 'SYN-MH-SATARA-KARAD', districtCode: 'SYN-MH-SATARA', name: 'Karad', nameLocal: 'कराड' },
  { code: 'SYN-MH-NAGPUR-HINGNA', districtCode: 'SYN-MH-NAGPUR', name: 'Hingna', nameLocal: 'हिंगणा' },
  { code: 'SYN-MH-GADCHIROLI-KURKHEDA', districtCode: 'SYN-MH-GADCHIROLI', name: 'Kurkheda', nameLocal: 'कुरखेडा' },
  { code: 'SYN-KA-BELAGAVI-BELAGAVI', districtCode: 'SYN-KA-BELAGAVI', name: 'Belagavi', nameLocal: 'ಬೆಳಗಾವಿ' },
  { code: 'SYN-KA-DHARWAD-HUBBALLI', districtCode: 'SYN-KA-DHARWAD', name: 'Hubballi', nameLocal: 'ಹುಬ್ಬಳ್ಳಿ' },
  { code: 'SYN-GJ-AHMEDABAD-SANAND', districtCode: 'SYN-GJ-AHMEDABAD', name: 'Sanand', nameLocal: 'સાણંદ' },
  { code: 'SYN-RJ-JAISALMER-POKARAN', districtCode: 'SYN-RJ-JAISALMER', name: 'Pokaran', nameLocal: 'पोकरण' },
  { code: 'SYN-UP-GBN-JEWAR', districtCode: 'SYN-UP-GBN', name: 'Jewar', nameLocal: 'जेवर' },
];

/** [minLng, minLat, maxLng, maxLat] — a synthetic rectangle standing in for the village boundary. */
export type Bounds = [number, number, number, number];

export type VillageFixture = {
  code: string;
  subDistrictCode: string;
  name: string;
  nameLocal: string;
  bounds: Bounds;
  /** Parcels generated near the project footprint, and scattered across the rest of the village. */
  parcelsNear: number;
  parcelsFar: number;
};

export const VILLAGES: VillageFixture[] = [
  // Demo corridor (MH-PSX): four contiguous villages along the synthetic centreline.
  {
    code: 'SYN-MH-KHED-SHIVAPUR',
    subDistrictCode: 'SYN-MH-PUNE-HAVELI',
    name: 'Khed Shivapur',
    nameLocal: 'खेड शिवापूर',
    bounds: [73.835, 18.3, 73.89, 18.35],
    parcelsNear: 90,
    parcelsFar: 30,
  },
  {
    code: 'SYN-MH-KAPURHOL',
    subDistrictCode: 'SYN-MH-PUNE-HAVELI',
    name: 'Kapurhol',
    nameLocal: 'कापूरहोळ',
    bounds: [73.86, 18.25, 73.925, 18.3],
    parcelsNear: 90,
    parcelsFar: 30,
  },
  {
    code: 'SYN-MH-SAROLE',
    subDistrictCode: 'SYN-MH-PUNE-BHOR',
    name: 'Sarole',
    nameLocal: 'सारोळे',
    bounds: [73.89, 18.195, 73.955, 18.25],
    parcelsNear: 90,
    parcelsFar: 30,
  },
  {
    code: 'SYN-MH-SHIRWAL',
    subDistrictCode: 'SYN-MH-SATARA-KHANDALA',
    name: 'Shirwal',
    nameLocal: 'शिरवळ',
    bounds: [73.925, 18.14, 73.99, 18.195],
    parcelsNear: 90,
    parcelsFar: 30,
  },
  {
    code: 'SYN-MH-PARGAON',
    subDistrictCode: 'SYN-MH-SATARA-KHANDALA',
    name: 'Pargaon',
    nameLocal: 'पारगाव',
    bounds: [74.0, 18.1, 74.06, 18.15],
    parcelsNear: 110,
    parcelsFar: 20,
  },
  {
    code: 'SYN-MH-UMBRAJ',
    subDistrictCode: 'SYN-MH-SATARA-KARAD',
    name: 'Umbraj',
    nameLocal: 'उंब्रज',
    bounds: [74.08, 17.37, 74.14, 17.41],
    parcelsNear: 70,
    parcelsFar: 20,
  },
  {
    code: 'SYN-MH-MAAN',
    subDistrictCode: 'SYN-MH-PUNE-MULSHI',
    name: 'Maan',
    nameLocal: 'माण',
    bounds: [73.7, 18.57, 73.75, 18.61],
    parcelsNear: 60,
    parcelsFar: 20,
  },
  {
    code: 'SYN-MH-HINGNA',
    subDistrictCode: 'SYN-MH-NAGPUR-HINGNA',
    name: 'Hingna',
    nameLocal: 'हिंगणा',
    bounds: [78.93, 21.05, 78.99, 21.1],
    parcelsNear: 140,
    parcelsFar: 20,
  },
  {
    code: 'SYN-MH-KURKHEDA',
    subDistrictCode: 'SYN-MH-GADCHIROLI-KURKHEDA',
    name: 'Kurkheda',
    nameLocal: 'कुरखेडा',
    bounds: [80.2, 20.6, 80.25, 20.64],
    parcelsNear: 70,
    parcelsFar: 20,
  },
  {
    code: 'SYN-KA-KAKATI',
    subDistrictCode: 'SYN-KA-BELAGAVI-BELAGAVI',
    name: 'Kakati',
    nameLocal: 'ಕಾಕತಿ',
    bounds: [74.48, 15.88, 74.55, 15.94],
    parcelsNear: 90,
    parcelsFar: 20,
  },
  {
    code: 'SYN-KA-AMARGOL',
    subDistrictCode: 'SYN-KA-DHARWAD-HUBBALLI',
    name: 'Amargol',
    nameLocal: 'ಅಮರಗೋಳ',
    bounds: [75.08, 15.37, 75.13, 15.41],
    parcelsNear: 80,
    parcelsFar: 20,
  },
  {
    code: 'SYN-GJ-SANAND',
    subDistrictCode: 'SYN-GJ-AHMEDABAD-SANAND',
    name: 'Sanand',
    nameLocal: 'સાણંદ',
    bounds: [72.35, 22.97, 72.4, 23.01],
    parcelsNear: 70,
    parcelsFar: 20,
  },
  {
    code: 'SYN-RJ-BHADASAR',
    subDistrictCode: 'SYN-RJ-JAISALMER-POKARAN',
    name: 'Bhadasar',
    nameLocal: 'भादासर',
    bounds: [70.95, 26.95, 71.02, 27.0],
    parcelsNear: 70,
    parcelsFar: 20,
  },
  {
    code: 'SYN-UP-DAYANATPUR',
    subDistrictCode: 'SYN-UP-GBN-JEWAR',
    name: 'Dayanatpur',
    nameLocal: 'दयानतपुर',
    bounds: [77.58, 28.15, 77.63, 28.19],
    parcelsNear: 70,
    parcelsFar: 20,
  },
];

export const REQUIRING_BODIES: Array<{ key: string; name: string; shortCode: string; type: RequiringBodyType }> = [
  { key: 'NHAI', name: 'National Highways Authority of India', shortCode: 'NHAI', type: 'central' },
  { key: 'MSRDC', name: 'Maharashtra State Road Development Corporation', shortCode: 'MSRDC', type: 'state' },
  { key: 'DLP', name: 'Deccan Logistics Parks Ltd (synthetic)', shortCode: 'DLP', type: 'ppp' },
  { key: 'MIDC', name: 'Maharashtra Industrial Development Corporation', shortCode: 'MIDC', type: 'state' },
  { key: 'KFT', name: 'Karnataka Freight Terminals Pvt Ltd (synthetic)', shortCode: 'KFT', type: 'private' },
  { key: 'GIDC', name: 'Gujarat Industrial Development Corporation', shortCode: 'GIDC', type: 'state' },
  { key: 'WRD', name: 'Water Resources Department, Maharashtra', shortCode: 'WRD', type: 'state' },
  { key: 'RSPCL', name: 'Rajasthan Solar Park Corporation (synthetic)', shortCode: 'RSPCL', type: 'psu' },
  { key: 'YEIDA', name: 'Yamuna Expressway Industrial Development Authority', shortCode: 'YEIDA', type: 'state' },
  { key: 'PMRDA', name: 'Pune Metropolitan Region Development Authority', shortCode: 'PMRDA', type: 'state' },
];

/** Footprint of a project: a centreline (linear) or a rectangle (area). SYNTHETIC coordinates. */
export type SiteFixture = { kind: 'LINE'; coordinates: Array<[number, number]> } | { kind: 'AREA'; bounds: Bounds };

/** A money scenario for projects past the award (§33.5 family money states). */
export type MoneyFixture = {
  /** Days before DEMO_NOW the Collector signed the award. */
  awardSignedDaysAgo: number;
  /** Fraction of parcels whose possession has been taken (only fully-settled parcels qualify). */
  possessionShare: number;
};

export type ConsentFixture = {
  type: 'PRIVATE_80' | 'PPP_70' | 'GRAM_SABHA_S41';
  /** Share of eligible entries that consented (drives the consent meter). */
  consentedShare: number;
  refusedShare: number;
};

/** A clock started outside the workflow (e.g. SIA commenced), placed for the §33.6 breach hooks. */
export type ExtraClockFixture = { clock: string; startedDaysAgo: number; subjectStage?: string };

export type ProjectFixture = {
  code: string;
  name: string;
  nameLocal: string;
  category: ProjectCategory;
  subCategory: string;
  acquisitionType: AcquisitionType;
  requiringBody: string;
  nationalImportance: boolean;
  budgetRupees: bigint;
  pack: { code: string; version: string };
  stateCode: string;
  districts: string[];
  isLinear: boolean;
  rowWidthM: string | null;
  isUrgency?: boolean;
  inScheduledArea?: boolean;
  site: SiteFixture;
  currentStage: string;
  submittedDaysAgo: number;
  /**
   * Stages approved so far, oldest first. Replayed through the workflow engine (planTransition) so
   * stage instances and statutory deadlines are exactly what the API would have written. An entry
   * is dated either `daysAgo`, or by `clockDueInDays` — approved on the day that makes that clock
   * (started by this approval) fall due N days after DEMO_NOW (§33.6 hooks).
   */
  history: Array<
    { stage: string; daysAgo: number } | { stage: string; clockDueInDays: { clock: string; days: number } }
  >;
  extraClocks?: ExtraClockFixture[];
  money?: MoneyFixture;
  consent?: ConsentFixture;
};

const MH = { code: 'larr-2013-maharashtra', version: '1.0.0' };
const BASE = { code: 'larr-2013-base', version: '1.0.0' };

export const PROJECTS: ProjectFixture[] = [
  {
    code: 'MH-PSX-2026-001',
    name: 'Pune–Satara Expressway Expansion',
    nameLocal: 'पुणे–सातारा द्रुतगती मार्ग विस्तार',
    category: 'TRANSPORT',
    subCategory: 'Linear corridor',
    acquisitionType: 'GOVERNMENT',
    requiringBody: 'NHAI',
    nationalImportance: true,
    budgetRupees: 42_000_000_000n,
    pack: MH,
    stateCode: '27',
    districts: ['SYN-MH-PUNE', 'SYN-MH-SATARA'],
    isLinear: true,
    rowWidthM: '60',
    site: {
      kind: 'LINE',
      coordinates: [
        [73.852, 18.348],
        [73.872, 18.3],
        [73.905, 18.252],
        [73.938, 18.197],
        [73.968, 18.142],
      ],
    },
    currentStage: 'S07_DECLARATION',
    submittedDaysAgo: 720,
    history: [
      { stage: 'S01_PROPOSAL', daysAgo: 700 },
      { stage: 'S02_SIA', daysAgo: 600 },
      { stage: 'S03_APPRAISAL', daysAgo: 500 },
      // Demo beat 2: "Declaration lapses in 34 days — s.19, deemed rescinded".
      { stage: 'S05_NOTIFICATION', clockDueInDays: { clock: 'DECLARATION', days: 34 } },
      { stage: 'S06_RNR_SCHEME', daysAgo: 90 },
    ],
  },
  {
    code: 'MH-NGP-2026-002',
    name: 'Nagpur Multimodal Logistics Park',
    nameLocal: 'नागपूर बहुविध लॉजिस्टिक्स पार्क',
    category: 'INDUSTRIAL',
    subCategory: 'Logistics park',
    acquisitionType: 'PPP',
    requiringBody: 'DLP',
    nationalImportance: false,
    budgetRupees: 8_500_000_000n,
    pack: MH,
    stateCode: '27',
    districts: ['SYN-MH-NAGPUR'],
    isLinear: false,
    rowWidthM: null,
    site: { kind: 'AREA', bounds: [78.945, 21.06, 78.968, 21.078] },
    currentStage: 'S04_CONSENT',
    submittedDaysAgo: 300,
    history: [
      { stage: 'S01_PROPOSAL', daysAgo: 290 }, // opens S02 and, alongside it, S04 (s.2)
      { stage: 'S02_SIA', daysAgo: 150 },
      { stage: 'S03_APPRAISAL', daysAgo: 60 },
    ],
    consent: { type: 'PPP_70', consentedShare: 0.712, refusedShare: 0.08 }, // meter just over 70%
  },
  {
    code: 'KA-BGM-2026-003',
    name: 'Belagavi Ring Road',
    nameLocal: 'ಬೆಳಗಾವಿ ವರ್ತುಲ ರಸ್ತೆ',
    category: 'TRANSPORT',
    subCategory: 'Bypass',
    acquisitionType: 'GOVERNMENT',
    requiringBody: 'NHAI',
    nationalImportance: false,
    budgetRupees: 12_000_000_000n,
    pack: BASE,
    stateCode: '29',
    districts: ['SYN-KA-BELAGAVI'],
    isLinear: true,
    rowWidthM: '45',
    site: {
      kind: 'LINE',
      coordinates: [
        [74.488, 15.888],
        [74.51, 15.905],
        [74.542, 15.932],
      ],
    },
    currentStage: 'S05_NOTIFICATION',
    submittedDaysAgo: 400,
    history: [
      { stage: 'S01_PROPOSAL', daysAgo: 390 },
      { stage: 'S02_SIA', daysAgo: 200 },
      { stage: 'S03_APPRAISAL', daysAgo: 30 },
    ],
  },
  {
    code: 'MH-SIN-2025-004',
    name: 'Satara Industrial Node',
    nameLocal: 'सातारा औद्योगिक केंद्र',
    category: 'INDUSTRIAL',
    subCategory: 'State industrial estate',
    acquisitionType: 'GOVERNMENT',
    requiringBody: 'MIDC',
    nationalImportance: false,
    budgetRupees: 6_400_000_000n,
    pack: MH,
    stateCode: '27',
    districts: ['SYN-MH-SATARA'],
    isLinear: false,
    rowWidthM: null,
    site: { kind: 'AREA', bounds: [74.012, 18.112, 74.036, 18.13] },
    currentStage: 'S09_PAYMENT_POSSESSION',
    submittedDaysAgo: 1000,
    history: [
      { stage: 'S01_PROPOSAL', daysAgo: 980 },
      { stage: 'S02_SIA', daysAgo: 860 },
      { stage: 'S03_APPRAISAL', daysAgo: 800 },
      { stage: 'S05_NOTIFICATION', daysAgo: 560 },
      { stage: 'S06_RNR_SCHEME', daysAgo: 420 },
      { stage: 'S07_DECLARATION', daysAgo: 300 },
      { stage: 'S08_AWARD', daysAgo: 70 },
    ],
    money: { awardSignedDaysAgo: 70, possessionShare: 0.35 },
  },
  {
    code: 'KA-HBL-2026-005',
    name: 'Hubballi Freight Terminal',
    nameLocal: 'ಹುಬ್ಬಳ್ಳಿ ಸರಕು ಸಾಗಣೆ ಟರ್ಮಿನಲ್',
    category: 'PPP_CORPORATE',
    subCategory: 'Private company with public utility',
    acquisitionType: 'PRIVATE',
    requiringBody: 'KFT',
    nationalImportance: false,
    budgetRupees: 2_300_000_000n,
    pack: BASE,
    stateCode: '29',
    districts: ['SYN-KA-DHARWAD'],
    isLinear: false,
    rowWidthM: null,
    site: { kind: 'AREA', bounds: [75.092, 15.38, 75.11, 15.395] },
    currentStage: 'S04_CONSENT',
    submittedDaysAgo: 260,
    history: [
      { stage: 'S01_PROPOSAL', daysAgo: 250 },
      { stage: 'S02_SIA', daysAgo: 120 },
      { stage: 'S03_APPRAISAL', daysAgo: 45 },
    ],
    consent: { type: 'PRIVATE_80', consentedShare: 0.76, refusedShare: 0.1 }, // below 80% — risk example
  },
  {
    code: 'GJ-SND-2026-006',
    name: 'Sanand Emergency Flood Relief Channel',
    nameLocal: 'સાણંદ પૂર રાહત ચેનલ',
    category: 'WATER_AGRICULTURE',
    subCategory: 'Flood embankments',
    acquisitionType: 'GOVERNMENT',
    requiringBody: 'GIDC',
    nationalImportance: false,
    budgetRupees: 900_000_000n,
    pack: BASE,
    stateCode: '24',
    districts: ['SYN-GJ-AHMEDABAD'],
    isLinear: true,
    rowWidthM: '30',
    isUrgency: true, // s.40 — SIA and appraisal do not apply (s.9)
    site: {
      kind: 'LINE',
      coordinates: [
        [72.355, 22.975],
        [72.375, 22.99],
        [72.395, 23.005],
      ],
    },
    currentStage: 'S05_NOTIFICATION',
    submittedDaysAgo: 60,
    history: [{ stage: 'S01_PROPOSAL', daysAgo: 50 }],
  },
  {
    code: 'MH-KRK-2026-007',
    name: 'Kurkheda Minor Irrigation Tank',
    nameLocal: 'कुरखेडा लघु पाटबंधारे तलाव',
    category: 'WATER_AGRICULTURE',
    subCategory: 'Reservoir',
    acquisitionType: 'GOVERNMENT',
    requiringBody: 'WRD',
    nationalImportance: false,
    budgetRupees: 1_100_000_000n,
    pack: MH,
    stateCode: '27',
    districts: ['SYN-MH-GADCHIROLI'],
    isLinear: false,
    rowWidthM: null,
    inScheduledArea: true, // s.41 — Gram Sabha consent applies
    site: { kind: 'AREA', bounds: [80.212, 20.61, 80.232, 20.628] },
    currentStage: 'S04_CONSENT',
    submittedDaysAgo: 330,
    history: [
      { stage: 'S01_PROPOSAL', daysAgo: 320 },
      { stage: 'S02_SIA', daysAgo: 160 },
      { stage: 'S03_APPRAISAL', daysAgo: 40 },
    ],
    consent: { type: 'GRAM_SABHA_S41', consentedShare: 0.64, refusedShare: 0.2 },
  },
  {
    code: 'MH-NH4-2026-008',
    name: 'NH-48 Umbraj Grade Separator',
    nameLocal: 'रा.म.-४८ उंब्रज उड्डाणपूल',
    category: 'TRANSPORT',
    subCategory: 'Linear corridor',
    acquisitionType: 'GOVERNMENT',
    requiringBody: 'NHAI',
    nationalImportance: true,
    budgetRupees: 3_200_000_000n,
    pack: { code: 'nh-act-1956', version: '1.0.0' }, // beat 8: a different statute, same engine
    stateCode: '27',
    districts: ['SYN-MH-SATARA'],
    isLinear: true,
    rowWidthM: '40',
    site: {
      kind: 'LINE',
      coordinates: [
        [74.085, 17.375],
        [74.11, 17.39],
        [74.135, 17.405],
      ],
    },
    currentStage: 'NH_3C_OBJECTIONS',
    submittedDaysAgo: 120,
    history: [
      { stage: 'NH_PROPOSAL', daysAgo: 110 },
      { stage: 'NH_3A_INTENT', daysAgo: 15 },
    ],
  },
  {
    code: 'MH-MAN-2026-009',
    name: 'Maan Metro Car Depot',
    nameLocal: 'माण मेट्रो डेपो',
    category: 'TRANSPORT',
    subCategory: 'Mass rapid transit',
    acquisitionType: 'GOVERNMENT',
    requiringBody: 'PMRDA',
    nationalImportance: false,
    budgetRupees: 1_800_000_000n,
    pack: MH,
    stateCode: '27',
    districts: ['SYN-MH-PUNE'],
    isLinear: false,
    rowWidthM: null,
    site: { kind: 'AREA', bounds: [73.715, 18.58, 73.732, 18.594] },
    currentStage: 'S02_SIA',
    submittedDaysAgo: 250,
    history: [{ stage: 'S01_PROPOSAL', daysAgo: 230 }],
    // Beat 1 breach #1: the SIA commenced ~7 months ago and is still not final (s.4, WARN).
    extraClocks: [{ clock: 'SIA_COMPLETION', startedDaysAgo: 200, subjectStage: 'S02_SIA' }],
  },
  {
    code: 'RJ-BHD-2025-010',
    name: 'Bhadasar Solar Park Phase II',
    nameLocal: 'भादासर सौर पार्क चरण II',
    category: 'ENERGY_UTILITIES',
    subCategory: 'Generation (solar)',
    acquisitionType: 'GOVERNMENT',
    requiringBody: 'RSPCL',
    nationalImportance: false,
    budgetRupees: 5_600_000_000n,
    pack: BASE,
    stateCode: '08',
    districts: ['SYN-RJ-JAISALMER'],
    isLinear: false,
    rowWidthM: null,
    site: { kind: 'AREA', bounds: [70.965, 26.96, 70.99, 26.98] },
    currentStage: 'S08_AWARD',
    // Beat 1 breach #2: s.19 published ~13 months ago and still no award — proceedings lapse (s.25).
    submittedDaysAgo: 1100,
    history: [
      { stage: 'S01_PROPOSAL', daysAgo: 1080 },
      { stage: 'S02_SIA', daysAgo: 950 },
      { stage: 'S03_APPRAISAL', daysAgo: 900 },
      { stage: 'S05_NOTIFICATION', daysAgo: 700 },
      { stage: 'S06_RNR_SCHEME', daysAgo: 560 },
      { stage: 'S07_DECLARATION', daysAgo: 380 },
    ],
  },
  {
    code: 'UP-DYP-2026-011',
    name: 'Dayanatpur Air Cargo Logistics Hub',
    nameLocal: 'दयानतपुर एयर कार्गो लॉजिस्टिक्स हब',
    category: 'TRANSPORT',
    subCategory: 'Nodes & terminals',
    acquisitionType: 'GOVERNMENT',
    requiringBody: 'YEIDA',
    nationalImportance: true,
    budgetRupees: 7_400_000_000n,
    pack: BASE,
    stateCode: '09',
    districts: ['SYN-UP-GBN'],
    isLinear: false,
    rowWidthM: null,
    site: { kind: 'AREA', bounds: [77.592, 28.16, 77.615, 28.176] },
    currentStage: 'S03_APPRAISAL',
    submittedDaysAgo: 420,
    history: [
      { stage: 'S01_PROPOSAL', daysAgo: 400 },
      { stage: 'S02_SIA', daysAgo: 90 },
    ],
    // Beat 1 breach #3: expert group constituted 75 days ago, no recommendation (s.7, two months).
    extraClocks: [{ clock: 'EXPERT_GROUP', startedDaysAgo: 75, subjectStage: 'S03_APPRAISAL' }],
  },
];

export type PostFixture = {
  key: string;
  designation: string;
  role: Role;
  level: JurisdictionLevel;
  stateCode?: string;
  districtCode?: string;
  project?: string;
  requiringBody?: string;
};

const collector = (key: string, district: string, name: string, dc = false): PostFixture => ({
  key,
  designation: `${dc ? 'Deputy Commissioner' : 'Collector'}, ${name}`,
  role: 'COLLECTOR',
  level: 'DISTRICT',
  districtCode: district,
});

export const POSTS: PostFixture[] = [
  { key: 'SUPER', designation: 'System Administrator', role: 'SUPER_ADMIN', level: 'NATIONAL' },
  { key: 'OVERSIGHT', designation: 'Central Monitoring Cell, MoRD', role: 'CENTRAL_VIEWER', level: 'NATIONAL' },
  {
    key: 'STATE_MH',
    designation: 'Revenue & Forest Department, Maharashtra',
    role: 'STATE_REVENUE',
    level: 'STATE',
    stateCode: '27',
  },
  {
    key: 'STATE_KA',
    designation: 'Revenue Department, Karnataka',
    role: 'STATE_REVENUE',
    level: 'STATE',
    stateCode: '29',
  },
  {
    key: 'STATE_GJ',
    designation: 'Revenue Department, Gujarat',
    role: 'STATE_REVENUE',
    level: 'STATE',
    stateCode: '24',
  },
  {
    key: 'STATE_RJ',
    designation: 'Revenue Department, Rajasthan',
    role: 'STATE_REVENUE',
    level: 'STATE',
    stateCode: '08',
  },
  {
    key: 'STATE_UP',
    designation: 'Revenue Department, Uttar Pradesh',
    role: 'STATE_REVENUE',
    level: 'STATE',
    stateCode: '09',
  },
  {
    key: 'RNR_COMM_MH',
    designation: 'Commissioner for R&R, Maharashtra',
    role: 'RNR_COMMISSIONER',
    level: 'STATE',
    stateCode: '27',
  },
  collector('COLL_PUNE', 'SYN-MH-PUNE', 'Pune'),
  {
    key: 'LAO_PUNE',
    designation: 'Special Land Acquisition Officer, Pune',
    role: 'LAO',
    level: 'DISTRICT',
    districtCode: 'SYN-MH-PUNE',
  },
  collector('COLL_SATARA', 'SYN-MH-SATARA', 'Satara'),
  {
    key: 'LAO_SATARA',
    designation: 'Special Land Acquisition Officer, Satara',
    role: 'LAO',
    level: 'DISTRICT',
    districtCode: 'SYN-MH-SATARA',
  },
  {
    key: 'TREASURY_SATARA',
    designation: 'District Treasury Officer, Satara',
    role: 'TREASURY_OFFICER',
    level: 'DISTRICT',
    districtCode: 'SYN-MH-SATARA',
  },
  {
    key: 'RNR_ADMIN_SATARA',
    designation: 'Administrator for R&R, Satara',
    role: 'RNR_ADMINISTRATOR',
    level: 'DISTRICT',
    districtCode: 'SYN-MH-SATARA',
  },
  {
    key: 'TEHSILDAR_HAVELI',
    designation: 'Tehsildar, Haveli',
    role: 'TEHSILDAR',
    level: 'DISTRICT',
    districtCode: 'SYN-MH-PUNE',
  },
  {
    key: 'DILR_PUNE',
    designation: 'District Inspector of Land Records, Pune',
    role: 'DILR',
    level: 'DISTRICT',
    districtCode: 'SYN-MH-PUNE',
  },
  collector('COLL_NAGPUR', 'SYN-MH-NAGPUR', 'Nagpur'),
  {
    key: 'LAO_NAGPUR',
    designation: 'Special Land Acquisition Officer, Nagpur',
    role: 'LAO',
    level: 'DISTRICT',
    districtCode: 'SYN-MH-NAGPUR',
  },
  collector('COLL_GADCHIROLI', 'SYN-MH-GADCHIROLI', 'Gadchiroli'),
  collector('COLL_BELAGAVI', 'SYN-KA-BELAGAVI', 'Belagavi', true),
  collector('COLL_DHARWAD', 'SYN-KA-DHARWAD', 'Dharwad', true),
  collector('COLL_AHMEDABAD', 'SYN-GJ-AHMEDABAD', 'Ahmedabad'),
  collector('COLL_JAISALMER', 'SYN-RJ-JAISALMER', 'Jaisalmer'),
  collector('COLL_GBN', 'SYN-UP-GBN', 'Gautam Buddh Nagar'),
  {
    key: 'FIELD_PSX',
    designation: 'Talathi, Khed Shivapur',
    role: 'FIELD_OFFICER',
    level: 'PROJECT',
    project: 'MH-PSX-2026-001',
  },
  {
    key: 'DLSA_NAGPUR',
    designation: 'DLSA Observer, Nagpur',
    role: 'DLSA_OBSERVER',
    level: 'PROJECT',
    project: 'MH-NGP-2026-002',
  },
  {
    key: 'SIA_MAN',
    designation: 'SIA Agency — Maan Metro Depot (synthetic)',
    role: 'SIA_AGENCY',
    level: 'PROJECT',
    project: 'MH-MAN-2026-009',
  },
  {
    key: 'LEGAL_MH',
    designation: 'Legal Cell, Revenue Department, Maharashtra',
    role: 'LEGAL_CELL',
    level: 'STATE',
    stateCode: '27',
  },
  {
    key: 'RB_NHAI',
    designation: 'Project Director, NHAI (Pune)',
    role: 'REQUIRING_BODY',
    level: 'PROJECT',
    requiringBody: 'NHAI',
  },
  {
    key: 'RB_MIDC',
    designation: 'Regional Officer, MIDC Satara',
    role: 'REQUIRING_BODY',
    level: 'PROJECT',
    requiringBody: 'MIDC',
  },
];

/** Every seeded account uses this password. Synthetic officers only (G18). */
export const DEMO_PASSWORD = 'bhoomisetu-demo';

export const USERS: Array<{ email: string; fullName: string; posts: string[] }> = [
  { email: 'admin@bhoomisetu.local', fullName: 'Asha Menon', posts: ['SUPER'] },
  { email: 'oversight@bhoomisetu.local', fullName: 'Vikram Sethi', posts: ['OVERSIGHT'] },
  { email: 'revenue.mh@bhoomisetu.local', fullName: 'Sunita Patwardhan', posts: ['STATE_MH'] },
  { email: 'revenue.ka@bhoomisetu.local', fullName: 'Prakash Hegde', posts: ['STATE_KA'] },
  { email: 'revenue.gj@bhoomisetu.local', fullName: 'Hetal Desai', posts: ['STATE_GJ'] },
  { email: 'revenue.rj@bhoomisetu.local', fullName: 'Mahendra Rathore', posts: ['STATE_RJ'] },
  { email: 'revenue.up@bhoomisetu.local', fullName: 'Alok Srivastava', posts: ['STATE_UP'] },
  { email: 'rnr.commissioner.mh@bhoomisetu.local', fullName: 'Vandana Gokhale', posts: ['RNR_COMM_MH'] },
  { email: 'collector.pune@bhoomisetu.local', fullName: 'Rohan Kulkarni', posts: ['COLL_PUNE'] },
  { email: 'lao.pune@bhoomisetu.local', fullName: 'Meera Jadhav', posts: ['LAO_PUNE'] },
  { email: 'collector.satara@bhoomisetu.local', fullName: 'Anil Shinde', posts: ['COLL_SATARA'] },
  { email: 'lao.satara@bhoomisetu.local', fullName: 'Pooja Nikam', posts: ['LAO_SATARA'] },
  { email: 'treasury.satara@bhoomisetu.local', fullName: 'Sachin Mane', posts: ['TREASURY_SATARA'] },
  { email: 'rnr.satara@bhoomisetu.local', fullName: 'Rekha Salunkhe', posts: ['RNR_ADMIN_SATARA'] },
  { email: 'tehsildar.haveli@bhoomisetu.local', fullName: 'Dattatray Bhosale', posts: ['TEHSILDAR_HAVELI'] },
  { email: 'dilr.pune@bhoomisetu.local', fullName: 'Shalini Deshmukh', posts: ['DILR_PUNE'] },
  { email: 'collector.nagpur@bhoomisetu.local', fullName: 'Kavita Wankhede', posts: ['COLL_NAGPUR'] },
  { email: 'lao.nagpur@bhoomisetu.local', fullName: 'Amol Dhote', posts: ['LAO_NAGPUR'] },
  { email: 'collector.gadchiroli@bhoomisetu.local', fullName: 'Sanjay Meshram', posts: ['COLL_GADCHIROLI'] },
  { email: 'dc.belagavi@bhoomisetu.local', fullName: 'Suresh Patil', posts: ['COLL_BELAGAVI'] },
  { email: 'dc.dharwad@bhoomisetu.local', fullName: 'Lakshmi Kulkarni', posts: ['COLL_DHARWAD'] },
  { email: 'collector.ahmedabad@bhoomisetu.local', fullName: 'Kiran Patel', posts: ['COLL_AHMEDABAD'] },
  { email: 'collector.jaisalmer@bhoomisetu.local', fullName: 'Ravindra Bhati', posts: ['COLL_JAISALMER'] },
  { email: 'dm.gbn@bhoomisetu.local', fullName: 'Neha Tyagi', posts: ['COLL_GBN'] },
  { email: 'talathi.khedshivapur@bhoomisetu.local', fullName: 'Ganesh Pawar', posts: ['FIELD_PSX'] },
  { email: 'dlsa.nagpur@bhoomisetu.local', fullName: 'Farida Sheikh', posts: ['DLSA_NAGPUR'] },
  { email: 'sia.man@bhoomisetu.local', fullName: 'Arvind Joshi', posts: ['SIA_MAN'] },
  { email: 'legal.mh@bhoomisetu.local', fullName: 'Harshad Apte', posts: ['LEGAL_MH'] },
  { email: 'pd.nhai@bhoomisetu.local', fullName: 'Nitin Rao', posts: ['RB_NHAI'] },
  { email: 'ro.midc@bhoomisetu.local', fullName: 'Prashant Kadam', posts: ['RB_MIDC'] },
  // The presenter's account: one person holding several posts drives the role switcher (§34 beat 7).
  {
    email: 'demo@bhoomisetu.local',
    fullName: 'Demo Presenter',
    posts: ['OVERSIGHT', 'STATE_MH', 'COLL_PUNE', 'COLL_SATARA', 'LAO_SATARA', 'FIELD_PSX'],
  },
];
