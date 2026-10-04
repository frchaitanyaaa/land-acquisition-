import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { api, auth, bootApp, closeApp, closeDb, loginAs, type Session } from './harness';

// Trust center API (§27, §11.6): ledger paging, audit log for oversight only and without values,
// public verify reading only public_chain_anchor (G22). Read-only: GET requests only.
describe('trust center endpoints', () => {
  let app: INestApplication;
  let national: Session;
  let pune: Session;

  beforeAll(async () => {
    app = await bootApp();
    national = await loginAs(app, 'oversight@bhoomisetu.local');
    pune = await loginAs(app, 'collector.pune@bhoomisetu.local');
  }, 60_000);

  afterAll(async () => {
    await closeApp();
    await closeDb();
  });

  it('pages the anchoring ledger with a keyset cursor and never returns the payload', async () => {
    const first = await api(app).get('/api/v1/chain/events?limit=2').set(auth(national)).expect(200);
    for (const r of first.body.data) expect(r).not.toHaveProperty('canonical_payload');
    if (first.body.data.length === 2 && first.body.nextCursor) {
      const next = await api(app)
        .get(`/api/v1/chain/events?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
        .set(auth(national))
        .expect(200);
      const ids = new Set(first.body.data.map((r: { id: string }) => r.id));
      for (const r of next.body.data) expect(ids.has(r.id)).toBe(false);
    }
  });

  it('status reports node state and per-event counts', async () => {
    const res = await api(app).get('/api/v1/chain/status').set(auth(national)).expect(200);
    expect(res.body.node).toHaveProperty('reachable');
    expect(Array.isArray(res.body.byEventType)).toBe(true);
  });

  it('audit log is oversight-only and lists changed field names, not values', async () => {
    await api(app).get('/api/v1/audit/log').set(auth(pune)).expect(403);
    const res = await api(app).get('/api/v1/audit/log?limit=5').set(auth(national)).expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const r of res.body.data) {
      expect(r).not.toHaveProperty('before');
      expect(r).not.toHaveProperty('after');
      expect(Array.isArray(r.changed_keys)).toBe(true);
    }
  });

  it('public verify needs no login and returns hashes only', async () => {
    const ev = await api(app).get('/api/v1/chain/events?limit=1').set(auth(national)).expect(200);
    const row = ev.body.data[0] as { entity_type: string; entity_id: string } | undefined;
    if (!row) return; // nothing anchored in this database
    const res = await api(app).get(`/api/v1/public/verify/${row.entity_type}/${row.entity_id}`).expect(200);
    expect(res.body.found).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/amount|name|phone|survey/i);
    const none = await api(app).get('/api/v1/public/verify/award/00000000-0000-0000-0000-000000000000').expect(200);
    expect(none.body.found).toBe(false);
  });
});
