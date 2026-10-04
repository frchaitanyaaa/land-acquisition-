import { useEffect, useReducer } from 'react';

export interface Fix {
  lat: number;
  lng: number;
  /** metres, 1σ as reported by the browser */
  accuracy: number;
  /** device ms when the fix arrived */
  at: number;
}

// One shared high-accuracy watcher for the whole app (§16.2 screen 4). Screens that need GPS mount
// usePosition(); the watcher runs while at least one of them is mounted.
let watchId: number | null = null;
let refs = 0;
let last: Fix | null = null;
let lastError: string | null = null;
const fixListeners = new Set<(f: Fix) => void>();
const renderListeners = new Set<() => void>();

const notify = () => renderListeners.forEach((l) => l());

function start() {
  if (watchId != null || !('geolocation' in navigator)) {
    if (!('geolocation' in navigator)) lastError = 'This device has no geolocation.';
    return;
  }
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      const fix: Fix = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() };
      last = fix;
      lastError = null;
      fixListeners.forEach((l) => l(fix));
      notify();
    },
    (err) => {
      lastError =
        err.code === err.PERMISSION_DENIED
          ? 'Location permission denied — allow it in the browser settings (the page must be on HTTPS).'
          : err.message || 'Waiting for GPS…';
      notify();
    },
    { enableHighAccuracy: true, maximumAge: 0 },
  );
}

function stop() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

/** Every new fix, as it arrives. Returns an unsubscribe function. */
export function subscribeFixes(listener: (f: Fix) => void): () => void {
  fixListeners.add(listener);
  return () => fixListeners.delete(listener);
}

export const latestFix = () => last;

/** A fix no older than `maxAgeMs`; falls back to a one-shot high-accuracy read. */
export async function freshFix(maxAgeMs = 15_000): Promise<Fix> {
  if (last && Date.now() - last.at <= maxAgeMs) return last;
  return new Promise<Fix>((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('This device has no geolocation.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() }),
      (e) => reject(new Error(e.message || 'Could not get a GPS fix.')),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
  });
}

/** Keeps the watcher running while mounted and re-renders on every fix. */
export function usePosition(): { fix: Fix | null; error: string | null } {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    renderListeners.add(rerender);
    refs++;
    start();
    return () => {
      renderListeners.delete(rerender);
      if (--refs === 0) stop();
    };
  }, []);
  return { fix: last, error: lastError };
}
