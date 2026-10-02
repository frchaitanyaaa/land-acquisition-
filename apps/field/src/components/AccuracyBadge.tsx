import { accuracyTier } from '../lib/geo';
import type { Thresholds } from '../lib/types';

// UX4G filled tags: green / amber / red, readable in sunlight.
const TIER = {
  good: 'ux4g-tag-filled-success',
  warn: 'ux4g-tag-filled-warning',
  bad: 'ux4g-tag-filled-error',
} as const;

/** Green ≤ 10 m, amber ≤ gpsAccuracyWarnM, red above (§16.2) — thresholds from the offline pack's rule pack. */
export function AccuracyBadge({ accuracy, thresholds }: { accuracy: number | null; thresholds: Thresholds }) {
  if (accuracy == null)
    return <span className="ux4g-tag-filled-neutral">No GPS</span>;
  return (
    <span className={`${TIER[accuracyTier(accuracy, thresholds)]} tabular-nums`}>
      ±{accuracy < 100 ? accuracy.toFixed(1) : Math.round(accuracy)} m
    </span>
  );
}
