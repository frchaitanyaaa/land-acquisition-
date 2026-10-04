'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useLiveStream } from '@/components/shell/live-stream';

/**
 * Invalidates the given query keys whenever a `kpi.updated` event arrives (§24.1), so dashboard
 * tiles refresh live without a full reload. Uses the shell's single SSE connection
 * (components/shell/live-stream.tsx) rather than opening another one per page.
 */
export function useLiveUpdates(queryKeys: readonly (readonly unknown[])[]) {
  const client = useQueryClient();
  const stream = useLiveStream();
  const subscribe = stream?.subscribe;

  useEffect(() => {
    if (!subscribe) return;
    return subscribe('kpi.updated', () => {
      for (const key of queryKeys) void client.invalidateQueries({ queryKey: key as unknown[] });
    });
    // queryKeys is expected to be a stable literal at each call site, not re-created per render.
  }, [client, subscribe]);
}
