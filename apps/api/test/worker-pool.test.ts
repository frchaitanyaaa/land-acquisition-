import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// §11.3: "app_worker has BYPASSRLS and is never used by an HTTP handler. A unit test asserts that
// request handlers only receive the app_user pool." This is that test: WorkerDbService and the
// worker connection string may appear only in background jobs and boot-time rule-pack sync.

const SRC = join(__dirname, '..', 'src');
const ALLOWED = [
  'common/db/worker-db.service.ts', // the definition
  'common/common.module.ts', // provider registration
  'config/env.ts', // the variable's schema
  'jobs/', // background jobs
  'rules/rules.service.ts', // boot-time pack sync, not a request path
];

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (name.endsWith('.ts')) yield p;
  }
}

describe('worker pool isolation', () => {
  it('only jobs and boot tasks touch the BYPASSRLS connection', () => {
    const offenders: string[] = [];
    for (const file of files(SRC)) {
      const rel = relative(SRC, file).replace(/\\/g, '/');
      if (ALLOWED.some((a) => rel === a || (a.endsWith('/') && rel.startsWith(a)))) continue;
      if (/WorkerDbService|DATABASE_WORKER_URL/.test(readFileSync(file, 'utf8'))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it('no controller injects the worker pool', () => {
    for (const file of files(SRC)) {
      if (!file.endsWith('.controller.ts')) continue;
      expect(readFileSync(file, 'utf8'), relative(SRC, file)).not.toMatch(/WorkerDbService/);
    }
  });
});
