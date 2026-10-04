import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { api, auth, bootApp, closeApp, closeDb, loginAs, type Session } from './harness';

// §24.5 mock provider: answers only what it was asked; an unrelated question never gets the KPI overview.
describe('assistant (mock provider)', () => {
  let app: INestApplication;
  let national: Session;

  beforeAll(async () => {
    app = await bootApp();
    national = await loginAs(app, 'oversight@bhoomisetu.local');
  }, 60_000);

  afterAll(async () => {
    await closeApp();
    await closeDb();
  });

  const ask = (question: string) =>
    api(app).post('/api/v1/assistant/query').set(auth(national)).send({ question }).expect((r) => expect(r.status).toBeLessThan(300));

  it('a date question is answered from the statutory clock, with no tool call', async () => {
    const res = await ask('todays date');
    expect(res.body.answer).toMatch(/statutory clock reads .*2026/);
    expect(res.body.toolCalls).toHaveLength(0);
  });

  it('an unrelated question gets the list of what it can answer, not the overview', async () => {
    const res = await ask('what is the weather in Pune');
    expect(res.body.answer).toMatch(/I can answer questions about/);
    expect(res.body.toolCalls).toHaveLength(0);
  });

  it('an overview question still uses get_kpis', async () => {
    const res = await ask('Give me an overview of the key figures in my scope.');
    expect(res.body.toolCalls.map((c: { tool: string }) => c.tool)).toEqual(['get_kpis']);
    expect(res.body.answer).toMatch(/Across your scope/);
  });
});
