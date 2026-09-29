'use client';

import { GeoJSON as LeafletGeoJSON } from 'react-leaflet';
import type { Feature, Geometry } from 'geojson';
import { BaseMap } from '@/components/base-map';

export function AlignmentMap({ footprint, alignment }: { footprint: unknown; alignment: unknown }) {
  const bounds = bboxOf(footprint);
  return (
    <BaseMap bounds={bounds} heightClassName="h-64">
      {!!footprint && (
        <LeafletGeoJSON
          data={{ type: 'Feature', geometry: footprint as Geometry, properties: {} } as Feature<Geometry>}
          style={{ color: '#0F766E', weight: 2, fillColor: '#0F766E', fillOpacity: 0.2 }}
        />
      )}
      {!!alignment && (
        <LeafletGeoJSON
          data={{ type: 'Feature', geometry: alignment as Geometry, properties: {} } as Feature<Geometry>}
          style={{ color: '#0F172A', weight: 2 }}
        />
      )}
    </BaseMap>
  );
}

function bboxOf(geom: unknown): [[number, number], [number, number]] | null {
  const lats: number[] = [];
  const lngs: number[] = [];
  function walk(v: unknown) {
    if (Array.isArray(v)) {
      if (v.length >= 2 && typeof v[0] === 'number' && typeof v[1] === 'number') {
        lngs.push(v[0]);
        lats.push(v[1]);
      } else v.forEach(walk);
    }
  }
  const g = geom as { coordinates?: unknown } | null;
  if (g?.coordinates) walk(g.coordinates);
  if (!lats.length) return null;
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}
