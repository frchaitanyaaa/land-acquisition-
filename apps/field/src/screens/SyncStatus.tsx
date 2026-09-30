import { useState } from 'react';
import { Header, useOnline } from '../components/Header';
import { Button, Card, StatusPill } from '../components/ui';
import { db } from '../lib/db';
import { sha256Hex } from '../lib/ids';
import { useLive } from '../lib/live';
import { go } from '../lib/router';
import { dropPhoto, retryPhoto, retryRejected, type SyncOutcome } from '../lib/sync';
import { syncNow } from '../lib/sync-trigger';
import type { OutboxRow, PhotoRow, SurveyRow } from '../lib/types';

function describe(r: SyncOutcome): string {
  switch (r.status) {
    case 'nothing':
      return 'Nothing to sync.';
    case 'offline':
      return 'Offline — everything stays queued on this device.';
    case 'busy':
      return 'A sync is already running.';
    case 'auth':
    case 'error':
      return r.message;
    case 'done':
      return `Synced ${r.synced} item(s)${r.rejected ? `, ${r.rejected} rejected` : ''}${r.held ? `, ${r.held} survey(s) waiting` : ''}.`;
  }
}

/** §16.2 screen 9 — queued / uploading / synced / rejected (with reason), and the Sync now button (§16.4). */
export function SyncStatus({ demoMode }: { demoMode: boolean }) {
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<SyncOutcome | null>(null);
  const data = useLive(async () => {
    const surveys = (await db.surveys.where('status').anyOf('queued', 'synced', 'rejected').toArray()).sort((a, b) =>
      (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''),
    );
    const ids = surveys.map((s) => s.clientId);
    const [ops, photos] = await Promise.all([
      db.outbox.where('surveyClientId').anyOf(ids).toArray(),
      db.photos.where('surveyClientId').anyOf(ids).toArray(),
    ]);
    return { surveys, ops, photos };
  }, []);

  async function run() {
    setBusy(true);
    setLast(await syncNow());
    setBusy(false);
  }

  return (
    <div className="min-h-full bg-slate-50">
      <Header title="Sync" back="assignments" demoMode={demoMode} />
      <main className="space-y-3 p-4">
        <Button className="w-full py-3" disabled={busy || !online} onClick={run}>
          {busy ? 'Syncing…' : online ? 'Sync now' : 'Offline — Sync now when connected'}
        </Button>
        {last && <p className="text-sm text-slate-700">{describe(last)}</p>}
        {data?.surveys.length === 0 && <p className="text-sm text-slate-600">No submitted surveys on this device.</p>}
        {data?.surveys.map((s) => (
          <SurveyCard
            key={s.clientId}
            survey={s}
            ops={data.ops.filter((o) => o.surveyClientId === s.clientId).sort((a, b) => a.id! - b.id!)}
            photos={data.photos.filter((p) => p.surveyClientId === s.clientId)}
          />
        ))}
      </main>
    </div>
  );
}

function SurveyCard({ survey, ops, photos }: { survey: SurveyRow; ops: OutboxRow[]; photos: PhotoRow[] }) {
  const [open, setOpen] = useState(false);
  const count = (status: string) => ops.filter((o) => o.status === status).length;
  const inFlight = count('uploading') > 0 || photos.some((p) => p.status === 'uploading');
  const status = inFlight ? 'uploading' : survey.status;
  const rejectedPhotos = photos.filter((p) => p.status === 'rejected');
  const serverFlags = survey.serverResult?.flags;
  const localKeys = Object.keys(survey.localFlags ?? {}).sort();
  const serverKeys = serverFlags ? Object.keys(serverFlags).sort() : null;

  return (
    <Card className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <button type="button" className="text-left font-medium text-teal-800 underline" onClick={() => go(`survey/${survey.clientId}/review`)}>
          Survey {survey.clientId.slice(0, 8)}
        </button>
        <StatusPill status={status} />
      </div>
      <p className="text-xs text-slate-500">
        Submitted {survey.submittedAt ? new Date(survey.submittedAt).toLocaleString() : '—'} · ops: {count('synced')} synced, {count('queued')} queued,{' '}
        {count('rejected')} rejected · photos: {photos.filter((p) => p.status === 'uploaded').length}/{photos.length} uploaded
      </p>
      {survey.lastError && <p className="rounded-md bg-red-50 px-2 py-1.5 text-red-800">{survey.lastError}</p>}

      {rejectedPhotos.map((p) => (
        <div key={p.localId} className="space-y-1 rounded-md border border-red-200 p-2">
          <p className="text-red-800">
            {p.kind.replace(/_/g, ' ').toLowerCase()} refused — {p.lastError}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => retryPhoto(p.localId, sha256Hex)}>
              Re-check & retry
            </Button>
            <Button variant="ghost" onClick={() => dropPhoto(p.localId)}>
              Send without it
            </Button>
          </div>
        </div>
      ))}

      {survey.status === 'rejected' && (
        <Button variant="secondary" onClick={() => retryRejected(survey.clientId)}>
          Retry rejected items
        </Button>
      )}

      {survey.status === 'synced' && serverKeys && (
        <div className="rounded-md bg-slate-50 p-2 text-xs">
          <p className="font-semibold">Server checks</p>
          {serverKeys.length === 0 ? (
            <p className="text-emerald-800">No flags.</p>
          ) : (
            serverKeys.map((k) => (
              <p key={k}>
                <span className="font-mono font-semibold">{k}</span> — {serverFlags![k]}
              </p>
            ))
          )}
          <p className={`mt-1 ${sameKeys(localKeys, serverKeys) ? 'text-emerald-800' : 'text-amber-800'}`}>
            {sameKeys(localKeys, serverKeys)
              ? 'Matches what this device showed before submit.'
              : `This device showed: ${localKeys.join(', ') || 'no flags'}.`}
          </p>
          {survey.serverResult?.parcelVersion != null && <p>Parcel geometry now v{survey.serverResult.parcelVersion}.</p>}
        </div>
      )}

      <button type="button" className="text-xs text-slate-500 underline" onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide' : 'Show'} items
      </button>
      {open && (
        <ul className="space-y-1 text-xs">
          {ops.map((o) => (
            <li key={o.id} className="flex items-start justify-between gap-2 border-t border-slate-100 pt-1">
              <span className="font-mono">{o.op}</span>
              <span className="text-right">
                <StatusPill status={o.status} />
                {o.lastError && <span className="block text-red-700">{o.lastError}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const sameKeys = (a: string[], b: string[]) => a.length === b.length && a.every((k, i) => k === b[i]);
