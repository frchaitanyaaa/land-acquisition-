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
/** Optional: proxy /field to the Vite dev server (e.g. http://localhost:5173) instead of the built copy. */
const fieldDevOrigin = process.env.FIELD_DEV_ORIGIN;

const config: NextConfig = {
  // Phones reach `next dev` through the HTTPS tunnel (§16.1); Next blocks unknown dev origins.
  allowedDevOrigins: ['*.trycloudflare.com', '*.ngrok-free.app', '*.ngrok.app'],
  // The field PWA lives at /field/index.html (inside its service worker's /field/ scope).
  async redirects() {
    return [{ source: '/field', destination: '/field/index.html', permanent: false }];
  },
  // One origin for browser, phones (via the tunnel) and WebAuthn: the portal proxies the API and
  // serves the built field app from public/field (§16.1).
  async rewrites() {
    return {
      beforeFiles: fieldDevOrigin ? [{ source: '/field/:path*', destination: `${fieldDevOrigin}/field/:path*` }] : [],
      afterFiles: [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }],
      fallback: [],
    };
  },
  async headers() {
    return [
      // The service worker must always be revalidated so fixes reach phones on the next open.
      { source: '/field/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};

export default config;
