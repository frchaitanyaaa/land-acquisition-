'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionCard } from '@/components/ui/section-card';
import { StatusTag } from '@/components/ui/status-tag';
import { api } from '@/lib/api';
import type { DeadlineRow } from '@/lib/dashboards-api';

const FILTERS = [
  { key: 'all', label: 'All open' },
  { key: 'breached', label: 'Breached' },
  { key: 'soon', label: 'Due within 30 days' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso));

/** Deadlines & alerts (§24.2, §28): every statutory clock in the post's scope, worst first (GET /deadlines/board). */
export default function DeadlinesPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const { data, isLoading, error } = useQuery({
    queryKey: ['deadlines', 'board'],
    queryFn: () => api<DeadlineRow[]>('/deadlines/board'),
  });
  const rows = (data ?? []).filter((d) =>
    filter === 'breached' ? d.live_status === 'BREACHED' : filter === 'soon' ? d.live_status !== 'BREACHED' && d.days_remaining <= 30 : true,
  );
  const count = (f: Filter) =>
    (data ?? []).filter((d) => (f === 'breached' ? d.live_status === 'BREACHED' : f === 'soon' ? d.live_status !== 'BREACHED' && d.days_remaining <= 30 : true)).length;

  return (
    <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-l">
      <PageHeader
        title="Deadlines & alerts"
        subtitle="Every statutory clock in your jurisdiction, with the section of the Act and what happens if it lapses."
        crumbs={[{ label: 'Monitoring' }, { label: 'Deadlines & alerts' }]}
      />
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter deadlines">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-sm ${filter === f.key ? 'border-[#1f3c8f] bg-[#1f3c8f] text-white' : 'border-slate-300 bg-white text-slate-700'}`}
          >
            {f.label} ({count(f.key)})
          </button>
        ))}
      </div>
      <SectionCard title="Statutory clocks" description="Worst first. Click a project to open its timeline.">
        {isLoading ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-700">{(error as Error).message}</p>
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing here" description="No deadline matches this filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Project</th>
                  <th className="py-2 pr-3">Clock</th>
                  <th className="py-2 pr-3">Section</th>
                  <th className="py-2 pr-3">Due</th>
                  <th className="py-2 pr-3 text-right">Days</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">If it lapses</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3">
                      <Link href={`/project/${d.project_id}/timeline`} className="font-medium text-teal-800 hover:underline">
                        {d.project_code}
                      </Link>
                      <span className="block text-xs text-slate-500">{d.project_name}</span>
                    </td>
                    <td className="py-2 pr-3">{d.label ?? d.clock_code}</td>
                    <td className="py-2 pr-3">{d.section ? `s.${d.section}` : '—'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmt(d.due_at)}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${d.days_remaining < 0 ? 'font-semibold text-red-700' : ''}`}>
                      {d.days_remaining < 0 ? `${-d.days_remaining} overdue` : d.days_remaining}
                    </td>
                    <td className="py-2 pr-3">
                      <StatusTag kind="deadline" status={d.live_status} />
                    </td>
                    <td className="py-2 text-xs text-slate-700">{d.consequence_text ?? d.consequence ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
