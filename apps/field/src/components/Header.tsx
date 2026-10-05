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
    <header className="sticky top-0 z-[1500] flex h-14 items-center gap-2 border-b-[3px] border-b-[#ff9933] bg-[#13245a] px-2 pt-[env(safe-area-inset-top)] text-white">
      {back && (
        <button
          type="button"
          onClick={() => go(back)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none hover:bg-white/10"
          aria-label="Back"
        >
          ‹
        </button>
      )}
      <div className={`min-w-0 flex-1 ${back ? '' : 'pl-2'}`}>
        <h1 className="truncate text-[15px] font-semibold leading-tight">{title}</h1>
        {demoMode && <p className="text-[10px] font-semibold uppercase tracking-wider text-[#ffb866]">Demo data</p>}
      </div>
      <button
        type="button"
        onClick={() => go('sync')}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium"
        aria-label={`${online ? 'Online' : 'Offline'}, ${pending} item(s) waiting to sync. Open sync status`}
      >
        <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-slate-400'}`} aria-hidden />
        {online ? 'Online' : 'Offline'}
        {pending ? (
          <span className="rounded-full bg-[#ff9933] px-1.5 text-[10px] font-bold text-slate-950">{pending}</span>
        ) : null}
      </button>
    </header>
  );
}
