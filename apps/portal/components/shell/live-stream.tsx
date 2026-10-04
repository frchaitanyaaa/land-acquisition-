'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type Listener = (data: unknown) => void;

interface LiveStream {
  /** True while the SSE connection to /stream is open (the top bar's Live dot). */
  connected: boolean;
  /** Unread notifications for the active post, pushed by the API every few seconds (null until known). */
  unread: number | null;
  /** Subscribe to one SSE event type (`kpi.updated`, `chain.anchored`, …). Returns the unsubscribe. */
  subscribe: (type: string, fn: Listener) => () => void;
}

const LiveStreamContext = createContext<LiveStream | null>(null);

/** Event types the API sends (notifications.controller.ts). `notification.count` is handled here. */
const FORWARDED = ['kpi.updated', 'notification.created', 'chain.anchored'] as const;

/**
 * One EventSource per tab for the whole officer shell (§24.1, §28). Dashboards subscribe through
 * useLiveUpdates instead of opening their own connection. Cookies ride automatically because the
 * portal proxies /api/* same-origin.
 */
export function LiveStreamProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState<number | null>(null);
  const listeners = useRef(new Map<string, Set<Listener>>());

  useEffect(() => {
    const source = new EventSource('/api/v1/stream', { withCredentials: true });
    const emit = (type: string, raw: string) => {
      let data: unknown = raw;
      try {
        data = JSON.parse(raw);
      } catch {
        /* plain-text event */
      }
      listeners.current.get(type)?.forEach((fn) => fn(data));
    };
    source.onopen = () => setConnected(true);
    // EventSource retries on its own; just reflect the state.
    source.onerror = () => setConnected(source.readyState === EventSource.OPEN);
    source.addEventListener('notification.count', (e) => {
      try {
        setUnread((JSON.parse((e as MessageEvent<string>).data) as { unread: number }).unread);
      } catch {
        /* ignore malformed */
      }
      emit('notification.count', (e as MessageEvent<string>).data);
    });
    for (const type of FORWARDED) source.addEventListener(type, (e) => emit(type, (e as MessageEvent<string>).data));
    // Some proxies coalesce unnamed events; treat any plain message as a KPI nudge.
    source.onmessage = (e) => emit('kpi.updated', e.data as string);
    return () => source.close();
  }, []);

  // Stable identity so subscribers don't re-subscribe whenever the connection state changes.
  const subscribe = useCallback((type: string, fn: Listener) => {
    const set = listeners.current.get(type) ?? new Set<Listener>();
    set.add(fn);
    listeners.current.set(type, set);
    return () => {
      set.delete(fn);
    };
  }, []);

  const value = useMemo<LiveStream>(() => ({ connected, unread, subscribe }), [connected, unread, subscribe]);

  return <LiveStreamContext.Provider value={value}>{children}</LiveStreamContext.Provider>;
}

/** The shell's live stream, or null outside the officer shell (e.g. the minimal login shell). */
export function useLiveStream(): LiveStream | null {
  return useContext(LiveStreamContext);
}
