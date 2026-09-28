import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { api, auth, bootApp, closeApp, closeDb, loginAs, type Session } from './harness';

// Exercises the STT pipeline built for this prompt (§17, §30, §31): uploading a hearing recording
// (POST /hearings/:id/audio) attaches the document and returns immediately; the stt job
// (apps/api/src/jobs/stt.service.ts) picks it up off the request path, transcribes it via the mock
// SttService (a committed demo transcript, data/demo-docs/hearing-audio-transcript.json), and
// files one objections ticket per segment with only ai_suggested_* filled (G3).
//
// Fixture: KA-BGM-2026-003 (GOVERNMENT), S05_NOTIFICATION, Belagavi district. Not a named demo
// hook (CLAUDE.md §33.6).
const PROJECT_ID = '75aa7acf-4e0b-47b0-bde6-0ad7866cc79f';

// Minimal valid WAV header (RIFF....WAVE) — enough for the magic-byte sniffer (§26.1), no audio data needed.
const WAV = Buffer.concat([
  Buffer.from('RIFF', 'latin1'),
  Buffer.from([0x24, 0, 0, 0]),
  Buffer.from('WAVE', 'latin1'),
  Buffer.alloc(8),
]);

describe('hearing audio → async stt job → objection tickets', () => {
  let app: INestApplication;
  let collector: Session;
  let hearingId: string;

  beforeAll(async () => {
    app = await bootApp();
    collector = await loginAs(app, 'dc.belagavi@bhoomisetu.local');
    const health = await api(app).get('/api/v1/health').expect(200);
    const scheduledAt = new Date(new Date(health.body.clock.now).getTime() + 15 * 86_400_000).toISOString();
    const hearing = await api(app)
      .post(`/api/v1/projects/${PROJECT_ID}/hearings`)
      .set(auth(collector))
      .send({ type: 'S15_OBJECTION', scheduledAt, venue: 'e2e venue' })
      .expect(201);
    hearingId = hearing.body.id;
  }, 60_000);

  afterAll(async () => {
    await closeApp();
    await closeDb();
  });

  it('uploading the recording attaches it to the hearing and returns immediately', async () => {
    const res = await api(app)
      .post(`/api/v1/hearings/${hearingId}/audio`)
      .set(auth(collector))
      .field('title', 'e2e hearing recording')
      .attach('file', WAV, 'hearing.wav')
      .expect(201);
    expect(res.body.recordingDocumentId).toBeTruthy();
  });

  it('the stt job transcribes it and files one objection ticket per segment, triaged into ai_suggested_* only', async () => {
    let objections: Array<{
      channel: string;
      body: string;
      aiSuggestedGround: string | null;
      aiSuggestedCategory: string | null;
      statutoryGround: string | null;
    }> = [];
    for (let i = 0; i < 20; i++) {
      const res = await api(app).get(`/api/v1/projects/${PROJECT_ID}/objections`).set(auth(collector)).expect(200);
      objections = res.body.filter((o: { channel: string }) => o.channel === 'hearing_audio');
      if (objections.length >= 3) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    expect(objections).toHaveLength(3);
    for (const o of objections) {
      expect(o.body.length).toBeGreaterThan(0);
      expect(o.aiSuggestedGround).toBeTruthy();
      expect(o.aiSuggestedCategory).toBeTruthy();
      // G3: the AI never writes the authoritative column, only ai_suggested_*.
      expect(o.statutoryGround).toBeFalsy();
    }
  }, 30_000);
});
