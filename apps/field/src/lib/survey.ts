import { db } from './db';
import { sha256Hex, uuid } from './ids';
import type { Fix } from './position';
import type { JirItemType, OfflinePack, OutboxRow, PhotoKind, SurveyRow } from './types';

// Local survey editing (§16.2 screens 4–8). Nothing here touches the network.

export async function openSurvey(pack: OfflinePack): Promise<SurveyRow> {
  const a = pack.assignment;
  const existing = await db.surveys
    .where('projectParcelId')
    .equals(a.projectParcelId)
    .filter((s) => s.status === 'draft')
    .first();
  if (existing) return existing;
  const s: SurveyRow = {
    clientId: uuid(),
    projectParcelId: a.projectParcelId,
    projectId: a.projectId,
    parcelId: a.parcelId,
    surveyType: 'PARCEL_IDENTIFICATION',
    startedAt: new Date().toISOString(),
    status: 'draft',
    closed: false,
    track: [],
  };
  await db.surveys.add(s);
  return s;
}

export async function savePhoto(input: {
  surveyClientId: string;
  projectId: string;
  kind: PhotoKind;
  blob: Blob;
  fix: Fix;
  capturedAt: string;
  attest?: boolean;
}): Promise<string> {
  const localId = uuid();
  await db.photos.add({
    localId,
    surveyClientId: input.surveyClientId,
    projectId: input.projectId,
    kind: input.kind,
    blob: input.blob,
    sha256: await sha256Hex(input.blob),
    lat: input.fix.lat,
    lng: input.fix.lng,
    accuracy: Math.round(input.fix.accuracy * 10) / 10,
    capturedAt: input.capturedAt,
    attest: input.attest ?? false,
    status: 'pending',
    attempts: 0,
  });
  return localId;
}

export async function deletePhoto(localId: string | undefined): Promise<void> {
  if (localId) await db.photos.delete(localId);
}

export const surveyVertices = (clientId: string) =>
  db.vertices.where('surveyClientId').equals(clientId).sortBy('seq');

export async function addVertex(
  clientId: string,
  v: { lat: number; lng: number; accuracyM: number; samples: number; capturedAt: string },
  photoLocalId: string,
): Promise<void> {
  await db.transaction('rw', db.vertices, db.surveys, async () => {
    const s = await db.surveys.get(clientId);
    if (!s || s.status !== 'draft' || s.closed) throw new Error('This survey is closed for new points.');
    const seq = (await db.vertices.where('surveyClientId').equals(clientId).count()) + 1;
    await db.vertices.add({
      surveyClientId: clientId,
      seq,
      lat: v.lat,
      lng: v.lng,
      accuracyM: v.accuracyM,
      samplesAveraged: v.samples,
      photoLocalId,
      capturedAt: v.capturedAt,
    });
  });
}

export async function undoLastVertex(clientId: string): Promise<void> {
  await db.transaction('rw', db.vertices, db.photos, db.surveys, async () => {
    const s = await db.surveys.get(clientId);
    if (!s || s.status !== 'draft') return;
    const vs = await surveyVertices(clientId);
    const last = vs[vs.length - 1];
    if (!last) return;
    await db.vertices.delete([clientId, last.seq]);
    await db.photos.delete(last.photoLocalId);
    if (s.closed) await db.surveys.update(clientId, { closed: false });
  });
}

export const setClosed = (clientId: string, closed: boolean) => db.surveys.update(clientId, { closed });

/** Walked track (§16.2): appended while Walk & Mark is open. */
export async function appendTrack(clientId: string, fix: Fix): Promise<void> {
  const s = await db.surveys.get(clientId);
  if (!s || s.status !== 'draft') return;
  if (s.track.length >= 20_000) return; // server cap
  await db.surveys.update(clientId, { track: [...s.track, [fix.lng, fix.lat]] });
}

export async function saveNotice(clientId: string, servedOn: string, photoLocalId: string): Promise<void> {
  const s = await db.surveys.get(clientId);
  if (s?.notice && s.notice.photoLocalId !== photoLocalId) await deletePhoto(s.notice.photoLocalId);
  await db.surveys.update(clientId, { notice: { servedOn, photoLocalId } });
}

export async function addJirItem(input: {
  surveyClientId: string;
  itemType: JirItemType;
  description: string;
  quantity: number | null;
  unit: string;
  photoLocalId: string;
  fix: Fix | null;
}): Promise<void> {
  await db.jirItems.add({
    localId: uuid(),
    surveyClientId: input.surveyClientId,
    itemType: input.itemType,
    description: input.description,
    quantity: input.quantity,
    unit: input.unit,
    photoLocalId: input.photoLocalId,
    lat: input.fix?.lat ?? null,
    lng: input.fix?.lng ?? null,
    createdAt: new Date().toISOString(),
  });
}

