'use client';

import { formatDate } from '@bhoomisetu/shared';
import { useState } from 'react';
import { ChainBadge } from '@/components/chain-badge';
import { ApiProblem } from '@/lib/api';
import {
  useDecideCorrection,
  useParcel,
  useRequestCorrection,
  useVerifyParcel,
  type ParcelDetail as ParcelDetailType,
} from '@/lib/parcels-api';

function sqm(v: string | null): string {
  if (v === null) return '—';
  return `${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 1 })} m²`;
}

export function ParcelDetail({ parcelId, projectId, onClose }: { parcelId: string; projectId: string; onClose: () => void }) {
  const { data, isLoading, error } = useParcel(parcelId);

  if (error) return <Panel onClose={onClose}><p className="text-red-700">Could not load this parcel.</p></Panel>;
  if (isLoading || !data) return <Panel onClose={onClose}><p className="text-slate-500">Loading…</p></Panel>;

  const allFlags = [
    ...new Set([
      ...data.projects.find((p) => p.project_id === projectId)?.flags ?? [],
      ...data.surveys.flatMap((s) => Object.keys(s.plausibility?.flags ?? {})),
    ]),
  ];

  return (
    <Panel onClose={onClose}>
      <h3 className="text-sm font-semibold text-slate-900">{data.survey_no}</h3>
      <p className="text-xs text-slate-500">{data.village_name} · v{data.version}</p>
      <div className="mt-2">
        <ChainBadge entityType="land_parcel" entityId={data.id} version={data.version} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Recorded area</dt>
          <dd className="font-medium text-slate-900">{sqm(data.recorded_area_sqm)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Field area</dt>
          <dd className="font-medium text-slate-900">{sqm(data.field_area_sqm)}</dd>
        </div>
        {data.area_diff_pct !== null && (
          <div className="col-span-2">
            <dt className="text-xs text-slate-500">Area difference</dt>
            <dd className={`font-medium ${Math.abs(Number(data.area_diff_pct)) > 5 ? 'text-amber-700' : 'text-slate-900'}`}>
              {Number(data.area_diff_pct).toFixed(1)}%
            </dd>
          </div>
        )}
      </dl>

      {allFlags.length > 0 && (
        <div className="mt-3 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-semibold">Flags</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {allFlags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <VertexList data={data} />
      <NoticeStatus data={data} />
      <VerifyForm parcelId={parcelId} projectId={projectId} requiresOverride={allFlags.length > 0} />
      <Corrections data={data} parcelId={parcelId} />
    </Panel>
  );
}

function Panel({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="w-full max-w-sm shrink-0 border border-slate-200 bg-white p-4">
      <button onClick={onClose} className="float-right text-xs text-slate-400 hover:text-slate-700">
        Close
      </button>
      {children}
    </div>
  );
}

function VertexList({ data }: { data: ParcelDetailType }) {
  if (!data.vertices.length) return null;
  return (
    <div className="mt-4">
      <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">Vertices</h4>
      <ul className="mt-2 space-y-2">
        {data.vertices.map((v) => {
          const accuracy = Number(v.accuracy_m);
          const badge = accuracy <= 10 ? 'text-teal-700' : accuracy <= 20 ? 'text-amber-700' : 'text-red-700';
          return (
            <li key={v.id} className="flex items-center gap-2 text-xs">
              {v.photo_document_id ? (
                <img
                  src={`/api/v1/documents/${v.photo_document_id}/download`}
                  alt={`vertex ${v.seq}`}
                  className="h-10 w-10 shrink-0 rounded border border-slate-200 object-cover"
                />
              ) : (
                <span className="h-10 w-10 shrink-0 rounded border border-slate-200 bg-slate-50" />
              )}
              <span className="text-slate-600">#{v.seq}</span>
              <span className={`font-medium ${badge}`}>±{accuracy.toFixed(0)}m</span>
              <span className="text-slate-400">{v.capture_method}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NoticeStatus({ data }: { data: ParcelDetailType }) {
  const survey = data.surveys[0];
  if (!survey) return null;
  return (
    <div className="mt-4 text-xs text-slate-600">
      <span className="font-medium text-slate-700">s.12 notice: </span>
      {survey.notice_served_on ? `served ${formatDate(survey.notice_served_on)}` : 'not served'}
    </div>
  );
}

function VerifyForm({ parcelId, projectId, requiresOverride }: { parcelId: string; projectId: string; requiresOverride: boolean }) {
  const verify = useVerifyParcel(parcelId, projectId);
  const [remarks, setRemarks] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = !requiresOverride || overrideReason.trim().length > 0;

  async function submit() {
    setError(null);
    try {
      await verify.mutateAsync({ remarks: remarks || null, overrideReason: overrideReason || null });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiProblem ? e.message : 'Verification failed.');
    }
  }

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">Verify</h4>
      <label className="mt-2 block text-sm">
        <span className="text-slate-700">Remarks</span>
        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      {requiresOverride && (
        <label className="mt-2 block text-sm">
          <span className="text-slate-700">Override reason (required — flags present)</span>
          <textarea
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border border-amber-300 px-2 py-1.5 text-sm"
          />
        </label>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {done && <p className="mt-2 text-sm text-teal-700">Verified.</p>}
      <button
        onClick={() => void submit()}
        disabled={!canSubmit || verify.isPending}
        className="mt-2 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {verify.isPending ? 'Verifying…' : 'Verify parcel'}
      </button>
    </div>
  );
}

function Corrections({ data, parcelId }: { data: ParcelDetailType; parcelId: string }) {
  const request = useRequestCorrection(parcelId);
  const decide = useDecideCorrection(parcelId);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submitRequest() {
    setError(null);
    try {
      await request.mutateAsync({ geometry: data.geometry, reason });
      setOpen(false);
      setReason('');
    } catch (e) {
      setError(e instanceof ApiProblem ? e.message : 'Request failed.');
    }
  }

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">Corrections (version lineage)</h4>
        <button onClick={() => setOpen((v) => !v)} className="text-xs font-medium text-teal-700 hover:underline">
          Request correction
        </button>
      </div>

      {open && (
        <div className="mt-2">
          <p className="text-xs text-slate-500">Uses the current boundary as the proposed geometry — edit reason only.</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Reason for correction"
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
          <button
            onClick={() => void submitRequest()}
            disabled={!reason.trim() || request.isPending}
            className="mt-2 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            Submit request
          </button>
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {[...data.versions.map((v) => ({ version: v.version, kind: 'version' as const })), ...data.corrections.map((c) => ({ ...c, kind: 'correction' as const }))].map(
          (item, i) =>
            item.kind === 'version' ? (
              <li key={`v${item.version}-${i}`} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">v{item.version}</span>
                <ChainBadge entityType="land_parcel" entityId={data.id} version={item.version} />
              </li>
            ) : (
              <li key={item.id} className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">
                    v{item.from_version} → v{item.to_version ?? '?'} · {item.status}
                  </span>
                  {item.status === 'requested' && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => decide.mutate({ correctionId: item.id, approve: true })}
                        className="rounded border border-teal-300 px-1.5 py-0.5 text-teal-700 hover:bg-teal-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => decide.mutate({ correctionId: item.id, approve: false })}
                        className="rounded border border-red-300 px-1.5 py-0.5 text-red-700 hover:bg-red-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-slate-500">{item.reason}</p>
              </li>
            ),
        )}
      </ul>
    </div>
  );
}
