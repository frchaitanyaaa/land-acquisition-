import Link from 'next/link';
import { EvaluatorLogins } from '@/components/landing/evaluator-logins';
import { serverEnv } from '@/lib/server-env';

type Health = { status: string; db: string; demoMode: boolean; clock: { now: string; frozen: boolean } };

type ChainSummary = {
  ledger: { anchored: number; pending: number; failed: number; latest_block: string | null } | null;
  node: { configured: boolean; contract: string | null; reachable: boolean; chainId: number | null; latestBlock: number | null };
};

async function chainSummary(): Promise<ChainSummary | null> {
  try {
    const res = await fetch(`${serverEnv.apiOrigin}/api/v1/public/chain-summary`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as ChainSummary) : null;
  } catch {
    return null;
  }
}

/** The six innovations (CLAUDE.md §2), in build-priority order. */
const INNOVATIONS = [
  {
    title: 'Payment acknowledgement loop',
    body: 'Disbursed is not received. The family confirms each payment with the fingerprint or face unlock on their own phone (WebAuthn). The dashboard shows the gap.',
  },
  {
    title: 'Statutory timeline engine',
    body: 'Every stage runs a legal clock from the Act: "Declaration lapses in 34 days, s.19". Interest cost of delay (s.80) estimated live.',
  },
  {
    title: 'Blockchain trust layer',
    body: 'Human-approved records are hashed and anchored on a permissioned EVM chain. A silent database edit shows up as a mismatch.',
  },
  {
    title: 'GIS field verification',
    body: 'Officers walk the boundary: GPS point and photo at every corner, works offline, recorded vs measured area both kept.',
  },
  {
    title: 'Policy-change resilience',
    body: 'The Act and state rules are versioned rule packs. Same engine runs RFCTLARR 2013 and the NH Act 1956; a case keeps the pack it started under.',
  },
  {
    title: 'AI administrative intelligence',
    body: 'Ask in plain language; answers come from whitelisted analytics tools under your own data scope. Advisory only, never writes a record.',
  },
];

const ALSO = [
  'Role + jurisdiction security in the database (Postgres RLS)',
  'Maker-checker on every approval',
  'Append-only, hash-chained audit log',
  'Offline field app (PWA)',
  'English · हिन्दी · मराठी',
  'Citizen portal, notices, objections, grievances',
  'Officer attestation on every document (s.84)',
  'Delay-risk scoring and MIS',
];

async function health(): Promise<Health | null> {
  try {
    const res = await fetch(`${serverEnv.apiOrigin}/api/v1/health`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as Health) : null;
  } catch {
    return null;
  }
}

