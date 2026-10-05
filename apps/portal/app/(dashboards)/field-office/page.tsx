'use client';

import { formatArea } from '@bhoomisetu/geo';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { ChainBadge } from '@/components/chain-badge';
import { Tabs, Tag } from '@/components/gis/ux';
import { api, ApiProblem, type Me } from '@/lib/api';
import {
  useAssignments,
  useCorrections,
  useReturnSurvey,
  useSurveyDetail,
  useSurveyQueue,
  type CorrectionRow,
  type SurveyDetail,
  type SurveyQueueStatus,
} from '@/lib/gis-api';
import { useDecideCorrection, useParcel, useRequestCorrection, useVerifyParcel } from '@/lib/parcels-api';
import { useProject, useRulePack } from '@/lib/project-api';

const mapLoading = () => <div className="h-[30rem] w-full animate-pulse border border-slate-200 bg-slate-100" />;
const SurveyMap = dynamic(() => import('@/components/gis/survey-map').then((m) => m.SurveyMap), {
  ssr: false,
  loading: mapLoading,
});
const CorrectionDiffMap = dynamic(() => import('@/components/gis/survey-map').then((m) => m.CorrectionDiffMap), {
  ssr: false,
  loading: mapLoading,
});
const AssignmentsMap = dynamic(() => import('@/components/gis/survey-map').then((m) => m.AssignmentsMap), {
  ssr: false,
  loading: mapLoading,
});

type Tab = SurveyQueueStatus | 'corrections' | 'assignments';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'submitted', label: 'To verify' },
  { key: 'returned', label: 'Returned' },
  { key: 'verified', label: 'Verified' },
  { key: 'corrections', label: 'Corrections to decide' },
  { key: 'assignments', label: 'Assignments' },
];

/** The §15.6 plausibility checks, with what each one means for the verifier. */
const CHECKS: Record<string, string> = {
  IMPLAUSIBLE_SPEED: 'Walking speed between vertices is not humanly plausible',
  CLOCK_SKEW: "The phone's clock disagrees with the server's",
  PHOTO_FAR: 'A vertex photo was taken far from the walked polygon',
  OUTSIDE_ASSIGNMENT: 'Vertices lie far outside the project footprint',
  SUSPICIOUS_FIX: 'GPS fixes look copied or rounded',
  TOO_FEW_POINTS: 'Too few usable vertices',
};

const label = (s: string | null | undefined) => (s ?? '—').replace(/_/g, ' ').toLowerCase();
const when = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(
        new Date(iso),
      )
    : '—';
const area = (v: string | null | undefined) => (v == null ? '—' : formatArea(Number(v)));
const doc = (id: string) => `/api/v1/documents/${id}/download`;
const errText = (e: unknown) =>
  e instanceof ApiProblem ? e.message : e instanceof Error ? e.message : 'Something went wrong.';

/**
 * Field office (A4) — for Tehsildar, DILR and field officers (LAO reads). Work queue on the left,
 * the walked survey on the map, verification on the right. Approve = POST /parcels/:id/verify
 * (an override reason is required whenever any flag exists); Return = POST /field/surveys/:id/return.
 * The API enforces roles and maker ≠ checker; buttons are shown and the server decides.
 */
