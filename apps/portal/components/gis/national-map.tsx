'use client';

import { geoJSON, type LatLngBoundsExpression, type Layer, type PathOptions } from 'leaflet';
import type { Feature, Geometry, Point } from 'geojson';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { CircleMarker, GeoJSON as LeafletGeoJSON, Tooltip } from 'react-leaflet';
import { BaseMap } from '@/components/gis/base-map';
import { STATUS_COLOR } from '@/components/status';
import { INDIA_BBOX, useMapLayers } from '@/lib/gis-api';

/** Choropleth classes by breached-deadline count. Light → dark red; 0 stays neutral. */
const BREACH_CLASSES: Array<{ min: number; label: string; fill: string }> = [
  { min: 6, label: '6 or more', fill: '#991B1B' },
  { min: 3, label: '3–5', fill: '#DC2626' },
  { min: 1, label: '1–2', fill: '#F87171' },
  { min: 0, label: 'None', fill: '#E2E8F0' },
];
const breachFill = (n: number) => BREACH_CLASSES.find((c) => n >= c.min)!.fill;

type Props = Record<string, unknown>;

/**
 * National map (A2, for the national dashboard): state outlines shaded by breached statutory
 * deadlines, one marker per project coloured by its worst open deadline, click → project.
 * Satellite with an offline PMTiles fallback (BaseMap). Outlines are SYNTHETIC_DEMO and say so.
 */
export function NationalMap({ heightClassName = 'h-[28rem]' }: { heightClassName?: string }) {
  const router = useRouter();
  const { data, isLoading, isError } = useMapLayers(INDIA_BBOX, ['states', 'projects'], 5);
  const states = data?.layers.states;
  const projects = data?.layers.projects;

  const bounds = useMemo<LatLngBoundsExpression | null>(() => {
    const src = [states, projects].filter((collection): collection is NonNullable<typeof collection> => !!collection && collection.features.length > 0);
    if (!src.length) return null;
    const b = geoJSON(src).getBounds();
    return b.isValid() ? b.pad(0.15) : null;
  }, [projects, states]);

  const counts = useMemo(() => {
    const c = { BREACHED: 0, DUE_SOON: 0, SAFE: 0 };
    for (const f of projects?.features ?? []) c[(f.properties.risk as keyof typeof c) ?? 'SAFE']++;
    return c;
  }, [projects]);

  const overlay = (
    <div className="absolute bottom-2 left-2 z-[1000] max-w-56 rounded-md border border-slate-300 bg-white/95 p-2 text-[11px] text-slate-700 shadow-sm">
      {isError ? (
        <p className="text-red-700">Map layers unavailable — the API is not reachable.</p>
      ) : isLoading ? (
        <p className="text-slate-500">Loading map layers…</p>
      ) : (
        <>
          <p className="font-semibold">Breached deadlines by state</p>
          <ul className="mt-1 space-y-0.5">
            {BREACH_CLASSES.map((c) => (
              <li key={c.label} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-3.5 border border-slate-400" style={{ background: c.fill }} />
                {c.label}
              </li>
            ))}
          </ul>
          <p className="mt-2 font-semibold">Projects by worst deadline</p>
          <ul className="mt-1 space-y-0.5">
            {(['BREACHED', 'DUE_SOON', 'SAFE'] as const).map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[k] }} />
                {k === 'BREACHED' ? 'Breached' : k === 'DUE_SOON' ? 'Due soon' : 'On track'} ({counts[k]})
              </li>
            ))}
          </ul>
          <p className="mt-2 text-slate-500">State outlines are approximate (synthetic demo data).</p>
        </>
      )}
    </div>
  );

  return (
    <BaseMap bounds={bounds} heightClassName={heightClassName} overlay={overlay}>
      {states && (
        <LeafletGeoJSON
          key={`states-${states.features.length}`}
          data={states}
          style={(f) => {
            const n = Number((f?.properties as Props | undefined)?.breached ?? 0);
            return { color: '#334155', weight: 1, fillColor: breachFill(n), fillOpacity: 0.45 } satisfies PathOptions;
          }}
          onEachFeature={(f: Feature<Geometry, Props>, layer: Layer) => {
            const p = f.properties;
            layer.bindTooltip(
              `<strong>${String(p.name)}</strong><br/>${Number(p.projects)} project(s) · ${Number(p.breached)} breached · ${Number(p.due_soon)} due soon`,
              { sticky: true },
            );
          }}
        />
      )}
      {projects?.features.map((f) => {
        const [lng, lat] = (f.geometry as Point).coordinates as [number, number];
        const p = f.properties;
        const risk = (p.risk as 'BREACHED' | 'DUE_SOON' | 'SAFE') ?? 'SAFE';
        return (
          <CircleMarker
            key={String(p.id)}
            center={[lat, lng]}
            radius={7}
            pathOptions={{ color: '#ffffff', weight: 2, fillColor: STATUS_COLOR[risk], fillOpacity: 1 }}
            eventHandlers={{ click: () => router.push(`/project/${String(p.id)}`) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <span className="font-mono text-[11px]">{String(p.code)}</span>
              <br />
              <span className="font-medium">{String(p.name)}</span>
              <br />
              <span className="text-slate-600">
                Stage {String(p.current_stage ?? '—')}
                {Number(p.breached) > 0 ? ` · ${Number(p.breached)} breached` : ''}
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </BaseMap>
  );
}