export async function deleteJirItem(localId: string): Promise<void> {
  const j = await db.jirItems.get(localId);
  await db.jirItems.delete(localId);
  await deletePhoto(j?.photoLocalId);
}

export async function addPillar(surveyClientId: string, pillarNo: number, fix: Fix, photoLocalId: string) {
  await db.pillars.add({ localId: uuid(), surveyClientId, pillarNo, lat: fix.lat, lng: fix.lng, photoLocalId });
}

export async function deletePillar(localId: string): Promise<void> {
  const p = await db.pillars.get(localId);
  await db.pillars.delete(localId);
  await deletePhoto(p?.photoLocalId);
}

/**
 * Submit (§16.2 screen 8): freeze the survey and queue the whole thing as ordered sync ops (§16.4).
 * Idempotency keys are derived from the survey's client id, so re-sending any op is always safe.
 */
export async function queueSurvey(clientId: string, localFlags: Record<string, string>): Promise<void> {
  await db.transaction('rw', [db.surveys, db.vertices, db.jirItems, db.pillars, db.outbox], async () => {
    const s = await db.surveys.get(clientId);
    if (!s || s.status !== 'draft') throw new Error('Only a draft survey can be submitted.');
    const vs = await surveyVertices(clientId);
    const jir = await db.jirItems.where('surveyClientId').equals(clientId).sortBy('createdAt');
    const pillars = await db.pillars.where('surveyClientId').equals(clientId).sortBy('pillarNo');
    const k = (suffix: string) => `field:${clientId}:${suffix}`;
    const ops: OutboxRow[] = [];
    const op = (o: Omit<OutboxRow, 'surveyClientId' | 'status' | 'attempts'>) =>
      ops.push({ ...o, surveyClientId: clientId, status: 'queued', attempts: 0 });

    op({
      idempotencyKey: k('create'),
      op: 'CREATE_SURVEY',
      payload: {
        clientId,
        projectId: s.projectId,
        parcelId: s.parcelId,
        surveyType: s.surveyType,
        startedAt: s.startedAt,
        deviceInfo: { userAgent: navigator.userAgent, app: 'bhoomisetu-field' },
      },
    });
    if (s.notice)
      op({
        idempotencyKey: k('notice'),
        op: 'SET_NOTICE',
        payload: { surveyClientId: clientId, servedOn: s.notice.servedOn },
        photoLocalId: s.notice.photoLocalId,
        photoField: 'documentId',
      });
    for (const v of vs)
      op({
        idempotencyKey: k(`vertex:${v.seq}`),
        op: 'ADD_VERTEX',
        payload: {
          surveyClientId: clientId,
          seq: v.seq,
          lat: v.lat,
          lng: v.lng,
          accuracyM: Math.min(v.accuracyM, 10_000), // server schema limit
          captureMethod: 'GPS_WALKED',
          samplesAveraged: v.samplesAveraged,
          capturedAt: v.capturedAt,
        },
        photoLocalId: v.photoLocalId,
        photoField: 'photoDocumentId',
      });
    for (const j of jir)
      op({
        idempotencyKey: k(`jir:${j.localId}`),
        op: 'ADD_JIR_ITEM',
        payload: {
          surveyClientId: clientId,
          itemType: j.itemType,
          description: j.description || null,
          quantity: j.quantity,
          unit: j.unit || null,
          lat: j.lat,
          lng: j.lng,
        },
        photoLocalId: j.photoLocalId,
        photoField: 'photoDocumentId',
      });
    for (const p of pillars)
      op({
        idempotencyKey: k(`pillar:${p.localId}`),
        op: 'ADD_PILLAR',
        payload: { surveyClientId: clientId, pillarNo: p.pillarNo, lat: p.lat, lng: p.lng },
        photoLocalId: p.photoLocalId,
        photoField: 'photoDocumentId',
      });
    op({
      idempotencyKey: k('submit'),
      op: 'SUBMIT_SURVEY',
      payload: { surveyClientId: clientId, ...(s.track.length >= 2 ? { track: s.track } : {}) },
    });

    await db.outbox.bulkAdd(ops);
    await db.surveys.update(clientId, {
      status: 'queued',
      closed: true,
      submittedAt: new Date().toISOString(),
      localFlags,
      lastError: undefined,
    });
  });
}
