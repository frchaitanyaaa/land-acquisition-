// Shared by the page and the service worker (no env access here — the SW build doesn't get it).

/** Cache holding the full regional PMTiles file; Workbox serves byte ranges out of it (§16.5). */
export const BASEMAP_CACHE = 'bhoomisetu-basemap-v1';

export const isBasemapUrl = (url: URL) => url.pathname.endsWith('.pmtiles');
