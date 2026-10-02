'use client';

import { formatArea } from '@bhoomisetu/geo';
import {
  divIcon,
  geoJSON,
  layerGroup,
  marker,
  type GeoJSON as LeafletGeoJSONLayer,
  type LatLngBounds,
  type LatLngBoundsExpression,
  type LayerGroup,
  type Path,
  type PathOptions,
} from 'leaflet';
import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { CircleMarker, GeoJSON as RLGeoJSON, Tooltip, useMap } from 'react-leaflet';
import { BaseMap } from '@/components/gis/base-map';
import { parcelColor } from '@/components/gis/parcel-colors';
import type { BBox, RegistryRow } from '@/lib/gis-api';
import type { ColorBy } from '@/lib/parcels-api';

export type LayerKey = 'parcels' | 'corridor' | 'alignment' | 'villages' | 'constraints' | 'labels';
export type ConstraintKey = 'IRRIGATED_MULTICROP' | 'SCHEDULED_AREA' | 'PROTECTED_FOREST' | 'WATER_BODY' | 'ECO_SENSITIVE';

export const CONSTRAINT_STYLE: Record<ConstraintKey, { label: string; color: string }> = {
  IRRIGATED_MULTICROP: { label: 's.10 irrigated multi-crop', color: '#16A34A' },
  SCHEDULED_AREA: { label: 's.41 scheduled area', color: '#9333EA' },
  PROTECTED_FOREST: { label: 'Protected forest', color: '#166534' },
  WATER_BODY: { label: 'Water body', color: '#2563EB' },
  ECO_SENSITIVE: { label: 'Eco-sensitive zone', color: '#CA8A04' },
};

/** Survey-number labels only from this zoom (A2), and never more than this many at once. */
const LABEL_MIN_ZOOM = 15;
const MAX_LABELS = 400;
const SELECTED: PathOptions = { color: '#F59E0B', weight: 3.5 };
const NORMAL: PathOptions = { color: '#0F172A', weight: 0.7 };

export const categoryOf = (r: Pick<RegistryRow, 'status' | 'payment' | 'deadline_risk'>, colorBy: ColorBy) =>
  colorBy === 'stage' ? r.status : colorBy === 'payment' ? r.payment : r.deadline_risk;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const label = (s: string) => s.replace(/_/g, ' ').toLowerCase();

/**
 * All parcels as ONE L.geoJSON layer on the canvas renderer (BaseMap sets preferCanvas) — not a
 * React component per parcel, so 1,500 parcels pan smoothly. Selection restyles in place.
 */
function ParcelsLayer({
  rows,
  colorBy,
  selectedId,
  onSelect,
  showLabels,
}: {
  rows: RegistryRow[];
  colorBy: ColorBy;
  selectedId: string | null;
  onSelect: (id: string) => void;
  showLabels: boolean;
}) {
  const map = useMap();
  const layerRef = useRef<LeafletGeoJSONLayer | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const fc: FeatureCollection<Geometry, RegistryRow> = {
      type: 'FeatureCollection',
      features: rows.filter((r) => r.geometry).map((r) => ({ type: 'Feature', geometry: r.geometry!, properties: r })),
    };
    const layer = geoJSON(fc, {
      style: (f) => ({
        ...NORMAL,
        fillColor: parcelColor(colorBy, categoryOf((f as Feature<Geometry, RegistryRow>).properties, colorBy)),
        fillOpacity: 0.6,
      }),
      onEachFeature: (f: Feature<Geometry, RegistryRow>, l) => {
        const p = f.properties;
        const area = p.affected_area_sqm ? formatArea(Number(p.affected_area_sqm)) : '—';
        l.bindTooltip(
          `<strong>${esc(p.survey_no)}</strong> · ${esc(p.village_name)}<br/>Affected: ${esc(area)}<br/>${esc(label(p.status))}`,
          { sticky: true },
        );
        l.on('click', () => onSelectRef.current(p.project_parcel_id));
      },
    });
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      map.removeLayer(layer);
      layerRef.current = null;
    };
  }, [map, rows, colorBy]);

  useEffect(() => {
    layerRef.current?.eachLayer((l) => {
      const p = (l as Path & { feature: Feature<Geometry, RegistryRow> }).feature.properties;
      const path = l as Path;
      if (p.project_parcel_id === selectedId) {
        path.setStyle(SELECTED);
        path.bringToFront();
      } else path.setStyle(NORMAL);
    });
  }, [selectedId, rows, colorBy]);

  // Survey labels: only at street zoom, only for parcels in view.
  useEffect(() => {
    let group: LayerGroup | null = null;
    const draw = () => {
      if (group) map.removeLayer(group);
      group = null;
      if (!showLabels || map.getZoom() < LABEL_MIN_ZOOM || !layerRef.current) return;
      const view = map.getBounds();
      group = layerGroup();
      let n = 0;
      layerRef.current.eachLayer((l) => {
        if (n >= MAX_LABELS) return;
        const pl = l as Path & { getBounds(): LatLngBounds; feature: Feature<Geometry, RegistryRow> };
        const b = pl.getBounds();
        if (!view.intersects(b)) return;
        n++;
        group!.addLayer(
          marker(b.getCenter(), {
            interactive: false,
            keyboard: false,
            icon: divIcon({
              className: '',
              html: `<span style="font:600 10px/1 system-ui;color:#0F172A;background:rgba(255,255,255,.8);padding:1px 3px;border-radius:2px;white-space:nowrap">${esc(pl.feature.properties.survey_no)}</span>`,
            }),
          }),
        );
      });
      group.addTo(map);
    };
    draw();
    map.on('zoomend moveend', draw);
    return () => {
      map.off('zoomend moveend', draw);
      if (group) map.removeLayer(group);
    };
  }, [map, rows, showLabels]);

  return null;
}

