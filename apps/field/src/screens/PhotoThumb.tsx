import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useLive } from '../lib/live';

/** A locally stored photo (Blob in Dexie). */
export function PhotoThumb({ localId, className = 'h-16 w-16' }: { localId: string | undefined; className?: string }) {
  const photo = useLive(async () => (localId ? db.photos.get(localId) : undefined), [localId]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) return;
    const u = URL.createObjectURL(photo.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo?.localId]); // the blob never changes for a given photo
  if (!localId) return null;
  return url ? (
    <img src={url} alt="" className={`${className} rounded-md object-cover`} />
  ) : (
    <div className={`${className} rounded-md bg-slate-200`} />
  );
}
