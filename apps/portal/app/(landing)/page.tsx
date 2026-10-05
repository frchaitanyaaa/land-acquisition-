import { InnovationFaq } from '@/components/landing/innovation-faq';
import { PortalCards } from '@/components/landing/portal-cards';
import { HeroBackdrop } from '@/components/landing/hero-backdrop';
import { serverEnv } from '@/lib/server-env';

type ChainSummary = {
  ledger: { anchored: number; pending: number; failed: number; latest_block: string | null } | null;
  node: {
    configured: boolean;
    contract: string | null;
    reachable: boolean;
    chainId: number | null;
    latestBlock: number | null;
  };
};

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${serverEnv.apiOrigin}/api/v1${path}`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}


export const dynamic = 'force-dynamic';

export default async function Home() {
  const chain = await get<ChainSummary>('/public/chain-summary');
  const chainLive = !!chain?.node.reachable && chain.node.configured;

  return (
    <div className="space-y-10">
      <section
        aria-labelledby="hero-title"
        className="relative isolate flex min-h-[560px] items-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#0e1a43] via-[#13245a] to-[#1f3c8f] text-white"
      >
        <HeroBackdrop />
        <div
          className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#ff9933] via-white to-[#138808]"
          aria-hidden
        />
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center px-6 py-16 text-center">
          <p className="rounded-full border border-white/30 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-[#ffb866] backdrop-blur-sm">
            Smart India Hackathon · Problem statement 26016
          </p>
          <h1 id="hero-title" className="mt-5 text-4xl font-extrabold leading-tight drop-shadow-md sm:text-5xl">
            From proposal to possession,
            <span className="block text-[#ffb866]">enforced by the law&apos;s own deadlines.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/90 drop-shadow">
            Every parcel on a map. Every approval anchored on a blockchain. Every payment confirmed by the family.
          </p>

          <a
            href="#portals"
            className="mt-8 rounded-md bg-[#ff9933] px-7 py-3 text-sm font-bold text-slate-950 shadow-lg hover:bg-[#ffb866]"
          >
            Get started ↓
          </a>

          <dl className="mt-10 grid w-full max-w-3xl grid-cols-1 overflow-hidden rounded-xl border border-white/20 bg-[#08102b]/55 text-left backdrop-blur-md sm:grid-cols-3 sm:divide-x sm:divide-white/15">
            <div className="p-4">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#ffb866]">
                Blockchain proof
                {chainLive && (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-label="chain node live" />
                )}
              </dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums">
                {chain?.ledger ? (
                  <>
                    {chain.ledger.anchored.toLocaleString('en-IN')}
                    <span className="ml-1 text-sm font-medium text-white/80">records anchored</span>
                  </>
                ) : (
                  <span className="text-sm font-medium text-white/90">
                    Every approved record hashed and anchored on chain
                  </span>
                )}
              </dd>
            </div>
            <div className="p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#ffb866]">GIS map</dt>
              <dd className="mt-1 text-sm text-white/90">
                Every parcel on satellite view, coloured by stage, payment or risk
              </dd>
            </div>
            <div className="p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#ffb866]">Statutory clocks</dt>
              <dd className="mt-1 text-sm text-white/90">RFCTLARR 2013 deadlines with their legal consequence, live</dd>
            </div>
          </dl>
        </div>
      </section>

      <PortalCards demoMode={serverEnv.demoMode} />

      <InnovationFaq />
    </div>
  );
}
