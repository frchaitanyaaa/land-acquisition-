#!/usr/bin/env node
// pnpm demo:tunnel (CLAUDE.md §16.1, §294) — one HTTPS origin for phones.
//
//  1. builds the field PWA into apps/portal/public/field (served by the portal under /field)
//  2. checks apps/portal/public/tiles/demo-region.pmtiles is there (made by scripts/extract-tiles.sh)
//  3. opens a cloudflared quick tunnel to the portal (:3000) and prints the URLs + .env lines
//
// Run the API and the portal first (pnpm dev). Needs `cloudflared` on PATH
// (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).
// Skip the build with --no-build when only restarting the tunnel.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PORTAL_PORT ?? '3000';

if (!process.argv.includes('--no-build')) {
  console.log('› building the field PWA into apps/portal/public/field …');
  const b = spawnSync('pnpm', ['--filter', '@bhoomisetu/field', 'build:portal'], { cwd: root, stdio: 'inherit', shell: true });
  if (b.status !== 0) process.exit(b.status ?? 1);
}

const tiles = join(root, 'apps', 'portal', 'public', 'tiles', 'demo-region.pmtiles');
if (!existsSync(tiles)) {
  console.warn('! apps/portal/public/tiles/demo-region.pmtiles is missing (§16.5) — run scripts/extract-tiles.sh.');
  console.warn('  Maps will be blank offline; capture and sync still work.');
}

console.log(`› starting cloudflared → http://localhost:${port}`);
const cf = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
cf.on('error', () => {
  console.error('✗ cloudflared not found. Install it, or run `ngrok http 3000` and use that https URL the same way.');
  process.exit(1);
});

let printed = false;
const scan = (chunk) => {
  const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(chunk));
  if (!m || printed) return;
  printed = true;
  const url = m[0];
  const host = new URL(url).host;
  console.log(`
  ✓ Tunnel up: ${url}

    Field PWA (open on the phone, then "Add to Home Screen"):  ${url}/field/index.html
    Portal:                                                    ${url}

  Portal must be running with \`pnpm dev\` (next dev picks up public/field live). With \`next start\`,
  re-run \`next build\` after building the field app — production Next only serves build-time public files.

  Put these in the repo-root .env and restart the API (WebAuthn / public links):
    PUBLIC_BASE_URL=${url}
    WEBAUTHN_RP_ID=${host}
    WEBAUTHN_ORIGIN=${url}
`);
};
cf.stdout.on('data', scan);
cf.stderr.on('data', scan);
cf.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => cf.kill('SIGINT'));
