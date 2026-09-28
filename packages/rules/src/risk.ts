// Delay risk score (§24.4) — a transparent weighted formula, NOT statute and NOT a trained model.
// Weights are heuristic and documented as such; each input is normalised to [0, 1].

export const RISK_WEIGHTS = {
  clockElapsed: 0.35,
  returns: 0.15,
  slowerThanDistrictMedian: 0.15,
  openObjectionsClaims: 0.1,
  escrowShortfall: 0.1,
  hearingsVoided: 0.1,
  legalStays: 0.05,
} as const;

export type RiskFactor = keyof typeof RISK_WEIGHTS;

export const RISK_LABELS: Record<RiskFactor, string> = {
  clockElapsed: 'Share of the statutory clock already used',
  returns: 'Files returned on this stage',
  slowerThanDistrictMedian: 'Slower than the district median for this stage',
  openObjectionsClaims: 'Open objections and claims',
  escrowShortfall: 'Escrow shortfall',
  hearingsVoided: 'Hearings voided on this project',
  legalStays: 'Legal stays / writs on project parcels',
};

export interface RiskInputs {
  startedAt: Date;
  dueAt: Date;
  now: Date;
  returns: number;
  /** Days the current stage has been open, and the district median for that stage (null = unknown). */
  stageElapsedDays: number;
  districtMedianDays: number | null;
  openObjectionsClaims: number;
  escrowDemandPaise: bigint;
  escrowDepositedPaise: bigint;
  hearingsVoided: number;
  legalStays: number;
}

export interface RiskScore {
  score: number;
  factors: Array<{ factor: RiskFactor; label: string; value: number; contribution: number }>;
  top: RiskFactor[];
}

const clamp = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

export function riskScore(i: RiskInputs): RiskScore {
  const span = i.dueAt.getTime() - i.startedAt.getTime();
  const shortfall =
    i.escrowDemandPaise > 0n && i.escrowDepositedPaise < i.escrowDemandPaise
      ? Number(((i.escrowDemandPaise - i.escrowDepositedPaise) * 1000n) / i.escrowDemandPaise) / 1000
      : 0;
  const values: Record<RiskFactor, number> = {
    clockElapsed: clamp(span > 0 ? (i.now.getTime() - i.startedAt.getTime()) / span : 1),
    returns: clamp(i.returns / 3),
    slowerThanDistrictMedian: i.districtMedianDays ? clamp((i.stageElapsedDays / i.districtMedianDays - 1) / 1) : 0,
    openObjectionsClaims: clamp(i.openObjectionsClaims / 20),
    escrowShortfall: clamp(shortfall),
    hearingsVoided: clamp(i.hearingsVoided / 2),
    legalStays: clamp(i.legalStays / 3),
  };
  const factors = (Object.keys(RISK_WEIGHTS) as RiskFactor[]).map((factor) => ({
    factor,
    label: RISK_LABELS[factor],
    value: Math.round(values[factor] * 1000) / 1000,
    contribution: Math.round(RISK_WEIGHTS[factor] * values[factor] * 1000) / 10,
  }));
  const score = Math.round(factors.reduce((a, f) => a + f.contribution, 0));
  const top = [...factors]
    .filter((f) => f.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map((f) => f.factor);
  return { score, factors, top };
}
