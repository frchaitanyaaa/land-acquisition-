import { area as turfArea, polygon as turfPolygon } from '@turf/turf';

export type AccuracyState = 'good' | 'warn' | 'critical';

export function getAccuracyState(accuracyM: number, warnM: number, rejectM: number): AccuracyState {
  if (accuracyM > rejectM) return 'critical';
  if (accuracyM > warnM) return 'warn';
  return 'good';
}

export function estimatePolygonAreaSqm(points: Array<{ lat: number; lng: number }>): number {
  if (points.length < 3) return 0;
  const ring = [...points.map((point) => [point.lng, point.lat] as [number, number]), [points[0].lng, points[0].lat] as [number, number]];
  return turfArea(turfPolygon([ring])) || 0;
}
