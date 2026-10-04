'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { QrCode } from '@/components/qr-code';
import { PageHeader } from '@/components/shell/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { KpiCard } from '@/components/ui/kpi-card';
import { SectionCard } from '@/components/ui/section-card';
import { StatusTag } from '@/components/ui/status-tag';
import { api } from '@/lib/api';
import { useChainVerify } from '@/lib/chain-api';

/** Anchored entity types (apps/api/src/chain/payloads.ts) with officer-facing names. */
export const ENTITY_LABEL: Record<string, string> = {
  land_parcel: 'Land parcel (verified boundary)',
  stage_instance: 'Stage approval',
  award: 'Award',
  disbursement: 'Disbursement',
  acknowledgement: 'Family acknowledgement',
  project_parcel: 'Possession',
  document: 'Document attestation',
  webauthn_credential: 'Passkey enrolment',
};

const EVENT_LABEL: Record<string, string> = {
  PARCEL_VERIFIED: 'Parcel verified',
  PARCEL_CORRECTED: 'Parcel corrected',
  APPROVAL_RECORDED: 'Stage approval',
  AWARD_DECLARED: 'Award declared',
  COMPENSATION_DISBURSED: 'Compensation disbursed',
  COMPENSATION_ACKNOWLEDGED: 'Receipt acknowledged by family',
  POSSESSION_CONFIRMED: 'Possession confirmed',
  DOCUMENT_ATTESTED: 'Document attested',
  WEBAUTHN_ENROLLED: 'Passkey enrolled',
};

interface ChainStatus {
  configured: boolean;
  node: { configured: boolean; contract: string | null; reachable: boolean; chainId: number | null; latestBlock: number | null };
  relayer: string | null;
  byEventType: Array<{ event_type: string; n: number; anchored: number }>;
  counts: Array<{ status: string; n: number }>;
}

interface ChainEventRow {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_version: number;
  event_type: string;
  data_hash: string;
  status: string;
  tx_hash: string | null;
  block_number: string | null;
  anchored_at: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
}

