'use client';

import { useChainVerify } from '@/lib/chain-api';

const LABEL: Record<string, string> = {
  VERIFIED: '✓ Anchored',
  MISMATCH: '✗ Mismatch — record differs from anchored version',
  PENDING: '⏳ Proof pending',
  NOT_ANCHORED: '⏳ Proof pending',
};

const CLASSES: Record<string, string> = {
  VERIFIED: 'bg-teal-50 text-teal-800 ring-teal-200',
  MISMATCH: 'bg-red-50 text-red-800 ring-red-200',
  PENDING: 'bg-slate-100 text-slate-600 ring-slate-200',
  NOT_ANCHORED: 'bg-slate-100 text-slate-600 ring-slate-200',
};

/**
 * §27.4 — the anchor status of a human-approved record (parcel, award, acknowledgement,
 * possession). Never claims a proof that isn't confirmed on-chain: PENDING and NOT_ANCHORED read
 * the same to a viewer (nothing to see yet), only VERIFIED/MISMATCH are asserted facts.
 */
export function ChainBadge({ entityType, entityId, version }: { entityType: string; entityId: string; version?: number }) {
  const { data, isLoading } = useChainVerify(entityType, entityId, version);
  if (isLoading || !data) {
    return <span className="inline-flex items-center rounded px-2 py-0.5 text-xs text-slate-400">Checking…</span>;
  }
  return (
    <span
      title={data.txHash ? `tx ${data.txHash}` : undefined}
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CLASSES[data.result]}`}
    >
      {LABEL[data.result]}
      {data.result === 'VERIFIED' && data.blockNumber != null && (
        <span className="tabular-nums text-teal-600">· block #{data.blockNumber}</span>
      )}
    </span>
  );
}