export default function FieldOfficePage() {
  const [tab, setTab] = useState<Tab>('submitted');
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/auth/me'), retry: false });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="ux4g-heading-m-strong">Field office</h1>
          <p className="text-sm text-slate-600">
            {me.data
              ? `${me.data.user.fullName} · ${me.data.activePost.designation}`
              : 'Verify synced field surveys and decide boundary corrections.'}
          </p>
        </div>
        <a href="/field/index.html" className="ux4g-btn-primary ux4g-btn-s">
          Open field app ↗
        </a>
      </div>

      <Tabs label="Field office" active={tab} onChange={setTab} tabs={TABS.map((t) => [t.key, t.label])} />

      {(tab === 'submitted' || tab === 'returned' || tab === 'verified') && <SurveyQueue status={tab} />}
      {tab === 'corrections' && <Corrections myPostId={me.data?.activePost.id ?? null} />}
      {tab === 'assignments' && <Assignments />}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------

function SurveyQueue({ status }: { status: SurveyQueueStatus }) {
  const queue = useSurveyQueue(status);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => setSelected(null), [status]);
  const rows = queue.data ?? [];
  const active = selected ?? rows[0]?.id ?? null;
  const detail = useSurveyDetail(active);

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <aside className="w-full border border-slate-200 bg-white lg:w-72 lg:shrink-0">
        <p className="border-b border-slate-200 px-3 py-2 text-xs text-slate-500">
          {queue.isLoading ? 'Loading…' : `${rows.length} survey${rows.length === 1 ? '' : 's'}`}
        </p>
        {queue.isError && <p className="px-3 py-3 text-sm text-red-700">{errText(queue.error)}</p>}
        {!queue.isLoading && !queue.isError && rows.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-slate-500">
            Nothing here.{status === 'submitted' && ' Surveys synced from the field app appear here.'}
          </p>
        )}
        <ul className="max-h-[40rem] divide-y divide-slate-100 overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r.id)}
                className={`w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${r.id === active ? 'bg-teal-50' : ''}`}
              >
                <span className="font-semibold">{r.survey_no ? `Survey ${r.survey_no}` : 'Unlinked survey'}</span>
                <span className="text-slate-500"> · {r.village_name ?? r.project_code}</span>
                <span className="block text-xs text-slate-500">
                  {r.surveyor_name} ({r.surveyor_designation}) · {when(r.submitted_at)} · {r.vertex_count} pts
                </span>
                {r.flags.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {r.flags.map((f) => (
                      <Tag key={f} tone="warning">
                        {f}
                      </Tag>
                    ))}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="min-w-0 flex-1">
        {!active ? null : detail.isError ? (
          <p className="text-red-700">{errText(detail.error)}</p>
        ) : !detail.data ? (
          mapLoading()
        ) : (
          <SurveyWorkspace survey={detail.data} />
        )}
      </div>
    </div>
  );
}

function usePackWarnM(projectId: string) {
  const project = useProject(projectId);
  const pack = useRulePack(project.data?.rulePack?.code, project.data?.rulePack?.version);
  return pack.data?.thresholds.gpsAccuracyWarnM ?? null;
}

