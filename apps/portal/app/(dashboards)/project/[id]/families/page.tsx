'use client';

import Link from 'next/link';
import { use, useMemo, useState } from 'react';
import { KpiCard, MoneyState } from '@/components/money-state';
import { useProjectFamilies } from '@/lib/award-api';
import { formatMoney } from '@/lib/format';
import { useLiveUpdates } from '@/lib/use-live-updates';

const FILTERS = ['ALL', 'DISBURSED_NOT_ACKNOWLEDGED', 'PART_PAID', 'UNPAID', 'ACKNOWLEDGED', 'NOT_AWARDED'] as const;

/** Families on the project, sorted by unconfirmed money first — the ones that need a phone tap. */
export default function FamiliesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useProjectFamilies(id);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  useLiveUpdates([['project-families', id]]);
  const rows = useMemo(() => (data ?? []).filter((f) => filter === 'ALL' || f.money_state === filter), [data, filter]);

  if (error) return <p className="text-red-700">Could not load families.</p>;
  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  // Totals of what the API returned per family — display sums, not a computed award (G1).
  const sum = (k: 'assessed_paise' | 'disbursed_paise' | 'acknowledged_paise' | 'unconfirmed_paise' | 'held_paise') =>
    (data ?? []).reduce((t, f) => t + BigInt(f[k] ?? 0), 0n).toString();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiCard label="Assessed" value={formatMoney(sum('assessed_paise'))} sub={`${data?.length ?? 0} families`} />
        <KpiCard label="Disbursed" value={formatMoney(sum('disbursed_paise'))} tone="info" />
        <KpiCard label="Acknowledged" value={formatMoney(sum('acknowledged_paise'))} tone="success" />
        <KpiCard label="Disbursed, not acknowledged" value={formatMoney(sum('unconfirmed_paise'))} tone="warning" />
        <KpiCard label="On hold" value={formatMoney(sum('held_paise'))} tone="error" />
      </div>
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            type="button"
            aria-pressed={filter === f}
            className={`ux4g-filter-chip-s ${filter === f ? 'active' : ''}`}
          >
            {f === 'ALL' ? 'All' : f.replace(/_/g, ' ').toLowerCase()}
            {f !== 'ALL' && ` (${(data ?? []).filter((r) => r.money_state === f).length})`}
          </button>
        ))}
      </div>
      <div className="ux4g-table-responsive border border-slate-200 bg-white">
        <table className="ux4g-table ux4g-table-s ux4g-table-interactive w-full">
          <thead>
            <tr>
              <th className="px-3 py-2">Head of family</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2 text-right">Assessed</th>
              <th className="px-3 py-2 text-right">Disbursed</th>
              <th className="px-3 py-2 text-right">Acknowledged</th>
              <th className="px-3 py-2 text-right">Unconfirmed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link href={`/families/${f.id}/money`} className="ux4g-text-link ux4g-text-link-s">
                    {f.head_name}
                  </Link>
                  <span className="ml-2 text-xs text-slate-500">
                    {f.is_displaced && 'displaced '}
                    {f.is_sc_st && 'SC/ST'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <MoneyState state={f.money_state} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(f.assessed_paise)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(f.disbursed_paise)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(f.acknowledged_paise)}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{formatMoney(f.unconfirmed_paise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">No families in this state.</p>}
      </div>
    </div>
  );
}
