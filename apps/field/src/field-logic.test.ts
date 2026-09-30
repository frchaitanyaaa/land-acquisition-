import { describe, expect, it } from 'vitest';
import { estimatePolygonAreaSqm, getAccuracyState } from './field-logic';

describe('field-logic', () => {
  it('rates accuracy by warning and reject thresholds', () => {
    expect(getAccuracyState(7, 10, 25)).toBe('good');
    expect(getAccuracyState(12, 10, 25)).toBe('warn');
    expect(getAccuracyState(30, 10, 25)).toBe('critical');
  });

  it('estimates a simple triangle area in square metres', () => {
    const area = estimatePolygonAreaSqm([
      { lat: 19.076, lng: 72.877 },
      { lat: 19.077, lng: 72.878 },
      { lat: 19.078, lng: 72.877 },
    ]);
    expect(area).toBeGreaterThan(0);
    expect(area).toBeLessThan(1000000);
  });
});
