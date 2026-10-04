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
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(
    new Date(iso),
  );

export const dynamic = 'force-dynamic';

export default async function Home() {
  const h = await health();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">National Land Acquisition &amp; Management System</h1>
        <p className="mt-1 text-slate-600">
          One land parcel from proposal to possession to closure, with the RFCTLARR Act&apos;s deadlines as live clocks.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Platform status</h2>
        {h ? (
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <dt className="text-slate-500">API</dt>
            <dd className="font-medium text-emerald-700">{h.status}</dd>
            <dt className="text-slate-500">Database</dt>
            <dd className={h.db === 'ok' ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>{h.db}</dd>
            <dt className="text-slate-500">Statutory clock (IST)</dt>
            <dd className="font-medium">{dateIST(h.clock.now)}</dd>
            <dt className="text-slate-500">Clock</dt>
            <dd className="font-medium">{h.clock.frozen ? 'frozen for demo' : 'live'}</dd>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-red-700">
            The API is not reachable. Start it with <code className="rounded bg-slate-100 px-1">pnpm dev</code>.
          </p>
        )}
      </section>

      <Link
        href="/login"
        className="inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
      >
        Sign in
      </Link>
    </div>
  );
}
