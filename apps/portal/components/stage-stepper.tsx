import type { PipelineProject } from '@/lib/pipeline-api';

/**
 * A compact stage stepper (§24.3): one dot per applicable stage, joined by a line. Done = green tick, current =
 * navy (red when a deadline is breached), returned = amber, not started = grey. Stage names are in the tooltips.
 */
export function StageStepper({ project }: { project: PipelineProject }) {
  return (
    <ol className="flex items-center" aria-label={`${project.done} of ${project.stages.length} stages complete`}>
      {project.stages.map((s, i) => {
        const current = s.code === project.currentStage && s.status !== 'done';
        const tone =
          s.status === 'done' || s.status === 'skipped'
            ? 'bg-[#138808] text-white border-[#138808]'
            : current && project.risk === 'BREACHED'
              ? 'bg-red-600 text-white border-red-600 ring-4 ring-red-100'
              : current
                ? 'bg-[#1f3c8f] text-white border-[#1f3c8f] ring-4 ring-[#1f3c8f]/15'
                : s.status === 'returned'
                  ? 'bg-amber-400 text-slate-950 border-amber-400'
                  : 'bg-white text-slate-400 border-slate-300';
        const line = s.status === 'done' || s.status === 'skipped' ? 'bg-[#138808]' : 'bg-slate-200';
        return (
          <li key={s.code} className="flex items-center">
            {i > 0 && <span className={`h-0.5 w-3 sm:w-5 ${line}`} aria-hidden />}
            <span
              title={`${i + 1}. ${s.name}${s.sections.length ? ` (s.${s.sections.join(', ')})` : ''} — ${s.status.replace('_', ' ')}`}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${tone}`}
            >
              {s.status === 'done' || s.status === 'skipped' ? '✓' : i + 1}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
