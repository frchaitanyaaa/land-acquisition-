import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { api, auth, bootApp, closeApp, closeDb, loginAs, type Session } from './harness';

// §32.5: "PPP consent success". MH-NGP-2026-002 is the seeded PPP-at-71%-consent demo hook
// (CLAUDE.md §33.6, threshold 70%) — beat 6/7 of the live demo depends on its consent register
// staying exactly as seeded, so this test is read-only (GET only, no register mutation). It checks
// the tally the Collector dashboard's consent meter (§18.1) reads: consented/eligible crossing the
// pack's PPP_70 threshold (packages/rules, never hard-coded here per G8).
const PROJECT_ID = 'c7c25206-8290-47be-9074-72f67da4beeb';

describe('PPP consent tally (read-only, protects the seeded demo hook)', () => {
  let app: INestApplication;
  let collector: Session;

  beforeAll(async () => {
    app = await bootApp();
    collector = await loginAs(app, 'collector.nagpur@bhoomisetu.local');
  }, 60_000);

  afterAll(async () => {
    await closeApp();
    await closeDb();
  });

  it('the project is PPP-type with a PPP_70 consent register', async () => {
    const res = await api(app).get(`/api/v1/projects/${PROJECT_ID}/consent/tally`).set(auth(collector)).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].consent_type).toBe('PPP_70');
  });

  it('reports a threshold read from the register, not a hard-coded 0.7', async () => {
    const res = await api(app).get(`/api/v1/projects/${PROJECT_ID}/consent/tally`).set(auth(collector)).expect(200);
    const tally = res.body[0];
    expect(Number(tally.threshold)).toBeCloseTo(0.7, 5);
    expect(Number(tally.eligible)).toBeGreaterThan(0);
    expect(Number(tally.consented)).toBeGreaterThan(0);
  });

  it('the seeded register has already crossed the threshold (met = true), matching the demo hook', async () => {
    const res = await api(app).get(`/api/v1/projects/${PROJECT_ID}/consent/tally`).set(auth(collector)).expect(200);
    const tally = res.body[0];
    const actualPct = (100 * Number(tally.consented)) / Number(tally.eligible);
    expect(actualPct).toBeGreaterThanOrEqual(70);
    expect(tally.met).toBe(true);
  });
});
