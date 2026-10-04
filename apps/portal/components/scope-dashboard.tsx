'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BreachAlerts } from '@/components/breach-alerts';
import { GapTile } from '@/components/gap-tile';
import { StateTable } from '@/components/state-table';
import { StatTile } from '@/components/stat-tile';
import { formatDateTime } from '@bhoomisetu/shared';
import { formatHectares, formatMoney, formatNum, formatPct } from '@/lib/format';
import type { NationalDashboard } from '@/lib/dashboards-api';

const ProjectMap = dynamic(() => import('@/components/gis/project-map').then((m) => m.ProjectMap), {
  ssr: false,
  loading: () => <div className="h-96 w-full animate-pulse border border-slate-200 bg-slate-100" />,
});

/**
 * One dashboard body for every scope (§24.1): national, state and district all return the same shape from
 * GET /dashboards/{national|state/:code|district/:code}; RLS decides what each post can see (G13).
 */
export function ScopeDashboard({
  title,
  data,
  breakdown,
}: {
  title: ReactNode;
  data: NationalDashboard;
  /** Table under the map: by state (national), by district (state), or the projects themselves (district). */
  breakdown: 'state' | 'district' | 'projects';
}) {
  const { kpis } = data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
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

      {breakdown === 'state' && (
        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">By state</h2>
          <StateTable states={data.states} />
        </section>
      )}
      {breakdown === 'district' && (
        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">By district</h2>
          <BreakdownTable
            rows={data.districts.map((d) => ({ key: d.district_code, name: d.district_name, href: `/district/${d.district_code}`, k: d }))}
          />
        </section>
      )}
      {breakdown === 'projects' && (
        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Projects</h2>
          <ul className="divide-y divide-slate-200 border border-slate-200 bg-white">
            {data.projects.map((p) => (
              <li key={p.project_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <Link href={`/project/${p.project_id}/timeline`} className="font-medium text-teal-800 hover:underline">
                  {p.code} · {p.name}
                </Link>
                <span className="text-slate-600">
                  {p.current_stage} · {p.status} ·{' '}
                  <span className={p.risk === 'BREACHED' ? 'text-red-700' : p.risk === 'DUE_SOON' ? 'text-amber-700' : 'text-teal-700'}>
                    {p.risk === 'BREACHED' ? 'deadline breached' : p.risk === 'DUE_SOON' ? 'deadline due soon' : 'on track'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function BreakdownTable({
  rows,
}: {
  rows: Array<{ key: string; name: string; href: string; k: NationalDashboard['kpis'] }>;
}) {
  return (
    <div className="overflow-x-auto border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">District</th>
            <th className="px-3 py-2 text-right">Projects</th>
            <th className="px-3 py-2 text-right">Area notified</th>
            <th className="px-3 py-2 text-right">Paid</th>
            <th className="px-3 py-2 text-right">Affected families</th>
            <th className="px-3 py-2 text-right">Possession</th>
            <th className="px-3 py-2 text-right">Breached</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, name, href, k }) => (
            <tr key={key} className="border-b border-slate-100">
              <td className="px-3 py-2">
                <Link href={href} className="font-medium text-teal-800 hover:underline">
                  {name}
                </Link>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatNum(k.projects)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatHectares(k.area_notified_sqm)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(k.compensation_paid_paise)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatNum(k.affected_families)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatPct(k.possession_pct)}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${k.deadlines_breached ? 'font-semibold text-red-700' : ''}`}>
                {formatNum(k.deadlines_breached)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardSkeleton() {
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
