import { useEffect, useRef, useState } from 'react';
import { freshFix, latestFix, type Fix } from '../lib/position';
import { Button } from './ui';

export interface Capture {
  blob: Blob;
  /** Position from the geolocation API at the shutter instant (§16.1 — photos carry no EXIF). */
  fix: Fix;
  capturedAt: string;
}

const MAX_EDGE = 1600;
/** A shutter-time fix older than this is replaced by a fresh one. */
const FIX_MAX_AGE_MS = 15_000;

/**
 * In-app camera (§16.1): getUserMedia + canvas capture. There is deliberately no file input and no
 * gallery picker — a photo can only come from this camera, at this place, now.
 */
export function Camera({ title, onCapture, onCancel }: { title: string; onCapture: (c: Capture) => Promise<void> | void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<{ blob: Blob; url: string; fix: Fix | null; at: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera unavailable — the app must be opened over HTTPS (use the demo tunnel URL).');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        setReady(true);
      } catch (e) {
        const name = e instanceof DOMException ? e.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'Camera permission denied — allow it in the browser settings.'
            : `Could not start the camera${e instanceof Error ? `: ${e.message}` : ''}`,
        );
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => () => {
    if (shot) URL.revokeObjectURL(shot.url);
  }, [shot]);

  async function takePhoto() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    // Location + time are taken at the shutter instant.
    const at = new Date().toISOString();
    const f = latestFix();
    const fix = f && Date.now() - f.at <= FIX_MAX_AGE_MS ? f : null;
    const scale = Math.min(1, MAX_EDGE / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext('2d')!.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    if (!blob) return setError('Could not encode the photo.');
    setShot({ blob, url: URL.createObjectURL(blob), fix, at });
  }

  async function usePhoto() {
    if (!shot) return;
    setBusy(true);
    setError(null);
    try {
      const fix = shot.fix ?? (await freshFix(FIX_MAX_AGE_MS));
      await onCapture({ blob: shot.blob, fix, capturedAt: shot.at });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the photo.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-medium">{title}</span>
        <button type="button" onClick={onCancel} className="text-sm text-slate-300">
          Cancel
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className={`h-full w-full object-contain ${shot ? 'hidden' : ''}`} />
        {shot && <img src={shot.url} alt="Captured" className="h-full w-full object-contain" />}
        {!ready && !error && <p className="absolute inset-0 grid place-items-center text-sm text-slate-300">Starting camera…</p>}
      </div>
      {error && <p className="bg-red-700 px-4 py-2 text-sm">{error}</p>}
      <div className="flex items-center justify-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {shot ? (
          <>
            <Button variant="secondary" onClick={() => setShot(null)} disabled={busy}>
              Retake
            </Button>
            <Button onClick={usePhoto} disabled={busy}>
              {busy ? (shot.fix ? 'Saving…' : 'Getting location…') : 'Use photo'}
            </Button>
          </>
        ) : (
          <button
            type="button"
            aria-label="Take photo"
            disabled={!ready}
            onClick={takePhoto}
            className="h-16 w-16 rounded-full border-4 border-white bg-white/20 active:bg-white/60 disabled:opacity-40"
          />
        )}
      </div>
    </div>
  );
}
