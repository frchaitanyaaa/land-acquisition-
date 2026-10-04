import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

/** Re-renders whenever the Dexie tables the query reads change — including writes from the service worker. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<{ v: T } | undefined>(undefined);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: (v) => setValue({ v }),
      error: (e: unknown) => console.error('liveQuery failed', e),
    });
    return () => sub.unsubscribe();
  }, deps);
  return value?.v;
}