function SurveyWorkspace({ survey }: { survey: SurveyDetail }) {
  const warnM = usePackWarnM(survey.project_id);
  const flags = survey.plausibility?.flags ?? {};
  const perVertex = new Map((survey.plausibility?.vertices ?? []).map((v) => [v.seq, v.issues]));
  const rejected = new Set(survey.plausibility?.rejectedSeqs ?? []);

  const legend = (
    <div className="absolute bottom-2 left-2 z-[1000] rounded-md border border-slate-300 bg-white/95 p-2 text-[11px] text-slate-700 shadow-sm">
      <p className="flex items-center gap-1.5">
        <span className="inline-block w-4 border-t-2 border-dashed border-slate-500" /> Recorded parcel
      </p>
      <p className="flex items-center gap-1.5">
        <span className="inline-block w-4 border-t-2 border-blue-700" /> Walked boundary
      </p>
      <p className="flex items-center gap-1.5">
        <span className="inline-block w-4 border-t-2 border-violet-600" /> Walked track
      </p>
      <p className="mt-1">Vertex: ● ≤10 m · ● ≤{warnM ?? '…'} m · ● worse (larger dot = has photo)</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 xl:flex-row">
      <div className="min-w-0 flex-1 space-y-2">
        <SurveyMap survey={survey} warnM={warnM} overlay={legend} />
        <p className="text-xs text-slate-500">
          {survey.project_code} — {survey.project_name} · walked by {survey.surveyor_name} (
          {survey.surveyor_designation}) · started {when(survey.started_at)} · submitted {when(survey.submitted_at)}
        </p>
      </div>

      <aside className="w-full space-y-4 border border-slate-200 bg-white p-4 text-sm xl:w-96 xl:shrink-0">
        <div>
          <h2 className="text-base font-semibold">
            {survey.survey_no ? `Survey ${survey.survey_no}` : 'Survey'} · {survey.village_name ?? '—'}
          </h2>
          <p className="text-xs text-slate-500">
            {label(survey.status)}
            {survey.verified_by_designation && ` · by ${survey.verified_by_designation}`}
            {survey.verification_remarks && ` — ${survey.verification_remarks}`}
          </p>
          {survey.parcel_id && survey.status === 'verified' && survey.parcel_version != null && (
            <div className="mt-2">
              <ChainBadge entityType="land_parcel" entityId={survey.parcel_id} version={survey.parcel_version} />
            </div>
          )}
        </div>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plausibility checks</h3>
          {Object.keys(flags).length === 0 ? (
            <p className="mt-1 text-teal-800">All checks passed.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {Object.entries(flags).map(([k, msg]) => (
                <li key={k} role="alert" className="ux4g-alert ux4g-alert-warning">
                  <span className="font-mono font-semibold">{k}</span> — {CHECKS[k] ?? ''}
                  <span className="block">{msg}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Area</h3>
          <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <dt className="text-slate-500">Recorded</dt>
            <dd>{area(survey.recorded_area_sqm)}</dd>
            <dt className="text-slate-500">Field</dt>
            <dd>{area(survey.field_area_sqm)}</dd>
            <dt className="text-slate-500">Difference</dt>
            <dd className={Math.abs(Number(survey.area_diff_pct ?? 0)) > 5 ? 'font-semibold text-amber-800' : ''}>
              {survey.area_diff_pct != null ? `${Number(survey.area_diff_pct).toFixed(1)}%` : '—'}
            </dd>
          </dl>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Vertices ({survey.vertices.length})
          </h3>
          <ul className="mt-1 max-h-64 space-y-1 overflow-y-auto">
            {survey.vertices.map((v) => {
              const issues = perVertex.get(v.seq) ?? [];
              const acc = v.accuracy_m == null ? null : Number(v.accuracy_m);
              return (
                <li
                  key={v.seq}
                  className={`flex items-center gap-2 border px-2 py-1 text-xs ${rejected.has(v.seq) ? 'border-red-200 bg-red-50' : 'border-slate-100'}`}
                >
                  {v.photo_document_id ? (
                    <a href={doc(v.photo_document_id)} target="_blank" rel="noreferrer">
                      <img
                        src={doc(v.photo_document_id)}
                        alt={`Vertex ${v.seq}`}
                        className="h-10 w-10 rounded object-cover"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-400">
                      no photo
                    </span>
                  )}
                  <span className="flex-1">
                    <span className="font-semibold">#{v.seq}</span> ±{acc?.toFixed(1) ?? '—'} m
                    {v.samples_averaged ? ` · ${v.samples_averaged} fixes` : ''}
                    <span className="block text-slate-500">
                      captured {when(v.captured_at)} · synced {when(v.synced_at)}
                    </span>
                    {issues.length > 0 && <span className="block text-red-700">{issues.join(', ')}</span>}
                    {rejected.has(v.seq) && (
                      <span className="block text-red-700">discarded by the server (accuracy)</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">s.12 notice</h3>
          {survey.notice_served_on ? (
            <p className="mt-1 text-xs">
              Served {survey.notice_served_on}
              {survey.notice_document_id && (
                <>
                  {' · '}
                  <a
                    href={doc(survey.notice_document_id)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-700 hover:underline"
                  >
                    notice photo
                  </a>
                </>
              )}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">Not recorded.</p>
          )}
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Joint inspection ({survey.jirItems.length})
          </h3>
          {survey.jirItems.length === 0 ? (
            <p className="mt-1 text-xs text-slate-500">No items.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-xs">
              {survey.jirItems.map((j) => (
                <li key={j.id} className="flex items-center gap-2">
                  {j.photo_document_id && (
                    <img
                      src={doc(j.photo_document_id)}
                      alt=""
                      className="h-8 w-8 rounded object-cover"
                      loading="lazy"
                    />
                  )}
                  <span>
                    <span className="font-medium">{label(j.item_type)}</span>
                    {j.description && ` — ${j.description}`}
                    {j.quantity != null && ` · ${j.quantity} ${j.unit ?? ''}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {survey.pillars.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">{survey.pillars.length} boundary pillar(s) recorded.</p>
          )}
        </section>

        {survey.status === 'submitted' && survey.parcel_id && (
          <Decision survey={survey} flagged={Object.keys(flags).length > 0} />
        )}
        {survey.status === 'submitted' && !survey.parcel_id && (
          <p className="text-xs text-slate-500">This survey is not linked to a parcel, so it cannot be approved.</p>
        )}
      </aside>
    </div>
  );
}

function Decision({ survey, flagged }: { survey: SurveyDetail; flagged: boolean }) {
  const parcelId = survey.parcel_id!;
  const verify = useVerifyParcel(parcelId, survey.project_id);
  const giveBack = useReturnSurvey();
  const correct = useRequestCorrection(parcelId);
  const parcel = useParcel(parcelId);
  const [remarks, setRemarks] = useState('');
  const [override, setOverride] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Parcel-level spatial flags also need an override (the API checks both).
  const allFlagged =
    flagged || (parcel.data?.projects.some((p) => p.project_id === survey.project_id && p.flags.length > 0) ?? false);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    }
  }

  const walked = useMemo(() => {
    const rejected = new Set(survey.plausibility?.rejectedSeqs ?? []);
    const pts = survey.vertices.filter((v) => !rejected.has(v.seq)).map((v) => [Number(v.lng), Number(v.lat)]);
    return pts.length >= 3 ? { type: 'Polygon' as const, coordinates: [[...pts, pts[0]!]] } : null;
  }, [survey]);

  const input = 'ux4g-textarea mt-1 block w-full';
  return (
    <section className="space-y-3 border-t border-slate-200 pt-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Decision</h3>
      <label className="ux4g-textarea-container ux4g-textarea-default block text-xs">
        <span className="ux4g-label-s-default">Remarks</span>
        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={input} />
      </label>
      {allFlagged && (
        <label className="ux4g-textarea-container ux4g-textarea-default block text-xs">
          <span className="ux4g-label-s-strong text-amber-900">
            Override reason (required — this survey or parcel has flags)
          </span>
          <textarea value={override} onChange={(e) => setOverride(e.target.value)} rows={2} className={input} />
        </label>
      )}
      <button
        type="button"
        disabled={verify.isPending || (allFlagged && !override.trim())}
        onClick={() =>
          void run(
            () =>
              verify.mutateAsync({
                remarks: remarks.trim() || null,
                overrideReason: allFlagged ? override.trim() : null,
              }),
            'Approved — the parcel is VERIFIED and queued for anchoring.',
          )
        }
        className="ux4g-btn-primary ux4g-btn-m w-full"
      >
        Approve
      </button>

      <label className="ux4g-textarea-container ux4g-textarea-default block text-xs">
        <span className="ux4g-label-s-default">Reason (for return or correction)</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={input} />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={giveBack.isPending || reason.trim().length < 5}
          onClick={() =>
            void run(() => giveBack.mutateAsync({ id: survey.id, reason: reason.trim() }), 'Returned to the surveyor.')
          }
          className="ux4g-btn-outline-primary ux4g-btn-s flex-1"
        >
          Return to surveyor
        </button>
        <button
          type="button"
          disabled={correct.isPending || reason.trim().length < 5 || !walked}
          title={walked ? 'Proposes the walked boundary as the corrected geometry' : 'Needs at least 3 usable vertices'}
          onClick={() =>
            void run(
              () => correct.mutateAsync({ geometry: walked, reason: reason.trim() }),
              'Correction requested — a different post decides it under "Corrections to decide".',
            )
          }
          className="ux4g-btn-outline-primary ux4g-btn-s flex-1"
        >
          Request correction
        </button>
      </div>
      {msg && <p className={`text-xs ${msg.ok ? 'text-teal-800' : 'text-red-700'}`}>{msg.text}</p>}
    </section>
  );
}

// ------------------------------------------------------------------------------------------------

function Corrections({ myPostId }: { myPostId: string | null }) {
  const q = useCorrections('requested');
  const [selected, setSelected] = useState<string | null>(null);
  const rows = q.data ?? [];
  const active = rows.find((r) => r.id === selected) ?? rows[0] ?? null;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <aside className="w-full border border-slate-200 bg-white lg:w-72 lg:shrink-0">
        <p className="border-b border-slate-200 px-3 py-2 text-xs text-slate-500">
          {q.isLoading ? 'Loading…' : `${rows.length} waiting`}
        </p>
        {q.isError && <p className="px-3 py-3 text-sm text-red-700">{errText(q.error)}</p>}
        {!q.isLoading && rows.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-slate-500">No corrections to decide.</p>
        )}
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r.id)}
                className={`w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${r.id === active?.id ? 'bg-teal-50' : ''}`}
              >
                <span className="font-semibold">Survey {r.survey_no}</span> · {r.village_name}
                <span className="block text-xs text-slate-500">
                  v{r.from_version} → v{r.from_version + 1} · by {r.requested_by_designation} · {when(r.created_at)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="min-w-0 flex-1">
        {active && <CorrectionDecision c={active} mine={active.requested_by_post_id === myPostId} />}
      </div>
    </div>
  );
}

function CorrectionDecision({ c, mine }: { c: CorrectionRow; mine: boolean }) {
  const decide = useDecideCorrection(c.parcel_id);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const stale = c.current_version !== c.from_version;

  async function go(approve: boolean) {
    setMsg(null);
    try {
      await decide.mutateAsync({ correctionId: c.id, approve });
      setMsg({
        ok: true,
        text: approve
          ? `Approved — the parcel is now v${c.from_version + 1}.`
          : 'Rejected — the boundary is unchanged.',
      });
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    }
  }

  return (
    <div className="space-y-3">
      <CorrectionDiffMap from={c.from_geometry} to={c.proposed_geometry} />
      <div className="space-y-2 border border-slate-200 bg-white p-4 text-sm">
        <p className="text-xs text-slate-500">
          <span className="inline-block w-4 border-t-2 border-dashed border-slate-500 align-middle" /> v{c.from_version}{' '}
          (current){'  '}
          <span className="ml-3 inline-block w-4 border-t-2 border-amber-600 align-middle" /> proposed v
          {c.from_version + 1}
        </p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-slate-500">Area now</dt>
          <dd>{area(c.current_area_sqm)}</dd>
          <dt className="text-slate-500">Area proposed</dt>
          <dd>{area(c.proposed_area_sqm)}</dd>
          <dt className="text-slate-500">Requested by</dt>
          <dd>
            {c.requested_by_designation} · {when(c.created_at)}
          </dd>
        </dl>
        <p>
          <span className="text-slate-500">Reason:</span> {c.reason}
        </p>
        {stale && (
          <p className="text-xs text-amber-800">
            The parcel has changed since this was requested (now v{c.current_version}).
          </p>
        )}
        {mine ? (
          <p className="text-xs text-slate-600">
            You requested this correction — a different post must decide it (G20).
          </p>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void go(true)}
              disabled={decide.isPending}
              className="ux4g-btn-primary ux4g-btn-s"
            >
              Approve v{c.from_version + 1}
            </button>
            <button
              type="button"
              onClick={() => void go(false)}
              disabled={decide.isPending}
              className="ux4g-btn-outline-danger ux4g-btn-s"
            >
              Reject
            </button>
          </div>
        )}
        {msg && <p className={`text-xs ${msg.ok ? 'text-teal-800' : 'text-red-700'}`}>{msg.text}</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------

function Assignments() {
  const q = useAssignments();
  const rows = q.data ?? [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Parcels in your scope that still need a field survey — <span className="text-red-700">red</span>: no surveyed
        boundary yet, <span className="text-blue-700">blue</span>: awaiting verification. Field officers walk them in
        the field app.
      </p>
      {q.isError && <p className="text-sm text-red-700">{errText(q.error)}</p>}
      <AssignmentsMap rows={rows} />
      <div className="ux4g-table-responsive border border-slate-200 bg-white">
        <table className="ux4g-table ux4g-table-s w-full">
          <thead>
            <tr>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Survey no.</th>
              <th className="px-3 py-2">Village</th>
              <th className="px-3 py-2">Boundary</th>
              <th className="px-3 py-2">Last survey</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.project_parcel_id}>
                <td className="px-3 py-1.5">{r.project_code}</td>
                <td className="px-3 py-1.5 font-semibold">{r.survey_no}</td>
                <td className="px-3 py-1.5">{r.village_name}</td>
                <td className="px-3 py-1.5">{label(r.boundary_source)}</td>
                <td className="px-3 py-1.5">{label(r.last_survey_status ?? 'not surveyed')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!q.isLoading && rows.length === 0 && (
          <p className="px-3 py-4 text-sm text-slate-500">No parcels waiting for a survey.</p>
        )}
      </div>
    </div>
  );
}
