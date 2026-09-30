import { useEffect, useRef, useState } from 'react';
import { CircleMarker, Polygon, Polyline, Tooltip } from 'react-leaflet';
import { AccuracyBadge } from '../components/AccuracyBadge';
import { Camera, type Capture } from '../components/Camera';
import { FieldMap } from '../components/FieldMap';
import { Button, ErrorText } from '../components/ui';
import { db } from '../lib/db';
import { distanceM, estimateAreaSqm, formatArea, HOLD_MS, selfIntersects, weightedAverage } from '../lib/geo';
import { useLive } from '../lib/live';
import { subscribeFixes, usePosition, type Fix } from '../lib/position';
import { go } from '../lib/router';
import { addVertex, appendTrack, savePhoto, setClosed, surveyVertices, undoLastVertex } from '../lib/survey';
import type { SurveyProps } from './SurveyShell';

/** Track sampling: a point when the officer has moved this far, at most this often. */
const TRACK_MIN_MOVE_M = 3;
const TRACK_MIN_INTERVAL_MS = 3000;

type Averaged = ReturnType<typeof weightedAverage> & { capturedAt: string };

/** §16.2 screen 4 — the core capture screen (demo beat 4). */
export function WalkMark({ survey, pack }: SurveyProps) {
  const t = pack.thresholds;
  const { fix, error: gpsError } = usePosition();
  const vertices = useLive(() => surveyVertices(survey.clientId), [survey.clientId]) ?? [];
  const [follow, setFollow] = useState(true);
  const [hold, setHold] = useState<{ progress: number; samples: number } | null>(null);
  const [pending, setPending] = useState<Averaged | null>(null);
  const [error, setError] = useState<string | null>(null);
  const holdRef = useRef<{ start: number; fixes: Fix[]; raf: number; unsub: () => void } | null>(null);
  const editable = survey.status === 'draft' && !survey.closed;

  // Walked track, recorded continuously while this screen is open (§16.2).
  const lastTrack = useRef<{ fix: Fix } | null>(null);
  useEffect(() => {
    if (survey.status !== 'draft') return;
    return subscribeFixes((f) => {
      if (f.accuracy > t.gpsAccuracyRejectM) return;
      const prev = lastTrack.current?.fix;
      if (prev && (f.at - prev.at < TRACK_MIN_INTERVAL_MS || distanceM(prev, f) < TRACK_MIN_MOVE_M)) return;
      lastTrack.current = { fix: f };
      void appendTrack(survey.clientId, f);
    });
  }, [survey.clientId, survey.status, t.gpsAccuracyRejectM]);

  // ---- Mark Point: hold for HOLD_MS, averaging every fix that arrives (w = 1/accuracy²).
  function startHold() {
    if (!editable || holdRef.current) return;
    setError(null);
    const state = { start: performance.now(), fixes: [] as Fix[], raf: 0, unsub: () => {} };
    state.unsub = subscribeFixes((f) => state.fixes.push(f));
    const tick = () => {
      const progress = Math.min(1, (performance.now() - state.start) / HOLD_MS);
      setHold({ progress, samples: state.fixes.length });
      if (progress >= 1) return finishHold();
      state.raf = requestAnimationFrame(tick);
    };
    holdRef.current = state;
    state.raf = requestAnimationFrame(tick);
  }

  function stopHold() {
    const s = holdRef.current;
    if (!s) return;
    cancelAnimationFrame(s.raf);
    s.unsub();
    holdRef.current = null;
    setHold(null);
    return s;
  }

  function cancelHold() {
    if (holdRef.current) {
      stopHold();
      setError('Keep holding for the full 5 seconds to average the GPS position.');
    }
  }

  function finishHold() {
    const s = stopHold();
    if (!s) return;
    if (!s.fixes.length) return setError('No GPS fix arrived while holding — wait for the badge to show an accuracy and try again.');
    const avg = { ...weightedAverage(s.fixes), capturedAt: new Date().toISOString() };
    if (
      avg.accuracyM > t.gpsAccuracyRejectM &&
      !confirm(`Accuracy ±${avg.accuracyM.toFixed(1)} m is worse than ${t.gpsAccuracyRejectM} m — the server will discard this point. Keep it anyway?`)
    )
      return;
    setPending(avg); // → camera
  }

  useEffect(() => () => void stopHold(), []);

  async function onPhoto(c: Capture) {
    if (!pending) return;
    const photoLocalId = await savePhoto({
      surveyClientId: survey.clientId,
      projectId: survey.projectId,
      kind: 'FIELD_PHOTO',
      blob: c.blob,
      fix: c.fix,
      capturedAt: c.capturedAt,
    });
    try {
      await addVertex(survey.clientId, pending, photoLocalId);
    } catch (e) {
      await db.photos.delete(photoLocalId);
      setError(e instanceof Error ? e.message : 'Could not save the point.');
    }
    setPending(null);
  }

  const areaSqm = estimateAreaSqm(vertices);
  const kinked = selfIntersects(vertices);
  const latlngs = vertices.map((v) => [v.lat, v.lng] as [number, number]);
  const trackLatLngs = survey.track.map(([lng, lat]) => [lat, lng] as [number, number]);

  return (
    <div className="flex flex-col">
      <div className="relative">
        <FieldMap pack={pack} fix={fix} follow={follow}>
          {trackLatLngs.length > 1 && <Polyline positions={trackLatLngs} pathOptions={{ color: '#7c3aed', weight: 2, opacity: 0.6 }} />}
          {survey.closed && latlngs.length >= 3 ? (
            <Polygon positions={latlngs} pathOptions={{ color: kinked ? '#dc2626' : '#1d4ed8', weight: 3, fillOpacity: 0.2 }} />
          ) : (
            latlngs.length > 1 && (
              <Polyline positions={latlngs} pathOptions={{ color: kinked ? '#dc2626' : '#1d4ed8', weight: 3 }} />
            )
          )}
          {vertices.map((v) => (
            <CircleMarker key={v.seq} center={[v.lat, v.lng]} radius={6} pathOptions={{ color: '#1e3a8a', fillColor: '#fff', fillOpacity: 1, weight: 2 }}>
              <Tooltip permanent direction="top" offset={[0, -6]}>
                {v.seq}
              </Tooltip>
            </CircleMarker>
          ))}
        </FieldMap>
        <div className="pointer-events-none absolute left-2 top-2 z-[1000] flex flex-col items-start gap-1">
          <AccuracyBadge accuracy={fix?.accuracy ?? null} thresholds={t} />
          {gpsError && !fix && <span className="rounded bg-white/90 px-2 py-0.5 text-[11px] text-red-700">{gpsError}</span>}
        </div>
        <button
          type="button"
          onClick={() => setFollow((f) => !f)}
          className={`absolute right-2 top-2 z-[1000] rounded-full px-3 py-1 text-xs font-medium shadow ${follow ? 'bg-blue-600 text-white' : 'bg-white text-slate-800'}`}
        >
          {follow ? 'Following' : 'Follow me'}
        </button>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <Stat label="Points" value={String(vertices.length)} />
          <Stat label="Area (estimate)" value={areaSqm != null ? formatArea(areaSqm) : '—'} />
          <Stat label="Track" value={`${survey.track.length} pts`} />
        </div>
        {kinked && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            The boundary crosses itself. Undo the last point(s) and re-walk — the server will refuse a self-intersecting polygon.
          </p>
        )}
        <ErrorText>{error}</ErrorText>

        {survey.status === 'draft' && (
          <>
            <button
              type="button"
              disabled={!editable}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                startHold();
              }}
              onPointerUp={cancelHold}
              onPointerCancel={cancelHold}
              onContextMenu={(e) => e.preventDefault()}
              className="no-callout relative w-full overflow-hidden rounded-xl bg-teal-700 py-5 text-base font-semibold text-white disabled:bg-slate-400"
            >
              <span
                className="absolute inset-y-0 left-0 bg-teal-900/60"
                style={{ width: `${(hold?.progress ?? 0) * 100}%` }}
                aria-hidden
              />
              <span className="relative">
                {!editable
                  ? 'Polygon closed'
                  : hold
                    ? `Hold still… ${Math.ceil((1 - hold.progress) * (HOLD_MS / 1000))} s · ${hold.samples} fixes`
                    : `Mark Point ${vertices.length + 1} — press & hold ${HOLD_MS / 1000} s`}
              </span>
            </button>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" disabled={!vertices.length || !!hold} onClick={() => undoLastVertex(survey.clientId)}>
                Undo last point
              </Button>
              {survey.closed ? (
                <Button variant="secondary" className="flex-1" onClick={() => setClosed(survey.clientId, false)}>
                  Reopen polygon
                </Button>
              ) : (
                <Button className="flex-1" disabled={vertices.length < 3 || !!hold} onClick={() => setClosed(survey.clientId, true)}>
                  Close polygon
                </Button>
              )}
            </div>
            {survey.closed && (
              <Button variant="ghost" className="w-full" onClick={() => go(`survey/${survey.clientId}/notice`)}>
                Next: s.12 notice →
              </Button>
            )}
          </>
        )}
        <p className="text-xs text-slate-500">
          Area and shape here are estimates for guidance; the server recomputes the polygon, area and checks on sync.
        </p>
      </div>

      {pending && <Camera title={`Photo for point ${vertices.length + 1}`} onCapture={onPhoto} onCancel={() => setPending(null)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}
