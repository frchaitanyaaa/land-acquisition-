'use client';

import { LAND_CLASSES, PARCEL_STATUSES } from '@bhoomisetu/shared';
import { formatArea } from '@bhoomisetu/geo';
import type { Geometry, LineString, MultiLineString, Point } from 'geojson';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { ChainageStrip } from '@/components/gis/chainage-strip';
import { COLOR_BY_LEGEND, parcelColor } from '@/components/gis/parcel-colors';
import {
  CONSTRAINT_STYLE,
  categoryOf,
  rowsBounds,
  type ConstraintKey,
  type CorridorData,
  type LayerKey,
} from '@/components/gis/gis-map';
import { LandRegistry } from '@/components/gis/land-registry';
import { Parcel360 } from '@/components/gis/parcel-360';
import { RecordPanel } from '@/components/gis/record-panel';
import { Checkbox, SelectField, Switch, Tabs, Tag, TextField, riskTone } from '@/components/gis/ux';
import { INDIA_BBOX, useMapLayers, useParcelRegistry, type BBox, type RegistryFilters, type RegistryRow } from '@/lib/gis-api';
import { useChainage, useParcels, type ColorBy } from '@/lib/parcels-api';

const GisMap = dynamic(() => import('@/components/gis/gis-map').then((m) => m.GisMap), {
  ssr: false,
  loading: () => <div className="h-[36rem] w-full animate-pulse border border-slate-200 bg-slate-100" />,
});

/** Map pages are fetched whole (with geometry) so map, list and legend describe the same set. */
const PAGE = 1000;
const MAX_PARCELS = 6000;
const LIST_STEP = 50;
const CHAINAGE_BIN_M = 500;

const COLOR_BY_OPTIONS: Array<{ value: ColorBy; label: string }> = [
  { value: 'stage', label: 'Stage' },
  { value: 'payment', label: 'Payment' },
  { value: 'risk', label: 'Deadline risk' },
];
const LAYER_LABELS: Record<LayerKey, string> = {
  parcels: 'Parcels',
  corridor: 'Corridor',
  alignment: 'Alignment',
  villages: 'Village boundaries',
  constraints: 'Constraint layers',
  labels: 'Survey labels (zoom 15+)',
};
const PAYMENTS = ['NONE', 'UNPAID', 'PART_PAID', 'PAID', 'ACKNOWLEDGED'] as const;
const RISK_LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const;
const label = (s: string) => s.replace(/_/g, ' ').toLowerCase();

const emptyFilters = (projectId?: string): RegistryFilters => (projectId ? { projectId } : {});

function endsOf(g: Geometry | null): { start: Point | null; end: Point | null } {
  if (!g) return { start: null, end: null };
  const lines = g.type === 'LineString' ? [(g as LineString).coordinates] : g.type === 'MultiLineString' ? (g as MultiLineString).coordinates : [];
  const first = lines[0]?.[0];
  const lastLine = lines[lines.length - 1];
  const last = lastLine?.[lastLine.length - 1];
  return {
    start: first ? { type: 'Point', coordinates: first } : null,
    end: last ? { type: 'Point', coordinates: last } : null,
  };
}

/**
 * The GIS workspace (A2) — /gis (everything in the caller's scope) and the project Parcels tab
 * (fixed project). Left: filters (server-side). Centre: map + chainage strip. Right: record panel.
 * Map, list and legend counts always describe the same filtered set.
 */
