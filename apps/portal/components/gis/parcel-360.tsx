'use client';

import { formatArea } from '@bhoomisetu/geo';
import { formatINR } from '@bhoomisetu/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChainBadge } from '@/components/chain-badge';
import { MockBadge, MoneyState, isMockProvider } from '@/components/money-state';
import { Tabs, Tag, riskTone, statusTone } from '@/components/gis/ux';
import { QrCode } from '@/components/qr-code';
import { useParcelDocuments, useParcelFamilies, useParcelRisk, useSurveyDetail, type RegistryRow } from '@/lib/gis-api';
import { useParcel } from '@/lib/parcels-api';

const TABS = ['overview', 'interests', 'risk', 'documents', 'legal', 'payment', 'families', 'field', 'qr'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  overview: 'Overview',
  interests: 'Interests',
  risk: 'Risk factors',
  documents: 'Documents',
  legal: 'Legal',
  payment: 'Payment',
  families: 'Families',
  field: 'Field photos & GPS',
  qr: 'QR',
};

const label = (s: string | null | undefined) => (s ?? '—').replace(/_/g, ' ').toLowerCase();
const area = (v: string | null | undefined) => (v == null ? '—' : formatArea(Number(v)));
const rupees = (p: string | null | undefined) => formatINR(BigInt(p ?? 0));
const when = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso)) : '—';
const doc = (id: string) => `/api/v1/documents/${id}/download`;


/**
 * Parcel 360° (A3) — a wide right drawer opened from the map, the registry and the record panel.
 * Everything here is read-only; actions live on the record panel and the field office.
 */
export function Parcel360({ row, onClose, onLocate }: { row: RegistryRow; onClose: () => void; onLocate?: (row: RegistryRow) => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const parcel = useParcel(row.parcel_id);
  const p = parcel.data;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* UX4G drawer (right, wide). z-index above Leaflet's panes and controls (1000). */}
      <div className="ux4g-drawer-overlay ux4g-drawer-open" style={{ zIndex: 1990 }} onClick={onClose} aria-hidden />
      <div
        className="ux4g-drawer ux4g-drawer-right ux4g-drawer-open"
        style={{ zIndex: 2000, top: 0, height: '100vh', width: 'min(100vw, 52rem)' }}
        role="dialog"
        aria-modal="true"
        aria-label={`Parcel ${row.survey_no}`}
      >
        <div className="ux4g-drawer-header">
          <div className="ux4g-drawer-title-group">
            <h2 className="ux4g-drawer-title">
              Survey {row.survey_no} — {row.village_name}
            </h2>
            <p className="ux4g-drawer-subtitle font-mono">{row.parcel_id}</p>
          </div>
          <button type="button" onClick={onClose} className="ux4g-drawer-close ux4g-icon-btn ux4g-icon-btn-text-primary ux4g-icon-btn-s" aria-label="Close">
            <i className="ux4g-icon-outlined" aria-hidden>
              close
            </i>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone={statusTone(row.status)}>{label(row.status)}</Tag>
          <MoneyState state={row.payment === 'PAID' ? 'DISBURSED' : row.payment === 'NONE' ? 'NOT_AWARDED' : row.payment} />
          <Tag tone={riskTone(row.risk_level)} title="Heuristic, not a legal finding">
            Risk score (advisory) {row.risk_level} — {row.risk_score}/100
          </Tag>
          <Link href={`/project/${row.project_id}/parcels`} className="ux4g-text-link ux4g-text-link-s">
            {row.project_code}
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {onLocate && (
            <button type="button" onClick={() => onLocate(row)} className="ux4g-btn-outline-primary ux4g-btn-xs">
              View on map
            </button>
          )}
          {(['documents', 'legal', 'payment', 'risk'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className="ux4g-btn-outline-neutral ux4g-btn-xs">
              {t === 'payment' ? 'Compensation' : TAB_LABEL[t]}
            </button>
          ))}
        </div>

        <Tabs label="Parcel sections" active={tab} onChange={setTab} tabs={TABS.map((t) => [t, TAB_LABEL[t]])} />

        <div className="ux4g-drawer-body min-h-0 flex-1 overflow-y-auto pb-6 text-sm">
          {parcel.isError && <p className="text-red-700">Could not load the parcel.</p>}
          {tab === 'overview' && <Overview row={row} p={p} />}
          {tab === 'interests' && <Interests p={p} />}
          {tab === 'risk' && <Risk projectParcelId={row.project_parcel_id} />}
          {tab === 'documents' && <Documents parcelId={row.parcel_id} projectParcelId={row.project_parcel_id} />}
          {tab === 'legal' && <Legal projectParcelId={row.project_parcel_id} />}
          {tab === 'payment' && <Payment projectParcelId={row.project_parcel_id} />}
          {tab === 'families' && <Families projectParcelId={row.project_parcel_id} />}
          {tab === 'field' && <Field p={p} />}
          {tab === 'qr' && <Qr parcelId={row.parcel_id} surveyNo={row.survey_no} />}
        </div>
      </div>
    </>
  );
}

