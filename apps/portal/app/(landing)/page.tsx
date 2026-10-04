import Link from 'next/link';
import { EvaluatorLogins } from '@/components/landing/evaluator-logins';
import { serverEnv } from '@/lib/server-env';

type Health = { status: string; db: string; demoMode: boolean; clock: { now: string; frozen: boolean } };

type ChainSummary = {
  ledger: { anchored: number; pending: number; failed: number; latest_block: string | null } | null;
  node: { configured: boolean; contract: string | null; reachable: boolean; chainId: number | null; latestBlock: number | null };
};

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${serverEnv.apiOrigin}/api/v1${path}`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** The six innovations (CLAUDE.md §2), in build-priority order — one line each. */
const INNOVATIONS = [
  ['Payment acknowledgement', 'The family confirms each payment on their own phone. Disbursed vs received, live.'],
  ['Statutory clocks', 'Every stage counts down a legal deadline and shows what happens if it lapses.'],
  ['Blockchain proof', 'Approved records are anchored on chain; a silent database edit shows as a mismatch.'],
  ['GIS field verification', 'Walk the boundary with GPS and a photo at every corner, even offline.'],
  ['Rule packs', 'The Act and state rules are versioned data. The law changes, the code does not.'],
  ['AI assistant', 'Plain-language questions answered from your own data scope. Advisory only.'],
] as const;

const dateIST = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso));

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [h, chain] = await Promise.all([get<Health>('/health'), get<ChainSummary>('/public/chain-summary')]);
  const chainLive = !!chain?.node.reachable && chain.node.configured;

  return (
    <div className="space-y-10">
      <section
        aria-labelledby="hero-title"
        className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0e1a43] via-[#13245a] to-[#1f3c8f] text-white"
      >
        <div className="h-1.5 bg-gradient-to-r from-[#ff9933] via-white to-[#138808]" aria-hidden />
        <div className="space-y-6 p-6 sm:p-10">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#ffb866]">
              Smart India Hackathon · Problem statement 26016
            </p>
            <h1 id="hero-title" className="max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl">
              Land acquisition, from proposal to possession, enforced by the law&apos;s own deadlines.
            </h1>
            <p className="max-w-2xl text-lg text-[#d6e0f5]">
              Every parcel on a map. Every approval anchored on a blockchain. Every payment confirmed by the family.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border-2 border-[#ff9933] bg-white/10 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#ffb866]">
                Blockchain anchoring
                {chainLive && (
                  <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs text-emerald-200">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden /> live
                  </span>
                )}
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">
                {chain?.ledger ? `${chain.ledger.anchored.toLocaleString('en-IN')} records` : 'Smart contract'}
              </p>
              <p className="text-sm text-[#d6e0f5]">
                {chainLive && chain?.node.latestBlock != null
                  ? `anchored · block #${chain.node.latestBlock} · permissioned EVM`
                  : 'proofs queue and anchor when the chain node is up'}
              </p>
            </div>
            <div className="rounded-xl border-2 border-white/30 bg-white/10 p-4">
              <p className="text-sm font-semibold text-[#ffb866]">GIS map</p>
              <p className="mt-1 text-2xl font-extrabold">Every parcel</p>
              <p className="text-sm text-[#d6e0f5]">satellite view, colour by stage / payment / risk, legal flags</p>
            </div>
            <div className="rounded-xl border-2 border-white/30 bg-white/10 p-4">
              <p className="text-sm font-semibold text-[#ffb866]">Statutory clocks</p>
              <p className="mt-1 text-2xl font-extrabold">RFCTLARR 2013</p>
              <p className="text-sm text-[#d6e0f5]">deadlines, consequences and interest cost, live</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {serverEnv.demoMode && (
              <a href="#evaluator-logins" className="rounded-md bg-[#ff9933] px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-[#ffb866]">
                Evaluator logins ↓
              </a>
            )}
            <Link href="/login" className="rounded-md bg-white px-5 py-2.5 text-sm font-bold text-[#13245a] hover:bg-[#eef2fb]">
              Officer sign in
            </Link>
            <Link href="/portal" className="rounded-md border-2 border-white px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10">
              Citizen portal
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="usp-title" className="space-y-4">
        <h2 id="usp-title" className="text-2xl font-bold text-slate-950">
          Six innovations
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INNOVATIONS.map(([title, body], i) => (
            <li key={title} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <span className="text-3xl font-black leading-none text-[#ff9933]" aria-hidden>
                {i + 1}
              </span>
              <div>
                <h3 className="font-bold text-slate-950">{title}</h3>
                <p className="mt-0.5 text-sm text-slate-700">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {serverEnv.demoMode && <EvaluatorLogins />}

      <p className="text-xs text-slate-500">
        {h ? `Statutory clock ${dateIST(h.clock.now)} IST${h.clock.frozen ? ' (frozen for the demo)' : ''}. ` : 'API not reachable. '}
        All personal data is synthetic. Payments, identity, land records, SMS and the language model are mock services,
        labelled MOCK where they appear.
      </p>
    </div>
  );
}
