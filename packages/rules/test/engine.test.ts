import { describe, expect, it } from 'vitest';
import { loadPacks } from '../src/fs';
import {
  applicableStages,
  availableActions,
  checkGuards,
  clockStatus,
  computeDueAt,
  deadlineStatus,
  daysRemaining,
  estimateInterestPaise,
  planTransition,
  possessionGate,
  runChecks,
  startClock,
  startForDueOn,
  type GuardContext,
  type ProjectFacts,
  type StageState,
} from '../src/index';

// §32.1 — engine unit tests. Expected values here are derived from the pack, never re-typed.

const pack = loadPacks().get('larr-2013-base@1.0.0')!; // loaded in golden.test.ts too

const gov: ProjectFacts = { acquisitionType: 'GOVERNMENT', isUrgency: false, inScheduledArea: false, status: 'ACTIVE' };
const ppp: ProjectFacts = { ...gov, acquisitionType: 'PPP' };

const iso = (s: string) => new Date(s);
const ist = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'short',
    timeStyle: 'medium',
    hourCycle: 'h23',
  }).format(d);

const collector = { userId: 'u-col', postId: 'p-col', role: 'COLLECTOR' as const, coversProject: true };
const lao = { userId: 'u-lao', postId: 'p-lao', role: 'LAO' as const, coversProject: true };

const approved = (...codes: string[]): StageState[] =>
  codes.map((stageCode) => ({ stageCode, attempt: 1, status: 'APPROVED' }));
const allChecked = (stageCode: string) =>
  Object.fromEntries(pack.stages.find((s) => s.code === stageCode)!.checklist.map((i) => [i.code, true]));

function ctx(over: Partial<GuardContext> & { stageCode?: string } = {}): GuardContext {
  return {
    project: gov,
    stages: [],
    actor: collector,
    checklist: over.stageCode ? allChecked(over.stageCode) : {},
    ...over,
  };
}

describe('computeDueAt (Asia/Kolkata, calendar arithmetic, end of day)', () => {
  it('adds months and lands at 23:59:59.999 IST', () => {
    const due = computeDueAt(iso('2026-03-10T05:00:00Z'), 'P6M');
    expect(ist(due)).toBe('2026-09-10, 23:59:59');
  });
  it('uses the IST date even when the UTC date differs', () => {
    // 20:00 UTC on 9 Mar is 01:30 IST on 10 Mar.
    expect(ist(computeDueAt(iso('2026-03-09T20:00:00Z'), 'P60D'))).toBe('2026-05-09, 23:59:59');
  });
  it('clamps month-end starts (31 Jan + P1M)', () => {
    expect(ist(computeDueAt(iso('2027-01-31T06:00:00Z'), 'P1M'))).toBe('2027-02-28, 23:59:59');
    expect(ist(computeDueAt(iso('2028-01-31T06:00:00Z'), 'P1M'))).toBe('2028-02-29, 23:59:59');
  });
  it('handles leap day + P1Y', () => {
    expect(ist(computeDueAt(iso('2028-02-29T06:00:00Z'), 'P1Y'))).toBe('2029-02-28, 23:59:59');
  });
  it('rejects a bad duration', () => {
    expect(() => computeDueAt(iso('2026-01-01T00:00:00Z'), 'six months')).toThrow();
  });
});

describe('deadlineStatus / daysRemaining', () => {
  const due = computeDueAt(iso('2026-01-01T06:00:00Z'), 'P12M');
  const soon = pack.thresholds.deadlineDueSoonDays;
  it('SAFE, DUE_SOON, BREACHED, SATISFIED', () => {
    expect(deadlineStatus(due, iso('2026-06-01T00:00:00Z'), soon)).toBe('SAFE');
    expect(deadlineStatus(due, iso('2026-12-20T00:00:00Z'), soon)).toBe('DUE_SOON');
    expect(deadlineStatus(due, iso('2027-01-02T00:00:00Z'), soon)).toBe('BREACHED');
    expect(deadlineStatus(due, iso('2027-01-02T00:00:00Z'), soon, iso('2026-06-01T00:00:00Z'))).toBe('SATISFIED');
  });
  it('counts calendar days in IST', () => {
    expect(daysRemaining(due, iso('2026-11-27T10:00:00Z'))).toBe(35);
    expect(daysRemaining(due, iso('2027-01-01T10:00:00Z'))).toBe(0);
  });
});

