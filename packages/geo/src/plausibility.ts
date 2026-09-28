// Field plausibility checks (§15.6). A PWA cannot read Android's mock-location flag, so the server
// checks whether a walked survey is PLAUSIBLE instead — and says so honestly. The thresholds that
// are statutory-adjacent (GPS accuracy) come from the rule pack; the rest are field heuristics.

export const WALKING_MAX_KMH = 15;
export const CLOCK_SKEW_MAX_H = 48;
export const SUSPICIOUS_REPEAT = 5;
export const MIN_VERTICES = 3;

const EARTH_M = 6_371_008.8;

export interface FieldVertex {
  seq: number;
  lat: number;
  lng: number;
  accuracyM: number | null;
  capturedAt: Date;
}

export interface PlausibilityThresholds {
  gpsAccuracyWarnM: number;
  gpsAccuracyRejectM: number;
}

export type VertexIssue = 'ACCURACY_REJECT' | 'ACCURACY_WARN';
export type SurveyFlag = 'IMPLAUSIBLE_SPEED' | 'CLOCK_SKEW' | 'SUSPICIOUS_FIX' | 'TOO_FEW_POINTS';

export interface PlausibilityResult {
  vertices: Array<{ seq: number; issues: VertexIssue[] }>;
  rejectedSeqs: number[];
  flags: Partial<Record<SurveyFlag, string>>;
  /** true when the survey cannot be accepted (too few usable points). */
  reject: boolean;
}

/** Great-circle distance in metres (haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const decimals = (x: number) => {
  const s = String(x);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
};

export function checkPlausibility(input: FieldVertex[], t: PlausibilityThresholds, syncedAt: Date): PlausibilityResult {
  const vs = [...input].sort((a, b) => a.seq - b.seq);
  const flags: PlausibilityResult['flags'] = {};
  const vertices = vs.map((v) => {
    const issues: VertexIssue[] = [];
    if (v.accuracyM != null && v.accuracyM > t.gpsAccuracyRejectM) issues.push('ACCURACY_REJECT');
    else if (v.accuracyM != null && v.accuracyM > t.gpsAccuracyWarnM) issues.push('ACCURACY_WARN');
    return { seq: v.seq, issues };
  });
  const rejectedSeqs = vertices.filter((v) => v.issues.includes('ACCURACY_REJECT')).map((v) => v.seq);
  const usable = vs.filter((v) => !rejectedSeqs.includes(v.seq));

  for (let i = 1; i < usable.length; i++) {
    const a = usable[i - 1]!;
    const b = usable[i]!;
    const hours = (b.capturedAt.getTime() - a.capturedAt.getTime()) / 3_600_000;
    const km = distanceM(a, b) / 1000;
    if (hours <= 0 ? km > 0.001 : km / hours > WALKING_MAX_KMH) {
      flags.IMPLAUSIBLE_SPEED = `Vertex ${a.seq}→${b.seq}: ${km.toFixed(3)} km in ${(hours * 60).toFixed(1)} min`;
      break;
    }
  }
  const skewed = vs.find(
    (v) =>
      v.capturedAt.getTime() > syncedAt.getTime() + 60_000 ||
      syncedAt.getTime() - v.capturedAt.getTime() > CLOCK_SKEW_MAX_H * 3_600_000,
  );
  if (skewed)
    flags.CLOCK_SKEW = `Vertex ${skewed.seq} captured at ${skewed.capturedAt.toISOString()}, synced ${syncedAt.toISOString()}`;

  const accCounts = new Map<number, number>();
  for (const v of vs)
    if (v.accuracyM != null && Number.isInteger(v.accuracyM))
      accCounts.set(v.accuracyM, (accCounts.get(v.accuracyM) ?? 0) + 1);
  const repeated = [...accCounts.entries()].find(([, n]) => n >= SUSPICIOUS_REPEAT);
  const coarse = vs.find((v) => decimals(v.lat) <= 4 || decimals(v.lng) <= 4);
  if (repeated) flags.SUSPICIOUS_FIX = `Accuracy exactly ${repeated[0]} m on ${repeated[1]} vertices`;
  else if (coarse) flags.SUSPICIOUS_FIX = `Vertex ${coarse.seq} has coordinates with ≤ 4 decimals`;

  if (usable.length < MIN_VERTICES) flags.TOO_FEW_POINTS = `${usable.length} usable vertices (need ${MIN_VERTICES})`;
  return { vertices, rejectedSeqs, flags, reject: usable.length < MIN_VERTICES };
}
