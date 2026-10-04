'use client';

import 'leaflet/dist/leaflet.css';
import { tileLayer, type Layer as LeafletLayer, type LatLngBoundsExpression, type LatLngExpression } from 'leaflet';
import { leafletLayer } from 'protomaps-leaflet';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MapContainer, useMap } from 'react-leaflet';

const TILES_URL = process.env.NEXT_PUBLIC_TILES_PMTILES_URL || '/tiles/demo-region.pmtiles';
export const INDIA_CENTER: LatLngExpression = [22.5, 79.0];

/** Esri World Imagery (A2). Needs internet; the PMTiles map is the offline fallback (§16.5). */
const ESRI_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTRIBUTION = 'Tiles © Esri — Esri, Maxar, Earthstar Geographics, GIS User Community';
/** After this many failed satellite tiles we assume no internet and fall back to the offline map. */
const FALLBACK_AFTER_ERRORS = 4;

export type BasemapKind = 'satellite' | 'offline';

/** Checked once per page: the PMTiles extract is optional (data/tiles is not always present). */
let pmtilesCheck: Promise<boolean> | null = null;
function pmtilesAvailable(): Promise<boolean> {
  pmtilesCheck ??= fetch(TILES_URL, { method: 'HEAD' })
    .then((r) => r.ok)
    .catch(() => false);
  return pmtilesCheck;
}

function Basemap({ kind, onFailed, onMissing }: { kind: BasemapKind; onFailed: () => void; onMissing: () => void }) {
  const map = useMap();
  useEffect(() => {
    let layer: LeafletLayer | null = null;
    let cancelled = false;
    if (kind === 'satellite') {
      let errors = 0;
      const sat = tileLayer(ESRI_URL, { attribution: ESRI_ATTRIBUTION, maxZoom: 19, maxNativeZoom: 18 });
      sat.on('tileerror', () => {
        if (++errors === FALLBACK_AFTER_ERRORS) onFailed();
      });
      layer = sat;
      map.addLayer(sat);
    } else {
      void pmtilesAvailable().then((ok) => {
        if (cancelled) return;
        if (!ok) return onMissing();
        // protomaps-leaflet's declarations don't line up with @types/leaflet's Layer; it is an L.GridLayer.
        layer = leafletLayer({ url: TILES_URL, maxDataZoom: 15 }) as unknown as LeafletLayer;
        map.addLayer(layer);
      });
    }
    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [map, kind, onFailed, onMissing]);
  return null;
}

/** Fits the map to the given bounds once, when they change. */
function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
  }, [map, bounds]);
  return null;
}

/** Tells Leaflet the container changed size (fullscreen, panes opening). */
function InvalidateOn({ token }: { token: unknown }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [map, token]);
  return null;
}

function ReportViewport({ onChange }: { onChange?: (bounds: [[number, number], [number, number]], zoom: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!onChange) return;
    const report = () => {
      const bounds = map.getBounds();
      onChange(
        [
          [bounds.getSouth(), bounds.getWest()],
          [bounds.getNorth(), bounds.getEast()],
        ],
        map.getZoom(),
      );
    };
    report();
    map.on('moveend', report);
    return () => {
      map.off('moveend', report);
    };
  }, [map, onChange]);
  return null;
}

/**
 * Shared Leaflet setup (§4, §16.5, A2) — every portal map renders through this so the basemap,
 * canvas renderer and controls stay consistent. Satellite by default with an offline PMTiles
 * fallback (automatic when satellite tiles fail, or by the toggle). Optional fullscreen.
 */
export function BaseMap({
  children,
  center = INDIA_CENTER,
  zoom = 5,
  bounds = null,
  scrollWheelZoom = false,
  heightClassName = 'h-96',
  defaultBasemap = 'satellite',
  controls = true,
  overlay,
  onViewportChange,
}: {
  children?: ReactNode;
  center?: LatLngExpression;
  zoom?: number;
  bounds?: LatLngBoundsExpression | null;
  scrollWheelZoom?: boolean;
  heightClassName?: string;
  defaultBasemap?: BasemapKind;
  /** Basemap toggle + fullscreen buttons. */
  controls?: boolean;
  /** Absolutely positioned content over the map (legend, layer panel). */
  overlay?: ReactNode;
  /** Reports the visible map bounds and zoom after initial render and each pan/zoom. */
  onViewportChange?: (bounds: [[number, number], [number, number]], zoom: number) => void;
}) {
  const [kind, setKind] = useState<BasemapKind>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : defaultBasemap,
  );
  const [fellBack, setFellBack] = useState(false);
  const [offlineMissing, setOfflineMissing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === box.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const onSatelliteFailed = useRef(() => {
    setFellBack(true);
    setKind('offline');
  }).current;
  const onOfflineMissing = useRef(() => setOfflineMissing(true)).current;

  return (
    <div ref={box} className={`${fullscreen ? 'h-screen' : heightClassName} relative w-full overflow-hidden border border-slate-200 bg-slate-100`}>
      <MapContainer center={center} zoom={zoom} preferCanvas className="h-full w-full" scrollWheelZoom={scrollWheelZoom}>
        <Basemap kind={kind} onFailed={onSatelliteFailed} onMissing={onOfflineMissing} />
        <FitBounds bounds={bounds} />
        <InvalidateOn token={fullscreen} />
        <ReportViewport onChange={onViewportChange} />
        {children}
      </MapContainer>
      {overlay}
      {controls && (
        <div className="absolute right-2 top-2 z-[1000] flex flex-col items-end gap-1">
          <div className="flex overflow-hidden rounded-md border border-slate-300 bg-white text-xs shadow-sm">
            {(['satellite', 'offline'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setFellBack(false);
                  setKind(k);
                }}
                aria-pressed={kind === k}
                className={`px-2 py-1 ${kind === k ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                {k === 'satellite' ? 'Satellite' : 'Offline map'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => (fullscreen ? void document.exitFullscreen() : void box.current?.requestFullscreen())}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm hover:bg-slate-50"
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {fullscreen ? '⤡ Exit' : '⤢ Full screen'}
          </button>
          {fellBack && !offlineMissing && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900 shadow-sm">No internet — showing offline map</span>
          )}
          {kind === 'offline' && offlineMissing && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900 shadow-sm">
              Offline basemap not installed — map layers only
            </span>
          )}
        </div>
      )}
    </div>
  );
}
