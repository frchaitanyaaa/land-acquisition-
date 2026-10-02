import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

// Field PWA (CLAUDE.md §16). Served by the portal under /field so one HTTPS tunnel covers the field
// app, the portal and the API (§16.1). The service worker is our own (src/sw.ts): precache, PMTiles
// range-request caching (§16.5) and Background Sync where the browser has it (§16.4).
export default defineConfig(({ mode }) => {
  const root = loadEnv(mode, repoRoot, '');
  const apiOrigin = `http://localhost:${root.API_PORT || '3001'}`;
  const portalOrigin = root.PORTAL_URL || 'http://localhost:3000';
  return {
    base: '/field/',
    // One config file for the whole repo (§7). Only TILES_* is exposed to the client bundle.
    envDir: repoRoot,
    envPrefix: ['VITE_', 'TILES_'],
    resolve: {
      // The same plausibility code the server runs (§15.6), so Review shows the flags the server will set.
      alias: { '@bhoomisetu/geo': fileURLToPath(new URL('../../packages/geo/src/index.ts', import.meta.url)) },
    },
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        injectRegister: false,
        manifest: {
          name: 'BhoomiSetu Field',
          short_name: 'BhoomiSetu',
          description: 'Offline parcel boundary capture for field officers',
          theme_color: '#0f766e',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/field/index.html',
          scope: '/field/',
          icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          // UX4G's stylesheet alone is ~8 MB (embedded fonts) and must be precached for offline use.
          maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
    ],
    server: {
      port: 5173,
      // Lets `cloudflared tunnel --url http://localhost:5173` work for quick UI checks on a phone.
      allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.app'],
      proxy: { '/api': apiOrigin, '/tiles': portalOrigin },
    },
  };
});
