'use client';

import type { ActionOption } from '@bhoomisetu/rules';
import { useState } from 'react';
import { AttestationModal } from '@/components/attestation-modal';
import { ApiProblem } from '@/lib/api';
import { useActOnStage, useStageActions, useTimeline, type TimelineStage } from '@/lib/project-api';

const REASONED = new Set(['RETURN', 'REJECT', 'NULLIFY', 'TERMINATE']);

/**
 * The generic action panel (§13) — the single form every module reuses. Never a bespoke
 * "approve X" button: it reads whatever GET .../actions returns and renders exactly that.
 */
export function ActionPanel({ projectId, stageCode, stages }: { projectId: string; stageCode: string; stages: TimelineStage[] }) {
  const { data, isLoading } = useStageActions(projectId, stageCode);
  const timeline = useTimeline(projectId);

  if (isLoading || !data) return <p className="text-sm text-slate-500">Loading actions…</p>;

  return (
    <div className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{data.stageName}</h3>
        <p className="text-xs text-slate-500">{data.status} · attempt {data.attempt ?? '—'}</p>
      </div>

      {data.checklist.length > 0 && (
        <ul className="divide-y divide-slate-100 border-b border-slate-200">
          {data.checklist.map((c) => (
            <li key={c.code} className="flex items-center gap-2 px-4 py-2 text-sm">
              <span
                aria-hidden
                className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                  c.satisfied ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {c.satisfied ? '✓' : '·'}
              </span>
              <span className={c.satisfied ? 'text-slate-700' : 'text-slate-500'}>{c.code}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 px-4 py-3">
        {data.actions.length === 0 && <p className="text-sm text-slate-500">No actions available to your post.</p>}
        {data.actions.map((a) => (
          <ActionButton
            key={a.action}
            action={a}
            projectId={projectId}
            stageCode={stageCode}
            stages={stages}
            onDone={() => void timeline.refetch()}
          />
        ))}
      </div>
    </div>
  );
}

function ActionButton({
  action,
  projectId,
  stageCode,
  stages,
  onDone,
}: {
  action: ActionOption;
  projectId: string;
  stageCode: string;
  stages: TimelineStage[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const failureText = action.failures.map((f) => f.message).join('; ');

  return (
    <div className="relative">
      <button
        onClick={() => action.allowed && setOpen(true)}
        disabled={!action.allowed}
        title={action.allowed ? undefined : failureText}
        className={`rounded-md px-3 py-1.5 text-sm font-medium ${
          action.allowed
            ? 'bg-teal-700 text-white hover:bg-teal-800'
            : 'cursor-not-allowed bg-slate-100 text-slate-400'
        }`}
      >
        {action.action}
      </button>
      {open && (
        <ActionForm
          action={action}
          projectId={projectId}
          stageCode={stageCode}
          stages={stages}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            onDone();
          }}
        />
      )}
    </div>
  );
}

function ActionForm({
  action,
  projectId,
  stageCode,
  stages,
  onClose,
  onDone,
}: {
  action: ActionOption;
  projectId: string;
  stageCode: string;
  stages: TimelineStage[];
  onClose: () => void;
  onDone: () => void;
}) {
  const act = useActOnStage(projectId, stageCode);
  const [reasonCode, setReasonCode] = useState('');
  const [remarks, setRemarks] = useState('');
  const [targetStageCode, setTargetStageCode] = useState('');
  const [writtenReasons, setWrittenReasons] = useState('');
  const [conditions, setConditions] = useState('');
  const [attest, setAttest] = useState(false);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [failures, setFailures] = useState<Array<{ code: string; message: string }>>([]);

  const needsReason = REASONED.has(action.action);
  const needsTarget = action.action === 'RETURN';
  const needsWritten = action.action === 'OVERRIDE' || action.requiresWrittenReasons;
  const needsConditions = action.action === 'APPROVE_CONDITIONAL';
  const earlierStages = stages.filter((s) => s.code !== stageCode);

  const canSubmit =
    (!needsReason || reasonCode) && (!needsWritten || writtenReasons.trim()) && (!action.requiresAttestation || attest);

  async function submit() {
    setFailures([]);
    try {
      await act.mutateAsync({
        action: action.action,
        reasonCode: needsReason ? reasonCode : null,
        remarks: remarks || null,
        targetStageCode: needsTarget && targetStageCode ? targetStageCode : null,
        writtenReasons: needsWritten ? writtenReasons : null,
        conditions: needsConditions ? conditions : null,
        documentIds,
        attest,
      });
      onDone();
    } catch (e) {
      if (e instanceof ApiProblem && e.code === 'GUARD_FAILED') {
        setFailures((e.extra.failures as Array<{ code: string; message: string }>) ?? []);
      } else {
        setFailures([{ code: 'ERROR', message: e instanceof Error ? e.message : 'Action failed.' }]);
      }
    }
  }

  return (
    <div className="absolute left-0 top-full z-20 mt-1 w-80 border border-slate-300 bg-white p-4 shadow-lg">
      <h4 className="text-sm font-semibold text-slate-900">{action.action}</h4>

      {needsReason && (
        <label className="mt-3 block text-sm">
          <span className="text-slate-700">Reason code</span>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Select a reason…</option>
            {action.reasonCodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
      )}

      {needsTarget && (
        <label className="mt-3 block text-sm">
          <span className="text-slate-700">Return to stage (optional — default: same stage)</span>
          <select
            value={targetStageCode}
            onChange={(e) => setTargetStageCode(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Same stage</option>
            {earlierStages.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {needsWritten && (
        <label className="mt-3 block text-sm">
          <span className="text-slate-700">Written reasons {action.action === 'OVERRIDE' && '(s.8(2), required)'}</span>
          <textarea
            value={writtenReasons}
            onChange={(e) => setWrittenReasons(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
      )}

      {needsConditions && (
        <label className="mt-3 block text-sm">
          <span className="text-slate-700">Conditions</span>
          <textarea
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
      )}

      <label className="mt-3 block text-sm">
        <span className="text-slate-700">Remarks</span>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>

      <div className="mt-3">
        <button type="button" onClick={() => setShowUpload(true)} className="text-xs font-medium text-teal-700 hover:underline">
          Attach supporting document{documentIds.length > 0 ? ` (${documentIds.length})` : ''}
        </button>
      </div>

      {action.requiresAttestation && (
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={attest} onChange={(e) => setAttest(e.target.checked)} />
          <span className="text-slate-700">I attest to this action.</span>
        </label>
      )}

      {failures.length > 0 && (
        <ul className="mt-3 space-y-1 border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {failures.map((f, i) => (
            <li key={i}>{f.message}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
          Cancel
        </button>
        <button
          onClick={() => void submit()}
          disabled={!canSubmit || act.isPending}
          className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {act.isPending ? 'Submitting…' : 'Submit'}
        </button>
      </div>

      <AttestationModal
        projectId={projectId}
        entityType="project"
        entityId={projectId}
        docType="OTHER"
        title="Supporting document"
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onUploaded={(id) => setDocumentIds((ids) => [...ids, id])}
      />
    </div>
  );
}
