import { useEffect, useState } from 'react';

type Health = { status: string; demoMode: boolean; clock: { now: string; frozen: boolean } };

function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

/** Phase 0 shell: installable, knows whether it is online, and can reach the API. */
export function App() {
  const online = useOnline();
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    if (!online) return;
    fetch('/api/v1/health')
      .then((r) => (r.ok ? (r.json() as Promise<Health>) : null))
      .then(setHealth)
      .catch(() => setHealth(null));
  }, [online]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center gap-2 bg-teal-700 px-4 py-3 text-white">
        <h1 className="text-base font-semibold">BhoomiSetu Field</h1>
        {health?.demoMode && (
          <span className="rounded bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
            Demo data
          </span>
        )}
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${online ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-800'}`}
        >
          {online ? 'Online' : 'Offline'}
        </span>
      </header>
      <main className="space-y-3 p-4 text-sm">
        <p className="text-slate-700">Assignments and offline boundary capture will appear here after sign-in.</p>
        <p className="text-slate-500">
          Server:{' '}
          {!online
            ? 'offline — work is kept on this device'
            : health
              ? `reachable (${health.status})`
              : 'not reachable'}
        </p>
      </main>
    </div>
  );
}
