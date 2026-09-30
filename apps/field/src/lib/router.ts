import { useEffect, useState } from 'react';

// Hash routes keep every screen at /field/index.html, inside the service worker's scope, so any
// screen reloads in airplane mode.
export function useRoute(): string[] {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

export function go(path: string): void {
  location.hash = `#/${path}`;
}
