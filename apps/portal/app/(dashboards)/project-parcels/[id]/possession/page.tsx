'use client';

import { use, useState } from 'react';
import { AttestationModal } from '@/components/attestation-modal';
import { ApiProblem } from '@/lib/api';
import { usePossessionGate, useTakePossession } from '@/lib/money-api';

/** Every condition the gate evaluates (packages/rules/src/engine/possession.ts, §12.6). */
const CONDITIONS: Array<{ codes: string[]; label: string }> = [
  { codes: ['LAND_HEAD_UNSETTLED'], label: 'Every land compensation head is acknowledged by the family or deposited with the Authority' },
  { codes: ['RNR_HEAD_UNSETTLED'], label: 'Monetary R&R of every displaced family is acknowledged or deposited' },
  { codes: ['SITE_NOT_READY'], label: 'Resettlement site is 100% ready for every displaced family' },
  { codes: ['VACATION_CERTIFICATE_MISSING'], label: 'Vacation certificate is uploaded and attested' },
  { codes: ['LEGAL_STAY'], label: 'No legal stay is in force on the parcel' },
];

type DocKey = 'vacation' | 'panchnama' | 'notice' | 'certificate' | 'handover';
const DOCS: Record<DocKey, { docType: string; title: string; required?: boolean }> = {
  vacation: { docType: 'VACATION_CERTIFICATE', title: 'Vacation certificate (a gate condition)', required: true },
  panchnama: { docType: 'POSSESSION_PANCHNAMA', title: 'Possession panchnama', required: true },
  notice: { docType: 'S38_POSSESSION_NOTICE', title: 's.38 possession notice' },
  certificate: { docType: 'CERTIFICATE_OF_POSSESSION', title: 'Certificate of possession' },
  handover: { docType: 'HANDOVER_CERTIFICATE', title: 'Handover certificate' },
};

/**
 * Possession (§21.3). The gate is rendered as a checklist; "Take possession" stays disabled until
 * it passes, and every failure is shown with the server's exact reason.
 */
export default function PossessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: gate, isLoading, error, refetch } = usePossessionGate(id);
  const take = useTakePossession(id);
  const [docs, setDocs] = useState<Partial<Record<DocKey, string>>>({});
  const [uploading, setUploading] = useState<DocKey | null>(null);
  const [witnesses, setWitnesses] = useState('');
  const [result, setResult] = useState<{ ok: boolean; lines: string[] } | null>(null);

  if (error) return <p className="text-red-700">Could not load the possession gate.</p>;
  if (isLoading || !gate) return <p className="text-slate-500">Loading…</p>;

  const possessed = gate.status === 'ACQUIRED_POSSESSED';
  const witnessList = witnesses
    .split('\n')
    .map((w) => w.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
  const canSubmit = gate.allowed && !possessed && !!docs.panchnama && witnessList.length > 0;

  async function submit() {
    setResult(null);
    try {
      await take.mutateAsync({
        panchnamaDocumentId: docs.panchnama!,
        noticeDocumentId: docs.notice ?? null,
        possessionCertificateDocumentId: docs.certificate ?? null,
        handoverDocumentId: docs.handover ?? null,
        vacationCertificateDocumentId: docs.vacation ?? null,
        witnesses: witnessList,
      });
      setResult({ ok: true, lines: ['Possession recorded. The parcel is now acquired and possessed.'] });
    } catch (e) {
      const failures = e instanceof ApiProblem ? ((e.extra.failures as Array<{ message: string }> | undefined) ?? []) : [];
      setResult({ ok: false, lines: failures.length ? failures.map((f) => f.message) : [e instanceof Error ? e.message : 'Refused.'] });
      void refetch();
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Possession</h1>
        <p className="text-sm text-slate-600">
          Project parcel · status {gate.status.replace(/_/g, ' ').toLowerCase()} · {gate.families} famil{gate.families === 1 ? 'y' : 'ies'},{' '}
          {gate.entitlements} entitlement heads
        </p>
      </div>

      <section className="border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold">Possession gate (s.38)</h2>
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${gate.allowed ? 'bg-teal-50 text-teal-800' : 'bg-red-50 text-red-800'}`}>
            {gate.allowed ? 'Passes' : `${gate.failures.length} blocking`}
          </span>
        </div>
        <ul className="divide-y divide-slate-100">
          {CONDITIONS.map((c) => {
            const fails = gate.failures.filter((f) => c.codes.includes(f.code));
            return (
              <li key={c.label} className="px-4 py-2.5 text-sm">
                <div className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                      fails.length ? 'bg-red-100 text-red-800' : 'bg-teal-100 text-teal-800'
                    }`}
                  >
                    {fails.length ? '✗' : '✓'}
                  </span>
                  <span className={fails.length ? 'text-slate-900' : 'text-slate-600'}>{c.label}</span>
                </div>
                {fails.length > 0 && (
                  <ul className="ml-6 mt-1 list-disc space-y-0.5 pl-4 text-xs text-red-800">
                    {fails.map((f, i) => (
                      <li key={i}>{f.message}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
          {gate.failures
            .filter((f) => !CONDITIONS.some((c) => c.codes.includes(f.code)))
            .map((f, i) => (
              <li key={`x${i}`} className="px-4 py-2.5 text-sm text-red-800">
                ✗ {f.message}
              </li>
            ))}
        </ul>
      </section>

      {possessed ? (
        <p className="border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">Possession has been taken for this parcel.</p>
      ) : (
        <section className="space-y-3 border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Panchnama and certificates</h2>
          <ul className="space-y-2 text-sm">
            {(Object.keys(DOCS) as DocKey[]).map((k) => (
              <li key={k} className="flex items-center justify-between gap-3">
                <span>
                  {DOCS[k].title}
                  {DOCS[k].required && <span className="text-red-700"> *</span>}
                </span>
                {docs[k] ? (
                  <span className="text-xs text-teal-800">✓ attested &amp; uploaded</span>
                ) : (
                  <button onClick={() => setUploading(k)} className="text-xs font-medium text-teal-700 hover:underline">
                    Upload
                  </button>
                )}
              </li>
            ))}
          </ul>
          <label className="block text-sm">
            <span className="text-slate-700">
              Witnesses <span className="text-red-700">*</span> (one name per line)
            </span>
            <textarea value={witnesses} onChange={(e) => setWitnesses(e.target.value)} rows={3} className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <button
            onClick={() => void submit()}
            disabled={!canSubmit || take.isPending}
            title={gate.allowed ? undefined : 'The possession gate does not pass'}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            {take.isPending ? 'Recording…' : 'Take possession'}
          </button>
          {!gate.allowed && <p className="text-xs text-slate-500">Disabled until every condition above passes.</p>}
          {result && (
            <ul className={`space-y-1 border p-2 text-sm ${result.ok ? 'border-teal-200 bg-teal-50 text-teal-900' : 'border-red-200 bg-red-50 text-red-800'}`}>
              {result.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {uploading && (
        <AttestationModal
          projectId={gate.projectId}
          entityType="project_parcel"
          entityId={id}
          docType={DOCS[uploading].docType}
          title={DOCS[uploading].title}
          open
          onClose={() => setUploading(null)}
          onUploaded={(docId) => {
            const k = uploading;
            if (!k) return;
            setDocs((d) => ({ ...d, [k]: docId }));
            // the vacation certificate is itself a gate condition — re-evaluate
            if (k === 'vacation') void refetch();
          }}
        />
      )}
    </div>
  );
}
