import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatDaysRemaining, parseIsoInstant } from '../src/time';

describe('parseIsoInstant', () => {
  it('accepts an instant with an IST offset', () => {
    expect(parseIsoInstant('2026-12-10T10:00:00+05:30').toISOString()).toBe('2026-12-10T04:30:00.000Z');
  });

  it('accepts Z and milliseconds', () => {
    expect(parseIsoInstant('2026-12-10T04:30:00.250Z').getTime()).toBe(Date.UTC(2026, 11, 10, 4, 30, 0, 250));
  });

  it.each(['10 December', '2026-12-10', '2026-12-10T10:00:00', '2026-13-40T10:00:00Z', ''])('rejects %j', (v) => {
    expect(() => parseIsoInstant(v, 'DEMO_NOW')).toThrow(/DEMO_NOW/);
  });
});

describe('formatDate / formatDateTime', () => {
  it('formats a Drizzle-decoded timestamp (ISO with T and Z)', () => {
    expect(formatDate('2026-11-24T18:29:59.999Z')).toBe('24 Nov 2026');
  });

  it('formats a raw-SQL pg timestamp (space-separated, no T)', () => {
    expect(formatDate('2026-11-24 18:29:59.999+00')).toBe('24 Nov 2026');
  });

  it('converts to IST for display (a UTC evening can be the next IST day)', () => {
    // 2026-12-10T20:00:00Z = 2026-12-11 01:30 IST
    expect(formatDate('2026-12-10T20:00:00Z')).toBe('11 Dec 2026');
  });

  it('includes the time of day', () => {
    expect(formatDateTime('2026-12-10T04:30:00.000Z')).toBe('10 Dec 2026, 10:00 AM');
  });
});

describe('formatDaysRemaining', () => {
  it('labels the future, today and overdue cases', () => {
    expect(formatDaysRemaining(34)).toBe('34 days left');
    expect(formatDaysRemaining(1)).toBe('1 day left');
    expect(formatDaysRemaining(0)).toBe('due today');
    expect(formatDaysRemaining(-1)).toBe('1 day overdue');
    expect(formatDaysRemaining(-16)).toBe('16 days overdue');
  });
});
