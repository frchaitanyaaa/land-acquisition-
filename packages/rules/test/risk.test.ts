import { describe, expect, it } from 'vitest';
import { RISK_WEIGHTS, riskScore } from '../src/risk';

const base = {
  startedAt: new Date('2026-01-01T00:00:00Z'),
  dueAt: new Date('2026-12-31T00:00:00Z'),
  now: new Date('2026-01-01T00:00:00Z'),
  returns: 0,
  stageElapsedDays: 0,
  districtMedianDays: null,
  openObjectionsClaims: 0,
  escrowDemandPaise: 0n,
  escrowDepositedPaise: 0n,
  hearingsVoided: 0,
  legalStays: 0,
};

describe('riskScore (heuristic, §24.4)', () => {
  it('weights sum to 1', () => {
    expect(Object.values(RISK_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it('fresh clock, nothing wrong → 0', () => {
    expect(riskScore(base).score).toBe(0);
    expect(riskScore(base).top).toEqual([]);
  });
  it('everything maxed → 100', () => {
    const r = riskScore({
      ...base,
      now: new Date('2027-06-01T00:00:00Z'),
      returns: 5,
      stageElapsedDays: 400,
      districtMedianDays: 100,
      openObjectionsClaims: 50,
      escrowDemandPaise: 100n,
      hearingsVoided: 3,
      legalStays: 4,
    });
    expect(r.score).toBe(100);
  });
  it('reports the top three contributors', () => {
    const r = riskScore({
      ...base,
      now: new Date('2026-07-01T00:00:00Z'),
      returns: 3,
      escrowDemandPaise: 100n,
      escrowDepositedPaise: 50n,
    });
    expect(r.top).toEqual(['clockElapsed', 'returns', 'escrowShortfall']);
  });
});
