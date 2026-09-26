import { describe, expect, it } from 'vitest';
import { parseIsoInstant } from '../src/time';

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
