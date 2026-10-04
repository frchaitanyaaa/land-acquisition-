import { useEffect, useState } from 'react';
import { useOnline } from './components/Header';
import { db } from './lib/db';
import { go, useRoute } from './lib/router';
import { resumeSession, useProfile } from './lib/session';
import { syncNow } from './lib/sync-trigger';
import { Assignments } from './screens/Assignments';
import { Login } from './screens/Login';
import { SurveyShell } from './screens/SurveyShell';
import { SyncStatus } from './screens/SyncStatus';

type Health = { status: string; demoMode: boolean; clock: { now: string; frozen: boolean } };

/**
 * Field PWA (CLAUDE.md §16): login → assignments → offline pack → Walk & Mark → s.12 notice →
 * joint inspection → review → submit → sync. Everything after login works in airplane mode.
 */
export function App() {
  const online = useOnline();
  const profile = useProfile();
  const route = useRoute();
  const [demoMode, setDemoMode] = useState(false);

  // Online again: fetch a fresh access token (refresh cookie) and flush the queue. The Sync now
  // button stays the guaranteed path (§16.4) — this is a convenience.
  useEffect(() => {
    if (!online) return;
    fetch('/api/v1/health')
      .then((r) => (r.ok ? (r.json() as Promise<Health>) : null))
      .then((h) => setDemoMode(!!h?.demoMode))
      .catch(() => undefined);
    if (!profile) return;
    void (async () => {
      if (!(await resumeSession().catch(() => true))) return; // offline-ish failures keep the cached profile
      const queued = await db.outbox.where('status').equals('queued').count();
      if (queued) await syncNow();
    })();
    // Only on connectivity changes / sign-in, not every render.
  }, [online, profile?.user.id]);

  if (!profile) {
    if (route[0] !== 'login') go('login');
    return <Login />;
  }

  const [screen, id, tab] = route;
  if (screen === 'survey' && id) return <SurveyShell clientId={id} tab={tab ?? 'walk'} demoMode={demoMode} />;
  if (screen === 'sync') return <SyncStatus demoMode={demoMode} />;
  if (screen !== 'assignments') go('assignments');
  return <Assignments profile={profile} demoMode={demoMode} />;
}
