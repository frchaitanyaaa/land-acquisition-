'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { AttestationModal } from '@/components/attestation-modal';
import { api, ApiProblem } from '@/lib/api';
import { formatMoney } from '@/lib/format';

export interface ChecklistItem {
  code: string;
  type: string;
  docType?: string;
  hearingType?: string;
  required: boolean;
  satisfied: boolean;
}

const words = (code: string) => code.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/**
 * One stage checklist item (§12.6) with the step that satisfies it, so a stage can actually move:
 * a document item opens the attested upload (G21); an escrow gate opens demand → deposit → certify; an
 * objections gate links to the objections tab. Items are satisfied by evidence — the API re-checks them.
 */
export function ChecklistRow({
  projectId,
  stageCode,
  item,
  onChanged,
}: {
  projectId: string;
  stageCode: string;
  item: ChecklistItem;
  onChanged: () => void;
}) {
  const [upload, setUpload] = useState(false);
  const [escrowOpen, setEscrowOpen] = useState(false);
  const gate = item.code === 'ESCROW_FULL_CERTIFIED' ? 'FULL' : item.code === 'ESCROW_INITIAL_FUNDED' ? 'INITIAL' : null;

  return (
    <li className="px-4 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden
          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
            item.satisfied ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {item.satisfied ? '✓' : '·'}
        </span>
        <span className={item.satisfied ? 'text-slate-700' : 'text-slate-900'}>{words(item.code)}</span>
        <span className="text-xs text-slate-500">
          {item.type === 'document' ? 'attested document' : item.type}
          {item.satisfied ? ' · done' : item.required ? ' · required' : ''}
        </span>
        {!item.satisfied && (
          <span className="ml-auto">
            {item.type === 'document' && item.docType && (
              <button type="button" onClick={() => setUpload(true)} className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-xs">
                Upload &amp; attest
              </button>
            )}
            {gate && (
              <button
                type="button"
                aria-expanded={escrowOpen}
                onClick={() => setEscrowOpen((o) => !o)}
                className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-xs"
              >
                {escrowOpen ? 'Close escrow' : 'Escrow steps'}
              </button>
            )}
            {item.code === 'OBJECTIONS_DISPOSED' && (
              <Link href={`/project/${projectId}/objections`} className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-xs">
                Decide objections
              </Link>
            )}
            {item.type === 'hearing' && <span className="text-xs text-slate-500">needs a valid {words(item.hearingType ?? 'hearing')}</span>}
          </span>
        )}
      </div>
      {gate && escrowOpen && !item.satisfied && <EscrowSteps projectId={projectId} gate={gate} onChanged={onChanged} />}
      {item.docType && (
        <AttestationModal
          projectId={projectId}
          entityType="project"
          entityId={projectId}
          docType={item.docType}
          title={`${words(item.docType)} (${stageCode})`}
          open={upload}
          onClose={() => setUpload(false)}
          onUploaded={onChanged}
        />
      )}
    </li>
  );
}

interface EscrowRow {
  gate: 'INITIAL' | 'FULL';
  demandAmountPaise: string | null;
  depositedAmountPaise: string | null;
  status: string;
}

/** §14 step 5 / §20: demand note → deposits → sufficiency certificate. Each step is role-checked by the API. */
function EscrowSteps({ projectId, gate, onChanged }: { projectId: string; gate: 'INITIAL' | 'FULL'; onChanged: () => void }) {
  const qc = useQueryClient();
  const key = ['project-escrow', projectId];
  const { data } = useQuery({ queryKey: key, queryFn: () => api<{ escrow?: EscrowRow[] }>(`/projects/${projectId}`) });
  const account = data?.escrow?.find((e) => e.gate === gate);
  const [amount, setAmount] = useState('');
  const step = useMutation({
    mutationFn: (s: 'demand' | 'deposits' | 'certify') =>
      api(`/projects/${projectId}/escrow/${gate}/${s}`, {
        method: 'POST',
        body: s === 'certify' ? '{}' : JSON.stringify({ amountRupees: amount, ...(s === 'deposits' ? { reference: 'Demo deposit' } : {}) }),
      }),
    onSuccess: () => {
      setAmount('');
      void qc.invalidateQueries({ queryKey: key });
      onChanged();
    },
  });
  const demand = account?.demandAmountPaise ? BigInt(account.demandAmountPaise) : 0n;
  const deposited = account?.depositedAmountPaise ? BigInt(account.depositedAmountPaise) : 0n;

  return (
    <div className="mt-2 space-y-2 rounded border border-slate-200 bg-slate-50 p-3 text-xs">
      <p className="text-slate-700">
        {account
          ? `Demand ${formatMoney(demand.toString())} · deposited ${formatMoney(deposited.toString())} · ${account.status}`
          : 'No demand note raised yet.'}{' '}
        Amounts are entered by the officer; the system does not compute them (G1).
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label>
          <span className="block text-slate-700">Amount (₹)</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="input mt-1 w-40" placeholder="e.g. 250000000" />
        </label>
        <button type="button" disabled={!amount || step.isPending} onClick={() => step.mutate('demand')} className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-xs">
          1 · Raise demand
        </button>
        <button type="button" disabled={!amount || !account || step.isPending} onClick={() => step.mutate('deposits')} className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-xs">
          2 · Record deposit
        </button>
        <button
          type="button"
          disabled={!account || deposited < demand || step.isPending}
          onClick={() => step.mutate('certify')}
          className="ux4g-btn ux4g-btn-primary ux4g-btn-xs"
        >
          3 · Certify sufficiency
        </button>
      </div>
      {step.error && <p className="text-red-700">{step.error instanceof ApiProblem ? step.error.message : 'That step failed.'}</p>}
    </div>
  );
}
