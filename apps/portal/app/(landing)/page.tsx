import Link from 'next/link';
import { serverEnv } from '@/lib/server-env';

type Health = { status: string; db: string; demoMode: boolean; clock: { now: string; frozen: boolean } };

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
  const h = await health();

  return (
    <div className="space-y-12">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-end">
        <div className="space-y-4">
          <h1 className="max-w-2xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
            Every acquired parcel, from first notice to final payment, on one record.
          </h1>
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
