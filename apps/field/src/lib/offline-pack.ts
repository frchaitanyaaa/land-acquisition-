import { cacheBasemap } from './basemap';
import { db } from './db';
import { api } from './session';
import type { Assignment, OfflinePack } from './types';

/** GET /field/assignments, mirrored into Dexie so the list opens offline. */
export async function refreshAssignments(): Promise<Assignment[]> {
  const rows = await api.json<Assignment[]>('/field/assignments');
  await db.transaction('rw', db.assignments, async () => {
    await db.assignments.clear();
    await db.assignments.bulkPut(rows);
  });
  return rows;
}

/**
 * Offline pack (§16.2 screen 3): assignment, footprint, village boundary, parcel + neighbour
 * geometries, JIR item types, reason codes and the rule-pack GPS thresholds — plus the PMTiles
 * basemap into the service worker's cache (§16.5).
 */
export async function downloadOfflinePack(projectParcelId: string): Promise<{ basemap: { ok: boolean; message?: string } }> {
  const pack = await api.json<OfflinePack>(`/field/assignments/${projectParcelId}/offline-pack`);
  // Ask the browser not to evict captured data under storage pressure.
  await navigator.storage?.persist?.().catch(() => false);
  const basemap = await cacheBasemap();
  await db.offlinePacks.put({ projectParcelId, pack, downloadedAt: new Date().toISOString(), basemap });
  return { basemap };
}
