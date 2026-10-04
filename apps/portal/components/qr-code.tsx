'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/**
 * A QR for a token link, scanned by the BENEFICIARY'S OWN phone (§21.2). The officer's session
 * only displays it — it never runs a WebAuthn ceremony itself.
 */
export function QrCode({ url, caption, expiresInMinutes }: { url: string; caption: string; expiresInMinutes?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 240 })
      .then((d) => live && setSrc(d))
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, [url]);

  const localhost = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(url);
  return (
    <figure className="inline-flex flex-col items-center gap-2 border border-slate-200 bg-white p-3">
      {src ? <img src={src} alt={caption} width={240} height={240} /> : <div className="h-60 w-60 bg-slate-100" />}
      <figcaption className="max-w-60 text-center text-xs text-slate-600">
        {caption}
        {expiresInMinutes ? ` · valid ${expiresInMinutes} min, single use` : ''}
      </figcaption>
      {localhost && (
        <p className="max-w-60 text-center text-[11px] text-amber-800">
          This link points at localhost — a phone can’t open it. Set PUBLIC_BASE_URL to the tunnel URL and restart the API.
        </p>
      )}
      <a href={url} target="_blank" rel="noreferrer" className="max-w-60 break-all text-center text-[11px] text-teal-700 underline">
        {url}
      </a>
    </figure>
  );
}
