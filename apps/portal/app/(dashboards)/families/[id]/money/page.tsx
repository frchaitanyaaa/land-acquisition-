'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { ChainBadge } from '@/components/chain-badge';
import { MoneyState } from '@/components/money-state';
import { QrCode } from '@/components/qr-code';
import { StatTile } from '@/components/stat-tile';
import { ApiProblem } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import {
  localPath,
  useAckLink,
  useEnrolLink,
  useFamilyMoney,
  usePassbookLink,
  type Disbursement,
  type TokenLink,
} from '@/lib/money-api';
import { useLiveUpdates } from '@/lib/use-live-updates';

const dateIST = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(iso)) : '—';
const dateTimeIST = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso));

/**
 * Family money + acknowledgement loop (§21, demo beats 6–7). Per head: assessed → sanctioned →
 * disbursed → acknowledged. QR links are for the family's OWN phone; this session never runs a
 * WebAuthn ceremony. Hold reasons show only when the API included them for this post (§11.4).
 */
export default function FamilyMoneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useFamilyMoney(id);
  useLiveUpdates([['family-money', id]]);
  const waitingForFamily = !!q.data?.entitlements.some((e) =>
    e.disbursements.some((d) => d.paymentStatus === 'SUCCESS' && d.instrument === 'DBT' && !d.acknowledgement),
  );
  // While a QR is on screen the row must flip the moment the phone confirms — poll as a backstop to SSE.
  const [linkShown, setLinkShown] = useState(false);

  const enrol = useEnrolLink();
  const passbook = usePassbookLink();
  const [enrolLink, setEnrolLink] = useState<TokenLink | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // re-query every 3 s while a link is open and the family hasn't confirmed yet
  useFamilyMoneyPoll(id, (linkShown && waitingForFamily) || !!enrolLink);

  if (q.error) {
    const e = q.error;
    return <p className="text-red-700">{e instanceof ApiProblem && e.status === 401 ? 'Sign in to continue.' : 'Could not load this family.'}</p>;
  }
  if (q.isLoading || !q.data) return <p className="text-slate-500">Loading…</p>;
  const { family, money, entitlements, estimatedInterestLiability, label } = q.data;
  const recipient = family.authorised_recipient_person_id ?? family.head_person_id;

  async function showEnrol() {
    setLinkError(null);
    try {
      setEnrolLink(await enrol.mutateAsync(recipient));
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'Could not create the link.');
    }
  }

  async function viewAsPublic() {
    setLinkError(null);
    try {
      const link = await passbook.mutateAsync(id);
      window.open(localPath(link.url), '_blank', 'noopener');
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'Could not issue a passbook link.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">
            <Link href={`/project/${family.project_id}/families`} className="hover:underline">
              {family.project_code} — {family.project_name}
            </Link>
          </p>
          <h1 className="text-xl font-semibold">{family.head_name}</h1>
          <p className="text-sm text-slate-600">
            {family.is_displaced ? 'Displaced family' : 'Affected family'}
            {family.is_sc_st ? ' · SC/ST' : ''}
            {family.phone_masked ? ` · ${family.phone_masked}` : ''} ·{' '}
            {family.has_passkey ? (
              <span className="text-teal-800">passkey enrolled</span>
            ) : (
              <span className="text-amber-800">no passkey enrolled</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/families/${id}/passbook`} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">
            Passbook
          </Link>
          <button onClick={() => void viewAsPublic()} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">
            View as the public sees it ↗
          </button>
          <button onClick={() => void showEnrol()} disabled={enrol.isPending} className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50">
            {family.has_passkey ? 'Enrol another phone' : 'Create enrolment link'}
          </button>
        </div>
      </div>
      {linkError && <p className="text-sm text-red-700">{linkError}</p>}
      {enrolLink && (
        <div className="flex flex-wrap items-start gap-4 border border-slate-200 bg-white p-4">
          <QrCode url={enrolLink.url} caption="Family scans with their own phone to register fingerprint / face" expiresInMinutes={enrolLink.expiresInMinutes} />
          <p className="max-w-sm text-sm text-slate-600">
            The beneficiary opens this on their own phone and uses its fingerprint or face unlock. Nothing biometric is stored — only the
            credential id and public key (G6).{' '}
            <button className="text-teal-700 underline" onClick={() => setEnrolLink(null)}>
              Close
            </button>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Assessed" value={formatMoney(money.assessed_paise)} />
        <StatTile label="Sanctioned" value={formatMoney(money.sanctioned_paise)} />
        <StatTile label="Disbursed" value={formatMoney(money.disbursed_paise)} />
        <StatTile label="Acknowledged" value={formatMoney(money.acknowledged_paise)} />
        <StatTile label="Disbursed, not acknowledged" value={formatMoney(money.unconfirmed_paise)} />
        <StatTile label="On hold" value={formatMoney(money.held_paise)} />
        <StatTile label="Deposited with Authority" value={formatMoney(money.deposited_paise)} />
        <StatTile label={label} value={formatMoney(estimatedInterestLiability?.estimated_interest_paise ?? '0')} />
      </div>

      <div className="space-y-4">
        {entitlements.map((e) => (
          <section key={e.entitlement_id} className="border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
              <div className="flex-1">
                <p className="font-medium">{e.head_code.replace(/_/g, ' ')}</p>
                <p className="text-xs text-slate-500">
                  {e.award_type} award {e.award_no}
                  {e.schedule_ref ? ` · ${e.schedule_ref}` : ''} · due {dateIST(e.due_by)}
                </p>
              </div>
              <span className="font-semibold tabular-nums">{formatMoney(e.amount_awarded_paise)}</span>
              <MoneyState state={e.status} />
            </div>
            {e.disbursements.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">No payment yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {e.disbursements.map((d) => (
                  <DisbursementRow key={d.id} d={d} onLinkShown={() => setLinkShown(true)} />
                ))}
              </ul>
            )}
          </section>
        ))}
        {entitlements.length === 0 && <p className="text-sm text-slate-500">No award entered for this family yet.</p>}
      </div>
    </div>
  );
}

function DisbursementRow({ d, onLinkShown }: { d: Disbursement; onLinkShown: () => void }) {
  const ack = useAckLink();
  const [link, setLink] = useState<TokenLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canAck = d.paymentStatus === 'SUCCESS' && d.instrument === 'DBT' && !d.acknowledgement;
  // Render whatever the server sent: it already removed these keys for posts that may not see them.
  const hasHold = ('holdReasonCode' in d && d.holdReasonCode) || ('holdReason' in d && d.holdReason);

  async function showQr() {
    setError(null);
    try {
      setLink(await ack.mutateAsync(d.id));
      onLinkShown();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the link.');
    }
  }

  return (
    <li className="space-y-2 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="tabular-nums">{formatMoney(d.amountPaise)}</span>
        <MoneyState state={d.paymentStatus} />
        <span className="text-xs text-slate-500">
          {d.instrument === 'DBT' ? 'DBT' : 'Deposit with Authority'}
          {d.paidOn ? ` · paid ${dateIST(d.paidOn)}` : ''}
          {d.acceptanceType === 'UNDER_PROTEST' ? ' · accepted under protest' : ''}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {d.acknowledgement ? (
            <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-200">
              ✓ Acknowledged by family · {d.acknowledgement.method} · {dateTimeIST(d.acknowledgement.confirmedAt)}
            </span>
          ) : d.paymentStatus === 'SUCCESS' && d.instrument === 'DBT' ? (
            <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-200">
              Disbursed, not acknowledged
            </span>
          ) : null}
          {d.paymentStatus === 'SUCCESS' && <ChainBadge entityType="disbursement" entityId={d.id} />}
        </span>
      </div>
      {hasHold && (
        <p className="border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-900">
          On hold{d.holdReasonCode ? ` — ${d.holdReasonCode}` : ''}
          {d.holdReason ? `: ${d.holdReason}` : ''}
        </p>
      )}
      {canAck &&
        (link ? (
          <div className="flex flex-wrap items-start gap-4">
            <QrCode url={link.url} caption="Family scans with their own phone to confirm receipt" />
            <p className="max-w-sm text-xs text-slate-600">
              The confirmation happens on the family’s phone — fingerprint/face, or an SMS code. This screen updates by itself when they
              confirm.
            </p>
          </div>
        ) : (
          <button onClick={() => void showQr()} disabled={ack.isPending} className="text-xs font-medium text-teal-700 hover:underline">
            Show acknowledgement QR
          </button>
        ))}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </li>
  );
}

function useFamilyMoneyPoll(id: string, on: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => {
      void qc.invalidateQueries({ queryKey: ['family-money', id] });
      void qc.invalidateQueries({ queryKey: ['chain'] });
    }, 3000);
    return () => clearInterval(t);
  }, [qc, id, on]);
}