type P = ReturnType<typeof useParcel>['data'];

function Dl({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-slate-500">{k}</dt>
          <dd className="font-medium text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Overview({ row, p }: { row: RegistryRow; p: P }) {
  const latest = p?.surveys.find((s) => s.status === 'verified') ?? p?.surveys[0];
  const survey = useSurveyDetail(latest?.id ?? null);
  return (
    <div className="space-y-5">
      <Dl
        items={[
          ['Village / taluk / district', `${row.village_name} · ${row.sub_district} · ${row.district}`],
          ['Survey number', row.survey_no],
          ['Land class', label(row.land_class)],
          ['Boundary source', label(row.boundary_source)],
          ['Recorded area', area(row.recorded_area_sqm)],
          ['Field area', area(row.field_area_sqm)],
          ['Affected area', `${area(row.affected_area_sqm)}${row.affected_pct != null ? ` (${Number(row.affected_pct).toFixed(1)}%)` : ''}`],
          ['Recorded vs field', row.area_diff_pct != null ? `${Number(row.area_diff_pct).toFixed(1)}%` : '—'],
          ['Chainage', row.chainage_km != null ? `${Number(row.chainage_km).toFixed(2)} km` : '—'],
          ['Transfer frozen on', p?.transfer_frozen_at ? when(p.transfer_frozen_at) : 'not frozen'],
          ['Irrigated multi-crop (s.10)', p ? (p.is_irrigated_multicrop ? 'yes' : 'no') : '—'],
          ['Scheduled area (s.41)', p ? (p.in_scheduled_area ? 'yes' : 'no') : '—'],
        ]}
      />
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verification</h3>
        {!latest ? (
          <p className="mt-1 text-slate-500">No field survey yet.</p>
        ) : (
          <p className="mt-1">
            {label(latest.status)}
            {survey.data?.verified_by_designation && ` by ${survey.data.verified_by_designation}`}
            {latest.verification_remarks && <span className="text-slate-600"> — {latest.verification_remarks}</span>}
            {latest.override_reason && <span className="block text-xs text-amber-800">Override: {latest.override_reason}</span>}
            <span className="block text-xs text-slate-500">
              Walked by {survey.data?.surveyor_name ?? '…'} ({survey.data?.surveyor_designation ?? '…'})
            </span>
          </p>
        )}
      </section>
      <section className="flex flex-wrap items-center gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proof</h3>
        <ChainBadge entityType="land_parcel" entityId={row.parcel_id} version={row.version} />
        {(row.flags?.length ?? 0) > 0 && <span className="text-xs text-amber-800">Flags: {row.flags.join(', ')}</span>}
      </section>
    </div>
  );
}

function Interests({ p }: { p: P }) {
  if (!p) return <p className="text-slate-500">Loading…</p>;
  if (!p.interests.length) return <p className="text-slate-500">No interests on record.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th className="py-1">Person</th>
          <th>Interest</th>
          <th>Share</th>
          <th>Phone</th>
          <th>Verification</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {p.interests.map((i) => (
          <tr key={i.id}>
            {/* Masked exactly as the API returned them for this post (G13). */}
            <td className="py-1.5 font-medium">{i.person.fullName}</td>
            <td>{label(i.interest_type)}</td>
            <td>{i.share_fraction ?? '—'}</td>
            <td className="font-mono text-xs">{i.person.phone ?? '—'}</td>
            <td>{label(i.verification_status)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Risk({ projectParcelId }: { projectParcelId: string }) {
  const { data, isLoading, isError } = useParcelRisk(projectParcelId);
  if (isError) return <p className="text-red-700">Could not load risk factors.</p>;
  if (isLoading || !data) return <p className="text-slate-500">Loading…</p>;
  const ev = data.evidence;
  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-semibold tabular-nums">{data.score}</span>
        <span className="text-slate-500">/ 100 · {data.level}</span>
      </div>
      <div className="ux4g-alert ux4g-alert-info">{data.note}</div>
      {data.factors.length === 0 ? (
        <p className="text-slate-500">No risk factors apply.</p>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-200">
          {data.factors.map((f) => (
            <li key={f.code} className="flex items-center justify-between gap-3 px-3 py-2">
              <span>{f.label}</span>
              <span className="font-semibold tabular-nums">+{f.points}</span>
            </li>
          ))}
        </ul>
      )}
      {(['deadlines', 'flags', 'legalCases', 'objections'] as const).map((k) =>
        ev[k]?.length ? (
          <section key={k}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence — {k.replace(/([A-Z])/g, ' $1').toLowerCase()}</h3>
            <ul className="mt-1 space-y-1 text-xs">
              {ev[k]!.map((r, i) => (
                <li key={i} className="border border-slate-100 px-2 py-1">
                  {k === 'deadlines'
                    ? `${String(r.label ?? r.clock_code)} (${String(r.section)}) — ${label(String(r.live_status))}, ${String(r.days_remaining)} days: ${String(r.consequence_text ?? '')}`
                    : k === 'flags'
                      ? `${String(r.flag_type)}${r.layer_type ? ` · ${String(r.layer_type)}` : ''} — ${String(r.message)}`
                      : k === 'legalCases'
                        ? `${String(r.case_type)} ${String(r.case_no ?? '')} — ${String(r.status)}, filed ${when(String(r.filed_at))}`
                        : `Objection ${String(r.id).slice(0, 8)} — ${label(String(r.status))}, ${String(r.channel)}`}
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}

function Documents({ parcelId, projectParcelId }: { parcelId: string; projectParcelId: string }) {
  const { data, isLoading, isError } = useParcelDocuments(parcelId, projectParcelId);
  if (isError) return <p className="text-red-700">Could not load documents.</p>;
  if (isLoading || !data) return <p className="text-slate-500">Loading…</p>;
  if (!data.length) return <p className="text-slate-500">No documents filed against this parcel.</p>;
  return (
    <ul className="divide-y divide-slate-100 border border-slate-200">
      {data.map((d) => (
        <li key={d.id} className="space-y-1 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">
              {d.title} <span className="text-xs font-normal text-slate-500">· {label(d.doc_type)} · v{d.version}</span>
              {!d.is_current && <span className="ml-1 rounded bg-slate-100 px-1.5 text-[10px] text-slate-600">superseded</span>}
            </span>
            <span className="flex items-center gap-2">
              <ChainBadge entityType="document" entityId={d.id} />
              <a href={doc(d.id)} target="_blank" rel="noreferrer" className="text-xs text-teal-700 hover:underline">
                Download
              </a>
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {d.attested_at
              ? `Attested by ${d.designation_snapshot ?? d.uploaded_by_designation ?? '—'} on ${when(d.attested_at)} · declaration ${d.declaration_version}`
              : `Uploaded by ${d.uploaded_by_designation ?? '—'} on ${when(d.uploaded_at)} · not attested`}
            {d.supersedes_id && ` · supersedes ${d.supersedes_id.slice(0, 8)}`}
          </p>
          <p className="break-all font-mono text-[10px] text-slate-400">sha256 {d.sha256}</p>
        </li>
      ))}
    </ul>
  );
}

function Legal({ projectParcelId }: { projectParcelId: string }) {
  const { data, isLoading } = useParcelRisk(projectParcelId);
  if (isLoading || !data) return <p className="text-slate-500">Loading…</p>;
  const cases = data.evidence.legalCases ?? [];
  const stay = cases.some((c) => c.case_type === 'WRIT' && ['filed', 'hearing'].includes(String(c.status)));
  return (
    <div className="space-y-3">
      {stay && (
        <div role="alert" className="ux4g-alert ux4g-alert-error">
          A writ is pending on this parcel — the stay blocks possession.
        </div>
      )}
      {cases.length === 0 ? (
        <p className="text-slate-500">No legal cases on this parcel.</p>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-200">
          {cases.map((c) => (
            <li key={String(c.id)} className="px-3 py-2">
              <span className="font-medium">
                {String(c.case_type)} {String(c.case_no ?? '')}
              </span>{' '}
              — {label(String(c.status))} · filed {when(String(c.filed_at))}
              {c.next_hearing_at ? ` · next hearing ${when(String(c.next_hearing_at))}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Payment({ projectParcelId }: { projectParcelId: string }) {
  const { data, isLoading, isError } = useParcelFamilies(projectParcelId);
  if (isError) return <p className="text-red-700">Could not load payments.</p>;
  if (isLoading || !data) return <p className="text-slate-500">Loading…</p>;
  if (!data.length) return <p className="text-slate-500">No affected family is linked to this parcel yet.</p>;
  return (
    <div className="space-y-4">
      {data.map((f) => (
        <section key={f.id} className="border border-slate-200">
          <h3 className="border-b border-slate-200 bg-slate-50 px-3 py-2 font-medium">
            {f.head_name} <span className="text-xs font-normal text-slate-500">· {label(f.interest_type)}</span>
          </h3>
          {f.entitlements.length === 0 ? (
            <p className="px-3 py-2 text-slate-500">No award entered.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {f.entitlements.map((e) => (
                <li key={e.id} className="space-y-1 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{label(e.headCode)}</span>
                    <span className="tabular-nums">{rupees(e.amountPaise)}</span>
                    <MoneyState state={e.status} />
                  </div>
                  {e.disbursements.map((d) => (
                    <div key={d.id} className="ml-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="tabular-nums">{rupees(d.amountPaise)}</span>
                      <MoneyState state={d.paymentStatus} />
                      {d.adapterRef && (
                        <span className="font-mono">
                          ref {d.adapterRef} {isMockProvider(d.adapterProvider) && <MockBadge />}
                        </span>
                      )}
                      {d.acknowledgement ? (
                        <span className="text-teal-800">
                          ✓ acknowledged · {d.acknowledgement.method}
                          {d.acknowledgement.method === 'OTP' && <> <MockBadge title="OTP sent through the mock SMS adapter" /></>}
                        </span>
                      ) : d.paymentStatus === 'SUCCESS' && d.instrument === 'DBT' ? (
                        <span className="text-amber-800">disbursed, not acknowledged</span>
                      ) : null}
                      {(d.holdReasonCode || d.holdReason) && (
                        <span className="text-red-800">
                          on hold{d.holdReasonCode ? ` — ${d.holdReasonCode}` : ''}
                          {d.holdReason ? `: ${d.holdReason}` : ''}
                        </span>
                      )}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function Families({ projectParcelId }: { projectParcelId: string }) {
  const { data, isLoading } = useParcelFamilies(projectParcelId);
  if (isLoading || !data) return <p className="text-slate-500">Loading…</p>;
  if (!data.length) return <p className="text-slate-500">No affected family is linked to this parcel yet.</p>;
  return (
    <ul className="divide-y divide-slate-100 border border-slate-200">
      {data.map((f) => (
        <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <span>
            <span className="font-medium">{f.head_name}</span>
            <span className="text-xs text-slate-500">
              {' '}
              · {label(f.affected_type)}
              {f.is_displaced ? ' · displaced' : ''}
              {f.is_sc_st ? ' · SC/ST' : ''}
            </span>
          </span>
          <Link href={`/families/${f.id}/money`} className="text-xs font-medium text-teal-700 hover:underline">
            Money & acknowledgement →
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Field({ p }: { p: P }) {
  if (!p) return <p className="text-slate-500">Loading…</p>;
  if (!p.vertices.length) return <p className="text-slate-500">No field survey has been synced for this parcel.</p>;
  const track = p.surveys.find((s) => s.track)?.track as { coordinates?: unknown[] } | undefined;
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        {p.vertices.length} vertices{track?.coordinates ? ` · walked track ${track.coordinates.length} points` : ''}. Captured time is the
        phone’s; synced time is when the server received it.
      </p>
      <table className="w-full text-xs">
        <thead className="text-left uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-1">#</th>
            <th>Position</th>
            <th>Accuracy</th>
            <th>Captured</th>
            <th>Synced</th>
            <th>Photo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {p.vertices.map((v) => (
            <tr key={v.id}>
              <td className="py-1">{v.seq}</td>
              <td className="font-mono">
                {Number(v.lat).toFixed(6)}, {Number(v.lng).toFixed(6)}
              </td>
              <td className={Number(v.accuracy_m) > 10 ? 'text-amber-800' : ''}>±{Number(v.accuracy_m).toFixed(1)} m</td>
              <td>{when(v.captured_at)}</td>
              <td>{when(v.synced_at)}</td>
              <td>
                {v.photo_document_id ? (
                  <a href={doc(v.photo_document_id)} target="_blank" rel="noreferrer">
                    <img src={doc(v.photo_document_id)} alt={`Vertex ${v.seq}`} className="h-12 w-12 rounded object-cover" loading="lazy" />
                  </a>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Qr({ parcelId, surveyNo }: { parcelId: string; surveyNo: string }) {
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  if (!origin) return null;
  return (
    <div className="space-y-2">
      <QrCode url={`${origin}/verify/parcel/${parcelId}`} caption={`Public verification page for survey ${surveyNo}`} />
      <p className="text-xs text-slate-500">The public verification page is built by Ishan; the QR already points at its final address.</p>
    </div>
  );
}
