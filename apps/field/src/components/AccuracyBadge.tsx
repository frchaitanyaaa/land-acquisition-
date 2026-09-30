import { accuracyTier } from '../lib/geo';
import type { Thresholds } from '../lib/types';

const TIER = {
  good: 'bg-emerald-600 text-white',
  warn: 'bg-amber-400 text-amber-950',
  bad: 'bg-red-600 text-white',
} as const;

/** Green ≤ 10 m, amber ≤ gpsAccuracyWarnM, red above (§16.2) — thresholds from the offline pack's rule pack. */
export function AccuracyBadge({ accuracy, thresholds }: { accuracy: number | null; thresholds: Thresholds }) {
  if (accuracy == null)
    return <span className="rounded-full bg-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-800">No GPS</span>;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${TIER[accuracyTier(accuracy, thresholds)]}`}>
      ±{accuracy < 100 ? accuracy.toFixed(1) : Math.round(accuracy)} m
    </span>
  );
}
