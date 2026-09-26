import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { canonicalJson } from '@bhoomisetu/shared';
import type { Pack } from '../schema/pack.schema';
import { PackError, resolvePacks } from './loader';

// Node-only entry (`@bhoomisetu/rules/fs`). The main entry stays free of I/O so the portal can
// import the schema and engine too.

function packageRoot(from: string): string {
  let dir = from;
  while (!existsSync(join(dir, 'package.json')) || !existsSync(join(dir, 'packs'))) {
    const up = dirname(dir);
    if (up === dir) throw new Error('could not locate packages/rules/packs');
    dir = up;
  }
  return dir;
}

export const PACKS_DIR = join(packageRoot(__dirname), 'packs');

const PACK_FILE = /^([a-z0-9-]+)@(\d+\.\d+\.\d+)\.json$/;

/** Reads every `<code>@<version>.json` in the directory. The file name must match its contents. */
export function readPackFiles(dir: string = PACKS_DIR): unknown[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => {
      const m = PACK_FILE.exec(file);
      if (!m) throw new PackError(file, 'file name must be <code>@<semver>.json');
      const doc = JSON.parse(readFileSync(join(dir, file), 'utf8')) as { code?: unknown; version?: unknown };
      if (doc.code !== m[1] || doc.version !== m[2]) {
        throw new PackError(
          file,
          `file name says ${m[1]}@${m[2]} but contents say ${String(doc.code)}@${String(doc.version)}`,
        );
      }
      return doc;
    });
}

export function loadPacks(dir: string = PACKS_DIR): Map<string, Pack> {
  return resolvePacks(readPackFiles(dir));
}

/** sha256 of the canonical (RFC 8785) resolved definition. Stored in rule_packs.checksum. */
export function packChecksum(pack: Pack): string {
  return createHash('sha256').update(canonicalJson(pack)).digest('hex');
}
