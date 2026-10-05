import { formatDaysRemaining } from '@bhoomisetu/shared';
import Link from 'next/link';
import { StatusPill } from '@/components/status';
import type { Alert } from '@/lib/dashboards-api';

export function BreachAlerts({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) {
    return <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">No open breach or due-soon alerts.</p>;
  }
  return (
    <ul className="space-y-2">
      {alerts.map((a) => (
        <li
          key={a.id}
          className={`rounded-xl border border-l-4 border-slate-200 bg-white px-4 py-3 ${a.live_status === 'BREACHED' ? 'border-l-red-600' : 'border-l-amber-500'}`}
        >
          <Link href={`/project/${a.project_id}`} className="group flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <StatusPill status={a.live_status} />
                <span className="truncate text-sm font-medium text-slate-900 group-hover:underline">
                  {a.project_code} {a.instances > 1 ? `· ${a.instances} entitlements` : ''}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-700">
                {a.label ?? a.clock_code}
                {a.section && <span className="text-slate-400"> — s.{a.section}</span>}
              </p>
              {a.consequence_text && <p className="mt-0.5 text-xs text-slate-500">{a.consequence_text}</p>}
            </div>
            <span
              className={`shrink-0 text-sm font-semibold tabular-nums ${a.live_status === 'BREACHED' ? 'text-red-700' : 'text-amber-700'}`}
            >
              {formatDaysRemaining(a.days_remaining)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
