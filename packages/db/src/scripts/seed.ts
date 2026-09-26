import { parseIsoInstant } from '@bhoomisetu/shared';
import { loadRootEnv, requireEnv } from '../env';
import { runSeed } from './seed/index';

// `pnpm db:seed`: reference data + synthetic demo dataset, deterministic (SEED, DEMO_NOW).
// Runs as app_worker (BYPASSRLS) — the only non-migration role allowed to write everywhere.

export function seedOptions(): { now: Date; seed: string } {
  const demoNow = process.env.DEMO_NOW;
  const now = demoNow ? parseIsoInstant(demoNow, 'DEMO_NOW') : new Date();
  if (!demoNow) console.warn('DEMO_NOW is not set — seeding relative to the real clock, so runs will differ');
  return { now, seed: process.env.SEED ?? '26016' };
}

if (require.main === module) {
  loadRootEnv();
  runSeed(requireEnv('DATABASE_WORKER_URL'), seedOptions()).catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
