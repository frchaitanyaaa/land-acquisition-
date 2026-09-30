'use client';

import Link from 'next/link';
import { use, useMemo, useState } from 'react';
import { MoneyState } from '@/components/money-state';
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
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs ${filter === f ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
          >
            {f === 'ALL' ? 'All' : f.replace(/_/g, ' ').toLowerCase()}
            {f !== 'ALL' && ` (${(data ?? []).filter((r) => r.money_state === f).length})`}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
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
                  <Link href={`/families/${f.id}/money`} className="font-medium text-teal-800 hover:underline">
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
