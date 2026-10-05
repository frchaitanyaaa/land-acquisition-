'use client';

import { formatDate, formatDaysRemaining } from '@bhoomisetu/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMe } from '@/components/shell/shell-data';
import { StageStepper } from '@/components/stage-stepper';
import { ApiProblem } from '@/lib/api';
import { useNationalDashboard } from '@/lib/dashboards-api';
import { usePipeline, type PipelineProject } from '@/lib/pipeline-api';
import { useTimeline } from '@/lib/project-api';

type Filter = 'all' | 'BREACHED' | 'DUE_SOON';

const RISK = {
  BREACHED: { dot: 'bg-red-600', text: 'text-red-700', label: 'Deadline breached' },
  DUE_SOON: { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Deadline due soon' },
  SAFE: { dot: 'bg-[#138808]', text: 'text-[#0f6e06]', label: 'On track' },
} as const;

/**
 * Projects pipeline (§24.3): every project in the post's scope, stage by stage, for national and state posts.
 * Read-only — expanding a project shows its stage history; acting happens in the project workspace (G12).
 */
export default function PipelinePage() {
  const me = useMe();
  const level = me.data?.activePost.level;
  const [state, setState] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [stage, setStage] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setStage(q.get('stage') ?? '');
    setState(q.get('state') ?? '');
  }, []);
  const { data, error, isLoading } = usePipeline(state || undefined);
  const states = useNationalDashboard().data?.states ?? [];
  const stateName = (code: string | null) => states.find((s) => s.state_code === code)?.state_name ?? code ?? '';

  if (error instanceof ApiProblem && error.status === 403)
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 text-center">
        <h1 className="text-lg font-semibold">Projects pipeline</h1>
        <p className="mt-2 text-sm text-slate-600">
          This bird&apos;s-eye view is for national and state posts. Your projects are on your own dashboard.
        </p>
      </div>
    );

  const all = data?.projects ?? [];
  const shown = all.filter((p) => (filter === 'all' || p.risk === filter) && (!stage || p.currentStage === stage));
  const count = (f: Filter) => (f === 'all' ? all.length : all.filter((p) => p.risk === f).length);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Projects pipeline ·{' '}
            {level === 'STATE'
              ? stateName(me.data?.activePost.stateCode ?? null) || 'your state'
              : state
                ? stateName(state)
                : 'India'}
          </h1>
          <p className="text-sm text-slate-500">
            Every project, stage by stage. Select a project to see its history. Read-only — action is taken in the
            project workspace.
          </p>
        </div>
        {level === 'NATIONAL' && states.length > 1 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-700">State</span>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s.state_code} value={s.state_code}>
                  {s.state_name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['all', 'All'],
            ['BREACHED', 'Breached'],
            ['DUE_SOON', 'Due soon'],
          ] as const
        ).map(([f, label]) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-sm ${filter === f ? 'border-[#1f3c8f] bg-[#1f3c8f] text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-[#1f3c8f]'}`}
          >
            {label} <span className="opacity-70">({count(f)})</span>
          </button>
        ))}
        {stage && (
          <button
            type="button"
            onClick={() => setStage('')}
            className="rounded-full border border-[#ff9933] bg-[#fff6ec] px-3 py-1 text-sm text-[#a85406]"
          >
            At stage {stage.replace(/_/g, ' ')} ✕
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No projects match.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                aria-expanded={open === p.id}
                onClick={() => setOpen(open === p.id ? null : p.id)}
                className="grid w-full gap-3 px-5 py-4 text-left hover:bg-slate-50 lg:grid-cols-[minmax(0,1.3fr)_auto_minmax(0,1fr)] lg:items-center"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${RISK[p.risk].dot}`}
                      aria-label={RISK[p.risk].label}
                    />
                    <span className="truncate font-semibold text-slate-950">{p.name}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {p.code} · {stateName(p.stateCode)} · {p.rulePack}
                  </span>
                </span>
                <span className="flex items-center gap-3 overflow-x-auto">
                  <StageStepper project={p} />
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600">
                    {p.done}/{p.stages.length}
                  </span>
                </span>
                <span className="text-sm lg:text-right">
                  {p.nextDeadline ? (
                    <>
                      <span className={`font-semibold ${RISK[p.nextDeadline.live_status].text}`}>
                        {formatDaysRemaining(p.nextDeadline.days_remaining)}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {p.nextDeadline.label} · s.{p.nextDeadline.section}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">No open deadline</span>
                  )}
                </span>
              </button>
              {open === p.id && <StageHistory project={p} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Approved',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted',
  RETURNED: 'Returned',
  SKIPPED: 'Not applicable',
  NULLIFIED: 'Nullified',
  TERMINATED: 'Terminated',
};

/** The drill-down: the existing GET /projects/:id/timeline, shown read-only. */
function StageHistory({ project }: { project: PipelineProject }) {
  const { data, isLoading } = useTimeline(project.id);
  if (isLoading || !data) return <div className="h-40 animate-pulse border-t border-slate-100 bg-slate-50" />;
  const open = data.deadlines.filter((d) => !['SATISFIED', 'WAIVED', 'VOIDED'].includes(d.status));
  return (
    <div className="grid gap-6 border-t border-slate-100 bg-slate-50/60 px-5 py-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <ol className="space-y-3">
        {data.stages.map((s, i) => {
          const latest = s.attempts[s.attempts.length - 1];
          const done = latest?.status === 'APPROVED';
          const current = s.code === data.project.currentStage && !done;
          const returns = s.attempts.flatMap((a) => a.transitions).filter((t) => t.action === 'RETURN');
          return (
            <li key={s.code} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${done ? 'bg-[#138808] text-white' : current ? 'bg-[#1f3c8f] text-white' : 'border border-slate-300 bg-white text-slate-400'}`}
              >
                {done ? '✓' : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${latest ? 'text-slate-950' : 'text-slate-500'}`}>
                  {s.name}
                  {s.sections.length > 0 && (
                    <span className="ml-1 font-normal text-slate-400">s.{s.sections.join(', ')}</span>
                  )}
                </p>
                <p className="text-xs text-slate-600">
                  {latest
                    ? `${STATUS_LABEL[latest.status] ?? latest.status} · started ${formatDate(latest.startedAt)}${latest.completedAt ? ` · completed ${formatDate(latest.completedAt)}` : ''}${s.attempts.length > 1 ? ` · attempt ${latest.attempt}` : ''}`
                    : 'Not started'}
                </p>
                {returns.map((t) => (
                  <p key={t.id} className="mt-1 text-xs text-amber-800">
                    Returned {formatDate(t.at)}
                    {t.reasonCode ? ` — ${t.reasonCode.replace(/_/g, ' ').toLowerCase()}` : ''}
                    {t.remarks ? `: ${t.remarks}` : ''}
                  </p>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open deadlines</p>
        {open.length === 0 && <p className="text-sm text-slate-600">None.</p>}
        {open.map((d) => (
          <div key={d.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-900">
              {d.label} <span className="font-normal text-slate-400">s.{d.section}</span>
            </p>
            <p className="text-xs text-slate-600">
              {d.daysRemaining != null ? formatDaysRemaining(d.daysRemaining) : ''} · due {formatDate(d.dueAt)}
            </p>
            {d.consequenceText && <p className="mt-1 text-xs text-slate-500">{d.consequenceText}</p>}
          </div>
        ))}
        <Link
          href={`/project/${project.id}/timeline`}
          className="inline-flex rounded-md bg-[#1f3c8f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#182f72]"
        >
          Open project workspace →
        </Link>
      </div>
    </div>
  );
}
