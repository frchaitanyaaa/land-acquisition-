/// <reference lib="webworker" />
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching';
import { RangeRequestsPlugin } from 'workbox-range-requests';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { createApiClient } from './lib/api';
import { BASEMAP_CACHE, isBasemapUrl } from './lib/basemap-shared';
import { runSync, SYNC_TAG } from './lib/sync';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<PrecacheEntry | string> };

// Field PWA service worker (§16). Type-checked with tsconfig.sw.json (WebWorker lib).

self.skipWaiting();
clientsClaim();

// App shell: every build asset, so the app opens in airplane mode.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }));

// Basemap (§16.5): pmtiles reads the file with HTTP Range requests. The full file is put in
// BASEMAP_CACHE by "Download offline pack"; RangeRequestsPlugin slices the requested bytes out of
// it. Only complete 200 responses are ever cached (a 206 cannot be).
registerRoute(
  ({ url }) => isBasemapUrl(url),
  new CacheFirst({
    cacheName: BASEMAP_CACHE,
    plugins: [new CacheableResponsePlugin({ statuses: [200] }), new RangeRequestsPlugin()],
  }),
);

// Background Sync where supported (Chromium). iOS Safari never fires this — "Sync now" covers it.
interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
}
self.addEventListener('sync', (event: Event) => {
  const e = event as SyncEvent;
  if (e.tag !== SYNC_TAG) return;
  e.waitUntil(
    runSync(createApiClient()).then((r) => {
      // Offline again → reject so the browser retries later.
      if (r.status === 'offline') throw new Error('offline');
    }),
  );
});
