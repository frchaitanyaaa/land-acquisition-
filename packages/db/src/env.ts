import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseEnv } from 'node:util';

/** The directory holding pnpm-workspace.yaml. */
export function repoRoot(from: string = __dirname): string {
  let dir = from;
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    const up = dirname(dir);
    if (up === dir) throw new Error('could not find the repo root (pnpm-workspace.yaml)');
    dir = up;
  }
  return dir;
}

/**
 * Loads the repo-root `.env.local` (written by `pnpm chain:deploy`) and then `.env` into
 * process.env without overriding anything already set, so CI and shell exports win and
 * .env.local wins over .env. Returns the .env path, or null when there is no .env.
 */
export function loadRootEnv(): string | null {
  for (const name of ['.env.local', '.env']) {
    const file = join(repoRoot(), name);
    if (!existsSync(file)) continue;
    const parsed = parseEnv(readFileSync(file, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      // An empty value in .env must not mask a value from .env.local.
      if ((process.env[key] === undefined || process.env[key] === '') && value !== undefined) process.env[key] = value;
    }
  }
  const main = join(repoRoot(), '.env');
  return existsSync(main) ? main : null;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — copy .env.example to .env at the repo root`);
  return value;
}
