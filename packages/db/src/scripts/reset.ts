import { createPool } from '../client';
import { loadRootEnv, requireEnv } from '../env';
import { runMigrations } from './migrate';
import { seedOptions } from './seed';
import { runSeed } from './seed/index';

// `pnpm db:reset`: drop everything the app owns, migrate, seed. Extensions and roles (created by
// docker/postgres/roles.sql as superuser) are untouched.

const DROP_ALL = `
  DO $$
  DECLARE r record;
  BEGIN
    -- Views, materialised views and functions owned by app_worker (see sql/01, sql/04).
    FOR r IN SELECT c.oid::regclass AS name, c.relkind FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND pg_get_userbyid(c.relowner) = 'app_worker' AND c.relkind IN ('v', 'm')
    LOOP
      EXECUTE format('DROP %s IF EXISTS %s CASCADE',
                     CASE r.relkind WHEN 'm' THEN 'MATERIALIZED VIEW' ELSE 'VIEW' END, r.name);
    END LOOP;
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND pg_get_userbyid(p.proowner) = 'app_worker'
    LOOP
      EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig);
    END LOOP;
  END $$;
  DROP OWNED BY owner CASCADE;
`;

async function main(): Promise<void> {
  loadRootEnv();
  const ownerUrl = requireEnv('DATABASE_OWNER_URL');

  const pool = createPool(ownerUrl, { max: 1 });
  try {
    await pool.query(DROP_ALL);
    console.log('  dropped all application objects');
  } finally {
    await pool.end();
  }

  await runMigrations(ownerUrl);
  await runSeed(requireEnv('DATABASE_WORKER_URL'), seedOptions());
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
