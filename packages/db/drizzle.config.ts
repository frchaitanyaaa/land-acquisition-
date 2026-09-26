import { defineConfig } from 'drizzle-kit';

// `pnpm db:generate` diffs src/schema against drizzle/ and writes the next migration.
// Functions, triggers, RLS and views are NOT here — they live in sql/ and are re-applied on every
// migrate (see src/scripts/migrate.ts).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  extensionsFilters: ['postgis'],
  dbCredentials: { url: process.env.DATABASE_OWNER_URL ?? '' },
});
