// The Act, restated independently of any pack (CLAUDE.md §39.4). The golden test compares the
// resolved larr-2013-base pack against this file, so a wrong number has to be wrong twice to
// ship. Change a value here only with the section of the Act open in front of you.

export const ACT = {
  consent: { PRIVATE: 0.8, PPP: 0.7, GOVERNMENT: null }, // s.2
  clocks: {
    SIA_COMPLETION: { section: '4', duration: 'P6M' },
    EXPERT_GROUP: { section: '7', duration: 'P2M' },
    SIA_LAPSE: { section: '14', duration: 'P12M', consequence: 'SIA_LAPSED' },
    OBJECTION_WINDOW: { section: '15', duration: 'P60D' },
    DECLARATION: { section: '19', duration: 'P12M', consequence: 'DEEMED_RESCINDED' },
    AWARD: { section: '25', duration: 'P12M', consequence: 'PROCEEDINGS_LAPSE' },
    COMPENSATION_PAYMENT: { section: '38', duration: 'P3M' },
    MONETARY_RNR: { section: '38', duration: 'P6M' },
    INFRA_RNR: { section: '38', duration: 'P18M' },
    UTILISATION: { section: '101', duration: 'P5Y' },
  },
  referenceWindow: { section: '64', ifPresent: 'P6W', otherwise: 'P6M' },
  interest: { section: '80', year1Pct: 9, afterPct: 15, stepAfter: 'P1Y' },
  solatiumPct: 100, // s.30
  additionalAmountPctPerAnnum: 12, // s.30(3)
  multiplicationFactor: { ruralMin: 1, ruralMax: 2, urban: 1 }, // First Schedule — NOT 1.25
  urgency: { tenderedPct: 80, additionalPct: 75 }, // s.40
  scStFirstInstalment: { numerator: 1, denominator: 3 }, // s.41
  rnrCommitteeAcres: 100, // s.45
  secondSchedule: {
    urbanHousePlinthSqm: 50,
    urbanHouseOptOutRupees: 150_000,
    oneTimeInLieuOfEmploymentRupees: 500_000,
    annuityRupeesPerMonth: 2_000,
    annuityMonths: 240,
    subsistenceRupeesPerMonth: 3_000,
    subsistenceMonths: 12,
    scStScheduledAreaExtraRupees: 50_000,
    transportRupees: 50_000,
    cattleShedMinRupees: 25_000,
    artisanMinRupees: 25_000,
    resettlementAllowanceRupees: 50_000,
    scStOutsideDistrictRupees: 50_000,
    landForLandMinAcres: 1,
    developedLandPct: 20,
  },
} as const;

export const rupeesToPaise = (rupees: number) => String(rupees * 100);
