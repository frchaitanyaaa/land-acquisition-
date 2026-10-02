'use client';

import { formatArea } from '@bhoomisetu/geo';
import Link from 'next/link';
import { ChainBadge } from '@/components/chain-badge';
import { MoneyState } from '@/components/money-state';
import { ParcelDetail } from '@/components/gis/parcel-detail';
import { Tag, riskTone, statusTone } from '@/components/gis/ux';
import type { RegistryRow } from '@/lib/gis-api';
import { useParcel } from '@/lib/parcels-api';

const label = (s: string) => s.replace(/_/g, ' ').toLowerCase();
const area = (v: string | null) => (v == null ? '—' : formatArea(Number(v)));

/**
 * A2 right pane — opens on parcel click. Identification, status + flags, areas, interests (masked
 * by the API as the viewer's post requires — rendered as returned, G13), payment state, anchor
 * badge, and the verify / correction actions (shown to everyone; the API refuses posts that may not).
 */
export function RecordPanel({
  row,
  onClose,
  onOpen360,
}: {
  row: RegistryRow;
  onClose: () => void;
  /** A3 — the Parcel 360° drawer. Omitted until it ships. */
  onOpen360?: (row: RegistryRow) => void;
}) {
  const { data } = useParcel(row.parcel_id);
  return (
    <aside className="flex max-h-[44rem] w-full flex-col overflow-hidden border border-slate-200 bg-white lg:w-96 lg:shrink-0">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Survey {row.survey_no}</h3>
            <p className="text-xs text-slate-500">
              {row.village_name} · {row.sub_district} · {row.district}
            </p>
            <p className="font-mono text-[11px] text-slate-400">{row.parcel_id}</p>
          </div>
          <button type="button" onClick={onClose} className="ux4g-btn-text-neutral ux4g-btn-xs" aria-label="Close record">
            ✕
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Tag tone={statusTone(row.status)}>{label(row.status)}</Tag>
          <Tag tone={riskTone(row.risk_level)} title="Heuristic, not a legal finding">
            Risk (advisory) {row.risk_level} — {row.risk_score}/100
          </Tag>
          {row.legal_stay && <Tag tone="error">Legal stay</Tag>}
          {row.flags.map((f) => (
            <Tag key={f} tone="warning">
              {label(f)}
            </Tag>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ChainBadge entityType="land_parcel" entityId={row.parcel_id} version={row.version} />
          {onOpen360 && (
            <button type="button" onClick={() => onOpen360(row)} className="ux4g-btn-primary ux4g-btn-xs">
              Open 360° view
            </button>
          )}
          <Link href={`/project/${row.project_id}/timeline`} className="text-xs text-teal-700 hover:underline">
            {row.project_code} →
          </Link>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3 text-sm">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div>
            <dt className="text-xs text-slate-500">Recorded area</dt>
            <dd className="text-xs font-medium">{area(row.recorded_area_sqm)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Field area</dt>
            <dd className="text-xs font-medium">{area(row.field_area_sqm)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Affected area</dt>
            <dd className="text-xs font-medium">
              {area(row.affected_area_sqm)}
              {row.affected_pct != null && <span className="text-slate-500"> ({Number(row.affected_pct).toFixed(1)}%)</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Recorded vs field</dt>
            <dd className={`text-xs font-medium ${Math.abs(Number(row.area_diff_pct ?? 0)) > 5 ? 'text-amber-700' : ''}`}>
              {row.area_diff_pct != null ? `${Number(row.area_diff_pct).toFixed(1)}%` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Land class</dt>
            <dd className="text-xs font-medium">{label(row.land_class)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Chainage</dt>
            <dd className="text-xs font-medium">{row.chainage_km != null ? `${Number(row.chainage_km).toFixed(2)} km` : '—'}</dd>
          </div>
        </dl>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment</h4>
          <div className="mt-1 flex items-center gap-2">
            <MoneyState state={row.payment === 'PAID' ? 'DISBURSED' : row.payment === 'NONE' ? 'NOT_AWARDED' : row.payment} />
            {row.unacknowledged && <span className="text-xs text-amber-800">disbursed, not acknowledged</span>}
          </div>
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Interests</h4>
          {!data ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : data.interests.length === 0 ? (
            <p className="text-xs text-slate-500">No interests on record.</p>
          ) : (
            <ul className="mt-1 divide-y divide-slate-100">
              {data.interests.map((i) => (
                <li key={i.id} className="py-1.5 text-xs">
                  <span className="font-medium">{i.person.fullName}</span> · {label(i.interest_type)}
                  {i.share_fraction ? ` · share ${i.share_fraction}` : ''}
                  <span className="block text-slate-500">
                    {i.person.phone ?? '—'} · {label(i.verification_status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ParcelDetail parcelId={row.parcel_id} projectId={row.project_id} onClose={onClose} embedded />
      </div>
    </aside>
  );
}
