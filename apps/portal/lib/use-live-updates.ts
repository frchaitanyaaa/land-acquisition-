'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * Subscribes to the API's SSE stream (§24.1) and invalidates the given query keys whenever a
 * `kpi.updated` event arrives, so dashboard tiles refresh live without a full reload. Cookies ride
 * automatically — the portal proxies /api/* same-origin (next.config.ts).
 */
export function useLiveUpdates(queryKeys: readonly (readonly unknown[])[]) {
  const client = useQueryClient();

  useEffect(() => {
    const source = new EventSource('/api/v1/stream', { withCredentials: true });
    const onKpiUpdated = () => {
      for (const key of queryKeys) void client.invalidateQueries({ queryKey: key as unknown[] });
    };
    source.addEventListener('kpi.updated', onKpiUpdated);
    // Some proxies coalesce unnamed events; treat any message as a light nudge too.
    source.onmessage = onKpiUpdated;
    source.onerror = () => {
      // EventSource retries on its own; nothing to do but avoid an uncaught console error storm.
    };
    return () => source.close();
    // queryKeys is expected to be a stable literal at each call site, not re-created per render.
  }, [client]);
}
