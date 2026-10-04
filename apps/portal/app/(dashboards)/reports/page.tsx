'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { api } from '@/lib/api';

const REPORTS = [
  { type: 'project-progress', title: 'Project progress', body: 'Stage, status, parcels, area notified and acquired, possession and timeline adherence per project.' },
  { type: 'compensation-register', title: 'Compensation register', body: 'Every entitlement head per family as entered by the Collector, with status and due date.' },
  { type: 'rnr-status', title: 'R&R status', body: 'Per affected family: assessed, disbursed, acknowledged, unconfirmed and deposited amounts.' },
  { type: 'deadline-compliance', title: 'Deadline compliance', body: 'All statutory clocks with section, due date, days remaining and status.' },
  { type: 'district-comparison', title: 'District comparison', body: 'Key parameters side by side for every district in your scope.' },
] as const;

const PREVIEW_ROWS = 8;

/** MIS reports (§24.4): code-defined templates, filtered by the post's scope (RLS), as CSV or PDF. */
export default function ReportsPage() {
  const [open, setOpen] = useState<string | null>(null);
  const preview = useQuery({
    queryKey: ['reports', open],
    queryFn: () => api<Array<Record<string, unknown>>>(`/reports/${open}?format=json`),
    enabled: !!open,
  });
  const cols = preview.data?.[0] ? Object.keys(preview.data[0]) : [];

  return (
    <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-l">
      <PageHeader
        title="Reports (MIS)"
        subtitle="Download any report as CSV or PDF. Each contains only the projects your post can see."
        crumbs={[{ label: 'Monitoring' }, { label: 'Reports (MIS)' }]}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <div key={r.type} className="flex flex-col rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-950">{r.title}</h2>
            <p className="mt-1 flex-1 text-sm text-slate-700">{r.body}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`/api/v1/reports/${r.type}?format=csv`} className="ux4g-btn ux4g-btn-primary ux4g-btn-s" download>
                CSV
              </a>
              <a href={`/api/v1/reports/${r.type}?format=pdf`} className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-s" download>
                PDF
              </a>
              <button
                type="button"
                className="ux4g-btn ux4g-btn-ghost-neutral ux4g-btn-s"
                aria-expanded={open === r.type}
                onClick={() => setOpen(open === r.type ? null : r.type)}
              >
                {open === r.type ? 'Hide preview' : 'Preview'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {open && (
        <SectionCard
          title={`Preview · ${REPORTS.find((r) => r.type === open)?.title}`}
          description={preview.data ? `${preview.data.length} rows; first ${Math.min(PREVIEW_ROWS, preview.data.length)} shown. Money columns are in paise.` : undefined}
        >
          {preview.isLoading ? (
            <p className="text-sm text-slate-600">Loading…</p>
          ) : preview.error ? (
            <p className="text-sm text-red-700">{(preview.error as Error).message}</p>
          ) : !preview.data?.length ? (
            <p className="text-sm text-slate-600">No rows in your scope.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 uppercase text-slate-500">
                  <tr>
                    {cols.map((c) => (
                      <th key={c} className="whitespace-nowrap py-2 pr-3">
                        {c.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.data.slice(0, PREVIEW_ROWS).map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {cols.map((c) => (
                        <td key={c} className="whitespace-nowrap py-1.5 pr-3">
                          {row[c] === null || row[c] === undefined ? '—' : String(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
