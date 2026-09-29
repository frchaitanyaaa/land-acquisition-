'use client';

import { use } from 'react';
import { formatDate, formatDaysRemaining } from '@bhoomisetu/shared';
import { ActionPanel } from '@/components/action-panel';
import { StatusPill } from '@/components/status';
import { useTimeline } from '@/lib/project-api';

const STATUS_DOT: Record<string, string> = {
  APPROVED: 'bg-teal-700',
  SUBMITTED: 'bg-amber-500',
  IN_PROGRESS: 'bg-slate-400',
  RETURNED: 'bg-amber-500',
  NOT_STARTED: 'bg-slate-200',
  NULLIFIED: 'bg-red-600',
  SKIPPED: 'bg-slate-200',
  TERMINATED: 'bg-red-600',
};

export default function ProjectTimeline({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useTimeline(id);

  if (error) return <p className="text-red-700">Could not load the timeline.</p>;
  if (isLoading || !data) return <p className="text-slate-500">Loading…</p>;

  const currentStageCode = data.project.currentStage;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <ol className="space-y-0">
        {data.stages.map((s, i) => {
          const latest = s.attempts.at(-1);
          const isCurrent = s.code === currentStageCode;
          return (
            <li key={s.code} className="relative flex gap-3 pb-6 last:pb-0">
              {i < data.stages.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-slate-200" />}
              <span
                aria-hidden
                className={`z-10 mt-1 h-4 w-4 shrink-0 rounded-full ring-4 ring-white ${
                  latest ? STATUS_DOT[latest.status] : 'bg-slate-200'
                }`}
              />
              <div>
                <p className={`text-sm font-medium ${isCurrent ? 'text-teal-800' : 'text-slate-900'}`}>
                  {s.code} — {s.name}
                </p>
                <p className="text-xs text-slate-500">
                  {latest ? `${latest.status} · attempt ${latest.attempt}` : 'Not started'}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="space-y-6">
        {data.deadlines.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Open deadlines</h2>
            <ul className="divide-y divide-slate-200 border border-slate-200 bg-white">
              {data.deadlines.map((d) => (
                <li key={d.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <StatusPill status={d.status} />
                      <span className="text-sm font-medium text-slate-900">{d.label ?? d.clockCode}</span>
                      {d.section && <span className="text-xs text-slate-400">s.{d.section}</span>}
                    </div>
                    <span className="text-xs font-medium tabular-nums text-slate-600">
                      {d.daysRemaining !== null && `${formatDaysRemaining(d.daysRemaining)} · `}
                      due {formatDate(d.dueAt)}
                    </span>
                  </div>
                  {d.consequenceText && <p className="mt-1 text-xs text-slate-500">{d.consequenceText}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {currentStageCode && (
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Act on the current stage</h2>
            <ActionPanel projectId={id} stageCode={currentStageCode} stages={data.stages} />
          </section>
        )}

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Transition history</h2>
          <ul className="divide-y divide-slate-200 border border-slate-200 bg-white text-sm">
            {data.stages
              .flatMap((s) => s.attempts.flatMap((a) => a.transitions.map((t) => ({ ...t, stageCode: s.code }))))
              .sort((a, b) => (a.at < b.at ? 1 : -1))
              .map((t) => (
                <li key={t.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">
                      {t.stageCode} — {t.action}
                    </span>
                    <span className="text-xs text-slate-500">{formatDate(t.at)}</span>
                  </div>
                  {(t.reasonCode || t.remarks) && (
                    <p className="mt-0.5 text-xs text-slate-500">{[t.reasonCode, t.remarks].filter(Boolean).join(' — ')}</p>
                  )}
                </li>
              ))}
            {data.stages.every((s) => s.attempts.every((a) => a.transitions.length === 0)) && (
              <li className="px-4 py-6 text-slate-500">No transitions yet.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
