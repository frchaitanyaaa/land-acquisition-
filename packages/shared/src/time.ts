import { DateTime } from 'luxon';

// Statutory time must be unambiguous (G17). V8's Date parser is lenient — `new Date('10 December')`
// is a valid date in 2001 — so any configured instant (DEMO_NOW) goes through this instead.

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/** Parses an ISO-8601 instant WITH an explicit offset (`Z` or `+05:30`). Throws otherwise. */
export function parseIsoInstant(value: string, name = 'timestamp'): Date {
  const at = new Date(value);
  if (!ISO_INSTANT.test(value) || Number.isNaN(at.getTime())) {
    throw new Error(
      `${name} must be an ISO-8601 instant with an offset, e.g. 2026-12-10T10:00:00+05:30 (got "${value}")`,
    );
  }
  return at;
}

// Display formatting (§9): `dd MMM yyyy`, computed via luxon — never hand-rolled `Date` math. The
// backend already computes day-counts (`days_remaining` etc.); these only ever format a value it
// already produced, in Asia/Kolkata (a statutory date is a date in India, not an instant in UTC, G17).
//
// A `timestamptz` reaches the client two ways depending on which API layer built the response: a
// Drizzle-typed select decodes it to a JS Date, serialised as proper ISO ("...T...Z"); a raw SQL
// row (rows()/one()) carries the pg driver's own string, space-separated ("... ...+00"), with no
// "T". Both are unambiguous full timestamps (date + time + offset) — accept either.
function toDateTime(value: string): DateTime {
  const isoish = value.includes('T') ? value : value.replace(' ', 'T');
  const dt = DateTime.fromISO(isoish, { zone: 'utc' });
  return dt.isValid ? dt : DateTime.fromSQL(value, { zone: 'utc' });
}

/** `10 Dec 2026`. */
export function formatDate(value: string): string {
  return toDateTime(value).setZone('Asia/Kolkata').toFormat('dd MMM yyyy');
}

/** `10 Dec 2026, 10:00 am`. */
export function formatDateTime(value: string): string {
  return toDateTime(value).setZone('Asia/Kolkata').toFormat('dd MMM yyyy, h:mm a');
}

/** "34 days left" / "16 days overdue" / "due today" — the label half; the number itself always
 * comes from the API (`days_remaining`), never computed client-side. */
export function formatDaysRemaining(days: number): string {
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'due today';
  return `${days} day${days === 1 ? '' : 's'} left`;
}