/** Reports the visible bbox/zoom so the reference layers can be fetched for the view. */
function ViewWatcher({ onView }: { onView: (bbox: BBox, zoom: number) => void }) {
  const map = useMap();
  const ref = useRef(onView);
  ref.current = onView;
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const fire = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const b = map.getBounds();
        ref.current([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], map.getZoom());
      }, 300);
    };
    fire();
    map.on('moveend', fire);
    return () => {
      clearTimeout(t);
      map.off('moveend', fire);
    };
  }, [map]);
  return null;
}

export interface CorridorData {
  footprint: Geometry | null;
  alignment: Geometry | null;
  start: Point | null;
  end: Point | null;
}

export function GisMap({
  rows,
  colorBy,
  selectedId,
  onSelect,
  layersOn,
  constraintsOn,
  villages,
  constraints,
  corridor,
  bounds,
  onView,
  overlay,
  heightClassName = 'h-[36rem]',
}: {
  rows: RegistryRow[];
  colorBy: ColorBy;
  selectedId: string | null;
  onSelect: (id: string) => void;
  layersOn: Record<LayerKey, boolean>;
  constraintsOn: Record<ConstraintKey, boolean>;
  villages: FeatureCollection<Geometry, Record<string, unknown>> | undefined;
  constraints: FeatureCollection<Geometry, Record<string, unknown>> | undefined;
  corridor: CorridorData | null;
  bounds: LatLngBoundsExpression | null;
  onView: (bbox: BBox, zoom: number) => void;
  overlay?: ReactNode;
  heightClassName?: string;
}) {
  const visibleConstraints = useMemo(
    () =>
      constraints && {
        ...constraints,
        features: constraints.features.filter((f) => constraintsOn[f.properties.layer_type as ConstraintKey]),
      },
    [constraints, constraintsOn],
  );
  // react-leaflet's GeoJSON is immutable after mount; a key that changes with the data remounts it.
  const vKey = villages ? villages.features.map((f) => f.id).join('|') : 'none';
  const cKey = visibleConstraints ? visibleConstraints.features.map((f) => f.id).join('|') : 'none';

  return (
    <BaseMap bounds={bounds} heightClassName={heightClassName} scrollWheelZoom overlay={overlay}>
      <ViewWatcher onView={onView} />
      {layersOn.villages && villages && (
        <RLGeoJSON
          key={`v-${vKey}`}
          data={villages}
          interactive={false}
          style={{ color: '#F8FAFC', weight: 1.5, dashArray: '6 5', fill: false, opacity: 0.9 }}
        />
      )}
      {layersOn.constraints && visibleConstraints && (
        <RLGeoJSON
          key={`c-${cKey}`}
          data={visibleConstraints}
          style={(f) => {
            const c = CONSTRAINT_STYLE[(f?.properties as Record<string, unknown>)?.layer_type as ConstraintKey];
            return { color: c?.color ?? '#64748B', weight: 1.5, fillColor: c?.color ?? '#64748B', fillOpacity: 0.18 };
          }}
          onEachFeature={(f, l) => {
            const p = f.properties as Record<string, unknown>;
            l.bindTooltip(`${esc(CONSTRAINT_STYLE[p.layer_type as ConstraintKey]?.label ?? p.layer_type)} — ${esc(p.name)}`, { sticky: true });
          }}
        />
      )}
      {layersOn.corridor && corridor?.footprint && (
        <RLGeoJSON
          key={`fp-${JSON.stringify(corridor.footprint).length}`}
          data={corridor.footprint}
          interactive={false}
          style={{ color: '#F97316', weight: 2, fillColor: '#FB923C', fillOpacity: 0.08 }}
        />
      )}
      {layersOn.alignment && corridor?.alignment && (
        <RLGeoJSON
          key={`al-${JSON.stringify(corridor.alignment).length}`}
          data={corridor.alignment}
          interactive={false}
          style={{ color: '#EA580C', weight: 3, dashArray: '10 6' }}
        />
      )}
      {layersOn.parcels && (
        <ParcelsLayer rows={rows} colorBy={colorBy} selectedId={selectedId} onSelect={onSelect} showLabels={layersOn.labels} />
      )}
      {corridor?.start && <EndMarker point={corridor.start} text="Start" />}
      {corridor?.end && <EndMarker point={corridor.end} text="End" />}
    </BaseMap>
  );
}

function EndMarker({ point, text }: { point: Point; text: string }) {
  const [lng, lat] = point.coordinates as [number, number];
  return (
    <CircleMarker center={[lat, lng]} radius={8} pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#0F172A', fillOpacity: 1 }}>
      <Tooltip permanent direction="top" offset={[0, -8]}>
        {text}
      </Tooltip>
    </CircleMarker>
  );
}

/** Bounds of a set of registry rows (the filtered set), or null. */
export function rowsBounds(rows: RegistryRow[]): LatLngBoundsExpression | null {
  const feats = rows.filter((r) => r.geometry).map((r) => ({ type: 'Feature' as const, geometry: r.geometry!, properties: {} }));
  if (!feats.length) return null;
  const fc: FeatureCollection = { type: 'FeatureCollection', features: feats };
  const b = geoJSON(fc).getBounds();
  return b.isValid() ? b : null;
}
