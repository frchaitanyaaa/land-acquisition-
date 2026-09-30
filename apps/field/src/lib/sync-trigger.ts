import { api } from './session';
import { runSync, SYNC_TAG, type SyncOutcome } from './sync';

/** "Sync now" (§16.4) — mandatory path, works everywhere including iOS Safari. */
export function syncNow(): Promise<SyncOutcome> {
  return runSync(api);
}

/**
 * Ask the service worker to sync when connectivity returns (Chromium's Background Sync). Where it
 * doesn't exist (iOS Safari, Firefox) this is a no-op and the Sync now button / `online` event cover it.
 */
export async function requestBackgroundSync(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sync = (reg as (ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }) | undefined)?.sync;
    if (!sync) return false;
    await sync.register(SYNC_TAG);
    return true;
  } catch {
    return false;
  }
}
