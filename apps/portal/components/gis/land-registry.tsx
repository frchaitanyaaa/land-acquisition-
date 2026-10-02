'use client';

import { formatArea } from '@bhoomisetu/geo';
import { useMemo } from 'react';
import { Tag, riskTone } from '@/components/gis/ux';
import { MoneyState } from '@/components/money-state';
import { useParcelRegistry, type RegistryFilters, type RegistryRow } from '@/lib/gis-api';

const label = (s: string) => s.replace(/_/g, ' ').toLowerCase();
const PAGE = 50;

function Kpi({ label: l, value, tone }: { label: string; value: string; tone?: 'bad' | 'warn' }) {
  return (
    <div className="ux4g-card ux4g-card-outline ux4g-card-vertical">
      <div className="ux4g-card-body">
        <p className="ux4g-label-s-default">{l}</p>
        <p className={`ux4g-heading-s-strong tabular-nums ${tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-800' : ''}`}>{value}</p>
      </div>
    </div>
  );
}

/**
 * Land registry (A3) — the list view of the GIS workspace: same filters, cursor pagination
 * ("Load more"), KPI strip for the whole filtered set (from the API, not from the loaded pages).
 */
export function LandRegistry({
  filters,
  onLocate,
  onOpen360,
}: {
  filters: RegistryFilters;
  onLocate: (row: RegistryRow) => void;
  onOpen360: (row: RegistryRow) => void;
}) {
  const q = useParcelRegistry(filters, { geometry: false, limit: PAGE });
  const rows = useMemo(() => (q.data?.pages ?? []).flatMap((p) => p.items), [q.data]);
  const s = q.data?.pages[0]?.summary;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Kpi label="Parcels" value={s ? s.parcels.toLocaleString('en-IN') : '—'} />
        <Kpi label="Affected area" value={s ? formatArea(Number(s.affected_area_sqm)).split(' · ')[0]! : '—'} />
        <Kpi label="High risk (advisory)" value={s ? String(s.high_risk) : '—'} tone={s?.high_risk ? 'bad' : undefined} />
        <Kpi label="Payments pending" value={s ? String(s.payments_pending) : '—'} tone={s?.payments_pending ? 'warn' : undefined} />
        <Kpi label="Legal stays" value={s ? String(s.legal_stays) : '—'} tone={s?.legal_stays ? 'bad' : undefined} />
      </div>

      <div className="ux4g-table-responsive border border-slate-200 bg-white">
        <table className="ux4g-table ux4g-table-s w-full">
          <thead>
            <tr>
              <th className="px-3 py-2">Parcel ID</th>
              <th className="px-3 py-2">Survey no.</th>
              <th className="px-3 py-2">Village / taluk</th>
              <th className="px-3 py-2">Affected area</th>
              <th className="px-3 py-2">Land class</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Payment</th>
              <th className="px-3 py-2">Risk (advisory)</th>
              <th className="px-3 py-2" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.project_parcel_id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs text-slate-500" title={r.parcel_id}>
                  {r.parcel_id.slice(0, 8)}
                </td>
                <td className="px-3 py-2 font-semibold">{r.survey_no}</td>
                <td className="px-3 py-2">
                  {r.village_name}
                  <span className="block text-xs text-slate-500">{r.sub_district}</span>
                </td>
                <td className="px-3 py-2 text-xs">{r.affected_area_sqm ? formatArea(Number(r.affected_area_sqm)) : '—'}</td>
                <td className="px-3 py-2">{label(r.land_class)}</td>
                <td className="px-3 py-2">{label(r.status)}</td>
                <td className="px-3 py-2">
                  <MoneyState state={r.payment === 'PAID' ? 'DISBURSED' : r.payment === 'NONE' ? 'NOT_AWARDED' : r.payment} />
                </td>
                <td className="px-3 py-2">
                  <Tag tone={riskTone(r.risk_level)}>
                    {r.risk_level} — {r.risk_score}/100
                  </Tag>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button type="button" onClick={() => onLocate(r)} className="ux4g-icon-btn ux4g-icon-btn-text-primary ux4g-icon-btn-s mr-1" title="Locate on map" aria-label={`Locate survey ${r.survey_no} on the map`}>
                    <i className="ux4g-icon-outlined" aria-hidden>
                      my_location
                    </i>
                  </button>
                  <button type="button" onClick={() => onOpen360(r)} className="ux4g-btn-outline-primary ux4g-btn-xs">
                    View 360°
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {q.isLoading && <p className="px-3 py-4 text-sm text-slate-500">Loading…</p>}
        {q.isError && <p className="px-3 py-4 text-sm text-red-700">The registry could not be loaded — the API is not reachable.</p>}
        {!q.isLoading && !q.isError && rows.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">No parcels match these filters.</p>}
        {q.hasNextPage && (
          <button type="button" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage} className="ux4g-btn-text-primary ux4g-btn-s w-full">
            {q.isFetchingNextPage ? 'Loading…' : `Load more (${rows.length} of ${s?.parcels ?? '…'})`}
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">{q.data?.pages[0]?.riskNote}</p>
    </div>
  );
}
