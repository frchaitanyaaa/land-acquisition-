import { formatDaysRemaining } from '@bhoomisetu/shared';
import Link from 'next/link';
import { StatusPill } from '@/components/status';
import type { Alert } from '@/lib/dashboards-api';

export function BreachAlerts({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) {
    return <p className="border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">No open breach or due-soon alerts.</p>;
  }
  return (
    <ul className="divide-y divide-slate-200 border border-slate-200 bg-white">
      {alerts.map((a) => (
        <li key={a.id} className="px-4 py-3">
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
            <span className="shrink-0 text-xs font-medium tabular-nums text-slate-600">{formatDaysRemaining(a.days_remaining)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
