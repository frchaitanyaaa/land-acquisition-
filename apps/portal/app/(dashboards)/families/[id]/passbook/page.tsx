'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { use, useState } from 'react';
import { MoneyState } from '@/components/money-state';
import { QrCode } from '@/components/qr-code';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { usePassbookLink, type TokenLink } from '@/lib/money-api';
import type { Passbook } from '@/lib/public-api';

const dateIST = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(iso)) : '—';

/**
 * Officer view of the family's R&R passbook (§19) — the same document the family sees (no hold
 * reasons, ever), plus the QR that gives the family its own passbook link.
 */
export default function OfficerPassbookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: pb, isLoading, error } = useQuery({
    queryKey: ['family-passbook', id],
    queryFn: () => api<Passbook>(`/families/${id}/passbook`),
  });
  const issue = usePassbookLink();
  const [link, setLink] = useState<TokenLink | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);

  if (error) return <p className="text-red-700">Could not load the passbook.</p>;
  if (isLoading || !pb) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            <Link href={`/families/${id}/money`} className="hover:underline">
              ← Family money
            </Link>
          </p>
          <h1 className="text-xl font-semibold">R&amp;R passbook — {pb.family.headFirstName}</h1>
          <p className="text-sm text-slate-600">
            {pb.family.projectName} ({pb.family.projectCode}){pb.family.isDisplaced ? ' · displaced family' : ''}
          </p>
        </div>
        <button
          onClick={async () => {
            setIssueError(null);
            try {
              setLink(await issue.mutateAsync(id));
            } catch (e) {
              setIssueError(e instanceof Error ? e.message : 'Could not issue a link.');
            }
          }}
          disabled={issue.isPending}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          Give the family their passbook (QR)
        </button>
      </div>
      {issueError && <p className="text-sm text-red-700">{issueError}</p>}
      {link && <QrCode url={link.url} caption="Family scans to open their passbook (valid 90 days)" />}

      <table className="w-full border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Head</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Acknowledged</th>
            <th className="px-3 py-2">Due by</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {pb.entitlements.map((e) => (
            <tr key={e.headCode}>
              <td className="px-3 py-2">{e.headCode.replace(/_/g, ' ')}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(e.amountPaise)}</td>
              <td className="px-3 py-2">
                <MoneyState state={e.status === 'PAYMENT_IN_PROCESS' ? 'SANCTIONED' : e.status} />
                {e.status === 'PAYMENT_IN_PROCESS' && <span className="ml-1 text-xs text-slate-500">(family sees: payment in process)</span>}
              </td>
              <td className="px-3 py-2">{BigInt(e.paidPaise) > 0n ? (e.acknowledged ? '✓ yes' : 'not yet') : '—'}</td>
              <td className="px-3 py-2">{dateIST(e.dueBy)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div className="border border-slate-200 bg-white p-3">
          <dt className="text-xs text-slate-500">Annuity</dt>
          <dd>
            {pb.annuity && pb.annuity.total > 0
              ? `${pb.annuity.paid} of ${pb.annuity.total} paid${pb.annuity.nextDue ? ` · next ${dateIST(pb.annuity.nextDue)}` : ''}`
              : '—'}
          </dd>
        </div>
        <div className="border border-slate-200 bg-white p-3">
          <dt className="text-xs text-slate-500">Resettlement site</dt>
          <dd>{pb.site ? `${pb.site.name}${pb.site.readinessPct != null ? ` · ${pb.site.readinessPct}% ready` : ''}` : '—'}</dd>
        </div>
        <div className="border border-slate-200 bg-white p-3">
          <dt className="text-xs text-slate-500">Contact</dt>
          <dd>{pb.contact}</dd>
        </div>
      </dl>
    </div>
  );
}
