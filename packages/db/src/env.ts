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
 * Loads the repo-root `.env` into process.env without overriding anything already set, so CI and
 * shell exports win. Returns the file path, or null when there is no .env.
 */
export function loadRootEnv(): string | null {
  const file = join(repoRoot(), '.env');
  if (!existsSync(file)) return null;
  const parsed = parseEnv(readFileSync(file, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined && value !== undefined) process.env[key] = value;
  }
  return file;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — copy .env.example to .env at the repo root`);
  return value;
}
