import { z } from 'zod';
import {
  ACQUISITION_TYPES,
  DOC_TYPES,
  HEARING_TYPES,
  JURISDICTION_LEVELS,
  PROJECT_CATEGORIES,
  PROJECT_STATUSES,
  ROLES,
  SCHEDULE_REFS,
  TRANSITION_ACTIONS,
  type AcquisitionType,
} from '@bhoomisetu/shared';

// Every rule pack must satisfy this (CLAUDE.md §12.2). Additions beyond §12.2 are marked
// "extension" and exist because the engine needs them to avoid hard-coding a statutory fact.

const IsoDate = z.iso.date();
/** Calendar durations only (P6M, P60D, P6W, P1Y) — statutory clocks never use a time part. */
const IsoDuration = z.string().regex(/^P(?=\d)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?$/, 'ISO-8601 date duration');
const Code = z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'UPPER_SNAKE code');
/** Paise as a decimal string — JSON cannot carry bigint. */
const PaiseString = z.string().regex(/^\d+$/, 'paise as a digit string');

export type Condition = {
  all?: Condition[];
  any?: Condition[];
  not?: Condition;
  acquisitionTypeIn?: AcquisitionType[];
  isUrgency?: boolean;
  inScheduledArea?: boolean;
  /** Affected area at or above thresholds.rnrCommitteeAcres (s.45). */
  rnrCommitteeRequired?: boolean;
};

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.strictObject({
    all: z.array(ConditionSchema).optional(),
    any: z.array(ConditionSchema).optional(),
    not: ConditionSchema.optional(),
    acquisitionTypeIn: z.array(z.enum(ACQUISITION_TYPES)).optional(),
    isUrgency: z.boolean().optional(),
    inScheduledArea: z.boolean().optional(),
    rnrCommitteeRequired: z.boolean().optional(),
  }),
);

export const ChecklistItemSchema = z.strictObject({
  code: Code,
  type: z.enum(['document', 'event', 'gate', 'hearing']),
  docType: z.enum(DOC_TYPES).optional(),
  hearingType: z.enum(HEARING_TYPES).optional(), // extension: which hearing must be VALID
  required: z.boolean(),
  requiredWhen: ConditionSchema.optional(), // extension: e.g. R&R Committee only at ≥ 100 acres
});

export const ActionSchema = z.strictObject({
  roles: z.array(z.enum(ROLES)).min(1),
  makerChecker: z.boolean().optional(),
  requiresAttestation: z.boolean().optional(),
  /** Omitted = next applicable stage (APPROVE) or no stage change. */
  to: z.union([Code, z.literal('SAME'), z.literal('TERMINAL')]).optional(),
  terminalStatus: z.enum(PROJECT_STATUSES).optional(),
  reasonCodes: z.array(Code).optional(),
  requiresWrittenReasons: z.boolean().optional(),
  /** Statutory events. STAGE_* lifecycle events are emitted by the engine for every action. */
  emits: z.array(Code).optional(),
});

export const StageSchema = z.strictObject({
  code: Code,
  name: z.string().min(1),
  order: z.number().int().positive(),
  sections: z.array(z.string()),
  ownerRole: z.enum(ROLES),
  appliesWhen: ConditionSchema.optional(),
  /** extension: stages this one may run alongside (s.2: consent runs along with the SIA). */
  parallelWith: z.array(Code).optional(),
  checklist: z.array(ChecklistItemSchema),
  actions: z.partialRecord(z.enum(TRANSITION_ACTIONS), ActionSchema),
});

export const CLOCK_CONSEQUENCES = [
  'WARN',
  'SIA_LAPSED',
  'DEEMED_RESCINDED',
  'PROCEEDINGS_LAPSE',
  'POSSESSION_BLOCKED',
  'WINDOW_CLOSED',
  'REVERSION_DUE',
  'INTEREST_STEP_UP',
] as const;

export const ENTITLEMENT_HEAD_KINDS = ['LAND', 'MONETARY_RNR', 'IN_KIND', 'FLAG'] as const;

