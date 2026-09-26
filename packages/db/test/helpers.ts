import { afterAll } from 'vitest';
import { createDb, createPool, type Db } from '../src/client';
import { loadRootEnv, requireEnv } from '../src/env';
import { PUBLIC_SCOPE, type Scope } from '../src/scope';
import { seedId } from '../src/scripts/seed/index';

loadRootEnv();

const pools: Array<ReturnType<typeof createPool>> = [];
afterAll(async () => {
  await Promise.all(pools.map((p) => p.end()));
});

function connect(envName: string): { pool: ReturnType<typeof createPool>; db: Db } {
  const pool = createPool(requireEnv(envName), { max: 2 });
  pools.push(pool);
  return { pool, db: createDb(pool) };
}

/** The request-handler role. RLS applies. */
export const asAppUser = () => connect('DATABASE_URL');
/** The jobs role. BYPASSRLS. */
export const asWorker = () => connect('DATABASE_WORKER_URL');

export const SEED = process.env.SEED ?? '26016';
export const id = (name: string) => seedId(SEED, name);
export const NOW = new Date(process.env.DEMO_NOW || '2026-12-10T10:00:00+05:30');

export const scope = (over: Partial<Scope>): Scope => ({ ...PUBLIC_SCOPE, ...over });
