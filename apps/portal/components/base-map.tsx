'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, useMap } from 'react-leaflet';
import type { Layer as LeafletLayer, LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import { leafletLayer } from 'protomaps-leaflet';
import type { ReactNode } from 'react';

const TILES_URL = process.env.NEXT_PUBLIC_TILES_PMTILES_URL || '/tiles/demo-region.pmtiles';
export const INDIA_CENTER: LatLngExpression = [22.5, 79.0];

/** The offline vector basemap (§16.5) — never bulk-cached OSM tiles. Renders blank until the
 * demo-region.pmtiles asset (§33.2, a data task, not code) is dropped into apps/portal/public/tiles. */
function Basemap() {
  const map = useMap();
  useEffect(() => {
    // protomaps-leaflet's own type declarations don't line up with @types/leaflet's Layer
    // interface across versions; the runtime object is a real L.GridLayer.
    const layer = leafletLayer({ url: TILES_URL, maxDataZoom: 14 }) as unknown as LeafletLayer;
    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
    };
  }, [map]);
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

/**
 * Shared Leaflet + PMTiles setup (§4, §16.5) — every map in the portal renders through this so the
 * basemap, canvas preference and scroll-zoom behaviour stay consistent.
 */
export function BaseMap({
  children,
  center = INDIA_CENTER,
  zoom = 5,
  bounds = null,
  scrollWheelZoom = false,
  heightClassName = 'h-96',
}: {
  children?: ReactNode;
  center?: LatLngExpression;
  zoom?: number;
  bounds?: LatLngBoundsExpression | null;
  scrollWheelZoom?: boolean;
  heightClassName?: string;
}) {
  return (
    <div className={`${heightClassName} w-full overflow-hidden border border-slate-200 bg-slate-100`}>
      <MapContainer center={center} zoom={zoom} preferCanvas className="h-full w-full" scrollWheelZoom={scrollWheelZoom}>
        <Basemap />
        <FitBounds bounds={bounds} />
        {children}
      </MapContainer>
    </div>
  );
}
