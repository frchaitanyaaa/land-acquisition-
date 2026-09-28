import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import type { Feature, FeatureCollection, Geometry, LineString, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import JSZip from 'jszip';
import { ProblemException } from '../common/errors/problem';

// Alignment upload parsing (§14 step 2). Server-side; the DB validates and measures (G10).

/** Rough India bbox (lng, lat) — RFC 7946 GeoJSON is EPSG:4326, reject anything outside. */
const INDIA = { minLng: 68, maxLng: 98, minLat: 6, maxLat: 38 };

export interface ParsedAlignment {
  kind: 'LINE' | 'AREA';
  /** GeoJSON geometry to hand to ST_GeomFromGeoJSON. */
  geometry: MultiLineString | MultiPolygon;
}

function coords(g: Geometry): number[][] {
  switch (g.type) {
    case 'Point':
      return [g.coordinates];
    case 'LineString':
    case 'MultiPoint':
      return g.coordinates;
    case 'Polygon':
    case 'MultiLineString':
      return g.coordinates.flat();
    case 'MultiPolygon':
      return g.coordinates.flat(2);
    case 'GeometryCollection':
      return g.geometries.flatMap(coords);
  }
}

function geometriesOf(input: unknown): Geometry[] {
  const o = input as { type?: string };
  if (o?.type === 'FeatureCollection')
    return (input as FeatureCollection).features.flatMap((f) => (f.geometry ? [f.geometry] : []));
  if (o?.type === 'Feature') return (input as Feature).geometry ? [(input as Feature).geometry] : [];
  if (o?.type && o.type !== 'GeometryCollection') return [input as Geometry];
  if (o?.type === 'GeometryCollection') return (input as { geometries: Geometry[] }).geometries;
  throw new ProblemException(422, 'ALIGNMENT_INVALID', 'Not a GeoJSON object.');
}

export function fromGeoJson(input: unknown): ParsedAlignment {
  const geoms = geometriesOf(input).flatMap((g) => (g.type === 'GeometryCollection' ? g.geometries : [g]));
  for (const [lng, lat] of geoms.flatMap(coords)) {
    if (lng! < INDIA.minLng || lng! > INDIA.maxLng || lat! < INDIA.minLat || lat! > INDIA.maxLat) {
      throw new ProblemException(
        422,
        'ALIGNMENT_OUT_OF_BOUNDS',
        'Coordinates fall outside India — is the file in EPSG:4326 (lng, lat)?',
      );
    }
  }
  const lines = geoms.flatMap((g) =>
    g.type === 'LineString'
      ? [(g as LineString).coordinates]
      : g.type === 'MultiLineString'
        ? (g as MultiLineString).coordinates
        : [],
  );
  const polys = geoms.flatMap((g) =>
    g.type === 'Polygon'
      ? [(g as Polygon).coordinates]
      : g.type === 'MultiPolygon'
        ? (g as MultiPolygon).coordinates
        : [],
  );
  if (lines.length && !polys.length) return { kind: 'LINE', geometry: { type: 'MultiLineString', coordinates: lines } };
  if (polys.length && !lines.length) return { kind: 'AREA', geometry: { type: 'MultiPolygon', coordinates: polys } };
  if (!lines.length && !polys.length)
    throw new ProblemException(422, 'ALIGNMENT_EMPTY', 'No line or polygon geometry found.');
  throw new ProblemException(
    422,
    'ALIGNMENT_MIXED',
    'Upload either the centreline (lines) or the area (polygons), not both.',
  );
}

export async function parseAlignmentFile(name: string, buf: Buffer): Promise<ParsedAlignment> {
  const lower = name.toLowerCase();
  if (lower.endsWith('.geojson') || lower.endsWith('.json')) return fromGeoJson(JSON.parse(buf.toString('utf8')));
  if (lower.endsWith('.kml')) return fromKml(buf.toString('utf8'));
  if (lower.endsWith('.kmz')) {
    const zip = await JSZip.loadAsync(buf);
    const entry = Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith('.kml'));
    if (!entry) throw new ProblemException(422, 'ALIGNMENT_INVALID', 'The KMZ has no .kml inside.');
    return fromKml(await entry.async('string'));
  }
  if (lower.endsWith('.dxf')) {
    throw new ProblemException(
      422,
      'ALIGNMENT_DXF',
      'DXF is accepted as a document only — upload the geometry as KML or GeoJSON.',
    );
  }
  throw new ProblemException(422, 'ALIGNMENT_FORMAT', 'Upload .kml, .kmz or .geojson.');
}

function fromKml(text: string): ParsedAlignment {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  return fromGeoJson(kml(doc as unknown as Parameters<typeof kml>[0]));
}
