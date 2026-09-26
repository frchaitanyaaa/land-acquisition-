// `pnpm rules:check` (CLAUDE.md §32.3). The golden test runs first (see package.json); this
// script then validates every pack and scans business code for statutory literals (G8).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { loadPacks, packChecksum, PACKS_DIR } from '../src/fs';

const REPO = join(PACKS_DIR, '..', '..', '..');

// Numbers that only ever appear in business code because someone hard-coded a statute.
// Scanned in the API and in shared/db/geo; UI code is not scanned (opacity, sizes, … — too noisy).
const NUMERIC_PATTERNS: Array<[RegExp, string]> = [
  [/(?<![\w.])1\.25(?!\d)/, '1.25 (there is no 1.25 multiplier — rural factor is a 1.00–2.00 range)'],
  [/(?<![\w.])0\.80?(?!\d)/, '0.8 (s.2 private consent — read pack.consent.PRIVATE)'],
  [/(?<![\w.])0\.70?(?!\d)/, '0.7 (s.2 PPP consent — read pack.consent.PPP)'],
  [/\*\s*0\.09(?!\d)/, '* 0.09 (s.80 interest — read pack.interest)'],
  [/\*\s*0\.15(?!\d)/, '* 0.15 (s.80 interest — read pack.interest)'],
];
const NUMERIC_ROOTS = ['apps/api/src', 'packages/shared/src', 'packages/db/src', 'packages/db/sql', 'packages/geo/src'];

// Statutory ISO durations may appear nowhere outside packages/rules — in any app or package.
const DURATION_PATTERN = /\bP(60D|12M|6M|18M|5Y|6W)\b/;
const DURATION_ROOTS = ['apps', 'packages'];
const DURATION_SKIP = [`packages${sep}rules${sep}`];

const SOURCE_EXT = /\.(ts|tsx|js|mjs|cjs|sql)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo', 'dev-dist', 'coverage', 'drizzle']);

function* walk(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(name)) yield* walk(path);
    } else if (SOURCE_EXT.test(name)) {
      yield path;
    }
  }
}

/** Lines of `path` or `path:line`; `#` starts a comment. Every entry needs a reason next to it. */
function loadAllowlist(): Set<string> {
  const file = join(PACKS_DIR, '..', 'forbidden-literals.allow');
  return new Set(
    readFileSync(file, 'utf8')
      .split('\n')
      .map((l) => l.replace(/#.*/, '').trim())
      .filter(Boolean),
  );
}

type Hit = { file: string; line: number; text: string; why: string };

function scan(): Hit[] {
  const allow = loadAllowlist();
  const hits: Hit[] = [];
  const check = (file: string, patterns: Array<[RegExp, string]>) => {
    const rel = relative(REPO, file);
    if (allow.has(rel)) return;
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((text, i) => {
        if (allow.has(`${rel}:${i + 1}`)) return;
        for (const [re, why] of patterns)
          if (re.test(text)) hits.push({ file: rel, line: i + 1, text: text.trim(), why });
      });
  };

  for (const root of NUMERIC_ROOTS) for (const f of walk(join(REPO, root))) check(f, NUMERIC_PATTERNS);
  for (const root of DURATION_ROOTS) {
    for (const f of walk(join(REPO, root))) {
      if (DURATION_SKIP.some((s) => relative(REPO, f).startsWith(s))) continue;
      check(f, [[DURATION_PATTERN, 'statutory ISO duration — read it from the rule pack']]);
    }
  }
  return hits;
}

let failed = false;

try {
  const packs = loadPacks();
  for (const [key, pack] of packs) {
    console.log(
      `✓ ${key}  ${packChecksum(pack).slice(0, 12)}  ${pack.stages.length} stages, ${pack.clocks.length} clocks`,
    );
    for (const v of pack.verify ?? []) console.log(`    [VERIFY] ${v}`);
  }
} catch (e) {
  failed = true;
  console.error(`✗ ${(e as Error).message}`);
}

const hits = scan();
if (hits.length) {
  failed = true;
  console.error(`\n✗ ${hits.length} statutory literal(s) outside packages/rules (G8):`);
  for (const h of hits) console.error(`  ${h.file}:${h.line}  ${h.why}\n      ${h.text}`);
  console.error('\nRead the value from the resolved rule pack. Genuine false positives go in');
  console.error('packages/rules/forbidden-literals.allow as `path:line  # reason`.');
} else {
  console.log('\n✓ no statutory literals outside packages/rules');
}

process.exit(failed ? 1 : 0);