describe('clocks', () => {
  it('REFERENCE_WINDOW: 6 weeks when present at award, 6 months otherwise', () => {
    const start = iso('2026-04-01T06:00:00Z');
    const present = startClock(pack, 'REFERENCE_WINDOW', start, { presentAtAward: true })!;
    const absent = startClock(pack, 'REFERENCE_WINDOW', start, { presentAtAward: false })!;
    expect(present.dueAt).toEqual(computeDueAt(start, 'P6W'));
    expect(absent.dueAt).toEqual(computeDueAt(start, 'P6M'));
  });
  it('INTEREST_STEP starts only when an unpaid amount exists', () => {
    expect(startClock(pack, 'INTEREST_STEP', iso('2026-04-01T06:00:00Z'), {})).toBeNull();
    expect(startClock(pack, 'INTEREST_STEP', iso('2026-04-01T06:00:00Z'), { unpaidAmountExists: true })).not.toBeNull();
  });
  it('carries the pack consequence', () => {
    expect(startClock(pack, 'DECLARATION', iso('2026-04-01T06:00:00Z'))!.consequence).toBe('DEEMED_RESCINDED');
  });
});

describe('applicableStages', () => {
  const codes = (p: ProjectFacts) => applicableStages(pack, p).map((s) => s.code);
  it('GOVERNMENT skips consent', () => expect(codes(gov)).not.toContain('S04_CONSENT'));
  it('PPP and PRIVATE include consent', () => {
    expect(codes(ppp)).toContain('S04_CONSENT');
    expect(codes({ ...gov, acquisitionType: 'PRIVATE' })).toContain('S04_CONSENT');
  });
  it('Scheduled Area includes consent (s.41)', () =>
    expect(codes({ ...gov, inScheduledArea: true })).toContain('S04_CONSENT'));
  it('urgency skips SIA and appraisal (s.9)', () => {
    const c = codes({ ...gov, isUrgency: true });
    expect(c).not.toContain('S02_SIA');
    expect(c).not.toContain('S03_APPRAISAL');
  });
});

