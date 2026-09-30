import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { go } from '../lib/router';

export function useOnline(): boolean {
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

export function Header({ title, back, demoMode }: { title: string; back?: string; demoMode?: boolean }) {
  const online = useOnline();
  const pending = useLive(() => db.outbox.where('status').anyOf('queued', 'uploading', 'rejected').count(), []);
  return (
    <header className="sticky top-0 z-[1500] flex items-center gap-2 bg-teal-700 px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-white">
      {back && (
        <button type="button" onClick={() => go(back)} className="-ml-1 px-2 text-lg leading-none" aria-label="Back">
          ‹
        </button>
      )}
      <h1 className="truncate text-base font-semibold">{title}</h1>
      {demoMode && (
        <span className="rounded bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">Demo data</span>
      )}
      <button
        type="button"
        onClick={() => go('sync')}
        className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium"
        aria-label="Sync status"
      >
        Sync{pending ? ` · ${pending}` : ''}
      </button>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${online ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-800'}`}>
        {online ? 'Online' : 'Offline'}
      </span>
    </header>
  );
}
