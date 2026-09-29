'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { BreachAlerts } from '@/components/breach-alerts';
import { GapTile } from '@/components/gap-tile';
import { StateTable } from '@/components/state-table';
import { StatTile } from '@/components/stat-tile';
import { formatDateTime } from '@bhoomisetu/shared';
import { formatHectares, formatMoney, formatNum, formatPct } from '@/lib/format';
import { nationalKey, useNationalDashboard } from '@/lib/dashboards-api';
import { ApiProblem } from '@/lib/api';
import { useLiveUpdates } from '@/lib/use-live-updates';

const ProjectMap = dynamic(() => import('@/components/project-map').then((m) => m.ProjectMap), {
  ssr: false,
  loading: () => <div className="h-96 w-full animate-pulse border border-slate-200 bg-slate-100" />,
});

export default function NationalDashboard() {
  const router = useRouter();
  const { data, error, isLoading } = useNationalDashboard();
  useLiveUpdates([nationalKey]);

  if (error) {
    if (error instanceof ApiProblem && error.status === 401) {
      router.replace('/login');
      return null;
    }
    return <p className="text-red-700">Could not load the national dashboard.</p>;
  }
  if (isLoading || !data) return <DashboardSkeleton />;

  const { kpis } = data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">National dashboard</h1>
        <p className="text-sm text-slate-500">
          {kpis.projects} projects · as of {formatDateTime(data.asOf)}
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Key parameters</h2>
        <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
          <StatTile label="Area notified" value={formatHectares(kpis.area_notified_sqm)} />
          <StatTile label="Area acquired" value={formatHectares(kpis.area_acquired_sqm)} />
          <StatTile label="Compensation assessed" value={formatMoney(kpis.compensation_assessed_paise)} />
          <StatTile label="Compensation paid" value={formatMoney(kpis.compensation_paid_paise)} />
          <StatTile label="Affected families" value={formatNum(kpis.affected_families)} />
          <StatTile label="Displaced families" value={formatNum(kpis.displaced_families)} />
          <StatTile label="R&R completion" value={formatPct(kpis.rnr_completion_pct)} />
          <StatTile label="Possession" value={formatPct(kpis.possession_pct)} />
          <StatTile label="Timeline adherence" value={formatPct(kpis.timeline_adherence_pct)} />
          <StatTile
            label="Deadlines breached"
            value={formatNum(kpis.deadlines_breached)}
            tone={kpis.deadlines_breached > 0 ? 'critical' : 'default'}
          />
          <StatTile
            label="Estimated interest liability (s.80)"
            value={formatMoney(data.estimatedInterestLiability.estimated_interest_paise)}
            sub={`${data.estimatedInterestLiability.entitlements} entitlements accruing`}
          />
          <GapTile
            paidPaise={kpis.compensation_paid_paise}
            acknowledgedPaise={kpis.compensation_acknowledged_paise}
            unconfirmedPaise={kpis.compensation_unconfirmed_paise}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Breach alerts {data.alerts.length ? `(${data.alerts.length})` : ''}
        </h2>
        <BreachAlerts alerts={data.alerts} />
      </section>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Projects by risk</h2>
        <ProjectMap projects={data.projects} />
      </section>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">By state</h2>
        <StateTable states={data.states} />
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-14 animate-pulse bg-slate-100" />
      <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse bg-white" />
        ))}
      </div>
    </div>
  );
}
