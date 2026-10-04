import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { api, bootApp, closeApp, closeDb } from './harness';

// Landing page trust stats (§27, G22): no login, counts and node state only — never a payload.
describe('GET /public/chain-summary', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootApp();
  }, 60_000);

  afterAll(async () => {
    await closeApp();
    await closeDb();
  });

  it('answers without a login and exposes only ledger totals and node state', async () => {
    const res = await api(app).get('/api/v1/public/chain-summary').expect(200);
    expect(Object.keys(res.body.ledger).sort()).toEqual(
      ['anchored', 'event_types', 'failed', 'last_anchored_at', 'latest_block', 'pending'].sort(),
    );
    expect(typeof res.body.ledger.anchored).toBe('number');
    expect(Object.keys(res.body.node).sort()).toEqual(['chainId', 'configured', 'contract', 'latestBlock', 'reachable']);
    expect(JSON.stringify(res.body)).not.toMatch(/canonical|payload|fullName|phone/i);
  });
});