const dateIST = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(
    new Date(iso),
  );

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [h, chain] = await Promise.all([health(), chainSummary()]);
  const chainLive = !!chain?.node.reachable && chain.node.configured;

  return (
    <div className="space-y-12">
      {/* Evaluator-facing headline: what is built, shown boldly on the first page (SIH 26016). */}
      <section
        aria-labelledby="hero-title"
        className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0e1a43] via-[#13245a] to-[#1f3c8f] text-white shadow-lg"
      >
        <div className="h-1.5 bg-gradient-to-r from-[#ff9933] via-white to-[#138808]" aria-hidden />
        <div className="space-y-6 p-6 sm:p-10">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#ffb866]">
              Smart India Hackathon · Problem statement 26016 · Ministry of Rural Development
            </p>
            <h1 id="hero-title" className="max-w-4xl text-3xl font-extrabold leading-tight sm:text-5xl">
              BhoomiSetu: real-time national land acquisition, enforced by the law&apos;s own deadlines.
            </h1>
            <p className="max-w-3xl text-lg text-[#d6e0f5]">
              One record for every parcel from proposal to possession, on a map, with every approval anchored on a
              blockchain and every payment confirmed by the family that received it.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border-2 border-[#ff9933] bg-white/10 p-5 backdrop-blur lg:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-[#ff9933] px-2 py-0.5 text-xs font-bold uppercase text-slate-950">Built &amp; running</span>
                {chainLive ? (
                  <span className="flex items-center gap-1.5 rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-200">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden /> Chain node live
                  </span>
                ) : (
                  <span className="rounded bg-white/15 px-2 py-0.5 text-xs text-white">Chain node offline: proofs queue and anchor later</span>
                )}
              </div>
              <h2 className="mt-2 text-2xl font-bold">Full blockchain anchoring backend</h2>
              <p className="mt-1 text-[#d6e0f5]">
                Solidity <code className="text-white">AnchorRegistry</code> smart contract with role-based access, deployed
                on a permissioned EVM chain. A background relayer hashes every human-approved record (parcel
                verification, stage approvals, awards, payments, acknowledgements, possession, document attestations)
                as canonical JSON with no personal data, and anchors it. Any record can be re-verified against the chain:
                a silent database edit shows <strong className="text-white">MISMATCH</strong>.
              </p>
              {chain?.ledger && (
                <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-[#adc0eb]">Records anchored</dt>
                    <dd className="text-2xl font-extrabold tabular-nums">{chain.ledger.anchored.toLocaleString('en-IN')}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#adc0eb]">Awaiting proof</dt>
                    <dd className="text-2xl font-extrabold tabular-nums">{chain.ledger.pending.toLocaleString('en-IN')}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#adc0eb]">Latest block</dt>
                    <dd className="text-2xl font-extrabold tabular-nums">
                      {chain.node.latestBlock !== null ? `#${chain.node.latestBlock}` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#adc0eb]">Chain ID</dt>
                    <dd className="text-2xl font-extrabold tabular-nums">{chain.node.chainId ?? '—'}</dd>
                  </div>
                </dl>
              )}
              {chain?.node.contract && (
                <p className="mt-3 break-all text-xs text-[#adc0eb]">
                  Contract <code className="text-white">{chain.node.contract}</code>
                </p>
              )}
              <p className="mt-2 text-xs text-[#adc0eb]">
                This deployment runs a Hardhat permissioned node; the production direction is Hyperledger Besu with one
                validator per authority. The chain is never in the request path: if it is down, work continues and proofs
                show as pending.
              </p>
            </div>

            <div className="rounded-xl border-2 border-white/30 bg-white/10 p-5 backdrop-blur">
              <span className="rounded bg-[#138808] px-2 py-0.5 text-xs font-bold uppercase text-white">GIS</span>
              <h2 className="mt-2 text-2xl font-bold">Live GIS map visualisation</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-[#d6e0f5]">
                <li>▸ Satellite basemap with an offline fallback</li>
                <li>▸ Corridor-to-parcel intersection in PostGIS, partial-acquisition %</li>
                <li>▸ Colour parcels by stage, payment or deadline risk</li>
                <li>▸ Chainage strip along the 50 km expressway</li>
                <li>▸ Automatic flags: irrigated multi-crop (s.10), Scheduled Area (s.41), forest, water, overlaps</li>
                <li>▸ Field-walked boundaries: GPS fix and photo at every corner</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {serverEnv.demoMode && (
              <a
                href="#evaluator-logins"
                className="rounded-md bg-[#ff9933] px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-[#ffb866]"
              >
                Evaluator logins ↓
              </a>
            )}
            <Link href="/login" className="rounded-md bg-white px-5 py-2.5 text-sm font-bold text-[#13245a] hover:bg-[#eef2fb]">
              Officer sign in
            </Link>
            <Link
              href="/portal"
              className="rounded-md border-2 border-white px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10"
            >
              Citizen portal
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="usp-title" className="space-y-4">
        <h2 id="usp-title" className="text-2xl font-bold text-slate-950 sm:text-3xl">
          Six innovations, built and working
        </h2>
        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {INNOVATIONS.map((u, i) => (
            <li key={u.title} className="flex gap-4 rounded-xl border border-slate-200 border-l-4 border-l-[#1f3c8f] bg-white p-5 shadow-sm">
              <span className="text-4xl font-black leading-none text-[#ff9933]" aria-hidden>
                {i + 1}
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-950">{u.title}</h3>
                <p className="mt-1 text-sm text-slate-700">{u.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <ul className="flex flex-wrap gap-2" aria-label="Also built">
          {ALSO.map((a) => (
            <li key={a} className="rounded-full border border-[#adc0eb] bg-[#eef2fb] px-3 py-1 text-sm font-medium text-[#13245a]">
              ✓ {a}
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">
          Payments, identity, cadastral data, SMS and the language model use mock adapters, labelled MOCK wherever they
          appear. No live government system is connected.
        </p>
      </section>

      {serverEnv.demoMode && <EvaluatorLogins password="bhoomisetu-demo" />}

      <section className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-end">
        <div className="space-y-4">
          <h2 className="max-w-2xl text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">
            Every acquired parcel, from first notice to final payment, on one record.
          </h2>
          <p className="max-w-xl text-lg text-slate-700">
            BhoomiSetu tracks land acquisition under the RFCTLARR Act, 2013. Statutory deadlines run as live clocks,
            and every payment is checked against what the family confirms they received.
          </p>
        </div>

        {/* The statutory clock is what every deadline in the system counts against. */}
        <div className="border-l-4 border-teal-700 pl-5">
          <p className="text-sm text-slate-600">Statutory clock, India Standard Time</p>
          {h ? (
            <>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{dateIST(h.clock.now)}</p>
              <p className="mt-1 text-sm text-slate-600">
                {h.clock.frozen ? 'Frozen for the demo so countdowns are reproducible.' : 'Live.'}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-red-700">
              The API is not reachable. Start it with <code className="rounded bg-slate-100 px-1">pnpm dev</code>.
            </p>
          )}
        </div>
      </section>

      {serverEnv.demoMode && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          <strong>Demo data.</strong> Every person, parcel and payment shown in this system is synthetic.
        </p>
      )}

      <section aria-label="Choose how to continue" className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-950">Officers and staff</h2>
          <p className="mt-2 flex-1 text-slate-700">
            Sign in, choose the post you are acting in, and see the cases, deadlines and payments in your jurisdiction.
          </p>
          <Link
            href="/login"
            className="mt-5 self-start rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Officer sign in
          </Link>
        </div>

        <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-950">Citizens and landowners</h2>
          <p className="mt-1 text-sm text-slate-500" lang="hi">
            नागरिक और भूमिधारक
          </p>
          <p className="mt-2 flex-1 text-slate-700">
            No account needed. Check your parcel, read published notices, file an objection, or open the passbook and
            payment links the Collector&apos;s office sent you. Available in English, Hindi and Marathi.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/portal"
              className="rounded-md border border-teal-700 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50"
            >
              Open the public portal
            </Link>
            <Link href="/portal/search" className="rounded-md px-2 py-2 text-sm text-slate-700 underline hover:text-slate-950">
              Find my land
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="what" className="grid gap-6 border-t border-slate-200 pt-8 md:grid-cols-3">
        <h2 id="what" className="sr-only">
          What BhoomiSetu records
        </h2>
        <div>
          <h3 className="font-semibold text-slate-950">Deadlines with consequences</h3>
          <p className="mt-1 text-sm text-slate-700">
            Each clock shows the section of the Act it comes from and what happens if it lapses.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-slate-950">Disbursed and acknowledged</h3>
          <p className="mt-1 text-sm text-slate-700">
            A payment counts as received only when the family confirms it on their own phone.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-slate-950">Privacy in the database</h3>
          <p className="mt-1 text-sm text-slate-700">
            The public portal reads only views designed for the public. Officers see only their jurisdiction.
          </p>
        </div>
      </section>

      {h && (
        <p className="text-xs text-slate-500">
          API {h.status}, database {h.db}.
        </p>
      )}
    </div>
  );
}
