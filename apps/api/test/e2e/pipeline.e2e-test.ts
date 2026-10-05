import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { api, auth, bootApp, closeApp, closeDb, loginAs } from './harness';

// §24.3 projects pipeline: higher authorities see every project in their scope stage by stage; others get 403.
describe('projects pipeline', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await bootApp();
  }, 60_000);
  afterAll(async () => {
    await closeApp();
    await closeDb();
  });

  it('a national post sees every submitted project with its stages', async () => {
    const s = await loginAs(app, 'oversight@bhoomisetu.local');
    const res = await api(app).get('/api/v1/pipeline').set(auth(s)).expect(200);
    const psx = res.body.projects.find((p: { code: string }) => p.code === 'MH-PSX-2026-001');
    expect(res.body.projects.length).toBeGreaterThan(5);
    expect(psx.currentStage).toBe('S07_DECLARATION');
    expect(psx.stages.find((st: { code: string }) => st.code === 'S07_DECLARATION').status).toBe('active');
    expect(psx.stages.find((st: { code: string }) => st.code === 'S01_PROPOSAL').status).toBe('done');
  });

  it('a state post sees only its own state', async () => {
    const s = await loginAs(app, 'revenue.mh@bhoomisetu.local');
    const res = await api(app).get('/api/v1/pipeline').set(auth(s)).expect(200);
    expect(res.body.projects.length).toBeGreaterThan(0);
    expect(res.body.projects.every((p: { stateCode: string }) => p.stateCode === '27')).toBe(true);
  });

  it('a district post is refused', async () => {
    const s = await loginAs(app, 'collector.pune@bhoomisetu.local');
    const res = await api(app).get('/api/v1/pipeline').set(auth(s)).expect(403);
    expect(res.body.code).toBe('PIPELINE_HIGHER_AUTHORITY_ONLY');
  });
});