describe('checkGuards', () => {
  const submitted = (stageCode: string, by = lao): StageState => ({
    stageCode,
    attempt: 1,
    status: 'SUBMITTED',
    submittedByUserId: by.userId,
    submittedByPostId: by.postId,
  });

  it('allows a clean approval', () => {
    const r = checkGuards(
      pack,
      'S01_PROPOSAL',
      'APPROVE',
      {},
      ctx({ stageCode: 'S01_PROPOSAL', project: { ...gov, status: 'SUBMITTED' }, stages: [submitted('S01_PROPOSAL')] }),
    );
    expect(r).toEqual({ allowed: true, failures: [] });
  });

  it('maker-checker blocks the same user and the same post', () => {
    const sameUser = { ...collector, userId: lao.userId };
    const samePost = { ...collector, postId: lao.postId };
    for (const actor of [sameUser, samePost]) {
      const r = checkGuards(
        pack,
        'S01_PROPOSAL',
        'APPROVE',
        {},
        ctx({
          stageCode: 'S01_PROPOSAL',
          actor,
          project: { ...gov, status: 'SUBMITTED' },
          stages: [submitted('S01_PROPOSAL')],
        }),
      );
      expect(r.failures.map((f) => f.code)).toContain('MAKER_CHECKER');
    }
  });

  it('role and jurisdiction', () => {
    const r = checkGuards(
      pack,
      'S01_PROPOSAL',
      'APPROVE',
      {},
      ctx({
        stageCode: 'S01_PROPOSAL',
        actor: { ...lao, userId: 'x', postId: 'y', coversProject: false },
        project: { ...gov, status: 'SUBMITTED' },
        stages: [submitted('S01_PROPOSAL')],
      }),
    );
    expect(r.failures.map((f) => f.code)).toEqual(expect.arrayContaining(['ROLE_NOT_ALLOWED', 'OUT_OF_JURISDICTION']));
  });

  it('checklist must be complete (escrow gate)', () => {
    const checklist = { ...allChecked('S01_PROPOSAL'), ESCROW_INITIAL_FUNDED: false };
    const r = checkGuards(
      pack,
      'S01_PROPOSAL',
      'APPROVE',
      {},
      { ...ctx({ project: { ...gov, status: 'SUBMITTED' }, stages: [submitted('S01_PROPOSAL')] }), checklist },
    );
    expect(r.failures).toEqual([expect.objectContaining({ code: 'CHECKLIST_INCOMPLETE' })]);
  });

  it.each(['RETURN', 'NULLIFY'] as const)('%s needs a valid reason code', (action) => {
    const base = ctx({ stages: [...approved('S01_PROPOSAL'), submitted('S02_SIA')] });
    expect(checkGuards(pack, 'S02_SIA', action, {}, base).failures.map((f) => f.code)).toContain('REASON_REQUIRED');
    expect(
      checkGuards(pack, 'S02_SIA', action, { reasonCode: 'NOT_A_CODE' }, base).failures.map((f) => f.code),
    ).toContain('REASON_NOT_ALLOWED');
    const ok = pack.stages.find((s) => s.code === 'S02_SIA')!.actions[action]!.reasonCodes![0];
    expect(checkGuards(pack, 'S02_SIA', action, { reasonCode: ok }, base).allowed).toBe(true);
  });

  it('REJECT and TERMINATE need a valid reason code', () => {
    const s3 = ctx({
      actor: { ...collector, role: 'STATE_REVENUE' },
      stages: [...approved('S01_PROPOSAL', 'S02_SIA'), submitted('S03_APPRAISAL')],
    });
    expect(checkGuards(pack, 'S03_APPRAISAL', 'REJECT', {}, s3).failures.map((f) => f.code)).toContain(
      'REASON_REQUIRED',
    );
    const s4 = ctx({
      project: ppp,
      stages: [
        ...approved('S01_PROPOSAL'),
        { stageCode: 'S02_SIA', attempt: 1, status: 'IN_PROGRESS' },
        { stageCode: 'S04_CONSENT', attempt: 1, status: 'IN_PROGRESS' },
      ],
    });
    expect(checkGuards(pack, 'S04_CONSENT', 'TERMINATE', {}, s4).failures.map((f) => f.code)).toContain(
      'REASON_REQUIRED',
    );
    expect(checkGuards(pack, 'S04_CONSENT', 'TERMINATE', { reasonCode: 'THRESHOLD_NOT_MET' }, s4).allowed).toBe(true);
  });

  it('OVERRIDE needs written reasons (s.8(2))', () => {
    const c = ctx({
      stageCode: 'S03_APPRAISAL',
      actor: { ...collector, role: 'STATE_REVENUE' },
      stages: [...approved('S01_PROPOSAL', 'S02_SIA'), submitted('S03_APPRAISAL')],
    });
    expect(
      checkGuards(pack, 'S03_APPRAISAL', 'OVERRIDE', { writtenReasons: '  ' }, c).failures.map((f) => f.code),
    ).toContain('WRITTEN_REASONS_REQUIRED');
    expect(
      checkGuards(pack, 'S03_APPRAISAL', 'OVERRIDE', { writtenReasons: 'Public purpose outweighs…' }, c).allowed,
    ).toBe(true);
  });

  it('consent may start while the SIA is in progress; notification may not start before consent', () => {
    const during = [...approved('S01_PROPOSAL'), { stageCode: 'S02_SIA', attempt: 1, status: 'IN_PROGRESS' as const }];
    const laoCtx = (stageCode: string, stages: StageState[]) => ctx({ stageCode, actor: lao, project: ppp, stages });
    expect(checkGuards(pack, 'S04_CONSENT', 'SUBMIT', {}, laoCtx('S04_CONSENT', during)).allowed).toBe(true);
    const beforeConsent = [
      ...approved('S01_PROPOSAL', 'S02_SIA', 'S03_APPRAISAL'),
      { stageCode: 'S04_CONSENT', attempt: 1, status: 'IN_PROGRESS' as const },
    ];
    const r = checkGuards(pack, 'S05_NOTIFICATION', 'SUBMIT', {}, laoCtx('S05_NOTIFICATION', beforeConsent));
    expect(r.failures).toEqual([expect.objectContaining({ code: 'STAGE_ORDER' })]);
    const afterConsent = approved('S01_PROPOSAL', 'S02_SIA', 'S03_APPRAISAL', 'S04_CONSENT');
    expect(checkGuards(pack, 'S05_NOTIFICATION', 'SUBMIT', {}, laoCtx('S05_NOTIFICATION', afterConsent)).allowed).toBe(
      true,
    );
  });

  it('a breached DECLARATION clock blocks S07 (deemed rescinded) but not RETURN', () => {
    const stages = [
      ...approved('S01_PROPOSAL', 'S02_SIA', 'S03_APPRAISAL', 'S05_NOTIFICATION', 'S06_RNR_SCHEME'),
      submitted('S07_DECLARATION'),
    ];
    const c = ctx({ stageCode: 'S07_DECLARATION', stages, firedClocks: ['DECLARATION'] });
    const r = checkGuards(pack, 'S07_DECLARATION', 'APPROVE', { attested: true }, c);
    expect(r.failures.map((f) => f.code)).toEqual(['CLOCK_CONSEQUENCE']);
    expect(checkGuards(pack, 'S07_DECLARATION', 'RETURN', { reasonCode: 'TIMELINE_EXPIRED' }, c).allowed).toBe(true);
  });

  it('attestation required where the pack says so', () => {
    const stages = [...approved('S01_PROPOSAL', 'S02_SIA', 'S03_APPRAISAL'), submitted('S05_NOTIFICATION')];
    const r = checkGuards(pack, 'S05_NOTIFICATION', 'APPROVE', {}, ctx({ stageCode: 'S05_NOTIFICATION', stages }));
    expect(r.failures.map((f) => f.code)).toEqual(['ATTESTATION_REQUIRED']);
  });

  it('a terminated project cannot act', () => {
    const r = checkGuards(
      pack,
      'S02_SIA',
      'SUBMIT',
      {},
      ctx({
        stageCode: 'S02_SIA',
        actor: lao,
        project: { ...gov, status: 'TERMINATED' },
        stages: approved('S01_PROPOSAL'),
      }),
    );
    expect(r.failures.map((f) => f.code)).toContain('PROJECT_NOT_ACTIVE');
  });

  it('availableActions lists disabled actions with reasons', () => {
    const opts = availableActions(
      pack,
      'S01_PROPOSAL',
      ctx({ stageCode: 'S01_PROPOSAL', actor: lao, project: { ...gov, status: 'SUBMITTED' } }),
    );
    expect(opts.find((o) => o.action === 'SUBMIT')!.allowed).toBe(true);
    const approve = opts.find((o) => o.action === 'APPROVE')!;
    expect(approve.allowed).toBe(false);
    expect(approve.makerChecker).toBe(true);
  });
});

