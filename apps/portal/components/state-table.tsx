'use client';

import { useMemo, useState } from 'react';
import { formatHectares, formatMoney, formatPct } from '@/lib/format';
import type { StateRow } from '@/lib/dashboards-api';

type SortKey = 'state_name' | 'projects' | 'area_acquired_sqm' | 'compensation_paid_paise' | 'possession_pct' | 'timeline_adherence_pct';

const COLUMNS: Array<{ key: SortKey; label: string; align?: 'right' }> = [
  { key: 'state_name', label: 'State' },
  { key: 'projects', label: 'Projects', align: 'right' },
  { key: 'area_acquired_sqm', label: 'Area acquired', align: 'right' },
  { key: 'compensation_paid_paise', label: 'Compensation paid', align: 'right' },
  { key: 'possession_pct', label: 'Possession', align: 'right' },
  { key: 'timeline_adherence_pct', label: 'Timeline adherence', align: 'right' },
];

export function StateTable({ states }: { states: StateRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('state_name');
  const [asc, setAsc] = useState(true);

  const sorted = useMemo(() => {
    const copy = [...states];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = typeof av === 'string' && sortKey !== 'state_name' ? Number(av) : av;
      const bn = typeof bv === 'string' && sortKey !== 'state_name' ? Number(bv) : bv;
      if (an === bn) return 0;
      if (an === null || an === undefined) return 1;
      if (bn === null || bn === undefined) return -1;
      return (an < bn ? -1 : 1) * (asc ? 1 : -1);
    });
    return copy;
  }, [states, sortKey, asc]);

  function toggle(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(true);
    }
  }

  return (
    <div className="overflow-x-auto border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {COLUMNS.map((c) => (
              <th key={c.key} className={`px-4 py-2 font-medium text-slate-600 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                <button onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 hover:text-slate-900">
                  {c.label}
                  {sortKey === c.key && <span aria-hidden>{asc ? '↑' : '↓'}</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((s) => (
            <tr key={s.state_code}>
              <td className="px-4 py-2 font-medium text-slate-900">{s.state_name}</td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-700">{s.projects}</td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-700">{formatHectares(s.area_acquired_sqm)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-700">{formatMoney(s.compensation_paid_paise)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-700">{formatPct(s.possession_pct)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-700">{formatPct(s.timeline_adherence_pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
