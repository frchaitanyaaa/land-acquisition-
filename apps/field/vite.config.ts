import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Field PWA (CLAUDE.md §16). Phase 0 is the installable shell; offline capture lands in Phase 2.
export default defineConfig(({ mode }) => {
  const root = loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), '');
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'BhoomiSetu Field',
          short_name: 'BhoomiSetu',
          description: 'Offline parcel boundary capture for field officers',
          theme_color: '#0f766e',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
        },
      }),
    ],
    server: {
      port: 5173,
      proxy: { '/api': `http://localhost:${root.API_PORT || '3001'}` },
    },
  };
});