describe('planTransition', () => {
  it('S01 APPROVE activates the project and opens the next stage', () => {
    const plan = planTransition(
      pack,
      'S01_PROPOSAL',
      'APPROVE',
      {},
      {
        project: { ...gov, status: 'SUBMITTED' },
        stages: [{ stageCode: 'S01_PROPOSAL', attempt: 1, status: 'SUBMITTED' }],
      },
    );
    expect(plan.projectStatus).toBe('ACTIVE');
    expect(plan.changes.map((c) => [c.stageCode, c.status])).toEqual([
      ['S01_PROPOSAL', 'APPROVED'],
      ['S02_SIA', 'IN_PROGRESS'],
    ]);
    expect(plan.events).toEqual(['STAGE_APPROVED']);
  });
  it('for PPP, S01 APPROVE opens SIA and consent together', () => {
    const plan = planTransition(
      pack,
      'S01_PROPOSAL',
      'APPROVE',
      {},
      {
        project: { ...ppp, status: 'SUBMITTED' },
        stages: [{ stageCode: 'S01_PROPOSAL', attempt: 1, status: 'SUBMITTED' }],
      },
    );
    expect(plan.changes.slice(1).map((c) => c.stageCode)).toEqual(['S02_SIA', 'S04_CONSENT']);
    expect(plan.currentStage).toBe('S02_SIA');
  });
  it('S05 APPROVE emits S11_PUBLISHED and starts objection + declaration clocks, satisfies SIA lapse', () => {
    const plan = planTransition(
      pack,
      'S05_NOTIFICATION',
      'APPROVE',
      {},
      {
        project: gov,
        stages: [
          ...approved('S01_PROPOSAL', 'S02_SIA', 'S03_APPRAISAL'),
          { stageCode: 'S05_NOTIFICATION', attempt: 1, status: 'SUBMITTED' },
        ],
      },
    );
    expect(plan.events).toContain('S11_PUBLISHED');
    expect(plan.clocksToStart).toEqual(expect.arrayContaining(['OBJECTION_WINDOW', 'DECLARATION']));
    expect(plan.clocksToSatisfy).toContain('SIA_LAPSE');
    expect(plan.currentStage).toBe('S06_RNR_SCHEME');
  });
  it('expert outcome C → REJECT → ABANDONED', () => {
    const plan = planTransition(
      pack,
      'S03_APPRAISAL',
      'REJECT',
      { reasonCode: 'SIA_INCOMPLETE' },
      { project: gov, stages: [{ stageCode: 'S03_APPRAISAL', attempt: 1, status: 'SUBMITTED' }] },
    );
    expect(plan.projectStatus).toBe('ABANDONED');
    expect(plan.events).toContain('PROJECT_TERMINATED');
  });
  it('OVERRIDE instead of REJECT keeps the project going', () => {
    const plan = planTransition(
      pack,
      'S03_APPRAISAL',
      'OVERRIDE',
      { writtenReasons: 'reasons' },
      {
        project: gov,
        stages: [
          ...approved('S01_PROPOSAL', 'S02_SIA'),
          { stageCode: 'S03_APPRAISAL', attempt: 1, status: 'SUBMITTED' },
        ],
      },
    );
    expect(plan.projectStatus).toBeUndefined();
    expect(plan.newStatus).toBe('APPROVED');
    expect(plan.events).toContain('SIA_APPRAISED');
  });
  it('consent below threshold → TERMINATE → TERMINATED', () => {
    const plan = planTransition(
      pack,
      'S04_CONSENT',
      'TERMINATE',
      { reasonCode: 'THRESHOLD_NOT_MET' },
      { project: ppp, stages: [{ stageCode: 'S04_CONSENT', attempt: 1, status: 'IN_PROGRESS' }] },
    );
    expect(plan.projectStatus).toBe('TERMINATED');
  });
  it('NULLIFY restarts the stage as a new attempt', () => {
    const plan = planTransition(
      pack,
      'S02_SIA',
      'NULLIFY',
      { reasonCode: 'IMPROPER_AGENCY_SELECTION' },
      { project: gov, stages: [{ stageCode: 'S02_SIA', attempt: 1, status: 'SUBMITTED' }] },
    );
    expect(plan.changes).toEqual([
      { stageCode: 'S02_SIA', attempt: 1, status: 'NULLIFIED', isNew: false },
      { stageCode: 'S02_SIA', attempt: 2, status: 'IN_PROGRESS', isNew: true },
    ]);
  });
  it('S10 APPROVE closes the project without PROJECT_TERMINATED', () => {
    const plan = planTransition(
      pack,
      'S10_POST_ACQUISITION',
      'APPROVE',
      {},
      { project: gov, stages: [{ stageCode: 'S10_POST_ACQUISITION', attempt: 1, status: 'IN_PROGRESS' }] },
    );
    expect(plan.projectStatus).toBe('CLOSED');
    expect(plan.events).not.toContain('PROJECT_TERMINATED');
  });
});

