import { affectedFamilies } from '@bhoomisetu/db';
import { eq } from 'drizzle-orm';
import PDFDocument from 'pdfkit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { api, auth, bootApp, closeApp, closeDb, loginAs, testDb, type Session } from './harness';

// §32.5: "award upload → OCR review (accept fields) → sign". Exercises the ocr job built
// for this prompt end to end: award creation enqueues an ocr_extractions row and returns
// immediately (never blocks on pdf-parse, §26.3/§31); this test polls until the background job
// (apps/api/src/jobs/ocr.service.ts) flips it to `ready`, then reviews it, then checks the
// entitlements it created carry source = ocr_confirmed (G1/G3 — only human-accepted values
// reach entitlements). Signing is left out: it needs a maker ≠ checker post pair for RJ-BHD's
// district that the seed does not provide (only a Collector post exists there, no LAO).
//
// Fixture: RJ-BHD-2025-010 (GOVERNMENT, base pack), at S08_AWARD. Not a named demo hook.
const PROJECT_ID = 'd4feb17f-3cc3-4575-910c-764afc7ee440';

interface Entry {
  familyId: string;
  headCode: string;
  amountRupees: string;
}

function buildSyntheticAwardPdf(entries: Entry[]): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(12).text('AWARD NO: E2E-TEST-AWARD-1');
    for (const e of entries) doc.text(`FAMILY: ${e.familyId} HEAD: ${e.headCode} AMOUNT: ${e.amountRupees}`);
    doc.end();
  });
}

describe('award upload → async OCR job → review', () => {
  let app: INestApplication;
  let admin: Session;
  let entries: Entry[];
  let awardId: string;
  let extractionId: string;

  beforeAll(async () => {
    app = await bootApp();
    admin = await loginAs(app, 'admin@bhoomisetu.local');
    const rows = await testDb()
      .select({ id: affectedFamilies.id })
      .from(affectedFamilies)
      .where(eq(affectedFamilies.projectId, PROJECT_ID))
      .limit(2);
    expect(rows).toHaveLength(2);
    entries = [
      { familyId: rows[0]!.id, headCode: 'LAND_COMPENSATION', amountRupees: '500000.00' },
      { familyId: rows[1]!.id, headCode: 'LAND_COMPENSATION', amountRupees: '750000.00' },
    ];
  }, 60_000);

  afterAll(async () => {
    await closeApp();
    await closeDb();
  });

  it('creating an award with a document enqueues OCR and returns immediately (status: pending)', async () => {
    const pdfBuffer = await buildSyntheticAwardPdf(entries);

    const doc = await api(app)
      .post('/api/v1/documents')
      .set(auth(admin))
      .field('entityType', 'project')
      .field('entityId', PROJECT_ID)
      .field('projectId', PROJECT_ID)
      .field('docType', 'AWARD_LAND')
      .field('title', 'e2e synthetic award')
      .field('attest', 'true')
      .attach('file', pdfBuffer, 'award.pdf')
      .expect(201);

    const award = await api(app)
      .post(`/api/v1/projects/${PROJECT_ID}/awards`)
      .set(auth(admin))
      .send({ awardType: 'LAND', awardNo: 'E2E-TEST-AWARD-1', documentId: doc.body.id })
      .expect(201);

    expect(award.body.ocrExtractionId).toBeTruthy();
    expect(award.body.status).toBe('draft');
    awardId = award.body.id;
    extractionId = award.body.ocrExtractionId;

    const extraction = await api(app).get(`/api/v1/ocr-extractions/${extractionId}`).set(auth(admin)).expect(200);
    expect(extraction.body.status).toBe('pending');
  });

  it('the ocr job picks it up, extracts the fields, and flips status to ready', async () => {
    let extraction: { status: string; fields: Array<{ key: string; value: string }> } | undefined;
    for (let i = 0; i < 20; i++) {
      const res = await api(app).get(`/api/v1/ocr-extractions/${extractionId}`).set(auth(admin)).expect(200);
      extraction = res.body;
      if (extraction!.status !== 'pending') break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    expect(extraction!.status).toBe('ready');
    expect(extraction!.fields).toHaveLength(2);
    for (const e of entries) {
      const field = extraction!.fields.find((f) => f.key === `${e.familyId}:${e.headCode}`);
      expect(field, `expected a field for ${e.familyId}:${e.headCode}`).toBeTruthy();
    }
  }, 30_000);

  it('reviewing (accepting) the fields creates entitlements sourced ocr_confirmed', async () => {
    const extraction = await api(app).get(`/api/v1/ocr-extractions/${extractionId}`).set(auth(admin)).expect(200);
    const accepted = extraction.body.fields.map((f: { key: string; value: string }) => ({ key: f.key, value: f.value }));

    const review = await api(app)
      .post(`/api/v1/ocr-extractions/${extractionId}/review`)
      .set(auth(admin))
      .send({ accepted })
      .expect(200);
    expect(review.body.entitlements).toHaveLength(2);
    expect(review.body.entitlements.every((e: { source: string }) => e.source === 'ocr_confirmed')).toBe(true);

    const award = await api(app).get(`/api/v1/awards/${awardId}`).set(auth(admin)).expect(200);
    const amounts = award.body.entitlements.map((e: { amount_awarded_paise: string }) => e.amount_awarded_paise).sort();
    expect(amounts).toEqual(['50000000', '75000000']);
  });
});
