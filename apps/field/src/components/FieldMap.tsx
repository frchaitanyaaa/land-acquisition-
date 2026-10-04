import 'leaflet/dist/leaflet.css';
import { geoJSON, type Layer as LeafletLayer, type LatLngBoundsExpression } from 'leaflet';
import { leafletLayer } from 'protomaps-leaflet';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Circle, CircleMarker, GeoJSON, MapContainer, useMap } from 'react-leaflet';
import type { Geometry } from 'geojson';
import { TILES_URL } from '../lib/basemap';
import type { Fix } from '../lib/position';
import type { OfflinePack } from '../lib/types';

/** Regional PMTiles vector basemap (§16.5) — same setup as the portal's BaseMap. */
function Basemap() {
  const map = useMap();
  useEffect(() => {
    // protomaps-leaflet's declarations don't line up with @types/leaflet's Layer; it is an L.GridLayer.
    const layer = leafletLayer({ url: TILES_URL, maxDataZoom: 14 }) as unknown as LeafletLayer;
    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
    };
  }, [map]);
  return null;
}

function FitOnce({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done && bounds) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18 });
      setDone(true);
    }
  }, [map, bounds, done]);
  return null;
}

function Follow({ fix, enabled }: { fix: Fix | null; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (enabled && fix) map.panTo([fix.lat, fix.lng], { animate: true });
  }, [map, fix, enabled]);
  return null;
}

function boundsOf(g: Geometry | null): LatLngBoundsExpression | null {
  if (!g) return null;
  try {
    const b = geoJSON(g).getBounds();
    return b.isValid() ? b : null;
  } catch {
    return null;
  }
}

/**
 * Walk & Mark map (§16.2 screen 4): project footprint, village boundary, existing parcels, and the
 * live position dot with its accuracy circle. Leaflet with preferCanvas, as in the portal.
 */
export function FieldMap({
  pack,
  fix,
  follow,
  children,
  heightClassName = 'h-[50vh]',
}: {
  pack: OfflinePack;
  fix: Fix | null;
  follow: boolean;
  children?: ReactNode;
  heightClassName?: string;
}) {
  const bounds = useMemo(
    () => boundsOf(pack.parcel_geometry) ?? boundsOf(pack.footprint) ?? boundsOf(pack.village_boundary),
    [pack],
  );
  return (
    <div className={`${heightClassName} w-full overflow-hidden bg-slate-200`}>
      <MapContainer center={[20.5, 78.9]} zoom={5} preferCanvas className="h-full w-full" zoomControl={false}>
        <Basemap />
        <FitOnce bounds={bounds} />
        <Follow fix={fix} enabled={follow} />
        {pack.village_boundary && (
          <GeoJSON data={pack.village_boundary} style={{ color: '#64748b', weight: 1, dashArray: '4 4', fill: false }} />
        )}
        {pack.footprint && (
          <GeoJSON data={pack.footprint} style={{ color: '#ea580c', weight: 2, fillColor: '#fb923c', fillOpacity: 0.12 }} />
        )}
        {pack.neighbours.map((n) => (
          <GeoJSON key={n.id} data={n.geometry} style={{ color: '#475569', weight: 1, fillOpacity: 0.04 }} />
        ))}
        {pack.parcel_geometry && (
          <GeoJSON data={pack.parcel_geometry} style={{ color: '#0f766e', weight: 2, dashArray: '6 4', fillOpacity: 0.08 }} />
        )}
        {children}
        {fix && (
          <>
            <Circle center={[fix.lat, fix.lng]} radius={fix.accuracy} pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.12 }} />
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
