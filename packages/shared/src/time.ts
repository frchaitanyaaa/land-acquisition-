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
