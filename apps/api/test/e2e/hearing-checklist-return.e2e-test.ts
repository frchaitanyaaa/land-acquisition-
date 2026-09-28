import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { api, auth, bootApp, closeApp, closeDb, loginAs, type Session } from './harness';

// §32.5: "Hearing NULLIFY and repeat" + "RETURN with a valid reason code (and confirm the guard
// blocks a missing one), then resubmit and approve." Combined into one fixture because a real
// SIA_PUBLIC hearing is exactly what S02_SIA's checklist needs before SUBMIT becomes available —
// building the hearing and then driving SUBMIT/RETURN off the same project exercises the guard
// engine, the hearing validity rules (packages/rules/src/hearing.ts), and the checklist-satisfied
// gate together, on one realistic path, instead of three disconnected fixtures.
//
// Fixture: MH-NGP... no — MH-MAN-2026-009 (GOVERNMENT, Maharashtra pack), currently at S02_SIA,
// Pune district. Not a named demo hook (CLAUDE.md §33.6), so mutating it here is safe.
const PROJECT_ID = 'aef99f94-67ac-4fd8-b08d-45ec7858b7fa';
const STAGE = 'S02_SIA';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function uploadDoc(
  app: INestApplication,
  session: Session,
  opts: { entityType: string; entityId: string; docType: string; title: string },
) {
  const res = await api(app)
    .post('/api/v1/documents')
    .set(auth(session))
    .field('entityType', opts.entityType)
    .field('entityId', opts.entityId)
    .field('projectId', PROJECT_ID)
    .field('docType', opts.docType)
    .field('title', opts.title)
    .field('attest', 'true')
    .attach('file', PNG, 'evidence.png')
    .expect(201);
  return res.body.id as string;
}

