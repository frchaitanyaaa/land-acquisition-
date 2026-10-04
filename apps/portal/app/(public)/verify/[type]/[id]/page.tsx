import Link from 'next/link';
import { serverEnv } from '@/lib/server-env';

export const dynamic = 'force-dynamic';

const KIND: Record<string, string> = {
  land_parcel: 'Verified land parcel boundary',
  stage_instance: 'Stage approval',
  award: 'Compensation award',
  disbursement: 'Compensation payment',
  acknowledgement: "Family's confirmation of receipt",
  project_parcel: 'Possession record',
  document: 'Attested document',
  webauthn_credential: 'Passkey enrolment',
};

interface Version {
  entity_version: number;
  event_type: string;
  data_hash: string;
  status: string;
  tx_hash: string | null;
  block_number: string | null;
  anchored_at: string | null;
  onChainHash: string | null;
  result: 'MATCH' | 'MISMATCH' | 'PENDING' | 'UNREACHABLE';
}

interface PublicVerify {
  found: boolean;
  contract: string | null;
  versions: Version[];
}

async function load(type: string, id: string): Promise<PublicVerify | null> {
  try {
    const res = await fetch(`${serverEnv.apiOrigin}/api/v1/public/verify/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    return res.ok ? ((await res.json()) as PublicVerify) : null;
  } catch {
    return null;
  }
}

const when = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso)) : '—';

const RESULT = {
  MATCH: { text: '✓ Proof confirmed on the blockchain', cls: 'border-emerald-300 bg-emerald-50 text-emerald-950' },
  MISMATCH: { text: '✗ The recorded hash does not match the blockchain', cls: 'border-red-300 bg-red-50 text-red-950' },
  PENDING: { text: '⏳ Proof is being written to the blockchain', cls: 'border-slate-300 bg-slate-50 text-slate-900' },
  UNREACHABLE: { text: 'The blockchain node could not be reached just now', cls: 'border-amber-300 bg-amber-50 text-amber-950' },
} as const;

/**
 * Public proof page (§27.4, G22) — opened from a QR code. No login. Shows only what kind of record,
 * its hash, block, transaction and time: never names, amounts or survey details.
 */
export default async function PublicVerifyPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  const data = await load(type, id);
  const latest = data?.versions.at(-1);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-600">BhoomiSetu · public proof check</p>
        <h1 className="text-2xl font-semibold text-slate-950">{KIND[type] ?? 'Record'}</h1>
        <p className="break-all font-mono text-xs text-slate-500">{id}</p>
      </div>

      {!data ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950">The service is not reachable. Try again later.</p>
      ) : !data.found || !latest ? (
        <p className="rounded-md border border-slate-300 bg-slate-50 p-4 text-slate-900">
          No blockchain proof is recorded for this reference. Only records approved by an officer are anchored.
        </p>
      ) : (
        <>
          <div className={`rounded-lg border-2 p-5 ${RESULT[latest.result].cls}`}>
            <p className="text-xl font-bold">{RESULT[latest.result].text}</p>
            <p className="mt-2 text-sm">
              When this record was approved, a fingerprint of it (a SHA-256 hash, which reveals nothing about its
              contents) was written to a permissioned blockchain. That fingerprint cannot be changed afterwards.
            </p>
          </div>

          <ol className="space-y-4">
            {[...data.versions].reverse().map((v) => (
              <li key={v.entity_version} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="font-semibold text-slate-950">
                  Version {v.entity_version} · {RESULT[v.result].text.replace(/^[^ ]+ /, '')}
                </p>
                <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-[10rem_1fr]">
                  <dt className="text-slate-600">Anchored</dt>
                  <dd>{when(v.anchored_at)}</dd>
                  <dt className="text-slate-600">Block</dt>
                  <dd>{v.block_number ? `#${v.block_number}` : '—'}</dd>
                  <dt className="text-slate-600">Transaction</dt>
                  <dd className="break-all font-mono text-xs">{v.tx_hash ?? '—'}</dd>
                  <dt className="text-slate-600">Recorded hash</dt>
                  <dd className="break-all font-mono text-xs">{v.data_hash}</dd>
                  <dt className="text-slate-600">Hash on chain</dt>
                  <dd className="break-all font-mono text-xs">{v.onChainHash ?? '—'}</dd>
                </dl>
              </li>
            ))}
          </ol>

          {data.contract && (
            <p className="break-all text-xs text-slate-500">
              Smart contract <span className="font-mono">{data.contract}</span>. Demo deployment: a Hardhat permissioned
              node.
            </p>
          )}
        </>
      )}

      <p className="text-sm text-slate-600">
        Questions about this record? Contact the office of the Collector, or use{' '}
        <Link href="/portal/grievance" className="font-medium text-teal-800 underline">
          grievances &amp; help
        </Link>
        .
      </p>
    </div>
  );
}
