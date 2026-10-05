'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BreachAlerts } from '@/components/breach-alerts';
import { GapTile } from '@/components/gap-tile';
import { StateTable } from '@/components/state-table';
import { StageFunnel } from '@/components/stage-funnel';
import { StatTile } from '@/components/stat-tile';
import { formatDateTime } from '@bhoomisetu/shared';
import { formatHectares, formatMoney, formatNum, formatPct } from '@/lib/format';
import type { NationalDashboard } from '@/lib/dashboards-api';

const ProjectMap = dynamic(() => import('@/components/gis/project-map').then((m) => m.ProjectMap), {
  ssr: false,
  loading: () => <div className="h-96 w-full animate-pulse bg-slate-100" />,
});

/**
 * One dashboard body for every scope (§24.1): national, state and district all return the same shape from
 * GET /dashboards/{national|state/:code|district/:code}; RLS decides what each post can see (G13).
 */
export function ScopeDashboard({
  title,
  actions,
  data,
  breakdown,
  pipeline,
}: {
  title: ReactNode;
  /** Shown to the right of the title on the header band (e.g. the state picker, `dark` variant). */
  actions?: ReactNode;
  data: NationalDashboard;
  /** Table under the map: by state (national), by district (state), or the projects themselves (district). */
  breakdown: 'state' | 'district' | 'projects';
  /** National and state dashboards link into the projects pipeline (§24.3); `state` narrows it for national posts. */
  pipeline?: { state?: string };
}) {
  const { kpis } = data;
  const pipelineHref = (stage?: string) => {
    const q = new URLSearchParams();
    if (stage) q.set('stage', stage);
    if (pipeline?.state) q.set('state', pipeline.state);
    const qs = q.toString();
    return `/pipeline${qs ? `?${qs}` : ''}`;
  };
  const pct = (v: string | number | null | undefined) => (v == null ? null : Number(v));

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1f3c8f] via-[#1b347c] to-[#132659] px-6 py-6 text-white shadow-sm">
        <span className="absolute inset-x-0 top-0 flex h-1" aria-hidden>
          <span className="flex-1 bg-[#ff9933]" />
          <span className="flex-1 bg-white" />
          <span className="flex-1 bg-[#138808]" />
        </span>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-0.5 text-sm text-white/70">As of {formatDateTime(data.asOf)}</p>
          </div>
          {actions}
        </div>
        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(
            [
              ['Projects', formatNum(kpis.projects)],
              ['Area acquired', formatHectares(kpis.area_acquired_sqm)],
              ['Affected families', formatNum(kpis.affected_families)],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
              <dt className="text-xs font-medium uppercase tracking-wide text-white/70">{label}</dt>
              <dd className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section>
        <SectionTitle>Key parameters</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Area notified" value={formatHectares(kpis.area_notified_sqm)} icon="map" accent="navy" />
          <StatTile
            label="Area acquired"
            value={formatHectares(kpis.area_acquired_sqm)}
            icon="landscape"
            accent="navy"
          />
          <StatTile
            label="Compensation assessed"
            value={formatMoney(kpis.compensation_assessed_paise)}
            icon="request_quote"
            accent="saffron"
          />
          <StatTile
            label="Compensation paid"
            value={formatMoney(kpis.compensation_paid_paise)}
            icon="payments"
            accent="saffron"
          />
          <StatTile label="Affected families" value={formatNum(kpis.affected_families)} icon="groups" accent="green" />
          <StatTile
            label="Displaced families"
            value={formatNum(kpis.displaced_families)}
            icon="home_work"
            accent="green"
          />
          <StatTile
            label="R&R completion"
            value={formatPct(kpis.rnr_completion_pct)}
            icon="volunteer_activism"
            accent="green"
            progress={pct(kpis.rnr_completion_pct)}
          />
          <StatTile
            label="Possession"
            value={formatPct(kpis.possession_pct)}
            icon="flag"
            accent="navy"
            progress={pct(kpis.possession_pct)}
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label="Timeline adherence"
            value={formatPct(kpis.timeline_adherence_pct)}
            icon="schedule"
            accent="navy"
            progress={pct(kpis.timeline_adherence_pct)}
          />
          <StatTile
            label="Deadlines breached"
            value={formatNum(kpis.deadlines_breached)}
            tone={kpis.deadlines_breached > 0 ? 'critical' : 'default'}
            icon="gavel"
            accent="slate"
          />
          <StatTile
            label="Estimated interest liability (s.80)"
            value={formatMoney(data.estimatedInterestLiability.estimated_interest_paise)}
            sub={`${data.estimatedInterestLiability.entitlements} entitlements accruing`}
            icon="trending_up"
            accent="saffron"
          />
        </div>
        <div className="mt-3">
          <GapTile
            paidPaise={kpis.compensation_paid_paise}
            acknowledgedPaise={kpis.compensation_acknowledged_paise}
            unconfirmedPaise={kpis.compensation_unconfirmed_paise}
          />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="min-w-0">
          <SectionTitle>Breach alerts {data.alerts.length ? `(${data.alerts.length})` : ''}</SectionTitle>
          <BreachAlerts alerts={data.alerts} />
        </section>
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <SectionTitle className="mb-0">Projects by stage</SectionTitle>
            {pipeline && (
              <Link href={pipelineHref()} className="text-sm font-semibold text-[#1f3c8f] hover:underline">
                See every project stage by stage →
              </Link>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <StageFunnel projects={data.projects} linkTo={pipeline ? (stage) => pipelineHref(stage) : undefined} />
          </div>
        </section>
      </div>

      <section className="min-w-0">
        <SectionTitle>Projects by risk</SectionTitle>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <ProjectMap projects={data.projects} />
        </div>
      </section>

      {breakdown === 'state' && (
        <section>
          <SectionTitle>By state</SectionTitle>
          <StateTable states={data.states} />
        </section>
      )}
      {breakdown === 'district' && (
        <section>
          <SectionTitle>By district</SectionTitle>
          <BreakdownTable
            rows={data.districts.map((d) => ({
              key: d.district_code,
              name: d.district_name,
              href: `/district/${d.district_code}`,
              k: d,
            }))}
          />
        </section>
      )}
      {breakdown === 'projects' && (
        <section>
          <SectionTitle>Projects</SectionTitle>
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {data.projects.map((p) => (
              <li key={p.project_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <Link href={`/project/${p.project_id}/timeline`} className="font-medium text-[#1f3c8f] hover:underline">
                  {p.code} · {p.name}
                </Link>
                <span className="text-slate-600">
                  {p.current_stage} · {p.status} ·{' '}
                  <span
                    className={
                      p.risk === 'BREACHED'
                        ? 'text-red-700'
                        : p.risk === 'DUE_SOON'
                          ? 'text-amber-700'
                          : 'text-teal-700'
                    }
                  >
                    {p.risk === 'BREACHED'
                      ? 'deadline breached'
                      : p.risk === 'DUE_SOON'
                        ? 'deadline due soon'
                        : 'on track'}
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
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
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
            <tr key={key} className="border-b border-slate-100 last:border-0 even:bg-slate-50/60 hover:bg-slate-50">
              <td className="px-3 py-2">
                <Link href={href} className="font-medium text-[#1f3c8f] hover:underline">
                  {name}
                </Link>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatNum(k.projects)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatHectares(k.area_notified_sqm)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(k.compensation_paid_paise)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatNum(k.affected_families)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatPct(k.possession_pct)}</td>
              <td
                className={`px-3 py-2 text-right tabular-nums ${k.deadlines_breached ? 'font-semibold text-red-700' : ''}`}
              >
                {formatNum(k.deadlines_breached)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionTitle({ children, className = 'mb-3' }: { children: ReactNode; className?: string }) {
  return <h2 className={`${className} text-sm font-semibold text-slate-800`}>{children}</h2>;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-44 animate-pulse rounded-2xl bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
