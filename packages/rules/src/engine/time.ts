import { DateTime, Duration } from 'luxon';
import type { DeadlineStatus } from '@bhoomisetu/shared';

// Statutory time (G16, G17). Every "now" is passed in — the engine never reads the clock.

/** The zone statutory dates are computed in. Callers pass STATUTORY_TZ; this is the default. */
export const STATUTORY_TZ = 'Asia/Kolkata';

const MS_PER_DAY = 86_400_000;

function parseDuration(isoDuration: string): Duration {
  const d = Duration.fromISO(isoDuration);
  if (!d.isValid) throw new Error(`invalid ISO-8601 duration: ${isoDuration}`);
  return d;
}

/**
 * The single place that decides legal day-counting. [VERIFY] the convention: today the start
 * instant is converted to the statutory zone, the duration is added with calendar arithmetic
 * (31 Jan + P1M = 28/29 Feb), and the deadline falls at the END of that calendar day.
 */
export function computeDueAt(startedAtUtc: Date, isoDuration: string, tz: string = STATUTORY_TZ): Date {
  const start = DateTime.fromJSDate(startedAtUtc, { zone: tz });
  if (!start.isValid) throw new Error(`invalid start instant or zone (${tz})`);
  return start.plus(parseDuration(isoDuration)).endOf('day').toJSDate();
}

/** Whole calendar days from `from` to `to` in the statutory zone (negative when `to` is earlier). */
export function calendarDaysBetween(from: Date, to: Date, tz: string = STATUTORY_TZ): number {
  const a = DateTime.fromJSDate(from, { zone: tz }).startOf('day');
  const b = DateTime.fromJSDate(to, { zone: tz }).startOf('day');
  return Math.round(b.diff(a, 'days').days);
}

/** Calendar days left until the due date (0 on the due date itself, negative once breached). */
export function daysRemaining(dueAt: Date, now: Date, tz: string = STATUTORY_TZ): number {
  return calendarDaysBetween(now, dueAt, tz);
}

export function deadlineStatus(dueAt: Date, now: Date, dueSoonDays: number, satisfiedAt?: Date | null): DeadlineStatus {
  if (satisfiedAt) return 'SATISFIED';
  const left = dueAt.getTime() - now.getTime();
  if (left < 0) return 'BREACHED';
  if (left <= dueSoonDays * MS_PER_DAY) return 'DUE_SOON';
  return 'SAFE';
}
