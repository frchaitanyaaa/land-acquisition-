import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Tx } from '@bhoomisetu/db';
import { Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DbService } from '../common/db/db.service';
import { rows } from '../common/db/raw';

export const MAP_LAYERS = ['villages', 'districts', 'states', 'constraints', 'projects'] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];
export type BBox = [number, number, number, number];

interface Feature {
  type: 'Feature';
  id?: string;
  properties: Record<string, unknown>;
  geometry: unknown;
}
export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

/** Repo root (holds pnpm-workspace.yaml). The boundary files live in <root>/data/boundaries. */
function repoRoot(from: string): string | null {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/**
 * Simplification tolerance in degrees for a zoom level: about half a screen pixel at that zoom
 * (256-px tiles, 360° wide at z0). Below this, removing vertices is invisible.
 */
export function toleranceForZoom(zoom: number): number {
  return 360 / (256 * 2 ** zoom) / 2;
}

/** Zoom at which the bbox roughly fills a ~1000-px-wide map. */
export function zoomForBBox(b: BBox): number {
  const width = Math.max(1e-6, b[2] - b[0]);
  return Math.max(0, Math.min(20, Math.round(Math.log2((360 * 1000) / (256 * width)))));
}

/**
 * Map reference layers for the portal maps (A1/A2): village outlines, district and state outlines,
 * constraint layers and project markers — one GeoJSON FeatureCollection per requested layer, cut
 * to the bbox and simplified for the zoom (ST_SimplifyPreserveTopology, 7 decimals ≈ 1 cm).
 *
 * Scope follows the caller's post (§11.3): villages through can_see_village() plus villages of the
 * caller's projects' parcels; districts and states the same way; projects through the projects
 * RLS policy. Constraint layers are national reference data and readable by every post.
 */
@Injectable()
export class GisLayersService {
  private readonly logger = new Logger('GisLayers');
  private boundaries: { states: FeatureCollection; districts: FeatureCollection } | null = null;

  constructor(private readonly db: DbService) {}

  private loadBoundaries() {
    if (this.boundaries) return this.boundaries;
    const dir = process.env.BOUNDARIES_DIR ?? join(repoRoot(__dirname) ?? process.cwd(), 'data', 'boundaries');
    const read = (f: string): FeatureCollection => {
      const p = join(dir, f);
      if (!existsSync(p)) {
        this.logger.warn(`${p} not found — the ${f} layer will be empty`);
        return { type: 'FeatureCollection', features: [] };
      }
      return JSON.parse(readFileSync(p, 'utf8')) as FeatureCollection;
    };
    this.boundaries = { states: read('states-demo.geojson'), districts: read('districts-demo.geojson') };
    return this.boundaries;
  }

  layers(user: AuthUser, bbox: BBox, wanted: MapLayer[], zoom?: number) {
    const z = zoom ?? zoomForBBox(bbox);
    const tol = toleranceForZoom(z);
    return this.db.withScope(user, async (tx) => {
      const out: Partial<Record<MapLayer, FeatureCollection>> = {};
      for (const layer of wanted) {
        if (layer === 'villages') out.villages = await this.villages(tx, bbox, tol);
        if (layer === 'districts') out.districts = await this.districts(tx, bbox, tol);
        if (layer === 'states') out.states = await this.states(tx, bbox, tol);
        if (layer === 'constraints') out.constraints = await this.constraints(tx, bbox, tol);
        if (layer === 'projects') out.projects = await this.projects(tx, bbox);
      }
      return {
        bbox,
        zoom: z,
        layers: out,
        notes: {
          villages: 'Village boundaries are synthetic rectangles (SYNTHETIC_DEMO) — not cadastral outlines.',
          districts: 'District outlines are synthetic (SYNTHETIC_DEMO).',
          states: 'State outlines are approximate hand-drawn polygons (SYNTHETIC_DEMO).',
        },
      };
    });
  }

  private env(b: BBox) {
    return sql`ST_MakeEnvelope(${b[0]}, ${b[1]}, ${b[2]}, ${b[3]}, 4326)`;
  }

  private collection(features: Feature[]): FeatureCollection {
    return { type: 'FeatureCollection', features };
  }

  private async villages(tx: Tx, b: BBox, tol: number) {
    const r = await rows<{ code: string; geometry: unknown } & Record<string, unknown>>(
      tx,
      sql`SELECT v.code, v.name, v.name_local, sd.code AS sub_district_code, sd.name AS sub_district,
                 d.code AS district_code, d.name AS district, d.state_code, v.data_source,
                 ST_AsGeoJSON(ST_SimplifyPreserveTopology(v.boundary, ${tol}), 7)::json AS geometry
          FROM villages v
          JOIN sub_districts sd ON sd.code = v.sub_district_code
          JOIN districts d ON d.code = sd.district_code
          WHERE v.boundary IS NOT NULL
            AND v.boundary && ${this.env(b)}
            AND (can_see_village(v.code)
                 OR v.code IN (SELECT lp.village_code FROM land_parcels lp JOIN project_parcels pp ON pp.parcel_id = lp.id))
          ORDER BY v.code`,
    );
    return this.collection(r.map(({ geometry, ...p }) => ({ type: 'Feature', id: p.code, properties: { ...p, synthetic: true }, geometry })));
  }

  /** District codes the caller may see: own jurisdiction plus the districts of visible projects. */
  private visibleDistricts(tx: Tx) {
    return rows<{ code: string; state_code: string }>(
      tx,
      sql`SELECT d.code, d.state_code FROM districts d
          WHERE CASE app_level()
                  WHEN 'NATIONAL' THEN true
                  WHEN 'STATE' THEN d.state_code = app_state_code()
                  WHEN 'DISTRICT' THEN d.code = app_district_code()
                  ELSE false END
             OR d.code IN (SELECT district_code FROM project_districts)`,
    );
  }

  /** Clip + simplify file-based outlines in PostGIS so they follow the same rules as DB layers. */
  private async simplifyFile(tx: Tx, feats: Feature[], b: BBox, tol: number) {
    if (!feats.length) return [];
    const r = await rows<{ properties: Record<string, unknown>; geometry: unknown }>(
      tx,
      sql`SELECT f -> 'properties' AS properties,
                 ST_AsGeoJSON(ST_SimplifyPreserveTopology(ST_SetSRID(ST_GeomFromGeoJSON(f ->> 'geometry'), 4326), ${tol}), 7)::json AS geometry
          FROM jsonb_array_elements(${JSON.stringify(feats)}::jsonb) f
          WHERE ST_SetSRID(ST_GeomFromGeoJSON(f ->> 'geometry'), 4326) && ${this.env(b)}`,
    );
    return r;
  }

  private async districts(tx: Tx, b: BBox, tol: number) {
    const visible = new Set((await this.visibleDistricts(tx)).map((d) => d.code));
    const feats = this.loadBoundaries().districts.features.filter((f) => visible.has(String(f.properties.code)));
    const r = await this.simplifyFile(tx, feats, b, tol);
    return this.collection(r.map((f) => ({ type: 'Feature', id: String(f.properties.code), properties: f.properties, geometry: f.geometry })));
  }

  private async states(tx: Tx, b: BBox, tol: number) {
    const visible = new Set((await this.visibleDistricts(tx)).map((d) => d.state_code));
    const counts = await rows<{ state_code: string; projects: number; breached: number; due_soon: number }>(
      tx,
      sql`SELECT p.state_code, count(DISTINCT p.id)::int AS projects,
                 count(b.id) FILTER (WHERE b.live_status = 'BREACHED')::int AS breached,
                 count(b.id) FILTER (WHERE b.live_status = 'DUE_SOON')::int AS due_soon
          FROM projects p LEFT JOIN v_deadline_board b ON b.project_id = p.id
          GROUP BY p.state_code`,
    );
    const byState = new Map(counts.map((c) => [c.state_code, c]));
    const feats = this.loadBoundaries().states.features.filter((f) => visible.has(String(f.properties.code)));
    const r = await this.simplifyFile(tx, feats, b, tol);
    return this.collection(
      r.map((f) => {
        const c = byState.get(String(f.properties.code));
        return {
          type: 'Feature',
          id: String(f.properties.code),
          properties: { ...f.properties, projects: c?.projects ?? 0, breached: c?.breached ?? 0, due_soon: c?.due_soon ?? 0 },
          geometry: f.geometry,
        };
      }),
    );
  }

  private async constraints(tx: Tx, b: BBox, tol: number) {
    const r = await rows<{ id: string; geometry: unknown } & Record<string, unknown>>(
      tx,
      sql`SELECT c.id, c.layer_type, c.name, c.source, c.data_source,
                 ST_AsGeoJSON(ST_SimplifyPreserveTopology(c.geom, ${tol}), 7)::json AS geometry
          FROM constraint_layers c WHERE c.geom && ${this.env(b)} ORDER BY c.layer_type, c.name`,
    );
    return this.collection(r.map(({ geometry, ...p }) => ({ type: 'Feature', id: p.id, properties: p, geometry })));
  }

  /** One marker per visible project (point on its footprint), coloured by its worst open deadline. */
  private async projects(tx: Tx, b: BBox) {
    const r = await rows<{ id: string; geometry: unknown } & Record<string, unknown>>(
      tx,
      sql`SELECT p.id, p.code, p.name, p.status, p.current_stage, p.state_code, p.is_linear, p.acquisition_type,
                 coalesce((SELECT CASE max(CASE b.live_status WHEN 'BREACHED' THEN 3 WHEN 'DUE_SOON' THEN 2 ELSE 1 END)
                                    WHEN 3 THEN 'BREACHED' WHEN 2 THEN 'DUE_SOON' ELSE 'SAFE' END
                           FROM v_deadline_board b WHERE b.project_id = p.id), 'SAFE') AS risk,
                 (SELECT count(*)::int FROM v_deadline_board b WHERE b.project_id = p.id AND b.live_status = 'BREACHED') AS breached,
                 ST_AsGeoJSON(ST_Centroid(coalesce(p.footprint, p.alignment)), 7)::json AS geometry,
                 ST_AsGeoJSON(p.footprint, 7)::json AS corridor_geometry,
                 ST_AsGeoJSON(p.alignment, 7)::json AS alignment_geometry,
                 CASE WHEN p.alignment IS NOT NULL THEN ST_AsGeoJSON(ST_StartPoint(ST_LineMerge(p.alignment)), 7)::json END AS start_point,
                 CASE WHEN p.alignment IS NOT NULL THEN ST_AsGeoJSON(ST_EndPoint(ST_LineMerge(p.alignment)), 7)::json END AS end_point
          FROM projects p
          WHERE coalesce(p.footprint, p.alignment) IS NOT NULL AND coalesce(p.footprint, p.alignment) && ${this.env(b)}
          ORDER BY p.code`,
    );
    return this.collection(r.map(({ geometry, ...p }) => ({ type: 'Feature', id: p.id, properties: p, geometry })));
  }
}
