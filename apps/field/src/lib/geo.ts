import {
  area,
  booleanPointInPolygon,
  kinks,
  lineString,
  point,
  pointToLineDistance,
  polygon,
} from '@turf/turf';
import { checkPlausibility, distanceM } from '@bhoomisetu/geo';
import type { Geometry, MultiPolygon, Polygon, Position } from 'geojson';
import type { Fix } from './position';
import type { Thresholds, VertexRow } from './types';

// Client geometry is live feedback only; the server is authoritative (§4). Anything computed here
// is labelled "estimate" in the UI.

/** Green badge limit from §16.2 (UI band, not a statutory value). Amber/red come from the rule pack. */
export const ACCURACY_GOOD_M = 10;
/** Mirrors ASSIGNMENT_MAX_M in apps/api/src/field/field.service.ts (field heuristic, §15.6). */
export const ASSIGNMENT_MAX_M = 2000;
/** Hold-to-average window (§16.2). */
export const HOLD_MS = 5000;

export type AccuracyTier = 'good' | 'warn' | 'bad';

export function accuracyTier(accuracyM: number, t: Thresholds): AccuracyTier {
  if (accuracyM <= ACCURACY_GOOD_M) return 'good';
  if (accuracyM <= t.gpsAccuracyWarnM) return 'warn';
  return 'bad';
}

/**
 * Inverse-variance weighted mean of the fixes collected while the button was held (w = 1/accuracy²).
 * The accuracy reported for the result is sqrt(n / Σw) — the weighted RMS of the inputs — which is
 * deliberately conservative: averaging does not get to claim better accuracy than the fixes had.
 */
export function weightedAverage(fixes: Fix[]): { lat: number; lng: number; accuracyM: number; samples: number } {
  let sw = 0;
  let lat = 0;
  let lng = 0;
  for (const f of fixes) {
    const w = 1 / Math.max(f.accuracy, 0.5) ** 2;
    sw += w;
    lat += w * f.lat;
    lng += w * f.lng;
  }
  return { lat: lat / sw, lng: lng / sw, accuracyM: Math.round(Math.sqrt(fixes.length / sw) * 100) / 100, samples: fixes.length };
}

export const ringOf = (vs: Array<{ lat: number; lng: number }>): Position[] => [
  ...vs.map((v) => [v.lng, v.lat]),
  [vs[0]!.lng, vs[0]!.lat],
];

/** Area estimate in m² (≥ 3 vertices), or null. */
export function estimateAreaSqm(vs: Array<{ lat: number; lng: number }>): number | null {
  if (vs.length < 3) return null;
  return area(polygon([ringOf(vs)]));
}

/** Does the running polygon cross itself? (turf kinks) */
export function selfIntersects(vs: Array<{ lat: number; lng: number }>): boolean {
  if (vs.length < 4) return false;
  try {
    return kinks(polygon([ringOf(vs)])).features.length > 0;
  } catch {
    return true;
  }
}

/** Metres from a point to a (Multi)Polygon, 0 inside. */
export function distanceToAreaM(p: { lat: number; lng: number }, g: Geometry): number | null {
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') return null;
  const pt = point([p.lng, p.lat]);
  if (booleanPointInPolygon(pt, g as Polygon | MultiPolygon)) return 0;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let best = Infinity;
  for (const poly of polys)
    for (const ring of poly) best = Math.min(best, pointToLineDistance(pt, lineString(ring), { units: 'meters' }));
  return best;
}

export { distanceM };

export interface LocalFlags {
  /** Flag key → message, same keys and wording the server writes to field_surveys.plausibility. */
  flags: Record<string, string>;
  perVertex: Map<number, string[]>;
  rejectedSeqs: number[];
  usable: number;
  /** Submitting would be refused by the server (too few points / self-intersection). */
  blocking: string[];
}

/**
 * The Review-screen flags (§16.2 screen 7). Runs the same checkPlausibility the server runs at
 * SUBMIT_SURVEY (packages/geo), plus client versions of the server's PHOTO_FAR / OUTSIDE_ASSIGNMENT
 * / SELF_INTERSECTION checks, so what the officer sees here is what the portal will show.
 */
export function computeLocalFlags(vs: VertexRow[], t: Thresholds, footprint: Geometry | null): LocalFlags {
  const result = checkPlausibility(
    vs.map((v) => ({ seq: v.seq, lat: v.lat, lng: v.lng, accuracyM: v.accuracyM, capturedAt: new Date(v.capturedAt) })),
    { gpsAccuracyWarnM: t.gpsAccuracyWarnM, gpsAccuracyRejectM: t.gpsAccuracyRejectM },
    new Date(),
  );
  const flags: Record<string, string> = { ...result.flags } as Record<string, string>;
  const perVertex = new Map(result.vertices.map((v) => [v.seq, v.issues as string[]]));
  const usable = vs.filter((v) => !result.rejectedSeqs.includes(v.seq));
  const blocking: string[] = [];
  if (result.reject) blocking.push(flags.TOO_FEW_POINTS ?? 'Too few usable vertices.');

  if (usable.length >= 3) {
    if (selfIntersects(usable)) {
      flags.SELF_INTERSECTION = 'The walked boundary crosses itself — re-walk or undo points.';
      blocking.push(flags.SELF_INTERSECTION);
    } else {
      const poly: Polygon = { type: 'Polygon', coordinates: [ringOf(usable)] };
      const far = vs.filter((v) => (distanceToAreaM(v, poly) ?? 0) > t.photoMaxDistanceFromParcelM).length;
      if (far) flags.PHOTO_FAR = `${far} photo(s) further than ${t.photoMaxDistanceFromParcelM} m from the polygon`;
    }
  }
  if (footprint) {
    const outside = vs.filter((v) => (distanceToAreaM(v, footprint) ?? 0) > ASSIGNMENT_MAX_M).length;
    if (outside) flags.OUTSIDE_ASSIGNMENT = `${outside} vertex(es) more than ${ASSIGNMENT_MAX_M} m from the project footprint`;
  }
  return { flags, perVertex, rejectedSeqs: result.rejectedSeqs, usable: usable.length, blocking };
}

export function formatArea(sqm: number): string {
  return sqm >= 10_000 ? `${(sqm / 10_000).toFixed(3)} ha` : `${Math.round(sqm).toLocaleString()} m²`;
}
