import { useEffect, useState } from 'react';
import { Header, useOnline } from '../components/Header';
import { Button, Card, ErrorText, StatusPill } from '../components/ui';
import { ApiProblem, OfflineError } from '../lib/api';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { downloadOfflinePack, refreshAssignments } from '../lib/offline-pack';
import { go } from '../lib/router';
import { logout, type Profile } from '../lib/session';
import { openSurvey } from '../lib/survey';

const message = (e: unknown) =>
  e instanceof OfflineError ? 'Offline — connect to download.' : e instanceof ApiProblem ? e.message : 'Something went wrong.';

/** §16.2 screen 2 — assignments, each with "Download offline pack". */
export function Assignments({ profile, demoMode }: { profile: Profile; demoMode: boolean }) {
  const online = useOnline();
  const assignments = useLive(() => db.assignments.toArray(), []);
  const packs = useLive(() => db.offlinePacks.toArray(), []);
  const surveys = useLive(() => db.surveys.toArray(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (online) refreshAssignments().catch((e: unknown) => setError(message(e)));
  }, [online]);

  async function download(id: string) {
    setBusy(id);
    setError(null);
    try {
      const { basemap } = await downloadOfflinePack(id);
      setNotes((n) => ({ ...n, [id]: basemap.ok ? 'Offline pack and basemap saved.' : `Offline pack saved. ${basemap.message ?? ''}` }));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  async function open(id: string) {
    const row = await db.offlinePacks.get(id);
    if (!row) return;
    const s = await openSurvey(row.pack);
    go(`survey/${s.clientId}/walk`);
  }

  async function signOut() {
    const unsynced = await db.outbox.where('status').anyOf('queued', 'uploading', 'rejected').count();
    if (unsynced && !confirm(`${unsynced} item(s) are not synced yet. They stay on this device. Sign out anyway?`)) return;
    await logout();
    go('login');
  }

  const packById = new Map((packs ?? []).map((p) => [p.projectParcelId, p]));
  return (
    <div className="min-h-full bg-slate-50">
      <Header title="Assignments" demoMode={demoMode} />
      <main className="space-y-3 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-700">
            {profile.user.fullName} · <span className="text-slate-500">{profile.activePost.designation}</span>
          </span>
          <button type="button" onClick={signOut} className="text-teal-800 underline">
            Sign out
          </button>
        </div>
        <ErrorText>{error}</ErrorText>
        {assignments === undefined && <p className="text-sm text-slate-500">Loading…</p>}
        {assignments?.length === 0 && (
          <p className="text-sm text-slate-600">{online ? 'No parcels assigned to you.' : 'Offline — no cached assignments yet.'}</p>
        )}
        {assignments?.map((a) => {
          const pack = packById.get(a.project_parcel_id);
          const local = (surveys ?? []).filter((s) => s.projectParcelId === a.project_parcel_id);
          const latest = local.sort((x, y) => y.startedAt.localeCompare(x.startedAt))[0];
          return (
            <Card key={a.project_parcel_id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    Survey no. {a.survey_no} · {a.village_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.project_code} — {a.project_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    Boundary: {a.boundary_source.replace(/_/g, ' ').toLowerCase()} · {a.status.replace(/_/g, ' ').toLowerCase()}
                  </p>
                </div>
                {latest && <StatusPill status={latest.status} />}
              </div>
              {notes[a.project_parcel_id] && <p className="text-xs text-slate-600">{notes[a.project_parcel_id]}</p>}
              {pack && (
                <p className="text-xs text-slate-500">
                  Pack downloaded {new Date(pack.downloadedAt).toLocaleString()}
                  {!pack.basemap.ok && ' · basemap missing'}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant={pack ? 'secondary' : 'primary'}
                  disabled={!online || busy === a.project_parcel_id}
                  onClick={() => download(a.project_parcel_id)}
                >
                  {busy === a.project_parcel_id ? 'Downloading…' : pack ? 'Re-download' : 'Download offline pack'}
                </Button>
                {pack && <Button onClick={() => open(a.project_parcel_id)}>{latest?.status === 'draft' ? 'Continue' : 'Walk & Mark'}</Button>}
              </div>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
