import type { LiveStatus } from '@/lib/dashboards-api';

/** The full deadline-status set (packages/shared DEADLINE_STATUSES) — v_deadline_board only ever
 * returns the first three (`LiveStatus`), but a project's own /timeline deadlines (computed live
 * via packages/rules clockStatus) can also be NOT_STARTED, SATISFIED, WAIVED or VOIDED. */
export type DeadlineStatus = LiveStatus | 'NOT_STARTED' | 'SATISFIED' | 'WAIVED' | 'VOIDED';

// Reserved status colors (never reused as categorical hues): critical / warning / good / neutral.
export const STATUS_COLOR: Record<DeadlineStatus, string> = {
  BREACHED: '#DC2626', // red-600
  DUE_SOON: '#D97706', // amber-600
  SAFE: '#0F766E', // teal-700 (brand accent, doubles as "good")
  SATISFIED: '#0F766E',
  NOT_STARTED: '#94A3B8', // slate-400
  WAIVED: '#94A3B8',
  VOIDED: '#94A3B8',
};

const STATUS_LABEL: Record<DeadlineStatus, string> = {
  BREACHED: 'Breached',
  DUE_SOON: 'Due soon',
  SAFE: 'Safe',
  SATISFIED: 'Satisfied',
  NOT_STARTED: 'Not started',
  WAIVED: 'Waived',
  VOIDED: 'Voided',
};

const STATUS_CLASSES: Record<DeadlineStatus, string> = {
  BREACHED: 'bg-red-50 text-red-800 ring-red-200',
  DUE_SOON: 'bg-amber-50 text-amber-800 ring-amber-200',
  SAFE: 'bg-teal-50 text-teal-800 ring-teal-200',
  SATISFIED: 'bg-teal-50 text-teal-800 ring-teal-200',
  NOT_STARTED: 'bg-slate-100 text-slate-600 ring-slate-200',
  WAIVED: 'bg-slate-100 text-slate-600 ring-slate-200',
  VOIDED: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function StatusPill({ status }: { status: DeadlineStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLASSES[status]}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] }} />
      {STATUS_LABEL[status]}
    </span>
  );
}