describe('estimateInterestPaise (s.80, estimated)', () => {
  const possession = iso('2026-04-01T06:00:00Z');
  const at = (days: number) => new Date(possession.getTime() + days * 86_400_000);
  const unpaid = 36_500_000n; // ₹3,65,000 — divides cleanly by 365
  const { rateYear1Pct: r1, rateAfterPct: r2 } = pack.interest;

  it('day 0 → 0', () => expect(estimateInterestPaise(unpaid, possession, possession, pack.interest)).toBe(0n));
  it('day 365 uses the year-1 rate only', () => {
    expect(estimateInterestPaise(unpaid, possession, at(365), pack.interest)).toBe((unpaid * BigInt(r1)) / 100n);
  });
  it('day 366 adds one day at the later rate', () => {
    const expected = (unpaid * BigInt(r1)) / 100n + (unpaid * BigInt(r2)) / 100n / 365n;
    expect(estimateInterestPaise(unpaid, possession, at(366), pack.interest)).toBe(expected);
  });
  it('rounds half-up once, in integer paise', () => {
    // 1 paisa for 1 day at 9% → 0.0002 → 0; 20,000 paise → 4.93 → 5; ₹20,000 → 493.15 → 493.
    expect(estimateInterestPaise(1n, possession, at(1), pack.interest)).toBe(0n);
    expect(estimateInterestPaise(20_000n, possession, at(1), pack.interest)).toBe(5n);
    expect(estimateInterestPaise(2_000_000n, possession, at(1), pack.interest)).toBe(493n);
    expect(typeof estimateInterestPaise(2_000_000n, possession, at(1), pack.interest)).toBe('bigint');
  });
  it('no unpaid amount, or asOf before possession → 0', () => {
    expect(estimateInterestPaise(0n, possession, at(400), pack.interest)).toBe(0n);
    expect(estimateInterestPaise(unpaid, possession, at(-10), pack.interest)).toBe(0n);
  });
});

