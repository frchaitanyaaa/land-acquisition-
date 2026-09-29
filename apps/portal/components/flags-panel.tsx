'use client';

import { formatDate } from '@bhoomisetu/shared';
import { useAcknowledgeFlag, useFlags } from '@/lib/parcels-api';

export function FlagsPanel({ projectId }: { projectId: string }) {
  const { data: flags, isLoading } = useFlags(projectId);
  const ack = useAcknowledgeFlag(projectId);

  if (isLoading || !flags) return <p className="text-sm text-slate-500">Loading flags…</p>;
  if (!flags.length) return <p className="border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">No spatial flags on this project.</p>;

  return (
    <ul className="divide-y divide-slate-200 border border-slate-200 bg-white">
      {flags.map((f) => (
        <li key={f.id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                {f.flag_type}
              </span>
              {f.layer_type && <span className="text-xs text-slate-400">{f.layer_type}</span>}
              {f.survey_no && <span className="text-xs text-slate-500">{f.survey_no}</span>}
            </div>
            <p className="mt-1 text-slate-700">{f.message}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              raised {formatDate(f.raised_at)}
              {f.overlap_area_sqm && ` · overlap ${Number(f.overlap_area_sqm).toLocaleString('en-IN')} m²`}
            </p>
          </div>
          {f.acknowledged_at ? (
            <span className="shrink-0 text-xs text-teal-700">Acknowledged</span>
          ) : (
            <button
              onClick={() => ack.mutate(f.id)}
              disabled={ack.isPending}
              className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Acknowledge
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
