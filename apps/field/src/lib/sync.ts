import { ApiProblem, OfflineError, problemFrom, type ApiClient } from './api';
import { db } from './db';
import { uuid } from './ids';
import type { OutboxRow, PhotoRow, SurveyRow } from './types';

// Sync engine (§16.4). Runs from the "Sync now" button, on the `online` event, and from the service
// worker's Background Sync handler where the browser supports it (not iOS Safari). DOM-free.
//
//   1. photos first — POST /field/photos (multipart + sha256/lat/lng/accuracy/capturedAt)
//   2. then POST /field/sync { ops } in outbox order, each op carrying its own idempotencyKey
//
// A photo the server refuses (e.g. SHA256_MISMATCH) is marked `rejected` with the server's reason
// and never retried automatically; its survey is held until the officer retries or drops the photo.

export const SYNC_TAG = 'bhoomisetu-field-sync';
const LOCK = 'bhoomisetu-field-sync';
const MAX_OPS_PER_REQUEST = 500; // server limit

export type SyncOutcome =
  | { status: 'done'; synced: number; rejected: number; held: number }
  | { status: 'nothing' }
  | { status: 'offline' }
  | { status: 'busy' }
  | { status: 'auth'; message: string }
  | { status: 'error'; message: string };

export async function runSync(api: ApiClient): Promise<SyncOutcome> {
  // One sync at a time across the page and the service worker.
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks)
    return await navigator.locks.request(LOCK, { ifAvailable: true }, (lock) =>
      lock ? syncOnce(api) : Promise.resolve<SyncOutcome>({ status: 'busy' }),
    );
  return syncOnce(api);
}

/** Queued work the Sync button would send. */
export async function pendingCount(): Promise<number> {
  return db.outbox.where('status').anyOf('queued', 'uploading').count();
}

