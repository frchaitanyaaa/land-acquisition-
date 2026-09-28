import { describe, expect, it } from 'vitest';
import { checkPlausibility, distanceM } from '../src/plausibility';

const t = { gpsAccuracyWarnM: 20, gpsAccuracyRejectM: 50 };
const at = (min: number) => new Date(Date.UTC(2026, 11, 10, 5, min));
const sq = (acc = [4.3, 5.1, 6.2, 3.9]) => [
  { seq: 1, lat: 18.3301234, lng: 73.8601234, accuracyM: acc[0]!, capturedAt: at(0) },
  { seq: 2, lat: 18.3301234, lng: 73.8611234, accuracyM: acc[1]!, capturedAt: at(3) },
  { seq: 3, lat: 18.3311234, lng: 73.8611234, accuracyM: acc[2]!, capturedAt: at(6) },
  { seq: 4, lat: 18.3311234, lng: 73.8601234, accuracyM: acc[3]!, capturedAt: at(9) },
];

describe('field plausibility (§15.6)', () => {
  it('haversine ≈ 111 m per 0.001° latitude', () => {
    expect(distanceM({ lat: 18, lng: 73 }, { lat: 18.001, lng: 73 })).toBeCloseTo(111.2, 0);
  });
  it('a clean walk passes', () => {
    const r = checkPlausibility(sq(), t, at(30));
    expect(r.flags).toEqual({});
    expect(r.reject).toBe(false);
  });
  it('accuracy: warn above warn threshold, reject above reject threshold', () => {
    const r = checkPlausibility(sq([4, 25.5, 60.2, 5.5]), t, at(30));
    expect(r.vertices.find((v) => v.seq === 2)!.issues).toEqual(['ACCURACY_WARN']);
    expect(r.rejectedSeqs).toEqual([3]);
  });
  it('too few usable points rejects the survey', () => {
    const r = checkPlausibility(sq([60, 60, 5.2, 5.1]), t, at(30));
    expect(r.reject).toBe(true);
    expect(r.flags.TOO_FEW_POINTS).toBeDefined();
  });
  it('implausible speed (driving between corners)', () => {
    const v = sq();
    v[1]!.capturedAt = new Date(at(0).getTime() + 10_000); // ~106 m in 10 s ≈ 38 km/h
    expect(checkPlausibility(v, t, at(30)).flags.IMPLAUSIBLE_SPEED).toBeDefined();
  });
  it('clock skew: captured in the future or long before sync', () => {
    expect(checkPlausibility(sq(), t, at(-10)).flags.CLOCK_SKEW).toBeDefined();
    expect(checkPlausibility(sq(), t, new Date(at(0).getTime() + 3 * 24 * 3_600_000)).flags.CLOCK_SKEW).toBeDefined();
  });
  it('suspicious precision: repeated integer accuracy or coarse coordinates', () => {
    const five = [...sq([5, 5, 5, 5]), { seq: 5, lat: 18.3305234, lng: 73.8600234, accuracyM: 5, capturedAt: at(12) }];
    expect(checkPlausibility(five, t, at(30)).flags.SUSPICIOUS_FIX).toMatch(/exactly 5 m/);
    const coarse = sq();
    coarse[0]!.lat = 18.3301;
    expect(checkPlausibility(coarse, t, at(30)).flags.SUSPICIOUS_FIX).toMatch(/decimals/);
  });
});
