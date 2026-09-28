import type { Pack } from '../../schema/pack.schema';
import { calendarDaysBetween, computeDueAt, STATUTORY_TZ } from './time';

const DAY_COUNT_BASIS: Record<Pack['interest']['dayCount'], bigint> = { ACT_365: 365n };

/** Percent → basis points as an integer, so rates such as 9.5 stay exact. */
const basisPoints = (pct: number): bigint => BigInt(Math.round(pct * 100));

/**
 * ESTIMATED s.80 interest liability (G2) — the only money figure the system computes.
 * Simple interest: the year-1 rate until `stepAfter` has elapsed since possession, the later
 * rate after it. Integer paise, one half-up rounding at the end. [VERIFY] day-count convention.
 */
export function estimateInterestPaise(
  unpaidPaise: bigint,
  possessionAt: Date,
  asOf: Date,
  cfg: Pack['interest'],
  tz: string = STATUTORY_TZ,
): bigint {
  if (unpaidPaise <= 0n) return 0n;
  const days = BigInt(Math.max(0, calendarDaysBetween(possessionAt, asOf, tz)));
  const stepDays = BigInt(calendarDaysBetween(possessionAt, computeDueAt(possessionAt, cfg.stepAfter, tz), tz));
  const d1 = days < stepDays ? days : stepDays;
  const d2 = days > stepDays ? days - stepDays : 0n;

  const numerator = unpaidPaise * (basisPoints(cfg.rateYear1Pct) * d1 + basisPoints(cfg.rateAfterPct) * d2);
  const denominator = 10_000n * DAY_COUNT_BASIS[cfg.dayCount];
  return (numerator * 2n + denominator) / (denominator * 2n);
}
