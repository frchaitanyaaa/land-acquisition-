'use client';

import { STATUS_COLOR } from '@/components/status';
import type { ChainageBin } from '@/lib/parcels-api';

const STATUS_RANK: Record<string, number> = {
  PROPOSED: 0,
  VERIFICATION_PENDING: 0,
  VERIFIED: 1,
  CONSENT_ACQUIRED_NOTIFIED: 1,
  CLEARED_FOR_AWARD_RNR: 1,
  AWARDED: 2,
  READY_FOR_POSSESSION: 2,
  ACQUIRED_POSSESSED: 3,
  CLOSED: 3,
};

/** Worst status inside a bin, by the same DUE/BREACHED-first ordering as everywhere else —
 * but a chainage bin's "worst" is really "least progressed", so this ranks by workflow stage,
 * with flagged bins always shown as breached-red regardless of stage. */
function binColor(bin: ChainageBin): string {
  if (bin.flagged > 0) return STATUS_COLOR.BREACHED;
  const worst = Math.min(...bin.statuses.map((s) => STATUS_RANK[s] ?? 0));
  return ['#94A3B8', '#5EEAD4', '#0D9488', '#134E4A'][worst] ?? '#94A3B8';
}

export function ChainageStrip({
  bins,
  selectedBin,
  onSelect,
}: {
  bins: ChainageBin[];
  selectedBin: number | null;
  onSelect: (bin: number | null) => void;
}) {
  if (!bins.length) return null;
  return (
    <div>
      <div className="flex h-8 w-full overflow-hidden border border-slate-200">
        {bins.map((b) => (
          <button
            key={b.bin}
            title={`${b.from_km}–${b.to_km} km · ${b.parcels} parcels${b.flagged ? ` · ${b.flagged} flagged` : ''}`}
            onClick={() => onSelect(selectedBin === b.bin ? null : b.bin)}
            className="h-full flex-1 border-r border-white/40 last:border-r-0"
            style={{ backgroundColor: binColor(b), outline: selectedBin === b.bin ? '2px solid #0F172A' : undefined }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span>{bins[0]!.from_km} km</span>
        <span>{bins.at(-1)!.to_km} km</span>
      </div>
    </div>
  );
}