describe('hearing lifecycle → checklist-gated SUBMIT → RETURN guard', () => {
  let app: INestApplication;
  let collector: Session;
  let lao: Session;
  let now: Date;

  beforeAll(async () => {
    app = await bootApp();
    collector = await loginAs(app, 'collector.pune@bhoomisetu.local');
    lao = await loginAs(app, 'lao.pune@bhoomisetu.local');
    const health = await api(app).get('/api/v1/health').expect(200);
    now = new Date(health.body.clock.now);
  }, 60_000);

  afterAll(async () => {
    await closeApp();
    await closeDb();
  });

  it('schedules a hearing, nullifies it, and schedules a second attempt', async () => {
    const scheduledAt = new Date(now.getTime() + 10 * 86_400_000).toISOString();
    const first = await api(app)
      .post(`/api/v1/projects/${PROJECT_ID}/hearings`)
      .set(auth(collector))
      .send({ type: 'SIA_PUBLIC', scheduledAt, venue: 'Gram Panchayat Hall' })
      .expect(201);
    expect(first.body.attempt).toBe(1);

    const nullified = await api(app)
      .post(`/api/v1/hearings/${first.body.id}/nullify`)
      .set(auth(collector))
      .send({ reasonCode: 'INADEQUATE_NOTICE' })
      .expect(200);
    expect(nullified.body.status).toBe('VOID');

    const second = await api(app)
      .post(`/api/v1/projects/${PROJECT_ID}/hearings`)
      .set(auth(collector))
      .send({ type: 'SIA_PUBLIC', scheduledAt, venue: 'Gram Panchayat Hall (repeat)' })
      .expect(201);
    expect(second.body.attempt).toBe(2);
  });

  it('a hearing missing evidence fails validation with the expected reason codes', async () => {
    const hearings = await api(app).get(`/api/v1/projects/${PROJECT_ID}/hearings`).set(auth(collector)).expect(200);
    const attempt2 = hearings.body.find((h: { attempt: number; status: string }) => h.attempt === 2);
    const res = await api(app).post(`/api/v1/hearings/${attempt2.id}/validate`).set(auth(collector)).expect(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.failures.map((f: { code: string }) => f.code)).toContain('NO_QUORUM');
  });

  it('attaching evidence and publishing notice ≥ 21 days ahead makes the hearing VALID', async () => {
    const hearings = await api(app).get(`/api/v1/projects/${PROJECT_ID}/hearings`).set(auth(collector)).expect(200);
    const attempt2 = hearings.body.find((h: { attempt: number }) => h.attempt === 2);
    const scheduledAt = new Date(attempt2.scheduledAt);
    const noticePublishedAt = new Date(scheduledAt.getTime() - 25 * 86_400_000).toISOString();

    const summaryDoc = await uploadDoc(app, collector, {
      entityType: 'hearing',
      entityId: attempt2.id,
      docType: 'LOCAL_LANGUAGE_SUMMARY',
      title: 'e2e local language summary',
    });
    const recordingDoc = await uploadDoc(app, collector, {
      entityType: 'hearing',
      entityId: attempt2.id,
      docType: 'HEARING_RECORDING',
      title: 'e2e recording',
    });
    const attendanceDoc = await uploadDoc(app, collector, {
      entityType: 'hearing',
      entityId: attempt2.id,
      docType: 'ATTENDANCE_REGISTER',
      title: 'e2e attendance',
    });

    await api(app)
      .post(`/api/v1/hearings/${attempt2.id}/documents`)
      .set(auth(collector))
      .send({
        documents: { LOCAL_LANGUAGE_SUMMARY: summaryDoc, RECORDING: recordingDoc, ATTENDANCE: attendanceDoc },
        noticePublishedAt,
        quorumMet: true,
      })
      .expect(200);

    const res = await api(app).post(`/api/v1/hearings/${attempt2.id}/validate`).set(auth(collector)).expect(200);
    expect(res.body.status).toBe('VALID');
    expect(res.body.valid).toBe(true);
  });

  it('uploading the remaining checklist documents makes SUBMIT available on S02_SIA', async () => {
    for (const docType of ['SIA_REPORT_FINAL', 'SIMP_FINAL', 'CPR_INVENTORY_REPORT']) {
      await uploadDoc(app, lao, { entityType: 'project', entityId: PROJECT_ID, docType, title: `e2e ${docType}` });
    }
    const res = await api(app)
      .get(`/api/v1/projects/${PROJECT_ID}/stages/${STAGE}/actions`)
      .set(auth(lao))
      .expect(200);
    expect(res.body.checklist.every((c: { satisfied: boolean }) => c.satisfied)).toBe(true);
    const submit = res.body.actions.find((a: { action: string }) => a.action === 'SUBMIT');
    expect(submit.allowed).toBe(true);
  });

  it('LAO submits S02_SIA', async () => {
    const res = await api(app)
      .post(`/api/v1/projects/${PROJECT_ID}/stages/${STAGE}/actions`)
      .set(auth(lao))
      .send({ action: 'SUBMIT' })
      .expect(200);
    expect(res.body.stageInstance.status).toBe('SUBMITTED');
  });

  it('the Collector cannot RETURN with a reason code outside the pack’s S02_SIA allowlist', async () => {
    const res = await api(app)
      .post(`/api/v1/projects/${PROJECT_ID}/stages/${STAGE}/actions`)
      .set(auth(collector))
      .send({ action: 'RETURN', reasonCode: 'NOT_A_REAL_REASON_CODE', remarks: 'bad code' })
      .expect(422);
    expect(res.body.code).toBe('GUARD_FAILED');
  });

  it('the Collector RETURNs S02_SIA with a valid reason code', async () => {
    const res = await api(app)
      .post(`/api/v1/projects/${PROJECT_ID}/stages/${STAGE}/actions`)
      .set(auth(collector))
      .send({ action: 'RETURN', reasonCode: 'INCOMPLETE_CPR_LIST', remarks: 'e2e: CPR list needs the grazing land' })
      .expect(200);
    expect(res.body.stageInstance.status).toBe('RETURNED');
    expect(res.body.transition.action).toBe('RETURN');
    expect(res.body.transition.reasonCode).toBe('INCOMPLETE_CPR_LIST');

    const timeline = await api(app).get(`/api/v1/projects/${PROJECT_ID}/timeline`).set(auth(collector)).expect(200);
    const stage = timeline.body.stages.find((s: { code: string }) => s.code === STAGE);
    const returnTransitions = stage.attempts.flatMap((a: { transitions: Array<{ action: string }> }) => a.transitions);
    expect(returnTransitions.filter((t: { action: string }) => t.action === 'RETURN')).toHaveLength(1);
  });
});
