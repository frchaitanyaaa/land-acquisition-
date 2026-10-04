'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { MockBanner } from '@/components/mock/mock-banner';
import { CATEGORY_LABEL, STATUS_LABEL, findGrievance, type GrievanceStatus, type MockGrievance } from '@/lib/mock-citizen';
import { usePortal } from '../portal-shell';

const STEPS: GrievanceStatus[] = ['FILED', 'ASSIGNED', 'IN_PROGRESS', 'RESPONDED', 'CLOSED'];

/** Public grievance status by tracking number (MOCK). Shows no name or phone — only what the citizen filed. */
export default function TrackGrievancePage() {
  const { formatDate } = usePortal();
  const [no, setNo] = useState('');
  const [result, setResult] = useState<MockGrievance | null | undefined>(undefined);

  async function lookup(value: string) {
    if (!value.trim()) return;
    setResult(await findGrievance(value));
  }

  useEffect(() => {
    // ?no=GRV-… from the "Track" links; read once on load.
    const q = new URLSearchParams(window.location.search).get('no');
    if (q) {
      setNo(q);
      void lookup(q);
    }
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    void lookup(no);
  }

  const reached = result ? STEPS.indexOf(result.status) : -1;

  return (
    <div className="max-w-3xl space-y-6">
      <MockBanner what="Grievance tracking" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-950">Track a grievance</h1>
        <p className="text-slate-700">Enter the tracking number you received, for example GRV-2026-000101.</p>
      </div>

      <form onSubmit={submit} className="flex flex-wrap gap-3">
        <input
          value={no}
          onChange={(e) => setNo(e.target.value)}
          className="input max-w-xs font-mono"
          placeholder="GRV-2026-000000"
          aria-label="Tracking number"
        />
        <button type="submit" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
          Track
        </button>
      </form>

      {result === null && <p className="text-sm text-red-700">No grievance found with that tracking number.</p>}

      {result && (
        <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-sm text-slate-600">{result.trackingNo}</p>
              <h2 className="text-lg font-semibold text-slate-950">{result.subject}</h2>
              <p className="text-sm text-slate-600">
                {CATEGORY_LABEL[result.category]} · {result.village ? `${result.village}, ` : ''}
                {result.district} · filed {formatDate(result.filedAt)}
              </p>
            </div>
            <span className="rounded bg-teal-100 px-2 py-1 text-sm font-medium text-teal-900">{STATUS_LABEL[result.status]}</span>
          </div>

          <ol className="flex flex-wrap gap-2" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li
                key={s}
                className={`rounded-full px-3 py-1 text-xs font-medium ${i <= reached ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-500'}`}
              >
                {STATUS_LABEL[s]}
              </li>
            ))}
          </ol>

          <p className="text-sm text-slate-700">
            Handled by {result.assignedTo}. Response target {formatDate(result.slaDueAt)} (administrative, not statutory).
          </p>

          <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
            {[...result.events].reverse().map((ev, i) => (
              <li key={i}>
                <p className="text-sm font-medium text-slate-950">{STATUS_LABEL[ev.status]}</p>
                <p className="text-sm text-slate-700">{ev.note}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(ev.at, true)} · {ev.by}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
