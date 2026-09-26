import { describe, expect, it } from 'vitest';
import { SQM_PER_ACRE, SQM_PER_GUNTHA, formatArea } from '../src/units';

describe('area units', () => {
  it('defines a guntha as exactly 1/40 acre', () => {
    expect(SQM_PER_GUNTHA * 40).toBeCloseTo(SQM_PER_ACRE, 9);
  });

  it('formats square metres as ha · acre · guntha', () => {
    expect(formatArea(23_700)).toBe('2.37 ha · 5.86 acre · 234.3 guntha');
  });
});