export function GisWorkspace({ projectId }: { projectId?: string }) {
  const [filters, setFilters] = useState<RegistryFilters>(emptyFilters(projectId));
  const [search, setSearch] = useState('');
  const [colorBy, setColorBy] = useState<ColorBy>('stage');
  const [layersOn, setLayersOn] = useState<Record<LayerKey, boolean>>({
    parcels: true,
    corridor: true,
    alignment: true,
    villages: true,
    constraints: true,
    labels: true,
  });
  const [constraintsOn, setConstraintsOn] = useState<Record<ConstraintKey, boolean>>({
    IRRIGATED_MULTICROP: true,
    SCHEDULED_AREA: true,
    PROTECTED_FOREST: true,
    WATER_BODY: true,
    ECO_SENSITIVE: true,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBin, setSelectedBin] = useState<number | null>(null);
  const [view, setView] = useState<{ bbox: BBox; zoom: number } | null>(null);
  const [listLimit, setListLimit] = useState(LIST_STEP);
  const [mode, setMode] = useState<'map' | 'registry'>('map');
  const [open360, setOpen360] = useState<RegistryRow | null>(null);
  const locate = (r: RegistryRow) => {
    setOpen360(null);
    setMode('map');
    setSelectedBin(null);
    setSelectedId(r.project_parcel_id);
  };

  // Server-side search, debounced.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: search.trim() || undefined })), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    setSelectedBin(null);
    setListLimit(LIST_STEP);
  }, [filters]);

  const activeProjectId = projectId ?? filters.projectId;
  const registry = useParcelRegistry(filters, { geometry: true, limit: PAGE });
  const loaded = useMemo(() => (registry.data?.pages ?? []).flatMap((p) => p.items), [registry.data]);
  useEffect(() => {
    if (registry.hasNextPage && !registry.isFetchingNextPage && loaded.length < MAX_PARCELS) void registry.fetchNextPage();
  }, [registry, loaded.length]);

  // Pick-lists: projects and the village → taluk → district tree in the caller's scope.
  const lists = useMapLayers(INDIA_BBOX, ['projects', 'villages'], 5);
  const projectOptions = (lists.data?.layers.projects?.features ?? []).map((f) => f.properties as { id: string; code: string; name: string });
  const villageProps = (lists.data?.layers.villages?.features ?? []).map(
    (f) => f.properties as { code: string; name: string; sub_district_code: string; sub_district: string; district_code: string; district: string },
  );
  const districts = [...new Map(villageProps.map((v) => [v.district_code, v.district])).entries()];
  const taluks = [...new Map(villageProps.filter((v) => !filters.district || v.district_code === filters.district).map((v) => [v.sub_district_code, v.sub_district])).entries()];
  const villages = villageProps.filter(
    (v) => (!filters.district || v.district_code === filters.district) && (!filters.subDistrict || v.sub_district_code === filters.subDistrict),
  );

  // Reference layers for the current view.
  const refLayers = useMapLayers(view?.bbox ?? null, ['villages', 'constraints'], view?.zoom);

  // Corridor / alignment of the selected project (and its chainage strip if linear).
  const projectGeo = useParcels(activeProjectId ?? '', 'stage', !!activeProjectId);
  const chainage = useChainage(activeProjectId ?? '', CHAINAGE_BIN_M, !!activeProjectId);
  const corridor = useMemo<CorridorData | null>(() => {
    if (!activeProjectId || !projectGeo.data) return null;
    const p = projectGeo.data.project;
    const alignment = (p.alignment as Geometry | null) ?? null;
    return { footprint: (p.footprint as Geometry | null) ?? null, alignment, ...endsOf(alignment) };
  }, [activeProjectId, projectGeo.data]);

  const shown = useMemo(
    () =>
      selectedBin === null
        ? loaded
        : loaded.filter((r) => r.chainage_km != null && Math.floor((Number(r.chainage_km) * 1000) / CHAINAGE_BIN_M) === selectedBin),
    [loaded, selectedBin],
  );
  const bounds = useMemo(() => rowsBounds(shown), [shown]);
  const selected = shown.find((r) => r.project_parcel_id === selectedId) ?? loaded.find((r) => r.project_parcel_id === selectedId) ?? null;

  const legend = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of shown) counts.set(categoryOf(r, colorBy), (counts.get(categoryOf(r, colorBy)) ?? 0) + 1);
    return COLOR_BY_LEGEND[colorBy].map((l) => ({ ...l, count: counts.get(l.key) ?? 0 })).filter((l) => l.count > 0);
  }, [shown, colorBy]);

  const set = <K extends keyof RegistryFilters>(k: K, v: RegistryFilters[K] | '') =>
    setFilters((f) => {
      const next = { ...f, [k]: v === '' ? undefined : v };
      if (k === 'district') {
        next.subDistrict = undefined;
        next.village = undefined;
      }
      if (k === 'subDistrict') next.village = undefined;
      return next;
    });

  const overlay = (
    <div className="absolute bottom-2 left-2 z-[1000] max-w-60 rounded-md border border-slate-300 bg-white/95 p-2 text-[11px] text-slate-700 shadow-sm">
      {registry.isError ? (
        <p className="text-red-700">Parcels unavailable — the API is not reachable.</p>
      ) : registry.isLoading ? (
        <p className="text-slate-500">Loading parcels…</p>
      ) : (
        <>
          <p className="font-semibold">
            {COLOR_BY_OPTIONS.find((o) => o.value === colorBy)!.label} · {shown.length} parcel{shown.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-1 space-y-0.5">
            {legend.map((l) => (
              <li key={l.key} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-3 rounded-sm border border-slate-400" style={{ background: parcelColor(colorBy, l.key) }} />
                <span className="flex-1">{l.label}</span>
                <span className="tabular-nums">{l.count}</span>
              </li>
            ))}
          </ul>
          {layersOn.villages && (
            <p className="mt-1.5 flex items-center gap-1.5 text-slate-500">
              <span className="inline-block w-4 border-t-2 border-dashed border-slate-500" /> Village boundary (synthetic)
            </p>
          )}
          {layersOn.constraints &&
            (Object.keys(CONSTRAINT_STYLE) as ConstraintKey[])
              .filter((k) => constraintsOn[k])
              .map((k) => (
                <p key={k} className="flex items-center gap-1.5 text-slate-500">
                  <span className="inline-block h-2.5 w-3 rounded-sm" style={{ background: CONSTRAINT_STYLE[k].color, opacity: 0.5 }} />
                  {CONSTRAINT_STYLE[k].label}
                </p>
              ))}
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* LEFT — filters (server-side) */}
      <aside className="w-full space-y-3 border border-slate-200 bg-white p-3 lg:w-64 lg:shrink-0" aria-label="Filters">
        <div className="flex items-center justify-between">
          <h2 className="ux4g-label-m-strong">Filters</h2>
          <button
            type="button"
            className="ux4g-btn-text-primary ux4g-btn-s"
            onClick={() => {
              setFilters(emptyFilters(projectId));
              setSearch('');
            }}
          >
            Reset
          </button>
        </div>
        {!projectId && (
          <SelectField
            label="Project"
            value={filters.projectId ?? ''}
            onChange={(v) => set('projectId', v)}
            allLabel="All projects in my scope"
            options={projectOptions.map((p) => [p.id, `${p.code} — ${p.name}`])}
          />
        )}
        <TextField label="Search survey no. or owner" value={search} onChange={setSearch} placeholder="e.g. 214/3 or Patil" />
        <SelectField label="District" value={filters.district ?? ''} onChange={(v) => set('district', v)} options={districts} />
        <SelectField label="Taluk" value={filters.subDistrict ?? ''} onChange={(v) => set('subDistrict', v)} options={taluks} />
        <SelectField label="Village" value={filters.village ?? ''} onChange={(v) => set('village', v)} options={villages.map((v) => [v.code, v.name])} />
        <SelectField label="Land class" value={filters.landClass ?? ''} onChange={(v) => set('landClass', v)} options={LAND_CLASSES.map((c) => [c, label(c)])} />
        <SelectField label="Parcel status" value={filters.status ?? ''} onChange={(v) => set('status', v)} options={PARCEL_STATUSES.map((c) => [c, label(c)])} />
        <SelectField
          label="Payment state"
          value={filters.payment ?? ''}
          onChange={(v) => set('payment', v as RegistryFilters['payment'] | '')}
          options={PAYMENTS.map((c) => [c, c === 'NONE' ? 'no interest on record' : label(c)])}
        />
        <SelectField
          label="Risk level (advisory)"
          value={filters.riskLevel ?? ''}
          onChange={(v) => set('riskLevel', v as RegistryFilters['riskLevel'] | '')}
          options={RISK_LEVELS.map((c) => [c, label(c)])}
        />
        <Checkbox label="Flagged only" checked={!!filters.flagged} onChange={(v) => set('flagged', v || undefined)} />
      </aside>

      {/* CENTRE — map or registry */}
      <div className="min-w-0 flex-1 space-y-3">
        <Tabs
          label="View"
          active={mode}
          onChange={setMode}
          tabs={[
            ['map', 'Map'],
            ['registry', 'Land registry'],
          ]}
        />
        {mode === 'registry' ? (
          <LandRegistry filters={filters} onLocate={locate} onOpen360={setOpen360} />
        ) : (
        <>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <SelectField
              label="Colour by"
              value={colorBy}
              onChange={(v) => setColorBy(v as ColorBy)}
              allLabel={null}
              options={COLOR_BY_OPTIONS.map((o) => [o.value, o.label])}
            />
          </div>
          <details className="relative self-end">
            <summary className="ux4g-btn-outline-neutral ux4g-btn-s cursor-pointer list-none">Layers</summary>
            <div className="absolute z-[1100] mt-1 w-72 space-y-2 border border-slate-300 bg-white p-3 shadow-lg">
              {(Object.keys(LAYER_LABELS) as LayerKey[]).map((k) => (
                <Switch key={k} label={LAYER_LABELS[k]} checked={layersOn[k]} onChange={(v) => setLayersOn((s) => ({ ...s, [k]: v }))} />
              ))}
              {layersOn.constraints && (
                <div className="ml-3 space-y-2 border-l border-slate-200 pl-2">
                  {(Object.keys(CONSTRAINT_STYLE) as ConstraintKey[]).map((k) => (
                    <Switch key={k} label={CONSTRAINT_STYLE[k].label} checked={constraintsOn[k]} onChange={(v) => setConstraintsOn((s) => ({ ...s, [k]: v }))} />
                  ))}
                </div>
              )}
            </div>
          </details>
          {registry.isFetchingNextPage && <span className="text-xs text-slate-500">Loading more parcels…</span>}
          {loaded.length >= MAX_PARCELS && registry.hasNextPage && (
            <span className="text-xs text-amber-800">Showing the first {MAX_PARCELS} parcels — narrow the filters.</span>
          )}
        </div>

        {activeProjectId && (chainage.data?.length ?? 0) > 0 && (
          <ChainageStrip bins={chainage.data!} selectedBin={selectedBin} onSelect={setSelectedBin} />
        )}

        <GisMap
          rows={shown}
          colorBy={colorBy}
          selectedId={selectedId}
          onSelect={setSelectedId}
          layersOn={layersOn}
          constraintsOn={constraintsOn}
          villages={refLayers.data?.layers.villages}
          constraints={refLayers.data?.layers.constraints}
          corridor={corridor}
          bounds={bounds}
          onView={(bbox, zoom) => setView({ bbox, zoom })}
          overlay={overlay}
        />

        {/* List — the same set as the map */}
        <div className="ux4g-table-responsive border border-slate-200 bg-white">
          <table className="ux4g-table ux4g-table-s ux4g-table-interactive w-full">
            <thead>
              <tr>
                <th className="px-3 py-2">Survey no.</th>
                <th className="px-3 py-2">Village</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2 text-right">Affected</th>
                <th className="px-3 py-2">Risk (advisory)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.slice(0, listLimit).map((r) => (
                <tr
                  key={r.project_parcel_id}
                  onClick={() => setSelectedId(r.project_parcel_id)}
                  className={`cursor-pointer hover:bg-slate-50 ${r.project_parcel_id === selectedId ? 'bg-amber-50' : ''}`}
                >
                  <td className="px-3 py-1.5 font-semibold">{r.survey_no}</td>
                  <td className="px-3 py-1.5">{r.village_name}</td>
                  <td className="px-3 py-1.5">{label(r.status)}</td>
                  <td className="px-3 py-1.5">{r.payment === 'NONE' ? '—' : label(r.payment)}</td>
                  <td className="px-3 py-1.5 text-right text-xs">{r.affected_area_sqm ? formatArea(Number(r.affected_area_sqm)) : '—'}</td>
                  <td className="px-3 py-1.5">
                    <Tag tone={riskTone(r.risk_level)}>
                      {r.risk_level} — {r.risk_score}/100
                    </Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && !registry.isLoading && (
            <p className="px-3 py-4 text-sm text-slate-500">{registry.isError ? 'The API is not reachable.' : 'No parcels match these filters.'}</p>
          )}
          {shown.length > listLimit && (
            <button type="button" onClick={() => setListLimit((n) => n + LIST_STEP)} className="ux4g-btn-text-primary ux4g-btn-s w-full">
              Show more ({shown.length - listLimit} left)
            </button>
          )}
        </div>
        </>
        )}
      </div>

      {/* RIGHT — record panel */}
      {selected && mode === 'map' && <RecordPanel row={selected} onClose={() => setSelectedId(null)} onOpen360={setOpen360} />}
      {open360 && <Parcel360 row={open360} onClose={() => setOpen360(null)} onLocate={locate} />}
    </div>
  );
}
