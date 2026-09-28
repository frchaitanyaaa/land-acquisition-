// Phase 0 seed fixtures: reference geography, organisation, and three projects in three districts
// (enough to prove RLS). The synthetic volume (≈2,000 parcels, ≈5,000 families) arrives with seed v1
// in Phase 1 and must go through domain services (§33.1).
//
// Codes below state level are `SYN-…` until data/lgd is fetched (§33.2 fallback). State codes use
// the LGD numbering (27 Maharashtra, 29 Karnataka) because the Maharashtra rule pack pins 27.
// [VERIFY] 27 / 29 against LGD; Khed Shivapur in Haveli (Pune) and Shirwal in Khandala (Satara).

import type { AcquisitionType, JurisdictionLevel, ProjectCategory, RequiringBodyType, Role } from '@bhoomisetu/shared';

export const STATES = [
  { code: '27', name: 'Maharashtra', nameLocal: 'महाराष्ट्र' },
  { code: '29', name: 'Karnataka', nameLocal: 'ಕರ್ನಾಟಕ' },
];

export const DISTRICTS = [
  { code: 'SYN-MH-PUNE', stateCode: '27', name: 'Pune', nameLocal: 'पुणे' },
  { code: 'SYN-MH-SATARA', stateCode: '27', name: 'Satara', nameLocal: 'सातारा' },
  { code: 'SYN-MH-NAGPUR', stateCode: '27', name: 'Nagpur', nameLocal: 'नागपूर' },
  { code: 'SYN-KA-BELAGAVI', stateCode: '29', name: 'Belagavi', nameLocal: 'ಬೆಳಗಾವಿ' },
];

export const SUB_DISTRICTS = [
  { code: 'SYN-MH-PUNE-HAVELI', districtCode: 'SYN-MH-PUNE', name: 'Haveli', nameLocal: 'हवेली' },
  { code: 'SYN-MH-SATARA-KHANDALA', districtCode: 'SYN-MH-SATARA', name: 'Khandala', nameLocal: 'खंडाळा' },
  { code: 'SYN-MH-NAGPUR-HINGNA', districtCode: 'SYN-MH-NAGPUR', name: 'Hingna', nameLocal: 'हिंगणा' },
  { code: 'SYN-KA-BELAGAVI-BELAGAVI', districtCode: 'SYN-KA-BELAGAVI', name: 'Belagavi', nameLocal: 'ಬೆಳಗಾವಿ' },
];

export const VILLAGES = [
  {
    code: 'SYN-MH-KHED-SHIVAPUR',
    subDistrictCode: 'SYN-MH-PUNE-HAVELI',
    name: 'Khed Shivapur',
    nameLocal: 'खेड शिवापूर',
  },
  { code: 'SYN-MH-SHIRWAL', subDistrictCode: 'SYN-MH-SATARA-KHANDALA', name: 'Shirwal', nameLocal: 'शिरवळ' },
  { code: 'SYN-MH-HINGNA', subDistrictCode: 'SYN-MH-NAGPUR-HINGNA', name: 'Hingna', nameLocal: 'हिंगणा' },
  { code: 'SYN-KA-KAKATI', subDistrictCode: 'SYN-KA-BELAGAVI-BELAGAVI', name: 'Kakati', nameLocal: 'ಕಾಕತಿ' },
];