describe('runChecks (validate entered values, never compute)', () => {
  const status = (rs: ReturnType<typeof runChecks>, code: string) => rs.find((r) => r.code === code)?.status;
  const land = 100_000_000n;
  const good = [
    { headCode: 'LAND_COMPENSATION', amountPaise: land },
    { headCode: 'ASSETS', amountPaise: 20_000_000n },
    { headCode: 'SOLATIUM', amountPaise: 120_000_000n },
    { headCode: 'ADDITIONAL_12PA', amountPaise: 5_000_000n },
  ];

  it('solatium equal to 100% passes; off by more than the tolerance fails', () => {
    expect(status(runChecks(pack, { heads: good }), 'SOLATIUM_100')).toBe('PASS');
    const bad = good.map((h) => (h.headCode === 'SOLATIUM' ? { ...h, amountPaise: 119_000_000n } : h));
    expect(status(runChecks(pack, { heads: bad }), 'SOLATIUM_100')).toBe('FAIL');
  });
  it('12% additional amount must be present with land compensation', () => {
    expect(
      status(
        runChecks(pack, { heads: good.filter((h) => h.headCode !== 'ADDITIONAL_12PA') }),
        'ADDITIONAL_12PA_PRESENT',
      ),
    ).toBe('FAIL');
  });
  it('multiplication factor: 1.25 passes the rural range, 2.10 fails, urban must be 1.00', () => {
    expect(status(runChecks(pack, { heads: good, factor: { value: 1.25, area: 'RURAL' } }), 'RURAL_FACTOR_RANGE')).toBe(
      'PASS',
    );
    expect(status(runChecks(pack, { heads: good, factor: { value: 2.1, area: 'RURAL' } }), 'RURAL_FACTOR_RANGE')).toBe(
      'FAIL',
    );
    expect(status(runChecks(pack, { heads: good, factor: { value: 1.25, area: 'URBAN' } }), 'RURAL_FACTOR_RANGE')).toBe(
      'FAIL',
    );
  });
  it('SC/ST first instalment below one-third fails', () => {
    const total = good.reduce((a, h) => a + h.amountPaise, 0n);
    expect(
      status(
        runChecks(pack, { heads: good, isScSt: true, firstInstalmentPaise: total / 4n }),
        'SC_ST_FIRST_INSTALMENT',
      ),
    ).toBe('FAIL');
    expect(
      status(
        runChecks(pack, { heads: good, isScSt: true, firstInstalmentPaise: total / 2n }),
        'SC_ST_FIRST_INSTALMENT',
      ),
    ).toBe('PASS');
    expect(
      status(runChecks(pack, { heads: good, isScSt: false, firstInstalmentPaise: 1n }), 'SC_ST_FIRST_INSTALMENT'),
    ).toBe('NOT_APPLICABLE');
  });
  it('urgency additional 75% applies only to urgency projects', () => {
    expect(status(runChecks(pack, { heads: good }), 'URGENCY_ADDITIONAL_75')).toBe('NOT_APPLICABLE');
    expect(status(runChecks(pack, { heads: good, isUrgency: true }), 'URGENCY_ADDITIONAL_75')).toBe('FAIL');
  });
  it('flags a head below its statutory minimum', () => {
    const min = BigInt(pack.entitlementHeads.find((h) => h.code === 'TRANSPORT')!.minPaise!);
    const r = runChecks(pack, { heads: [{ headCode: 'TRANSPORT', amountPaise: min - 1n }] });
    expect(r.find((x) => x.headCode === 'TRANSPORT')!.status).toBe('FAIL');
  });
  it('never returns an amount', () => {
    for (const r of runChecks(pack, { heads: good }))
      expect(Object.values(r).some((v) => typeof v === 'bigint')).toBe(false);
  });
  it('unknown check kinds are NOT_EVALUATED, not silently passed', () => {
    const mh = loadPacks().get('larr-2013-maharashtra@1.0.0')!;
    expect(status(runChecks(mh, { heads: good }), 'RURAL_FACTOR_BANDS')).toBe('NOT_EVALUATED');
  });
});

