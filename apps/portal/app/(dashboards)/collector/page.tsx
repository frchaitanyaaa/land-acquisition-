'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BreachAlerts } from '@/components/breach-alerts';
import { StatTile } from '@/components/stat-tile';
import { formatDateTime } from '@bhoomisetu/shared';
import { formatMoney, formatPct } from '@/lib/format';
import { collectorKey, useCollectorDashboard, type Alert } from '@/lib/dashboards-api';
import { ApiProblem } from '@/lib/api';
import { useLiveUpdates } from '@/lib/use-live-updates';

/** The stage-level board and the entitlement-level alerts can both surface the same clock row
 * (a STAGE deadline whose id is also the representative of a single-entitlement group) — keep
 * the first occurrence so the list never repeats the same deadline. */
function dedupeById(alerts: Alert[]): Alert[] {
  const seen = new Set<string>();
  return alerts.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}

export default function CollectorDashboard() {
  const router = useRouter();
  const { data, error, isLoading } = useCollectorDashboard();
  useLiveUpdates([collectorKey]);

  if (error) {
    if (error instanceof ApiProblem && error.status === 401) {
      router.replace('/login');
      return null;
    }
    return <p className="text-red-700">Could not load the Collector dashboard.</p>;
  }
  if (isLoading || !data) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{data.post.designation}</h1>
        <p className="text-sm text-slate-500">
          {data.post.districtCode ?? 'District not set'} · as of {formatDateTime(data.asOf)}
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">What breaches on my watch</h2>
        <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
          <StatTile
            label="Deadlines breached"
            value={data.kpis.deadlines_breached}
            tone={data.kpis.deadlines_breached > 0 ? 'critical' : 'default'}
          />
          <StatTile
            label="Estimated interest liability (s.80)"
            value={formatMoney(data.estimatedInterestLiability.estimated_interest_paise)}
            sub={`${data.estimatedInterestLiability.entitlements} entitlements accruing`}
          />
          <StatTile label="Pending verifications" value={data.pendingVerifications.length} />
          <StatTile label="Unacknowledged payments" value={data.unacknowledged.length} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Deadline board</h2>
        <BreachAlerts
          alerts={dedupeById([
            ...data.deadlineBoard.map((d): Alert => ({ ...d, subject_type: d.subject_type, instances: 1 })),
            ...data.entitlementClocks,
          ])
            .filter((d) => d.live_status !== 'SAFE')
            .sort((a, b) => a.days_remaining - b.days_remaining)
            .slice(0, 20)}
        />
      </section>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Consent meters</h2>
        {data.consentMeters.length === 0 ? (
          <p className="border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">No consent registers in progress.</p>
        ) : (
          <ul className="divide-y divide-slate-200 border border-slate-200 bg-white">
            {data.consentMeters.map((c) => {
              const pct = c.pct === null ? 0 : Number(c.pct);
              const threshold = c.threshold === null ? null : Number(c.threshold) * 100;
              return (
                <li key={c.register_id} className="px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <Link href={`/project/${c.project_id}`} className="font-medium text-slate-900 hover:underline">
                      {c.project_code} — {c.consent_type}
                    </Link>
                    <span className={`font-semibold tabular-nums ${c.met ? 'text-teal-700' : 'text-slate-700'}`}>
                      {formatPct(pct)} of {threshold ?? '—'}% required · {c.consented} / {c.eligible}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-sm bg-slate-100">
                    <div
                      className={`h-full ${c.met ? 'bg-teal-700' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                    {threshold !== null && (
                      <div className="relative -mt-1.5 h-1.5 w-px bg-slate-400" style={{ marginLeft: `${Math.min(100, threshold)}%` }} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Returned files ({data.returnedFiles.length})
          </h2>
          <ul className="divide-y divide-slate-200 border border-slate-200 bg-white text-sm">
            {data.returnedFiles.length === 0 && <li className="px-4 py-6 text-slate-500">None returned.</li>}
            {data.returnedFiles.slice(0, 10).map((f, i) => (
              <li key={i} className="px-4 py-2.5">
                <Link href={`/project/${f.project_id}`} className="font-medium text-slate-900 hover:underline">
                  {f.project_code}
                </Link>
                <span className="text-slate-500"> — {f.stage_code} (attempt {f.attempt})</span>
                {f.reason_code && <p className="mt-0.5 text-xs text-slate-500">{f.reason_code}</p>}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Unacknowledged disbursements ({data.unacknowledged.length})
          </h2>
          <ul className="divide-y divide-slate-200 border border-slate-200 bg-white text-sm">
            {data.unacknowledged.length === 0 && <li className="px-4 py-6 text-slate-500">All disbursements acknowledged.</li>}
            {data.unacknowledged.slice(0, 10).map((u) => (
              <li key={u.affected_family_id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <Link href={`/project/${u.project_id}`} className="font-medium text-slate-900 hover:underline">
                    {u.head_name}
                  </Link>
                  <p className="text-xs text-slate-500">{u.project_code}</p>
                </div>
                <span className="font-semibold tabular-nums text-amber-700">{formatMoney(u.unconfirmed_paise)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
