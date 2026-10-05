import 'leaflet/dist/leaflet.css';
import { geoJSON, tileLayer, type Layer as LeafletLayer, type LatLngBounds } from 'leaflet';
import { leafletLayer } from 'protomaps-leaflet';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Circle, CircleMarker, GeoJSON, MapContainer, useMap } from 'react-leaflet';
import type { Geometry } from 'geojson';
import { TILES_URL } from '../lib/basemap';
import type { Fix } from '../lib/position';
import type { OfflinePack } from '../lib/types';

/**
 * Esri World Imagery while online (same source as the portal, attribution shown). Never cached by the
 * service worker — satellite imagery is online-only (§16.5).
 */
const ESRI_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTRIBUTION = 'Imagery © Esri, Maxar, Earthstar Geographics';

/** The PMTiles extract is optional (data/tiles is not always installed): checked once per page. */
let pmtilesCheck: Promise<boolean> | null = null;
function pmtilesAvailable(): Promise<boolean> {
  pmtilesCheck ??= fetch(TILES_URL, { method: 'HEAD' })
    .then((r) => r.ok)
    .catch(() => false);
  return pmtilesCheck;
}

/**
 * Offline vector basemap (regional PMTiles, §16.5) underneath, satellite imagery on top. Offline, the
 * satellite tiles fail and the PMTiles map (cached with the offline pack) shows through.
 */
function Basemap() {
  const map = useMap();
  useEffect(() => {
    let cancelled = false;
    let vector: LeafletLayer | null = null;
    void pmtilesAvailable().then((ok) => {
      if (cancelled || !ok) return;
      // protomaps-leaflet's declarations don't line up with @types/leaflet's Layer; it is an L.GridLayer.
      vector = leafletLayer({ url: TILES_URL, maxDataZoom: 14 }) as unknown as LeafletLayer;
      map.addLayer(vector);
      (vector as unknown as { bringToBack: () => void }).bringToBack();
    });
    const sat = tileLayer(ESRI_URL, { attribution: ESRI_ATTRIBUTION, maxZoom: 20, maxNativeZoom: 18 });
    map.addLayer(sat);
    return () => {
      cancelled = true;
      map.removeLayer(sat);
      if (vector) map.removeLayer(vector);
    };
  }, [map]);
  return null;
}

/** Fits the map to the parcel on first show and every time `token` changes ("Parcel" button). */
function FitTo({ bounds, token }: { bounds: LatLngBounds | null; token: number }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 18 });
  }, [map, bounds, token]);
  return null;
}

function Follow({ fix, enabled }: { fix: Fix | null; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (enabled && fix) map.setView([fix.lat, fix.lng], Math.max(map.getZoom(), 17), { animate: true });
  }, [map, fix, enabled]);
  return null;
}

function boundsOf(g: Geometry | null): LatLngBounds | null {
  if (!g) return null;
  try {
    const b = geoJSON(g).getBounds();
    return b.isValid() ? b : null;
  } catch {
    return null;
  }
}

/** The parcel's bounds, else the project footprint's, else the village's. */
export function packBounds(pack: OfflinePack): LatLngBounds | null {
  return boundsOf(pack.parcel_geometry) ?? boundsOf(pack.footprint) ?? boundsOf(pack.village_boundary);
}

/**
 * Walk & Mark map (§16.2 screen 4): project footprint, village boundary, existing parcels, and the
 * live position dot with its accuracy circle. Leaflet with preferCanvas, as in the portal.
 */
export function FieldMap({
  pack,
  fix,
  follow,
  fitToken = 0,
  children,
  heightClassName = 'h-[50vh]',
}: {
  pack: OfflinePack;
  fix: Fix | null;
  follow: boolean;
  /** Increment to re-fit the map to the parcel. */
  fitToken?: number;
  children?: ReactNode;
  heightClassName?: string;
}) {
  const bounds = useMemo(() => packBounds(pack), [pack]);
  const [ready, setReady] = useState(false);
  return (
    <div className={`${heightClassName} w-full overflow-hidden bg-slate-300`}>
      <MapContainer
        center={[20.5, 78.9]}
        zoom={5}
        preferCanvas
        className="h-full w-full"
        zoomControl={false}
        whenReady={() => setReady(true)}
      >
        <Basemap />
        {ready && <FitTo bounds={bounds} token={fitToken} />}
        <Follow fix={fix} enabled={follow} />
        {pack.village_boundary && (
          <GeoJSON
            data={pack.village_boundary}
            style={{ color: '#ffffff', weight: 1.5, dashArray: '4 4', fill: false }}
          />
        )}
        {pack.footprint && (
          <GeoJSON
            data={pack.footprint}
            style={{ color: '#ff9933', weight: 2, fillColor: '#ff9933', fillOpacity: 0.12 }}
          />
        )}
        {pack.neighbours.map((n) => (
          <GeoJSON key={n.id} data={n.geometry} style={{ color: '#e2e8f0', weight: 1, fillOpacity: 0.05 }} />
        ))}
        {pack.parcel_geometry && (
          <GeoJSON
            data={pack.parcel_geometry}
            style={{ color: '#facc15', weight: 3, dashArray: '6 4', fillOpacity: 0.12 }}
          />
        )}
        {children}
        {fix && (
          <>
            <Circle
              center={[fix.lat, fix.lng]}
              radius={fix.accuracy}
              pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.12 }}
            />
            <CircleMarker
              center={[fix.lat, fix.lng]}
              radius={7}
              pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}
