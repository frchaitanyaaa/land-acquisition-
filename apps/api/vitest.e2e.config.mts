import { defineConfig } from 'vitest/config';

// §32.5 — real HTTP against a real (migrated + seeded) Postgres, via `pnpm db:reset` first.
// A distinct suffix (.e2e-test.ts) and config keep this out of the plain `pnpm test` run, which
// must stay fast and infra-independent; `pnpm test:e2e` (apps/api) targets this file explicitly.
// fileParallelism: false — one Nest app instance, one login per seeded user, avoids the auth
// throttle (10/min/IP, §29) and keeps stage transitions on the same project deterministic.
export default defineConfig({
  test: {
    include: ['test/e2e/**/*.e2e-test.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
