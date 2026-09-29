'use client';

import { GeoJSON as LeafletGeoJSON } from 'react-leaflet';
import type { Layer, PathOptions } from 'leaflet';
import type { Feature, Geometry } from 'geojson';
import { BaseMap } from '@/components/base-map';
import { parcelColor } from '@/components/parcel-colors';
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
  return (
    <BaseMap bounds={bounds} heightClassName="h-[32rem]">
      {features.map((f) => (
        <ParcelPolygon key={f.id} feature={f} colorBy={colorBy} selected={f.properties.parcel_id === selectedId} onSelect={onSelect} />
      ))}
    </BaseMap>
  );
}

function ParcelPolygon({
  feature,
  colorBy,
  selected,
  onSelect,
}: {
  feature: ParcelFeature;
  colorBy: ColorBy;
  selected: boolean;
  onSelect: (parcelId: string) => void;
}) {
  const color = parcelColor(colorBy, feature.properties.category);
  const flagged = feature.properties.flags.length > 0;
  const style: PathOptions = {
    color: selected ? '#0F172A' : flagged ? '#DC2626' : color,
    weight: selected ? 3 : flagged ? 2 : 1,
    fillColor: color,
    fillOpacity: 0.6,
  };

  const geo: Feature<Geometry> = { type: 'Feature', geometry: feature.geometry as Geometry, properties: {} };

  function onEachFeature(_f: Feature, layer: Layer) {
    layer.bindTooltip(`${feature.properties.survey_no}${flagged ? ` — ${feature.properties.flags.join(', ')}` : ''}`);
    layer.on('click', () => onSelect(feature.properties.parcel_id));
  }

  return <LeafletGeoJSON data={geo} style={style} onEachFeature={onEachFeature} />;
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
