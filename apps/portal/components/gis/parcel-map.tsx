'use client';

import { GeoJSON as LeafletGeoJSON } from 'react-leaflet';
import type { Layer, PathOptions } from 'leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { BaseMap } from '@/components/gis/base-map';
import { parcelColor } from '@/components/gis/parcel-colors';
import type { ColorBy, ParcelFeature } from '@/lib/parcels-api';

export function ParcelMap({
  features,
  colorBy,
  selectedId,
  onSelect,
  bbox,
}: {
  features: ParcelFeature[];
  colorBy: ColorBy;
  selectedId: string | null;
  onSelect: (parcelId: string) => void;
  bbox: unknown;
}) {
  const bounds = bboxToLatLngBounds(bbox);
  const collection: FeatureCollection<Geometry, ParcelFeature['properties']> = {
    type: 'FeatureCollection',
    features: features.map((feature) => ({
      type: 'Feature',
      id: feature.id,
      geometry: feature.geometry as Geometry,
      properties: feature.properties,
    })),
  };

  return (
    <BaseMap bounds={bounds} heightClassName="h-[32rem]">
      <LeafletGeoJSON
        data={collection}
        style={(feature) => {
          const properties = feature?.properties as ParcelFeature['properties'] | undefined;
          const color = parcelColor(colorBy, properties?.category ?? '');
          const flagged = !!properties?.flags.length;
          const selected = properties?.parcel_id === selectedId;
          return {
            color: selected ? '#0F172A' : flagged ? '#DC2626' : color,
            weight: selected ? 3 : flagged ? 2 : 1,
            fillColor: color,
            fillOpacity: 0.6,
          } satisfies PathOptions;
        }}
        onEachFeature={(feature: Feature<Geometry, ParcelFeature['properties']>, layer: Layer) => {
          const properties = feature.properties;
          const area = Number(properties.affected_area_sqm).toLocaleString('en-IN', { maximumFractionDigits: 1 });
          layer.bindTooltip(
            `${properties.survey_no} · ${properties.village_name} · ${area} m² · ${properties.status}`,
            { sticky: true },
          );
          layer.on('click', () => onSelect(properties.parcel_id));
        }}
      />
    </BaseMap>
  );
}

function bboxToLatLngBounds(bbox: unknown): [[number, number], [number, number]] | null {
  const geom = bbox as { type?: string; coordinates?: number[][][] } | null;
  if (!geom?.coordinates?.[0]?.length) return null;
  const ring = geom.coordinates[0];
  const lats = ring.map((c) => c[1]!);
  const lngs = ring.map((c) => c[0]!);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}