export const ClockSchema = z
  .strictObject({
    code: Code,
    section: z.string().min(1),
    label: z.string().min(1),
    // extension: AFFECTED_FAMILY (s.64 runs per person served with the s.37 notice)
    subject: z.enum(['PROJECT', 'STAGE', 'ENTITLEMENT', 'PROJECT_PARCEL', 'HEARING', 'AFFECTED_FAMILY']),
    startsOn: Code,
    /** extension: named condition input that must be true for the clock to start. */
    startsIf: z.string().optional(),
    endsOn: Code.optional(),
    duration: IsoDuration.optional(),
    durationWhen: z.array(z.strictObject({ if: z.string().min(1), duration: IsoDuration })).optional(),
    durationElse: IsoDuration.optional(),
    /** extension: ENTITLEMENT clocks — which head kinds this clock applies to. */
    appliesToHeadKinds: z.array(z.enum(ENTITLEMENT_HEAD_KINDS)).optional(),
    consequence: z.enum(CLOCK_CONSEQUENCES),
    consequenceText: z.string().min(1),
  })
  .refine((c) => (c.duration !== undefined) !== (c.durationWhen !== undefined), {
    message: 'a clock has either `duration` or `durationWhen` + `durationElse`, not both',
  })
  .refine((c) => (c.durationWhen === undefined) === (c.durationElse === undefined), {
    message: '`durationWhen` needs `durationElse`',
  });

export const ValidationCheckSchema = z.strictObject({
  code: Code,
  section: z.string().min(1),
  kind: z.string().min(1),
  params: z.record(z.string(), z.union([z.number(), z.string()])),
  message: z.string().min(1),
});

export const EntitlementHeadSchema = z.strictObject({
  code: Code,
  schedule: z.enum(SCHEDULE_REFS),
  label: z.string().min(1),
  kind: z.enum(ENTITLEMENT_HEAD_KINDS), // extension: drives COMPENSATION_PAYMENT / MONETARY_RNR clocks
  /** Flags entries BELOW the statutory minimum. Never used to compute an amount (G1). */
  minPaise: PaiseString.optional(),
  per: z.literal('MONTH').optional(), // extension: minPaise is per month …
  periods: z.number().int().positive().optional(), // … for this many months
  min: z.strictObject({ value: z.number().positive(), unit: z.string().min(1) }).optional(), // in-kind minimums
  notes: z.string().optional(),
});

