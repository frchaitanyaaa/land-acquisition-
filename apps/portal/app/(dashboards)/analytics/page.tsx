'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { AdvisoryBadge } from '@/components/ui/badges';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionCard } from '@/components/ui/section-card';
import { StatusTag } from '@/components/ui/status-tag';
import { api } from '@/lib/api';

interface RiskRow {
  deadlineId: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  clockCode: string;
  label: string | null;
  liveStatus: string;
  daysRemaining: number;
  score: number;
  factors: Array<{ factor: string; label: string; value: number; contribution: number }>;
  top: string[];
}

interface Bottlenecks {
  byStage: Array<{
    stage_code: string;
    instances: number;
    approved: number;
    returns: number;
    median_days_in_stage: string | null;
    open_now: number;
  }>;
  topReasonCodes: Array<{ reason_code: string; stage_code: string; n: number }>;
}

const label = (s: string) =>
  s
    .replace(/^S\d+_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

/**
 * Analytics (§24.4): delay risk score per open deadline — a transparent weighted formula, not a trained model —
 * and where files get stuck (stage_transitions). Advisory only.
 */
export default function AnalyticsPage() {
  const risk = useQuery({ queryKey: ['analytics', 'risk'], queryFn: () => api<RiskRow[]>('/analytics/risk') });
  const bottle = useQuery({
    queryKey: ['analytics', 'bottlenecks'],
    queryFn: () => api<Bottlenecks>('/analytics/bottlenecks'),
  });

  return (
    <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-l">
      <PageHeader
        title="Analytics"
        subtitle="Which deadlines are most at risk, and which stages slow files down."
        crumbs={[{ label: 'Monitoring' }, { label: 'Analytics' }]}
      />

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            Delay risk <AdvisoryBadge label="Advisory" />
          </span>
        }
        description="Score 0–100 from a published weighted formula (clock elapsed, returns, escrow shortfall, objections, voided hearings, legal stays). Heuristic: use it to prioritise, not to decide."
      >
        {risk.isLoading ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : !risk.data?.length ? (
          <EmptyState title="No open deadlines" description="Nothing to score in your scope." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {risk.data.slice(0, 25).map((r) => {
              const top = r.factors.filter((f) => r.top.includes(f.factor));
              return (
                <li key={r.deadlineId} className="flex flex-wrap items-start gap-4 py-3">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${r.score >= 60 ? 'bg-red-700' : r.score >= 35 ? 'bg-amber-600' : 'bg-teal-700'}`}
                    aria-label={`Risk score ${r.score}`}
                  >
                    {r.score}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <Link
                        href={`/project/${r.projectId}/timeline`}
                        className="font-medium text-teal-800 hover:underline"
                      >
                        {r.projectCode}
                      </Link>{' '}
                      · {r.label ?? r.clockCode} · <StatusTag kind="deadline" status={r.liveStatus} />{' '}
                      <span className="text-slate-600">
                        {r.daysRemaining < 0 ? `${-r.daysRemaining} days overdue` : `${r.daysRemaining} days left`}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Top factors: {top.map((f) => `${f.label} (+${Math.round(f.contribution)})`).join(' · ') || '—'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Bottlenecks by stage"
        description="Files open now, how often a stage is returned, and the median days it takes."
      >
        {bottle.isLoading || !bottle.data ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Stage</th>
                    <th className="py-2 pr-3 text-right">Open now</th>
                    <th className="py-2 pr-3 text-right">Approved</th>
                    <th className="py-2 pr-3 text-right">Returns</th>
                    <th className="py-2 text-right">Median days</th>
                  </tr>
                </thead>
                <tbody>
                  {bottle.data.byStage.map((s) => {
                    const max = Math.max(1, ...bottle.data.byStage.map((x) => x.open_now));
                    return (
                      <tr key={s.stage_code} className="border-b border-slate-100">
                        <td className="py-2 pr-3">{label(s.stage_code)}</td>
                        <td className="py-2 pr-3 text-right">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-2 rounded bg-[#1f3c8f]"
                              style={{ width: `${(s.open_now / max) * 60}px` }}
                              aria-hidden
                            />
                            <span className="tabular-nums">{s.open_now}</span>
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{s.approved}</td>
                        <td
                          className={`py-2 pr-3 text-right tabular-nums ${s.returns ? 'font-semibold text-amber-700' : ''}`}
                        >
                          {s.returns}
                        </td>
                        <td className="py-2 text-right tabular-nums">{s.median_days_in_stage ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Most common return reasons</p>
              {bottle.data.topReasonCodes.length === 0 ? (
                <p className="text-sm text-slate-600">No files returned yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {bottle.data.topReasonCodes.slice(0, 8).map((r) => (
                    <li key={`${r.stage_code}-${r.reason_code}`} className="flex justify-between gap-2">
                      <span>
                        {r.reason_code.replace(/_/g, ' ').toLowerCase()}{' '}
                        <span className="text-xs text-slate-500">({label(r.stage_code)})</span>
                      </span>
                      <span className="tabular-nums">{r.n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