describe('possessionGate (s.38)', () => {
  const base = {
    families: [{ id: 'f1', isDisplaced: false }],
    vacationCertificateAttested: true,
  };
  it('blocked with an unacknowledged land head', () => {
    const r = possessionGate(pack, {
      ...base,
      entitlements: [
        { id: 'e1', familyId: 'f1', headCode: 'LAND_COMPENSATION', status: 'DISBURSED', paymentStatus: 'SUCCESS' },
      ],
    });
    expect(r.failures.map((f) => f.code)).toEqual(['LAND_HEAD_UNSETTLED']);
  });
  it('passes with DEPOSITED_WITH_AUTHORITY, ACKNOWLEDGED, or UNDER_PROTEST paid', () => {
    const r = possessionGate(pack, {
      ...base,
      entitlements: [
        { id: 'e1', familyId: 'f1', headCode: 'LAND_COMPENSATION', status: 'DEPOSITED_WITH_AUTHORITY' },
        { id: 'e2', familyId: 'f1', headCode: 'SOLATIUM', status: 'ACKNOWLEDGED' },
        { id: 'e3', familyId: 'f1', headCode: 'ASSETS', status: 'UNDER_PROTEST', paymentStatus: 'SUCCESS' },
      ],
    });
    expect(r).toEqual({ allowed: true, failures: [] });
  });
  it('blocked when a displaced family’s site is not ready, unless excepted', () => {
    const fam = { id: 'f1', isDisplaced: true, siteReadinessPct: 80 };
    expect(possessionGate(pack, { ...base, families: [fam], entitlements: [] }).failures.map((f) => f.code)).toEqual([
      'SITE_NOT_READY',
    ]);
    expect(
      possessionGate(pack, { ...base, families: [{ ...fam, siteException: true }], entitlements: [] }).allowed,
    ).toBe(true);
  });
  it('monetary R&R gates only displaced families', () => {
    const ent = [{ id: 'e1', familyId: 'f1', headCode: 'TRANSPORT', status: 'ASSESSED' as const }];
    expect(possessionGate(pack, { ...base, entitlements: ent }).allowed).toBe(true);
    const displaced = [{ id: 'f1', isDisplaced: true, siteReadinessPct: 100 }];
    expect(
      possessionGate(pack, { ...base, families: displaced, entitlements: ent }).failures.map((f) => f.code),
    ).toEqual(['RNR_HEAD_UNSETTLED']);
  });
  it('needs the vacation certificate and no legal stay', () => {
    const r = possessionGate(pack, { ...base, entitlements: [], vacationCertificateAttested: false, legalStay: true });
    expect(r.failures.map((f) => f.code)).toEqual(['VACATION_CERTIFICATE_MISSING', 'LEGAL_STAY']);
  });
});

describe('startForDueOn (seed helper)', () => {
  it.each(['P12M', 'P60D', 'P6W', 'P1M'])('%s: the returned start falls due on the target day', (dur) => {
    for (const day of ['2027-01-13T12:00:00Z', '2027-02-28T12:00:00Z', '2027-03-28T12:00:00Z']) {
      const start = startForDueOn(iso(day), dur);
      expect(ist(computeDueAt(start, dur)).slice(0, 10)).toBe(ist(iso(day)).slice(0, 10));
    }
  });
  it('throws when no start date can fall due that day (nothing + P1M lands on 31 Mar)', () => {
    expect(() => startForDueOn(iso('2027-03-31T12:00:00Z'), 'P1M')).toThrow();
  });
});

describe('clockStatus', () => {
  it('a window with no ending event elapses rather than breaches', () => {
    const window = pack.clocks.find((c) => c.code === 'OBJECTION_WINDOW')!;
    const decl = pack.clocks.find((c) => c.code === 'DECLARATION')!;
    const due = iso('2026-01-01T18:29:59Z');
    const later = iso('2026-02-01T00:00:00Z');
    expect(clockStatus(window, due, later, 30)).toBe('SATISFIED');
    expect(clockStatus(decl, due, later, 30)).toBe('BREACHED');
  });
});
