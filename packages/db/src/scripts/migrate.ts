import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, createPool } from '../client';
import { loadRootEnv, requireEnv } from '../env';

// `pnpm db:migrate`: drizzle migrations (tables, enums), then every sql/*.sql in name order
// (functions, triggers, grants + RLS, views). The SQL files are idempotent and always re-applied,
// so editing one never needs a new migration. Runs as `owner` (DATABASE_OWNER_URL).

const PKG = join(__dirname, '..', '..');

export async function runMigrations(ownerUrl: string): Promise<void> {
  const pool = createPool(ownerUrl, { max: 1 });
  try {
    await migrate(createDb(pool), { migrationsFolder: join(PKG, 'drizzle') });
    console.log('  drizzle migrations applied');
    const dir = join(PKG, 'sql');
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      await pool.query(readFileSync(join(dir, file), 'utf8'));
      console.log(`  sql/${file} applied`);
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  loadRootEnv();
  runMigrations(requireEnv('DATABASE_OWNER_URL')).catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
