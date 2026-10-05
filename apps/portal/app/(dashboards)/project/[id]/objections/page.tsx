'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { use, useState } from 'react';
import { AdvisoryBadge } from '@/components/ui/badges';
import { EmptyState } from '@/components/ui/empty-state';
import { api, ApiProblem } from '@/lib/api';

interface Objection {
  id: string;
  channel: string;
  filedAt: string;
  language: string | null;
  body: string;
  statutoryGround: string | null;
  operationalCategory: string | null;
  aiSuggestedGround: string | null;
  aiSuggestedCategory: string | null;
  aiConfidence: string | number | null;
  status: string;
  decisionRemarks: string | null;
  decidedAt: string | null;
}

const words = (s: string | null) =>
  s
    ? s
        .replace(/^[A-C]_/, '')
        .replace(/_/g, ' ')
        .toLowerCase()
    : null;
const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));
const OPEN = new Set(['FILED', 'SCHEDULED', 'HEARD']);

/**
 * s.15 objections on a project (§18.3). The AI triage only suggests a ground (ai_suggested_*, G3); the officer
 * records the decision. The API decides who may decide.
 */
export default function ObjectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['objections', id],
    queryFn: () => api<Objection[]>(`/projects/${id}/objections`),
  });

  if (isLoading) return <p className="text-sm text-slate-600">Loading objections…</p>;
  if (error) return <p className="text-sm text-red-700">{(error as Error).message}</p>;
  const rows = data ?? [];
  const open = rows.filter((o) => OPEN.has(o.status)).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700">
        {rows.length} objections · {open} open. All must be decided before the s.19 declaration (checklist item
        OBJECTIONS_DISPOSED).
      </p>
      {rows.length === 0 ? (
        <EmptyState title="No objections" description="None have been filed on this project." />
      ) : (
        <ul className="space-y-3">
          {rows.map((o) => (
            <ObjectionCard
              key={o.id}
              o={o}
              onDone={() => void qc.invalidateQueries({ queryKey: ['objections', id] })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ObjectionCard({ o, onDone }: { o: Objection; onDone: () => void }) {
  const [remarks, setRemarks] = useState('');
  const decide = useMutation({
    mutationFn: (decision: 'UPHELD' | 'REJECTED') =>
      api(`/objections/${o.id}/decide`, { method: 'POST', body: JSON.stringify({ decision, remarks }) }),
    onSuccess: onDone,
  });
  const isOpen = OPEN.has(o.status);

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <span>
          Filed {fmt(o.filedAt)} · via {o.channel.replace(/_/g, ' ')}
          {o.language ? ` · ${o.language}` : ''}
        </span>
        <span
          className={`rounded px-2 py-0.5 font-medium ${o.status === 'UPHELD' ? 'bg-amber-100 text-amber-900' : o.status === 'REJECTED' ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-900'}`}
        >
          {o.status}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-900">{o.body}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {o.statutoryGround ? (
          <span>
            Ground (officer): <strong>{words(o.statutoryGround)}</strong>
            {o.operationalCategory ? ` · ${words(o.operationalCategory)}` : ''}
          </span>
        ) : o.aiSuggestedGround ? (
          <span className="flex items-center gap-1">
            <AdvisoryBadge label="AI suggestion" /> {words(o.aiSuggestedGround)}
            {o.aiSuggestedCategory ? ` · ${words(o.aiSuggestedCategory)}` : ''}
            {o.aiConfidence != null ? ` · confidence ${Math.round(Number(o.aiConfidence) * 100)}%` : ''}
          </span>
        ) : (
          <span className="text-slate-500">Not yet classified</span>
        )}
      </div>
      {o.decisionRemarks && <p className="mt-2 text-xs text-slate-700">Decision: {o.decisionRemarks}</p>}
      {isOpen && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <label className="min-w-64 flex-1 text-xs">
            <span className="text-slate-700">Remarks for the decision</span>
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="input mt-1 w-full" />
          </label>
          <button
            type="button"
            disabled={remarks.trim().length < 3 || decide.isPending}
            onClick={() => decide.mutate('REJECTED')}
            className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-s"
          >
            Reject objection
          </button>
          <button
            type="button"
            disabled={remarks.trim().length < 3 || decide.isPending}
            onClick={() => decide.mutate('UPHELD')}
            className="ux4g-btn ux4g-btn-primary ux4g-btn-s"
          >
            Uphold objection
          </button>
          {decide.error && (
            <p className="w-full text-xs text-red-700">
              {decide.error instanceof ApiProblem ? decide.error.message : 'Could not record the decision.'}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
