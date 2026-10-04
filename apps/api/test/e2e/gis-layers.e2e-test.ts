import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { api, auth, bootApp, closeApp, closeDb, loginAs, type Session } from './harness';

// A1 — GET /gis/layers is scoped by the caller's post (§11.3). Read-only: GET requests only.
const INDIA = '68,8,98,37';
type FC = { type: 'FeatureCollection'; features: Array<{ id: string; properties: Record<string, unknown>; geometry: unknown }> };

describe('GET /gis/layers (scope + shape)', () => {
  let app: INestApplication;
  let pune: Session;
  let national: Session;

  beforeAll(async () => {
    app = await bootApp();
    pune = await loginAs(app, 'collector.pune@bhoomisetu.local');
    national = await loginAs(app, 'oversight@bhoomisetu.local'); // NATIONAL level
  }, 60_000);

  afterAll(async () => {
    await closeApp();
    await closeDb();
  });

  const get = (s: Session, q: string) => api(app).get(`/api/v1/gis/layers?${q}`).set(auth(s));

  it('a Pune district post gets Pune villages and no Nagpur villages', async () => {
    const res = await get(pune, `bbox=${INDIA}&layers=villages`).expect(200);
    const villages = (res.body.layers.villages as FC).features;
    const codes = villages.map((f) => f.id);
    expect(codes).toContain('SYN-MH-KHED-SHIVAPUR');
    expect(codes).not.toContain('SYN-MH-HINGNA');
    expect(villages.some((f) => f.properties.district_code === 'SYN-MH-NAGPUR')).toBe(false);
  });

  it('a Pune district post gets no Nagpur district outline', async () => {
    const res = await get(pune, `bbox=${INDIA}&layers=districts`).expect(200);
    const codes = (res.body.layers.districts as FC).features.map((f) => f.id);
    expect(codes).toContain('SYN-MH-PUNE');
    expect(codes).not.toContain('SYN-MH-NAGPUR');
  });

  it('a national post sees all five seeded states with breach counts', async () => {
    const res = await get(national, `bbox=${INDIA}&layers=states,projects`).expect(200);
    const states = res.body.layers.states as FC;
    expect(states.features.map((f) => f.id).sort()).toEqual(['08', '09', '24', '27', '29']);
    for (const f of states.features) expect(typeof f.properties.breached).toBe('number');
    expect((res.body.layers.projects as FC).features.length).toBeGreaterThan(0);
  });

  it('cuts to the bbox and returns FeatureCollections with 7-decimal geometry', async () => {
    // Just the Pune–Satara corridor: no Nagpur village even for a national post.
    const res = await get(national, 'bbox=73.75,18.04,74.07,18.45&layers=villages,constraints').expect(200);
    const villages = res.body.layers.villages as FC;
    expect(villages.type).toBe('FeatureCollection');
    expect(villages.features.map((f) => f.id)).not.toContain('SYN-MH-HINGNA');
    const coords = JSON.stringify(villages.features[0]?.geometry ?? {}).match(/-?\d+\.\d+/g) ?? [];
    for (const c of coords) expect(c.split('.')[1]!.length).toBeLessThanOrEqual(7);
    expect(res.body.layers.constraints.type).toBe('FeatureCollection');
  });

  it('rejects a malformed bbox and unknown layers', async () => {
    await get(pune, 'bbox=1,2,3&layers=villages').expect(400);
    await get(pune, `bbox=${INDIA}&layers=roads`).expect(400);
  });
});