const short = (h: string | null | undefined, n = 10) => (h ? `${h.slice(0, n)}…${h.slice(-6)}` : '—');
const when = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso))
    : '—';

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ux4g-btn ux4g-btn-ghost-neutral ux4g-btn-xs"
      onClick={() =>
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1200);
          })
          .catch(() => {})
      }
      aria-label="Copy"
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function VerifyResult({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { data, isLoading, error } = useChainVerify(entityType, entityId);
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  if (isLoading) return <p className="ux4g-body-s-default">Rebuilding the record and reading the chain…</p>;
  if (error || !data) return <p className="ux4g-body-s-default ux4g-text-error">{(error as Error)?.message ?? 'Could not verify.'}</p>;
  const tone =
    data.result === 'VERIFIED'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
      : data.result === 'MISMATCH'
        ? 'border-red-300 bg-red-50 text-red-950'
        : 'border-slate-300 bg-slate-50 text-slate-900';
  const headline = {
    VERIFIED: '✓ Verified: the record today matches the hash anchored on the chain',
    MISMATCH: '✗ Mismatch: the record in the database differs from what was anchored',
    PENDING: '⏳ Proof pending: queued for anchoring',
    NOT_ANCHORED: 'Not anchored: this record has no approved version on the chain',
  }[data.result];
  const publicUrl = `${origin}/verify/${entityType}/${entityId}`;
  return (
    <div className={`space-y-3 rounded-lg border-2 p-4 ${tone}`}>
      <p className="text-lg font-bold">{headline}</p>
      <dl className="grid gap-2 text-sm sm:grid-cols-[12rem_1fr]">
        <dt className="font-medium">Version checked</dt>
        <dd>v{data.version}</dd>
        <dt className="font-medium">Hash of the record now</dt>
        <dd className="break-all font-mono text-xs">{data.currentHash ?? '—'}</dd>
        <dt className="font-medium">Hash on the chain</dt>
        <dd className="break-all font-mono text-xs">{data.anchoredHash ?? '—'}</dd>
        {data.blockNumber != null && (
          <>
            <dt className="font-medium">Block · transaction</dt>
            <dd className="break-all font-mono text-xs">
              #{data.blockNumber} · {data.txHash}
            </dd>
          </>
        )}
        {data.anchoredAt && (
          <>
            <dt className="font-medium">Anchored at</dt>
            <dd>{when(data.anchoredAt)}</dd>
          </>
        )}
      </dl>
      {data.lineage.length > 1 && (
        <div>
          <p className="text-sm font-medium">Version history on the chain</p>
          <ol className="mt-1 flex flex-wrap gap-2 text-xs">
            {data.lineage.map((l) => (
              <li key={l.version} className="rounded bg-white/70 px-2 py-1 ring-1 ring-slate-300">
                v{l.version} · {EVENT_LABEL[l.eventType] ?? l.eventType} · {l.status}
                {l.blockNumber != null ? ` · #${l.blockNumber}` : ''}
              </li>
            ))}
          </ol>
        </div>
      )}
      {data.result !== 'NOT_ANCHORED' && origin && (
        <div className="flex flex-wrap items-start gap-4 border-t border-slate-300/60 pt-3">
          <QrCode url={publicUrl} caption="Public proof page: anyone can scan and check this anchor" />
          <div className="space-y-2 text-sm">
            <p>The public page shows only hashes, block and time. No names or amounts.</p>
            <Link href={`/verify/${entityType}/${entityId}`} className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-s" target="_blank">
              Open public proof page
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrustCenterPage() {
  const status = useQuery({ queryKey: ['chain', 'status'], queryFn: () => api<ChainStatus>('/chain/status'), refetchInterval: 15_000 });
  const [statusFilter, setStatusFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [form, setForm] = useState({ entityType: 'disbursement', entityId: '' });
  const [checking, setChecking] = useState<{ entityType: string; entityId: string } | null>(null);

  // ChainBadge links here with ?entity=<type>:<id>.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('entity');
    const [t, id] = q?.split(':') ?? [];
    if (t && id) {
      setForm({ entityType: t, entityId: id });
      setChecking({ entityType: t, entityId: id });
    }
  }, []);

  const events = useInfiniteQuery({
    queryKey: ['chain', 'events', statusFilter, eventFilter],
    initialPageParam: '',
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ limit: '25' });
      if (statusFilter) qs.set('status', statusFilter);
      if (eventFilter) qs.set('eventType', eventFilter);
      if (pageParam) qs.set('cursor', pageParam);
      return api<{ data: ChainEventRow[]; nextCursor: string | null }>(`/chain/events?${qs}`);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const count = (s: string) => status.data?.counts.find((c) => c.status === s)?.n ?? 0;
  const node = status.data?.node;
  const rows = events.data?.pages.flatMap((p) => p.data) ?? [];

  function submit(e: FormEvent) {
    e.preventDefault();
    if (form.entityId.trim()) setChecking({ entityType: form.entityType, entityId: form.entityId.trim() });
  }

  return (
    <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-l">
      <PageHeader
        title="Trust center"
        subtitle="Every human-approved record is hashed and anchored on a permissioned blockchain. Check any record against its proof."
        crumbs={[{ label: 'Trust' }, { label: 'Trust center' }]}
        actions={
          <Link href="/trust/audit" className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-s">
            Audit log
          </Link>
        }
      />

      <section className="overflow-hidden rounded-xl bg-gradient-to-br from-[#0e1a43] to-[#1f3c8f] p-5 text-white">
        <div className="flex flex-wrap items-center gap-3">
          {node?.reachable ? (
            <span className="flex items-center gap-1.5 rounded bg-emerald-500/20 px-2 py-0.5 text-sm font-semibold text-emerald-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden /> Chain node live
            </span>
          ) : (
            <span className="rounded bg-amber-400/20 px-2 py-0.5 text-sm font-semibold text-amber-100">
              {status.isLoading ? 'Checking chain node…' : 'Chain node not reachable: work continues, proofs queue'}
            </span>
          )}
          <span className="text-sm text-[#adc0eb]">Permissioned EVM · Hardhat node (production direction: Hyperledger Besu)</span>
        </div>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[#adc0eb]">Smart contract</dt>
            <dd className="break-all font-mono text-xs">{node?.contract ?? 'not deployed (pnpm chain:deploy)'}</dd>
          </div>
          <div>
            <dt className="text-[#adc0eb]">Relayer (ANCHORER_ROLE)</dt>
            <dd className="break-all font-mono text-xs">{status.data?.relayer ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[#adc0eb]">Chain ID</dt>
            <dd className="text-xl font-bold">{node?.chainId ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[#adc0eb]">Latest block</dt>
            <dd className="text-xl font-bold">{node?.latestBlock != null ? `#${node.latestBlock}` : '—'}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon="verified" label="Records anchored" value={count('ANCHORED').toLocaleString('en-IN')} />
        <KpiCard icon="schedule" label="Queued / submitted" value={(count('QUEUED') + count('SUBMITTED')).toLocaleString('en-IN')} />
        <KpiCard
          icon="error"
          label="Failed (retrying)"
          value={count('FAILED').toLocaleString('en-IN')}
          sub={count('FAILED') ? { text: 'The job retries with back-off', tone: 'warning' } : undefined}
        />
        <KpiCard icon="category" label="Kinds of record anchored" value={status.data?.byEventType.length ?? '—'} />
      </div>

      <SectionCard
        id="verify"
        title="Verify any record"
        description="Rebuilds the record's canonical hash from the database now and compares it with the hash on the chain."
      >
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-slate-700">Record type</span>
            <select
              className="input mt-1"
              value={form.entityType}
              onChange={(e) => setForm((f) => ({ ...f, entityType: e.target.value }))}
            >
              {Object.entries(ENTITY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-72 flex-1 text-sm">
            <span className="block text-slate-700">Record ID</span>
            <input
              className="input mt-1 w-full font-mono"
              placeholder="uuid, or pick a row below"
              value={form.entityId}
              onChange={(e) => setForm((f) => ({ ...f, entityId: e.target.value }))}
            />
          </label>
          <button type="submit" className="ux4g-btn ux4g-btn-primary ux4g-btn-m">
            Verify
          </button>
        </form>
        {checking && (
          <div className="mt-4">
            <VerifyResult key={`${checking.entityType}:${checking.entityId}`} {...checking} />
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Anchoring ledger"
        description="Newest first. Payloads contain no names, phones or bank details: only IDs, amounts in paise, hashes and posts."
        actions={
          <div className="flex flex-wrap gap-2">
            <select className="input" aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {['ANCHORED', 'QUEUED', 'SUBMITTED', 'FAILED'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select className="input" aria-label="Event" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
              <option value="">All events</option>
              {(status.data?.byEventType ?? []).map((t) => (
                <option key={t.event_type} value={t.event_type}>
                  {EVENT_LABEL[t.event_type] ?? t.event_type} ({t.n})
                </option>
              ))}
            </select>
          </div>
        }
      >
        {events.isLoading ? (
          <p className="ux4g-body-s-default">Loading…</p>
        ) : rows.length === 0 ? (
          statusFilter || eventFilter ? (
            <EmptyState title="No entries match these filters" description="Choose “All statuses” and “All events” to see the whole ledger." />
          ) : (
            <EmptyState title="Nothing anchored yet" description="Approve a record (verify a parcel, sign an award) and it appears here." />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">Record</th>
                  <th className="py-2 pr-3">Data hash</th>
                  <th className="py-2 pr-3">Block · tx</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Anchored</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 font-medium">{EVENT_LABEL[r.event_type] ?? r.event_type}</td>
                    <td className="py-2 pr-3">
                      <span className="block">{ENTITY_LABEL[r.entity_type] ?? r.entity_type}</span>
                      <span className="font-mono text-xs text-slate-500">
                        {short(r.entity_id, 8)} · v{r.entity_version}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {short(r.data_hash)} <Copy text={r.data_hash} />
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {r.block_number ? `#${r.block_number}` : '—'}
                      <span className="block text-slate-500">{short(r.tx_hash)}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <StatusTag kind="chain" status={r.status} />
                      {r.last_error && <span className="mt-1 block max-w-48 text-xs text-red-700">{r.last_error.slice(0, 80)}</span>}
                    </td>
                    <td className="py-2 pr-3 text-xs">{when(r.anchored_at)}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-xs"
                        onClick={() => {
                          setForm({ entityType: r.entity_type, entityId: r.entity_id });
                          setChecking({ entityType: r.entity_type, entityId: r.entity_id });
                          document.getElementById('verify')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        Check
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {events.hasNextPage && (
              <button
                type="button"
                className="ux4g-btn ux4g-btn-outline-neutral ux4g-btn-s mt-3"
                disabled={events.isFetchingNextPage}
                onClick={() => void events.fetchNextPage()}
              >
                {events.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard title="How tampering is caught" description="What the demo shows, and why a correction is different.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-950">
            <p className="font-bold">Silent database edit → MISMATCH</p>
            <p className="mt-1">
              <code>pnpm demo:tamper</code> moves one verified parcel&apos;s boundary by about 5 m with raw SQL, as a
              privileged insider could (if no parcel is anchored yet, it adds ₹1,000 to an anchored payment instead).
              The record&apos;s hash no longer matches the hash on the chain: Verify shows MISMATCH and the record&apos;s
              badge turns red.
            </p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-bold">Legitimate correction → new version, new proof</p>
            <p className="mt-1">
              A correction is requested by one post and approved by another (maker-checker). It creates version 2, keeps
              version 1 in history, and anchors v2 as a new proof. The chain shows the lineage v1 → v2.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
