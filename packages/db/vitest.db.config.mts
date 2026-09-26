import { defineConfig } from 'vitest/config';

// Integration tests against a migrated + seeded database (`pnpm db:reset` first).
export default defineConfig({
  test: {
    include: ['test/**/*.db.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