export const PackSchema = z
  .strictObject({
    code: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'semver'),
    title: z.string().min(1),
    governingAct: z.string().min(1),
    jurisdiction: z.strictObject({
      level: z.enum(JURISDICTION_LEVELS).extract(['NATIONAL', 'STATE']),
      stateCode: z.string().optional(),
    }),
    effectiveFrom: IsoDate,
    effectiveTo: IsoDate.optional(),
    extends: z.strictObject({ code: z.string(), version: z.string() }).optional(),
    verify: z.array(z.string()).optional(),

    appliesTo: z.strictObject({
      acquisitionTypes: z.array(z.enum(ACQUISITION_TYPES)).min(1),
      categories: z.array(z.enum(PROJECT_CATEGORIES)).optional(),
    }),

    stages: z.array(StageSchema).min(1),
    clocks: z.array(ClockSchema),
    events: z.array(Code).min(1),
    /** extension: the reason-code catalog (§12.7), keyed by stage code, plus HEARING. */
    reasonCodes: z.record(z.string(), z.array(Code)),

    consent: z.strictObject({
      PRIVATE: z.number().gt(0).lte(1).optional(),
      PPP: z.number().gt(0).lte(1).optional(),
      GOVERNMENT: z.null().optional(),
      scheduledAreaGramSabha: z.boolean(),
    }),
    interest: z.strictObject({
      section: z.string(),
      rateYear1Pct: z.number().positive(),
      rateAfterPct: z.number().positive(),
      stepAfter: IsoDuration,
      dayCount: z.literal('ACT_365'),
    }),
    checks: z.array(ValidationCheckSchema),
    entitlementHeads: z.array(EntitlementHeadSchema),
    thresholds: z.strictObject({
      rnrCommitteeAcres: z.number().positive().optional(),
      scStFirstInstalmentMinFraction: z.number().gt(0).lt(1).optional(),
      deadlineDueSoonDays: z.number().int().positive(),
      gpsAccuracyWarnM: z.number().positive(),
      gpsAccuracyRejectM: z.number().positive(),
      areaMismatchFlagPct: z.number().positive(),
      photoMaxDistanceFromParcelM: z.number().positive(),
    }),
    escalation: z.strictObject({
      afterBreachDays: z.array(z.number().int().nonnegative()).min(1),
      levels: z.array(z.enum(['POST', 'DISTRICT', 'STATE'])).min(1),
    }),
    declarations: z.strictObject({ attestationVersion: z.string().min(1) }),
  })
  .superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });

    const dupes = (codes: string[]) => codes.filter((c, i) => codes.indexOf(c) !== i);
    for (const [key, list] of [
      ['stages', pack.stages.map((s) => s.code)],
      ['clocks', pack.clocks.map((c) => c.code)],
      ['checks', pack.checks.map((c) => c.code)],
      ['entitlementHeads', pack.entitlementHeads.map((h) => h.code)],
      ['events', pack.events],
    ] as const) {
      for (const d of dupes(list)) issue([key], `duplicate code ${d}`);
    }
    for (const d of dupes(pack.stages.map((s) => String(s.order)))) issue(['stages'], `duplicate order ${d}`);

    if (pack.jurisdiction.level === 'STATE' && !pack.jurisdiction.stateCode) {
      issue(['jurisdiction', 'stateCode'], 'a STATE pack needs a stateCode');
    }

    const events = new Set(pack.events);
    const stageCodes = new Set(pack.stages.map((s) => s.code));
    const allReasons = new Set(Object.values(pack.reasonCodes).flat());

    pack.clocks.forEach((c, i) => {
      if (!events.has(c.startsOn)) issue(['clocks', i, 'startsOn'], `unknown event ${c.startsOn}`);
      if (c.endsOn && !events.has(c.endsOn)) issue(['clocks', i, 'endsOn'], `unknown event ${c.endsOn}`);
    });

    pack.stages.forEach((s, si) => {
      for (const p of s.parallelWith ?? []) {
        if (!stageCodes.has(p)) issue(['stages', si, 'parallelWith'], `unknown stage ${p}`);
      }
      for (const [action, a] of Object.entries(s.actions)) {
        const path = ['stages', si, 'actions', action];
        for (const e of a.emits ?? []) if (!events.has(e)) issue([...path, 'emits'], `unknown event ${e}`);
        for (const r of a.reasonCodes ?? []) {
          if (!allReasons.has(r)) issue([...path, 'reasonCodes'], `${r} is not in the reasonCodes catalog`);
        }
        if (a.to && a.to !== 'SAME' && a.to !== 'TERMINAL' && !stageCodes.has(a.to)) {
          issue([...path, 'to'], `unknown stage ${a.to}`);
        }
        if (a.to === 'TERMINAL' && !a.terminalStatus)
          issue([...path, 'terminalStatus'], 'TERMINAL needs a terminalStatus');
        if (['RETURN', 'REJECT', 'NULLIFY', 'TERMINATE'].includes(action) && !a.reasonCodes?.length) {
          issue([...path, 'reasonCodes'], `${action} must list its allowed reason codes (§12.6 guard 5)`);
        }
        if (action === 'OVERRIDE' && !a.requiresWrittenReasons) {
          issue([...path, 'requiresWrittenReasons'], 'OVERRIDE requires written reasons (s.8(2))');
        }
      }
    });
  });

export type Pack = z.infer<typeof PackSchema>;
export type Stage = z.infer<typeof StageSchema>;
export type Clock = z.infer<typeof ClockSchema>;
export type StageAction = z.infer<typeof ActionSchema>;
export type ValidationCheck = z.infer<typeof ValidationCheckSchema>;
export type EntitlementHead = z.infer<typeof EntitlementHeadSchema>;

/** What the loader needs before merging: identity + parent. Everything else is validated after. */
export const RawPackSchema = z.looseObject({
  code: z.string().min(1),
  version: z.string().min(1),
  extends: z.strictObject({ code: z.string(), version: z.string() }).optional(),
});
export type RawPack = z.infer<typeof RawPackSchema>;