export const REQUIRING_BODIES: Array<{ key: string; name: string; shortCode: string; type: RequiringBodyType }> = [
  { key: 'NHAI', name: 'National Highways Authority of India', shortCode: 'NHAI', type: 'central' },
  { key: 'MSRDC', name: 'Maharashtra State Road Development Corporation', shortCode: 'MSRDC', type: 'state' },
  { key: 'DLP', name: 'Deccan Logistics Parks Ltd (synthetic)', shortCode: 'DLP', type: 'ppp' },
];

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
  totalAreaProposedSqm: string;
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
};

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
    pack: { code: 'larr-2013-maharashtra', version: '1.0.0' },
    stateCode: '27',
    districts: ['SYN-MH-PUNE', 'SYN-MH-SATARA'],
    isLinear: true,
    rowWidthM: '60',
    totalAreaProposedSqm: '1500000',
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
    pack: { code: 'larr-2013-maharashtra', version: '1.0.0' },
    stateCode: '27',
    districts: ['SYN-MH-NAGPUR'],
    isLinear: false,
    rowWidthM: null,
    totalAreaProposedSqm: '2400000',
    currentStage: 'S04_CONSENT',
    submittedDaysAgo: 300,
    history: [
      { stage: 'S01_PROPOSAL', daysAgo: 290 }, // opens S02 and, alongside it, S04 (s.2)
      { stage: 'S02_SIA', daysAgo: 150 },
      { stage: 'S03_APPRAISAL', daysAgo: 60 },
    ],
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
    pack: { code: 'larr-2013-base', version: '1.0.0' },
    stateCode: '29',
    districts: ['SYN-KA-BELAGAVI'],
    isLinear: true,
    rowWidthM: '45',
    totalAreaProposedSqm: '900000',
    currentStage: 'S05_NOTIFICATION',
    submittedDaysAgo: 400,
    history: [
      { stage: 'S01_PROPOSAL', daysAgo: 390 },
      { stage: 'S02_SIA', daysAgo: 200 },
      { stage: 'S03_APPRAISAL', daysAgo: 30 },
    ],
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
    key: 'COLL_PUNE',
    designation: 'Collector, Pune',
    role: 'COLLECTOR',
    level: 'DISTRICT',
    districtCode: 'SYN-MH-PUNE',
  },
  {
    key: 'LAO_PUNE',
    designation: 'Special Land Acquisition Officer, Pune',
    role: 'LAO',
    level: 'DISTRICT',
    districtCode: 'SYN-MH-PUNE',
  },
  {
    key: 'COLL_SATARA',
    designation: 'Collector, Satara',
    role: 'COLLECTOR',
    level: 'DISTRICT',
    districtCode: 'SYN-MH-SATARA',
  },
  {
    key: 'COLL_NAGPUR',
    designation: 'Collector, Nagpur',
    role: 'COLLECTOR',
    level: 'DISTRICT',
    districtCode: 'SYN-MH-NAGPUR',
  },
  {
    key: 'COLL_BELAGAVI',
    designation: 'Deputy Commissioner, Belagavi',
    role: 'COLLECTOR',
    level: 'DISTRICT',
    districtCode: 'SYN-KA-BELAGAVI',
  },
  {
    key: 'FIELD_PSX',
    designation: 'Talathi, Khed Shivapur',
    role: 'FIELD_OFFICER',
    level: 'PROJECT',
    project: 'MH-PSX-2026-001',
  },
  {
    key: 'RB_NHAI',
    designation: 'Project Director, NHAI (Pune)',
    role: 'REQUIRING_BODY',
    level: 'PROJECT',
    requiringBody: 'NHAI',
  },
];

/** Every seeded account uses this password. Synthetic officers only (G18). */
export const DEMO_PASSWORD = 'bhoomisetu-demo';

export const USERS: Array<{ email: string; fullName: string; posts: string[] }> = [
  { email: 'admin@bhoomisetu.local', fullName: 'Asha Menon', posts: ['SUPER'] },
  { email: 'oversight@bhoomisetu.local', fullName: 'Vikram Sethi', posts: ['OVERSIGHT'] },
  { email: 'revenue.mh@bhoomisetu.local', fullName: 'Sunita Patwardhan', posts: ['STATE_MH'] },
  { email: 'revenue.ka@bhoomisetu.local', fullName: 'Prakash Hegde', posts: ['STATE_KA'] },
  { email: 'collector.pune@bhoomisetu.local', fullName: 'Rohan Kulkarni', posts: ['COLL_PUNE'] },
  { email: 'lao.pune@bhoomisetu.local', fullName: 'Meera Jadhav', posts: ['LAO_PUNE'] },
  { email: 'collector.satara@bhoomisetu.local', fullName: 'Anil Shinde', posts: ['COLL_SATARA'] },
  { email: 'collector.nagpur@bhoomisetu.local', fullName: 'Kavita Wankhede', posts: ['COLL_NAGPUR'] },
  { email: 'dc.belagavi@bhoomisetu.local', fullName: 'Suresh Patil', posts: ['COLL_BELAGAVI'] },
  { email: 'talathi.khedshivapur@bhoomisetu.local', fullName: 'Ganesh Pawar', posts: ['FIELD_PSX'] },
  { email: 'pd.nhai@bhoomisetu.local', fullName: 'Nitin Rao', posts: ['RB_NHAI'] },
  // The presenter's account: one person holding several posts drives the role switcher (§34 beat 7).
  {
    email: 'demo@bhoomisetu.local',
    fullName: 'Demo Presenter',
    posts: ['OVERSIGHT', 'STATE_MH', 'COLL_PUNE', 'FIELD_PSX'],
  },
];