async function syncOnce(api: ApiClient): Promise<SyncOutcome> {
  // A crash mid-upload leaves rows marked in-flight; they were never confirmed, so send them again.
  await db.outbox.where('status').equals('uploading').modify({ status: 'queued' });
  await db.photos.where('status').equals('uploading').modify({ status: 'pending' });

  const queued = await db.outbox.where('status').equals('queued').sortBy('id');
  if (!queued.length) return { status: 'nothing' };

  try {
    if (!api.token && !(await api.refresh()))
      return { status: 'auth', message: 'Your session has expired — sign in again (your data is safe on this device).' };

    const surveyIds = [...new Set(queued.map((o) => o.surveyClientId))];

    // ---- 1. photos
    const photoIds = new Set(queued.map((o) => o.photoLocalId).filter((x): x is string => !!x));
    const photos = (await db.photos.bulkGet([...photoIds])).filter((p): p is PhotoRow => !!p);
    for (const p of photos.filter((x) => x.status === 'pending')) {
      const outcome = await uploadPhoto(api, p);
      if (outcome !== 'ok' && outcome !== 'rejected') return outcome;
    }

    // ---- 2. ops, per survey, only once every photo it refers to is settled
    const settled = new Map((await db.photos.bulkGet([...photoIds])).filter((p): p is PhotoRow => !!p).map((p) => [p.localId, p]));
    const ready: OutboxRow[] = [];
    let held = 0;
    for (const sid of surveyIds) {
      const ops = queued.filter((o) => o.surveyClientId === sid);
      const refs = ops.map((o) => (o.photoLocalId ? settled.get(o.photoLocalId) : undefined)).filter((p): p is PhotoRow => !!p);
      const blocked = refs.find((p) => p.status === 'rejected');
      const waiting = refs.some((p) => p.status === 'pending' || p.status === 'uploading');
      if (blocked) {
        held++;
        await db.surveys.update(sid, {
          lastError: `Photo refused by the server: ${blocked.lastError ?? 'rejected'}. Retry it or send without it.`,
        });
        continue;
      }
      if (waiting) {
        held++;
        continue;
      }
      for (const o of ops) {
        if (o.photoLocalId && o.photoField) {
          const p = settled.get(o.photoLocalId);
          o.payload = { ...o.payload, [o.photoField]: p?.status === 'uploaded' ? p.documentId : null };
        }
        ready.push(o);
      }
    }

    let synced = 0;
    let rejected = 0;
    for (let i = 0; i < ready.length; i += MAX_OPS_PER_REQUEST) {
      const chunk = ready.slice(i, i + MAX_OPS_PER_REQUEST);
      const r = await sendOps(api, chunk);
      if (typeof r !== 'object') return r === 'offline' ? { status: 'offline' } : { status: 'auth', message: 'Sign in again.' };
      synced += r.synced;
      rejected += r.rejected;
    }
    for (const sid of surveyIds) await settleSurvey(sid);
    return { status: 'done', synced, rejected, held };
  } catch (e) {
    if (e instanceof OfflineError) return { status: 'offline' };
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

type StepOutcome = 'ok' | 'rejected' | { status: 'offline' } | { status: 'auth'; message: string } | { status: 'error'; message: string };

async function uploadPhoto(api: ApiClient, p: PhotoRow): Promise<StepOutcome> {
  await db.photos.update(p.localId, { status: 'uploading', attempts: p.attempts + 1 });
  const form = new FormData();
  form.set('projectId', p.projectId);
  form.set('surveyClientId', p.surveyClientId);
  form.set('kind', p.kind);
  form.set('sha256', p.sha256);
  form.set('lat', String(p.lat));
  form.set('lng', String(p.lng));
  form.set('accuracy', String(p.accuracy));
  form.set('capturedAt', p.capturedAt);
  if (p.attest) form.set('attest', 'true');
  form.set('file', p.blob, `${p.localId}.jpg`);
  let res: Response;
  try {
    res = await api.request('/field/photos', {
      method: 'POST',
      body: form,
      headers: { 'idempotency-key': `photo:${p.sha256}` },
    });
  } catch (e) {
    await db.photos.update(p.localId, { status: 'pending' });
    if (e instanceof OfflineError) return { status: 'offline' };
    throw e;
  }
  if (res.ok) {
    const doc = (await res.json()) as { id: string };
    await db.photos.update(p.localId, { status: 'uploaded', documentId: doc.id, lastError: undefined });
    return 'ok';
  }
  const problem = await problemFrom(res);
  if (res.status === 401) {
    await db.photos.update(p.localId, { status: 'pending' });
    return { status: 'auth', message: 'Your session has expired — sign in again (your data is safe on this device).' };
  }
  if (res.status >= 500 || res.status === 408 || res.status === 429) {
    await db.photos.update(p.localId, { status: 'pending', lastError: problem.message });
    return { status: 'error', message: `Server problem uploading a photo: ${problem.message}` };
  }
  // A definite refusal (SHA256_MISMATCH, FILE_TYPE_NOT_ALLOWED, …): show it, don't loop.
  await db.photos.update(p.localId, { status: 'rejected', lastError: `${problem.code}: ${problem.message}` });
  return 'rejected';
}

interface OpResult {
  idempotencyKey: string;
  op: string;
  status: 'applied' | 'rejected';
  result?: unknown;
  code?: string;
  reason?: string;
}

async function sendOps(api: ApiClient, ops: OutboxRow[]): Promise<{ synced: number; rejected: number } | 'offline' | 'auth'> {
  const ids = ops.map((o) => o.id!);
  await db.outbox.bulkUpdate(ops.map((o) => ({ key: o.id!, changes: { status: 'uploading' as const, attempts: o.attempts + 1, payload: o.payload } })));
  let body: { results: OpResult[] };
  try {
    body = await api.json<{ results: OpResult[] }>('/field/sync', {
      method: 'POST',
      headers: { 'idempotency-key': `field-sync:${uuid()}` },
      body: JSON.stringify({ ops: ops.map((o) => ({ op: o.op, idempotencyKey: o.idempotencyKey, payload: o.payload })) }),
    });
  } catch (e) {
    if (e instanceof OfflineError) {
      await db.outbox.where('id').anyOf(ids).modify({ status: 'queued' });
      return 'offline';
    }
    if (e instanceof ApiProblem && e.status === 401) {
      await db.outbox.where('id').anyOf(ids).modify({ status: 'queued' });
      return 'auth';
    }
    if (e instanceof ApiProblem && e.status < 500) {
      // The whole batch was refused (validation, role): every op carries the reason.
      const first = (e.extra.errors as Array<{ path: string; message: string }> | undefined)?.[0];
      const reason = `${e.code}: ${e.message}${first ? ` (${first.path}: ${first.message})` : ''}`;
      await db.outbox.where('id').anyOf(ids).modify({ status: 'rejected', lastError: reason });
      return { synced: 0, rejected: ops.length };
    }
    await db.outbox.where('id').anyOf(ids).modify({ status: 'queued' });
    throw e;
  }
  const byKey = new Map(body.results.map((r) => [r.idempotencyKey, r]));
  let synced = 0;
  let rejected = 0;
  await db.transaction('rw', db.outbox, async () => {
    for (const o of ops) {
      const r = byKey.get(o.idempotencyKey);
      if (!r) await db.outbox.update(o.id!, { status: 'queued' });
      else if (r.status === 'applied') {
        synced++;
        await db.outbox.update(o.id!, { status: 'synced', result: r.result, lastError: undefined });
      } else {
        rejected++;
        await db.outbox.update(o.id!, { status: 'rejected', lastError: `${r.code ?? 'REJECTED'}: ${r.reason ?? 'Rejected by the server.'}` });
      }
    }
  });
  return { synced, rejected };
}

/** Roll op statuses up to the survey (§16.2 screen 9: queued / uploading / synced / rejected). */
async function settleSurvey(clientId: string): Promise<void> {
  const ops = await db.outbox.where('surveyClientId').equals(clientId).sortBy('id');
  if (!ops.length) return;
  const firstRejected = ops.find((o) => o.status === 'rejected');
  const submit = ops.find((o) => o.op === 'SUBMIT_SURVEY');
  if (firstRejected) {
    await db.surveys.update(clientId, { status: 'rejected', lastError: `${firstRejected.op} — ${firstRejected.lastError}` });
  } else if (ops.every((o) => o.status === 'synced')) {
    await db.surveys.update(clientId, {
      status: 'synced',
      lastError: undefined,
      serverResult: submit?.result as SurveyRow['serverResult'],
    });
  }
}

/** Re-queue a survey's rejected ops (same idempotency keys — the server only stores successes). */
export async function retryRejected(clientId: string): Promise<void> {
  await db.transaction('rw', db.outbox, db.surveys, async () => {
    await db.outbox.where('surveyClientId').equals(clientId).filter((o) => o.status === 'rejected').modify({ status: 'queued', lastError: undefined });
    await db.surveys.update(clientId, { status: 'queued', lastError: undefined });
  });
}

/** Re-hash the stored bytes and try the upload again (fixes a stale/incorrect local sha256). */
export async function retryPhoto(localId: string, rehash: (b: Blob) => Promise<string>): Promise<void> {
  const p = await db.photos.get(localId);
  if (!p) return;
  await db.photos.update(localId, { status: 'pending', sha256: await rehash(p.blob), lastError: undefined });
  await db.surveys.update(p.surveyClientId, { lastError: undefined });
}

/** Send the survey without this photo (its op goes with a null document id). */
export async function dropPhoto(localId: string): Promise<void> {
  const p = await db.photos.get(localId);
  if (!p) return;
  await db.photos.update(localId, { status: 'dropped' });
  await db.surveys.update(p.surveyClientId, { lastError: undefined });
}
