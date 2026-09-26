import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import type { NextConfig } from 'next';

// The repo-root .env is the one config file (CLAUDE.md §7); Next only reads its own directory.
const rootEnv = join(process.cwd(), '..', '..', '.env');
if (existsSync(rootEnv)) {
  for (const [k, v] of Object.entries(parseEnv(readFileSync(rootEnv, 'utf8')))) process.env[k] ??= v;
}

const apiOrigin = `http://localhost:${process.env.API_PORT ?? '3001'}`;

const config: NextConfig = {
  // One origin for browser, phones (via the tunnel) and WebAuthn: the portal proxies the API (§16.1).
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
};

export default config;
