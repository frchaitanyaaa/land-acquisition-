import type { Pack, ValidationCheck } from '../../schema/pack.schema';

// Award-entry validation (G1): these VALIDATE amounts the Collector entered. They never produce
// an amount, and results never carry a "correct" figure.

export interface EnteredHead {
  headCode: string;
  amountPaise: bigint;
}

export interface CheckInput {
  heads: EnteredHead[];
  isScSt?: boolean;
  isUrgency?: boolean;
  /** Multiplication factor as stated in the award, if any. */
  factor?: { value: number; area: 'RURAL' | 'URBAN' };
  firstInstalmentPaise?: bigint;
  tenderedBeforePossessionPaise?: bigint;
}

export type CheckStatus = 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'NOT_EVALUATED';

export interface CheckResult {
  code: string;
  section: string;
  status: CheckStatus;
  message: string;
  headCode?: string;
}

const sumOf = (input: CheckInput, codes: Iterable<string>): bigint => {
  const set = new Set(codes);
  return input.heads.filter((h) => set.has(h.headCode)).reduce((a, h) => a + h.amountPaise, 0n);
};
const has = (input: CheckInput, code: string) => input.heads.some((h) => h.headCode === code && h.amountPaise > 0n);
const csv = (v: string | number | undefined) =>
  String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const num = (v: string | number | undefined) => Number(v);
/** Percent as a basis-point integer, so percentages stay exact in bigint arithmetic. */
const bp = (pct: number) => BigInt(Math.round(pct * 100));

type Evaluate = (check: ValidationCheck, input: CheckInput, pack: Pack) => CheckStatus;

const landTotal = (input: CheckInput, pack: Pack) =>
  sumOf(
    input,
    pack.entitlementHeads.filter((h) => h.kind === 'LAND').map((h) => h.code),
  );

const KINDS: Partial<Record<string, Evaluate>> = {
  HEAD_EQUALS_PCT_OF_HEADS: ({ params }, input) => {
    if (typeof params.when === 'string' && !input[params.when as 'isUrgency' | 'isScSt']) return 'NOT_APPLICABLE';
    const base = sumOf(input, csv(params.ofHeads));
    const head = String(params.head);
    if (base === 0n && !has(input, head)) return 'NOT_APPLICABLE';
    const entered = sumOf(input, [head]);
    const diff = entered * 10_000n - base * bp(num(params.pct));
    const tol = BigInt(num(params.tolerancePaise ?? 0)) * 10_000n;
    return (diff < 0n ? -diff : diff) <= tol ? 'PASS' : 'FAIL';
  },
  HEAD_PRESENT_WHEN: ({ params }, input) => {
    if (!has(input, String(params.when))) return 'NOT_APPLICABLE';
    return has(input, String(params.head)) ? 'PASS' : 'FAIL';
  },
  FACTOR_RANGE: ({ params }, input) => {
    if (!input.factor) return 'NOT_APPLICABLE';
    const { value, area } = input.factor;
    if (area === 'URBAN') return value === num(params.urban) ? 'PASS' : 'FAIL';
    return value >= num(params.ruralMin) && value <= num(params.ruralMax) ? 'PASS' : 'FAIL';
  },
  FIRST_INSTALMENT_MIN_FRACTION: ({ params }, input, pack) => {
    if (!input.isScSt || input.firstInstalmentPaise === undefined) return 'NOT_APPLICABLE';
    const total = landTotal(input, pack);
    return input.firstInstalmentPaise * BigInt(num(params.denominator)) >= total * BigInt(num(params.numerator))
      ? 'PASS'
      : 'FAIL';
  },
  MIN_PCT_TENDERED_BEFORE_POSSESSION: ({ params }, input, pack) => {
    if (!input.isUrgency || input.tenderedBeforePossessionPaise === undefined) return 'NOT_APPLICABLE';
    return input.tenderedBeforePossessionPaise * 10_000n >= landTotal(input, pack) * bp(num(params.pct))
      ? 'PASS'
      : 'FAIL';
  },
};

export function runChecks(pack: Pack, input: CheckInput): CheckResult[] {
  const results: CheckResult[] = pack.checks.map((check) => {
    const evaluate = KINDS[check.kind];
    return {
      code: check.code,
      section: check.section,
      status: evaluate ? evaluate(check, input, pack) : 'NOT_EVALUATED',
      message: evaluate ? check.message : `${check.message} — no evaluator for kind ${check.kind}; check manually.`,
    };
  });

  // Statutory minimums (Second Schedule) — flags entries below the minimum. For per-month heads
  // the entered amount is the total over the schedule and is compared with minimum × periods.
  for (const head of pack.entitlementHeads) {
    if (!head.minPaise) continue;
    const entered = input.heads.filter((h) => h.headCode === head.code);
    if (!entered.length) continue;
    const min = BigInt(head.minPaise) * BigInt(head.periods ?? 1);
    const total = entered.reduce((a, h) => a + h.amountPaise, 0n);
    results.push({
      code: 'BELOW_STATUTORY_MINIMUM',
      section: head.schedule === 'SECOND' ? 'Second Schedule' : head.schedule,
      status: total >= min ? 'PASS' : 'FAIL',
      message: `${head.label}: the amount entered must not be below the statutory minimum`,
      headCode: head.code,
    });
  }
  return results;
}
