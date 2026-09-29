import { formatDate, formatDaysRemaining } from '@bhoomisetu/shared';
import { StatusPill } from '@/components/status';
import type { DeadlineRow } from '@/lib/dashboards-api';

/** Reusable across the project header and the dashboards (§14, §24). Never re-derives
 * days-remaining client-side — the API already computed it (v_deadline_board). */
export function DeadlineCountdown({ deadline }: { deadline: DeadlineRow | null }) {
  if (!deadline) return <p className="text-sm text-slate-500">No open deadline.</p>;
  return (
    <div>
      <div className="flex items-center gap-2">
        <StatusPill status={deadline.live_status} />
        <span className="text-sm font-medium text-slate-900">{deadline.label ?? deadline.clock_code}</span>
        {deadline.section && <span className="text-xs text-slate-400">s.{deadline.section}</span>}
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
        {formatDaysRemaining(deadline.days_remaining)}
        <span className="ml-2 text-sm font-normal text-slate-500">due {formatDate(deadline.due_at)}</span>
      </p>
      {deadline.consequence_text && <p className="mt-1 text-sm text-slate-600">{deadline.consequence_text}</p>}
    </div>
  );
}
