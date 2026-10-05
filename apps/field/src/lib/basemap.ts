import { BASEMAP_CACHE } from './basemap-shared';

/**
 * The regional vector basemap (§16.5), cached with the offline pack. Online, FieldMap draws Esri satellite imagery on
 * top of it; that imagery is never cached (and OSM raster tiles are never used).
 */
export const TILES_URL = import.meta.env.TILES_PMTILES_URL || '/tiles/demo-region.pmtiles';

/**
 * Puts the whole PMTiles file into the basemap cache with one plain GET (a 200, which the Cache API
 * accepts — a 206 range response would not be). After that the service worker answers every range
 * request pmtiles makes from this one cached copy, so the map works in airplane mode.
 */
export async function cacheBasemap(): Promise<{ ok: boolean; message?: string }> {
  if (!('caches' in self)) return { ok: false, message: 'This browser has no Cache Storage.' };
  const url = new URL(TILES_URL, location.origin).href;
  try {
    const cache = await caches.open(BASEMAP_CACHE);
    if (await cache.match(url)) return { ok: true };
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok)
      return {
        ok: false,
        message: `Basemap not available (${res.status}). Put demo-region.pmtiles in apps/portal/public/tiles — the map works without it, just blank.`,
      };
    await cache.put(url, res);
    return { ok: true };
  } catch {
    return { ok: false, message: 'Basemap download failed — the map will be blank offline.' };
  }
}
