'use client';

import { geoJSON, type LatLngBoundsExpression } from 'leaflet';
import type { FeatureCollection, Geometry, Polygon } from 'geojson';
import { useMemo, type ReactNode } from 'react';
import { CircleMarker, GeoJSON as RLGeoJSON, Polygon as RLPolygon, Tooltip } from 'react-leaflet';
import { BaseMap } from '@/components/gis/base-map';
import type { Assignment, SurveyDetail } from '@/lib/gis-api';

/** Green ≤ 10 m (UI band from §16.2), amber ≤ the pack's gpsAccuracyWarnM, red above — same as the phone. */
export function accuracyColor(m: number | null, warnM: number | null): string {
  if (m == null) return '#64748B';
  if (m <= 10) return '#16A34A';
  if (warnM != null && m <= warnM) return '#D97706';
  return '#DC2626';
}

/** The walked boundary as a polygon (vertices the server discarded are left out, as it does). */
export function walkedPolygon(s: Pick<SurveyDetail, 'vertices' | 'plausibility'>): Polygon | null {
  const rejected = new Set(s.plausibility?.rejectedSeqs ?? []);
  const pts = s.vertices.filter((v) => !rejected.has(v.seq)).map((v) => [Number(v.lng), Number(v.lat)]);
  if (pts.length < 3) return null;
  return { type: 'Polygon', coordinates: [[...pts, pts[0]!]] };
}

function boundsOf(...gs: Array<Geometry | null | undefined>): LatLngBoundsExpression | null {
  const feats = gs.filter((g): g is Geometry => !!g).map((g) => ({ type: 'Feature' as const, geometry: g, properties: {} }));
  if (!feats.length) return null;
  const fc: FeatureCollection = { type: 'FeatureCollection', features: feats };
  const b = geoJSON(fc).getBounds();
  return b.isValid() ? b : null;
}

/** A4 centre pane: recorded parcel (dashed) vs walked polygon, numbered vertices by accuracy, photo pins, track. */
export function SurveyMap({ survey, warnM, overlay }: { survey: SurveyDetail; warnM: number | null; overlay?: ReactNode }) {
  const walked = useMemo(() => walkedPolygon(survey), [survey]);
  const recorded = survey.recorded_geometry ?? survey.parcel_geometry;
  const bounds = useMemo(() => boundsOf(recorded, walked, survey.track), [recorded, walked, survey.track]);
  return (
    <BaseMap bounds={bounds} heightClassName="h-[30rem]" scrollWheelZoom overlay={overlay}>
      {recorded && (
        <RLGeoJSON key={`rec-${survey.id}`} data={recorded} interactive={false} style={{ color: '#475569', weight: 2, dashArray: '6 4', fillOpacity: 0.05 }} />
      )}
      {survey.track && (
        <RLGeoJSON key={`trk-${survey.id}`} data={survey.track} interactive={false} style={{ color: '#7C3AED', weight: 2, opacity: 0.7 }} />
      )}
      {walked && (
        <RLPolygon
          positions={walked.coordinates[0]!.map(([lng, lat]) => [lat!, lng!] as [number, number])}
          pathOptions={{ color: '#1D4ED8', weight: 3, fillOpacity: 0.15 }}
        />
      )}
      {survey.vertices.map((v) => (
        <CircleMarker
          key={v.seq}
          center={[Number(v.lat), Number(v.lng)]}
          radius={v.photo_document_id ? 8 : 6}
          pathOptions={{ color: '#ffffff', weight: 2, fillColor: accuracyColor(v.accuracy_m == null ? null : Number(v.accuracy_m), warnM), fillOpacity: 1 }}
        >
          <Tooltip permanent direction="top" offset={[0, -6]}>
            {v.seq}
          </Tooltip>
          {v.photo_document_id && (
            <Tooltip direction="right" offset={[10, 0]}>
              <img src={`/api/v1/documents/${v.photo_document_id}/download`} alt={`Vertex ${v.seq}`} width={140} height={105} className="object-cover" />
            </Tooltip>
          )}
        </CircleMarker>
      ))}
    </BaseMap>
  );
}

/** Corrections tab: v1 (dashed) → proposed v2 (solid). */
export function CorrectionDiffMap({ from, to }: { from: Geometry | null; to: Geometry | null }) {
  const bounds = useMemo(() => boundsOf(from, to), [from, to]);
  return (
    <BaseMap bounds={bounds} heightClassName="h-80" scrollWheelZoom>
      {from && <RLGeoJSON key={`f-${JSON.stringify(from).length}`} data={from} style={{ color: '#475569', weight: 2, dashArray: '6 4', fillOpacity: 0.05 }} />}
      {to && <RLGeoJSON key={`t-${JSON.stringify(to).length}`} data={to} style={{ color: '#D97706', weight: 3, fillOpacity: 0.15 }} />}
    </BaseMap>
  );
}

/** Assignments tab: parcels awaiting a field survey in this post's scope. */
export function AssignmentsMap({ rows }: { rows: Assignment[] }) {
  const pts = rows.filter((r) => r.lat != null && r.lng != null);
  const bounds = useMemo<LatLngBoundsExpression | null>(
    () => (pts.length ? (pts.map((r) => [Number(r.lat), Number(r.lng)]) as LatLngBoundsExpression) : null),
    [pts],
  );
  return (
    <BaseMap bounds={bounds} heightClassName="h-[28rem]" scrollWheelZoom>
      {pts.map((r) => (
        <CircleMarker
          key={r.project_parcel_id}
          center={[Number(r.lat), Number(r.lng)]}
          radius={6}
          pathOptions={{ color: '#ffffff', weight: 2, fillColor: r.boundary_source === 'SURVEY_REFERENCE_ONLY' ? '#DC2626' : '#1D4ED8', fillOpacity: 1 }}
        >
          <Tooltip>
            {r.survey_no} · {r.village_name}
            <br />
            {r.project_code} · {(r.last_survey_status ?? 'not surveyed').replace(/_/g, ' ')}
          </Tooltip>
        </CircleMarker>
      ))}
    </BaseMap>
  );
}
