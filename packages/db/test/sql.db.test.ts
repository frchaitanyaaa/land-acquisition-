import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { auditLog } from '../src/schema';
import { runScoped } from '../src/scope';
import { asAppUser, asWorker, NOW, scope } from './helpers';

// §32.2 geometry tests and the §11.6 audit chain, against the real functions.

const { db } = asAppUser();
const one = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows[0] as T;

// A ~100 m square near Pune (18.5°N): 0.000947° lat ≈ 104.8 m is too coarse, so use metres.
const SQUARE = `ST_Transform(ST_MakeEnvelope(0, 0, 100, 100, 32643), 4326)`; // UTM 43N — Pune's zone
const PUNE_SQUARE = `ST_Transform(ST_Translate(ST_MakeEnvelope(0, 0, 100, 100, 32643), 373000, 2045000), 4326)`;

describe('geom_canonical_hash (G11)', () => {
  const hash = (wkt: string) => one<{ h: string }>(sql.raw(`SELECT geom_canonical_hash(${wkt}) AS h`)).then((r) => r.h);

  it('ignores ring start, ring direction and sub-centimetre noise', async () => {
    const a = await hash(
      `ST_GeomFromText('POLYGON((73.8 18.5, 73.801 18.5, 73.801 18.501, 73.8 18.501, 73.8 18.5))', 4326)`,
    );
    const rotated = await hash(
      `ST_GeomFromText('POLYGON((73.801 18.5, 73.801 18.501, 73.8 18.501, 73.8 18.5, 73.801 18.5))', 4326)`,
    );
    const reversed = await hash(
      `ST_GeomFromText('POLYGON((73.8 18.5, 73.8 18.501, 73.801 18.501, 73.801 18.5, 73.8 18.5))', 4326)`,
    );
    const noisy = await hash(
      `ST_GeomFromText('POLYGON((73.800000001 18.5, 73.801 18.500000001, 73.801 18.501, 73.8 18.501, 73.800000001 18.5))', 4326)`,
    );
    expect(rotated).toBe(a);
    expect(reversed).toBe(a);
    expect(noisy).toBe(a);
  });

  it('changes when a vertex moves one metre', async () => {
    const a = await hash(
      `ST_GeomFromText('POLYGON((73.8 18.5, 73.801 18.5, 73.801 18.501, 73.8 18.501, 73.8 18.5))', 4326)`,
    );
    const moved = await hash(
      `ST_GeomFromText('POLYGON((73.80001 18.5, 73.801 18.5, 73.801 18.501, 73.8 18.501, 73.80001 18.5))', 4326)`,
    );
    expect(moved).not.toBe(a);
  });
});

describe('area_sqm (G10)', () => {
  it('measures a 100 m × 100 m square near Pune as 10,000 ± 5 m²', async () => {
    const { a } = await one<{ a: string }>(sql.raw(`SELECT area_sqm(${PUNE_SQUARE}) AS a`));
    expect(Math.abs(Number(a) - 10_000)).toBeLessThan(5);
  });

  it('is not square degrees', async () => {
    const { a } = await one<{ a: string }>(sql.raw(`SELECT area_sqm(${SQUARE}) AS a`));
    expect(Number(a)).toBeGreaterThan(1_000);
  });
});

describe('audit_log hash chain (§11.6, G15)', () => {
  it('chains every insert and verifies', async () => {
    await runScoped(db, scope({ level: 'NATIONAL' }), NOW, async (tx) => {
      await tx
        .insert(auditLog)
        .values({ action: 'TEST_A', entityType: 'test', after: { amountPaise: '1250', n: 12.5 } });
      await tx.insert(auditLog).values({ action: 'TEST_B', entityType: 'test' });
    });
    const { db: worker } = asWorker();
    const rows = (await worker.execute(sql`SELECT prev_hash, hash FROM audit_log ORDER BY id DESC LIMIT 2`))
      .rows as Array<{
      prev_hash: string;
      hash: string;
    }>;
    expect(rows[0]!.prev_hash).toBe(rows[1]!.hash);
    const verify = (await worker.execute(sql`SELECT * FROM audit_verify()`)).rows[0] as {
      first_broken_id: string | null;
    };
    expect(verify.first_broken_id).toBeNull();
  });

  it('is append-only even for the worker role', async () => {
    const { db: worker } = asWorker();
    // drizzle wraps driver errors ("Failed query: …"); the Postgres message is on .cause
    const cause = (p: Promise<unknown>) =>
      p.then(
        () => '',
        (e: Error) => String((e.cause as Error | undefined)?.message),
      );
    expect(
      await cause(worker.execute(sql`UPDATE audit_log SET action = 'X' WHERE id = (SELECT max(id) FROM audit_log)`)),
    ).toMatch(/append-only/);
    expect(await cause(worker.execute(sql`DELETE FROM audit_log`))).toMatch(/append-only/);
  });

  it('request handlers can write audit rows but not read them', async () => {
    await expect(db.execute(sql`SELECT count(*) FROM audit_log`)).rejects.toThrow();
  });
});

describe('app_now (G16)', () => {
  it('follows the transaction clock set by withScope', async () => {
    const at = await runScoped(
      db,
      scope({}),
      NOW,
      async (tx) => (await tx.execute(sql`SELECT app_now() AS t`)).rows[0] as { t: Date },
    );
    expect(new Date(at.t).toISOString()).toBe(NOW.toISOString());
  });
});
