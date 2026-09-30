import { boundaryPillars, fieldSurveys, jirItems, parcelVertices, type Tx } from '@bhoomisetu/db';
import { checkPlausibility } from '@bhoomisetu/geo';
import type { Role } from '@bhoomisetu/shared';
import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth-user';
import { ClockService } from '../common/clock/clock.service';
import { DbService } from '../common/db/db.service';
import { one, rows } from '../common/db/raw';
import { ProblemException } from '../common/errors/problem';
import { idempotent } from '../common/idempotency/idempotency';
import { writeOutbox } from '../common/outbox/outbox';
import { projectPack } from '../common/project-pack';
import { RulesService } from '../rules/rules.service';

const FIELD_ROLES: Role[] = ['FIELD_OFFICER', 'TEHSILDAR', 'DILR', 'LAO', 'SUPER_ADMIN'];
/** Field heuristic (§15.6), not statute: a vertex this far from the assigned footprint is flagged. */
const ASSIGNMENT_MAX_M = 2000;

const Iso = z.iso.datetime({ offset: true });
export const SyncOp = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('CREATE_SURVEY'),
    idempotencyKey: z.string().min(8).max(200),
    payload: z.object({
      clientId: z.string().min(4).max(64),
      projectId: z.uuid(),
      parcelId: z.uuid().nullish(),
      surveyType: z.enum(['PARCEL_IDENTIFICATION', 'JOINT_INSPECTION']),
      startedAt: Iso,
      deviceInfo: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
  z.object({
    op: z.literal('ADD_VERTEX'),
    idempotencyKey: z.string().min(8).max(200),
    payload: z.object({
      surveyClientId: z.string(),
      seq: z.number().int().min(1).max(500),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      accuracyM: z.number().min(0).max(10_000).nullish(),
      captureMethod: z.enum(['GPS_WALKED', 'MAP_DRAWN']).default('GPS_WALKED'),
      samplesAveraged: z.number().int().min(1).max(1000).nullish(),
      photoDocumentId: z.uuid().nullish(),
      capturedAt: Iso,
    }),
  }),
  z.object({
    op: z.literal('ADD_JIR_ITEM'),
    idempotencyKey: z.string().min(8).max(200),
    payload: z.object({
      surveyClientId: z.string(),
      itemType: z.enum(['TREE', 'CROP', 'WELL', 'BOREWELL', 'IRRIGATION_PIPE', 'STRUCTURE', 'OTHER']),
      description: z.string().max(500).nullish(),
      quantity: z.number().min(0).nullish(),
      unit: z.string().max(30).nullish(),
      photoDocumentId: z.uuid().nullish(),
      lat: z.number().nullish(),
      lng: z.number().nullish(),
    }),
  }),
  z.object({
    op: z.literal('ADD_PILLAR'),
    idempotencyKey: z.string().min(8).max(200),
    payload: z.object({
      surveyClientId: z.string(),
      pillarNo: z.number().int().min(1).max(999),
      lat: z.number(),
      lng: z.number(),
      photoDocumentId: z.uuid().nullish(),
    }),
  }),
  z.object({
    op: z.literal('SET_NOTICE'),
    idempotencyKey: z.string().min(8).max(200),
    payload: z.object({ surveyClientId: z.string(), servedOn: z.iso.date(), documentId: z.uuid().nullish() }),
  }),
  z.object({
    op: z.literal('SUBMIT_SURVEY'),
    idempotencyKey: z.string().min(8).max(200),
    payload: z.object({
      surveyClientId: z.string(),
      track: z
        .array(z.tuple([z.number(), z.number()]))
        .max(20_000)
        .optional(),
    }),
  }),
]);
export type SyncOp = z.infer<typeof SyncOp>;

/** Module B — field assignments, offline pack, sync (§16). */
@Injectable()
export class FieldService {
  constructor(
    private readonly db: DbService,
    private readonly rules: RulesService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  /** A client's survey id maps to a deterministic server id (idempotent CREATE_SURVEY, no mapping table). */
  private async surveyId(tx: Tx, user: AuthUser, clientId: string): Promise<string> {
    const r = await one<{ id: string }>(tx, sql`SELECT det_uuid(${`survey:${user.id}:${clientId}`}) AS id`);
    return r!.id; // det_uuid is STRICT and always returns for a non-null key
  }

  assignments(user: AuthUser) {
    return this.db.withScope(user, (tx) =>
      rows(
        tx,
        sql`SELECT pp.id AS project_parcel_id, pp.project_id, p.code AS project_code, p.name AS project_name, lp.id AS parcel_id,
                   lp.village_code, v.name AS village_name, lp.survey_number || coalesce('/' || lp.sub_division, '') AS survey_no,
                   lp.boundary_source, pp.status, pp.affected_area_sqm, lp.recorded_area_sqm,
                   (SELECT fs.status FROM field_surveys fs WHERE fs.parcel_id = lp.id ORDER BY fs.started_at DESC NULLS LAST LIMIT 1) AS last_survey_status,
                   ST_Y(ST_PointOnSurface(lp.geom)) AS lat, ST_X(ST_PointOnSurface(lp.geom)) AS lng
            FROM project_parcels pp JOIN projects p ON p.id = pp.project_id JOIN land_parcels lp ON lp.id = pp.parcel_id
            JOIN villages v ON v.code = lp.village_code
            WHERE p.status = 'ACTIVE' AND (pp.status IN ('PROPOSED','VERIFICATION_PENDING') OR lp.boundary_source = 'SURVEY_REFERENCE_ONLY')
            ORDER BY (lp.boundary_source = 'SURVEY_REFERENCE_ONLY') DESC, p.code, v.name, lp.survey_number LIMIT 200`,
      ),
    );
  }

  offlinePack(user: AuthUser, projectParcelId: string) {
    return this.db.withScope(user, async (tx) => {
      const a = await one<{ project_id: string; parcel_id: string; village_code: string }>(
        tx,
        sql`SELECT pp.project_id, pp.parcel_id, lp.village_code FROM project_parcels pp JOIN land_parcels lp ON lp.id = pp.parcel_id WHERE pp.id = ${projectParcelId}`,
      );
      if (!a) throw new ProblemException(404, 'ASSIGNMENT_NOT_FOUND', 'No such assignment in your scope.');
      const { project, pack } = await projectPack(tx, this.rules, a.project_id);
      const geo = await one<Record<string, unknown>>(
        tx,
        sql`SELECT ST_AsGeoJSON(p.footprint, 7)::json AS footprint, ST_AsGeoJSON(p.alignment, 7)::json AS alignment,
                   (SELECT ST_AsGeoJSON(boundary, 7)::json FROM villages WHERE code = ${a.village_code}) AS village_boundary,
                   (SELECT ST_AsGeoJSON(geom, 7)::json FROM land_parcels WHERE id = ${a.parcel_id}) AS parcel_geometry
            FROM projects p WHERE p.id = ${a.project_id}`,
      );
      const neighbours = await rows(
        tx,
        sql`SELECT lp.id, lp.survey_number || coalesce('/' || lp.sub_division, '') AS survey_no, ST_AsGeoJSON(lp.geom, 7)::json AS geometry
            FROM land_parcels lp, land_parcels me WHERE me.id = ${a.parcel_id} AND lp.village_code = me.village_code
              AND ST_DWithin(lp.geom::geography, me.geom::geography, 300)`,
      );
      return {
        assignment: {
          projectParcelId,
          projectId: a.project_id,
          parcelId: a.parcel_id,
          projectCode: project.code,
          projectName: project.name,
        },
        ...geo,
        neighbours,
        jirItemTypes: ['TREE', 'CROP', 'WELL', 'BOREWELL', 'IRRIGATION_PIPE', 'STRUCTURE', 'OTHER'],
        thresholds: {
          gpsAccuracyWarnM: pack.thresholds.gpsAccuracyWarnM,
          gpsAccuracyRejectM: pack.thresholds.gpsAccuracyRejectM,
          photoMaxDistanceFromParcelM: pack.thresholds.photoMaxDistanceFromParcelM,
        },
        reasonCodes: pack.reasonCodes,
        generatedAt: this.clock.now(),
      };
    });
  }

  /** Ops are applied in order, each in its own transaction, each deduplicated by its idempotency key. */
  async sync(user: AuthUser, ops: SyncOp[]) {
    if (!FIELD_ROLES.includes(user.post.role))
      throw new ProblemException(403, 'ROLE_NOT_PERMITTED', `Field sync needs one of: ${FIELD_ROLES.join(', ')}.`);
    const results = [];
    for (const op of ops) {
      try {
        const result = await this.db.withScope(user, (tx) =>
          idempotent(tx, user, op.idempotencyKey, `field:${op.op}`, op.payload, () => this.apply(tx, user, op)),
        );
        results.push({ idempotencyKey: op.idempotencyKey, op: op.op, status: 'applied', result });
      } catch (e) {
        const msg = e instanceof ProblemException ? e.message : 'Rejected by the server.';
        const code = e instanceof ProblemException ? e.code : 'INTERNAL';
        results.push({ idempotencyKey: op.idempotencyKey, op: op.op, status: 'rejected', code, reason: msg });
      }
    }
    return { syncedAt: this.clock.now(), results };
  }

  private async survey(tx: Tx, user: AuthUser, clientId: string) {
    const id = await this.surveyId(tx, user, clientId);
    const [s] = await tx.select().from(fieldSurveys).where(eq(fieldSurveys.id, id));
    if (!s) throw new ProblemException(409, 'SURVEY_NOT_FOUND', 'CREATE_SURVEY must be synced first.');
    if (s.status !== 'draft') throw new ProblemException(409, 'SURVEY_SUBMITTED', 'The survey is already submitted.');
    return s;
  }

  private async apply(tx: Tx, user: AuthUser, op: SyncOp): Promise<unknown> {
    const now = this.clock.now();
    const point = (lat?: number | null, lng?: number | null) =>
      lat != null && lng != null ? (sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)` as unknown as string) : null;
    switch (op.op) {
      case 'CREATE_SURVEY': {
        const p = op.payload;
        const id = await this.surveyId(tx, user, p.clientId);
        const exists = await one<{ id: string }>(tx, sql`SELECT id FROM field_surveys WHERE id = ${id}`);
        if (exists) return { surveyId: id };
        const [s] = await tx
          .insert(fieldSurveys)
          .values({
            id,
            projectId: p.projectId,
            parcelId: p.parcelId ?? null,
            surveyType: p.surveyType,
            surveyorUserId: user.id,
            surveyorPostId: user.post.id,
            startedAt: new Date(p.startedAt),
            deviceInfo: p.deviceInfo ?? null,
            status: 'draft',
          })
          .returning({ id: fieldSurveys.id });
        return { surveyId: s!.id };
      }
      case 'ADD_VERTEX': {
        const p = op.payload;
        const s = await this.survey(tx, user, p.surveyClientId);
        const [v] = await tx
          .insert(parcelVertices)
          .values({
            surveyId: s.id,
            parcelId: s.parcelId,
            seq: p.seq,
            lat: p.lat,
            lng: p.lng,
            accuracyM: p.accuracyM != null ? String(p.accuracyM) : null,
            captureMethod: p.captureMethod,
            samplesAveraged: p.samplesAveraged ?? null,
            photoDocumentId: p.photoDocumentId ?? null,
            capturedAt: new Date(p.capturedAt),
            syncedAt: now,
          })
          .onConflictDoNothing()
          .returning({ id: parcelVertices.id });
        return { vertexId: v?.id ?? null, seq: p.seq };
      }
      case 'ADD_JIR_ITEM': {
        const p = op.payload;
        const s = await this.survey(tx, user, p.surveyClientId);
        if (!s.parcelId)
          throw new ProblemException(422, 'NO_PARCEL', 'A joint-inspection item needs a parcel on the survey.');
        const [j] = await tx
          .insert(jirItems)
          .values({
            surveyId: s.id,
            parcelId: s.parcelId,
            itemType: p.itemType,
            description: p.description ?? null,
            quantity: p.quantity != null ? String(p.quantity) : null,
            unit: p.unit ?? null,
            photoDocumentId: p.photoDocumentId ?? null,
            point: point(p.lat, p.lng),
          })
          .returning({ id: jirItems.id });
        return { jirItemId: j!.id };
      }
      case 'ADD_PILLAR': {
        const p = op.payload;
        const s = await this.survey(tx, user, p.surveyClientId);
        if (!s.parcelId)
          throw new ProblemException(422, 'NO_PARCEL', 'A boundary pillar needs a parcel on the survey.');
        const [b] = await tx
          .insert(boundaryPillars)
          .values({
            parcelId: s.parcelId,
            pillarNo: p.pillarNo,
            point: point(p.lat, p.lng)!,
            photoDocumentId: p.photoDocumentId ?? null,
          })
          .onConflictDoNothing()
          .returning({ id: boundaryPillars.id });
        return { pillarId: b?.id ?? null };
      }
      case 'SET_NOTICE': {
        const s = await this.survey(tx, user, op.payload.surveyClientId);
        await tx
          .update(fieldSurveys)
          .set({ noticeServedOn: op.payload.servedOn, noticeDocumentId: op.payload.documentId ?? null })
          .where(eq(fieldSurveys.id, s.id));
        return { surveyId: s.id };
      }
      case 'SUBMIT_SURVEY':
        return this.submit(tx, user, op.payload.surveyClientId, op.payload.track);
    }
  }

  /** §15.6 plausibility, polygon from vertices, parcel geometry update (FIELD_DRAWN), re-intersection. */
  private async submit(tx: Tx, user: AuthUser, clientId: string, track?: Array<[number, number]>) {
    const s = await this.survey(tx, user, clientId);
    const { pack } = await projectPack(tx, this.rules, s.projectId);
    const now = this.clock.now();
    const vs = await tx
      .select()
      .from(parcelVertices)
      .where(eq(parcelVertices.surveyId, s.id))
      .orderBy(parcelVertices.seq);
    const result = checkPlausibility(
      vs.map((v) => ({
        seq: v.seq,
        lat: v.lat,
        lng: v.lng,
        accuracyM: v.accuracyM != null ? Number(v.accuracyM) : null,
        capturedAt: v.capturedAt,
      })),
      { gpsAccuracyWarnM: pack.thresholds.gpsAccuracyWarnM, gpsAccuracyRejectM: pack.thresholds.gpsAccuracyRejectM },
      // CLOCK_SKEW compares the phone's clock with the wall clock, like a token expiry — not a
      // statutory date — so it must not use the frozen DEMO_NOW clock, or every real walk is flagged.
      this.clock.realNow(),
    );
    if (result.reject)
      throw new ProblemException(422, 'TOO_FEW_POINTS', result.flags.TOO_FEW_POINTS ?? 'Too few usable vertices.');
    const usable = vs.filter((v) => !result.rejectedSeqs.includes(v.seq));
    const ring = [...usable.map((v) => [v.lng, v.lat]), [usable[0]!.lng, usable[0]!.lat]];
    const gj = JSON.stringify({ type: 'Polygon', coordinates: [ring] });
    const geomCheck = await one<{ valid: boolean; photo_far: number; outside: number }>(
      tx,
      sql`WITH poly AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON(${gj}), 4326) AS g)
          SELECT ST_IsValid(poly.g) AS valid,
                 (SELECT count(*)::int FROM parcel_vertices v WHERE v.survey_id = ${s.id} AND v.photo_document_id IS NOT NULL
                    AND ST_Distance(ST_SetSRID(ST_MakePoint(v.lng, v.lat), 4326)::geography, poly.g::geography) > ${pack.thresholds.photoMaxDistanceFromParcelM}) AS photo_far,
                 (SELECT count(*)::int FROM parcel_vertices v, projects p WHERE v.survey_id = ${s.id} AND p.id = ${s.projectId}
                    AND ST_Distance(ST_SetSRID(ST_MakePoint(v.lng, v.lat), 4326)::geography, p.footprint::geography) > ${ASSIGNMENT_MAX_M}) AS outside
          FROM poly`,
    );
    if (!geomCheck?.valid)
      throw new ProblemException(
        422,
        'SELF_INTERSECTION',
        'The walked boundary crosses itself — re-walk or undo points.',
      );
    const flags: Record<string, string> = { ...result.flags };
    if (geomCheck.photo_far)
      flags.PHOTO_FAR = `${geomCheck.photo_far} photo(s) further than ${pack.thresholds.photoMaxDistanceFromParcelM} m from the polygon`;
    if (geomCheck.outside)
      flags.OUTSIDE_ASSIGNMENT = `${geomCheck.outside} vertex(es) more than ${ASSIGNMENT_MAX_M} m from the project footprint`;
    const plausibility = { flags, vertices: result.vertices, rejectedSeqs: result.rejectedSeqs, checkedAt: now };

    const trackSql =
      track && track.length >= 2
        ? (sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify({ type: 'LineString', coordinates: track })}), 4326)` as unknown as string)
        : null;
    await tx
      .update(fieldSurveys)
      .set({ status: 'submitted', submittedAt: now, plausibility, track: trackSql })
      .where(eq(fieldSurveys.id, s.id));

    // The walked polygon becomes the parcel's geometry as a new version (old one kept, G14).
    let parcelVersion: number | null = null;
    if (s.parcelId) {
      const upd = await one<{ version: number; field_area_sqm: string; recorded_area_sqm: string | null }>(
        tx,
        sql`UPDATE land_parcels SET geom = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${gj}), 4326)), boundary_source = 'FIELD_DRAWN', version = version + 1
            WHERE id = ${s.parcelId} RETURNING version, field_area_sqm, recorded_area_sqm`,
      );
      parcelVersion = upd?.version ?? null;
      await tx.execute(sql`UPDATE parcel_vertices SET parcel_id = ${s.parcelId} WHERE survey_id = ${s.id}`);
      const projs = await rows<{ project_id: string }>(
        tx,
        sql`SELECT DISTINCT project_id FROM project_parcels WHERE parcel_id = ${s.parcelId}`,
      );
      for (const p of projs)
        await tx.execute(
          sql`SELECT intersect_project_parcels(${p.project_id}), screen_project_constraints(${p.project_id})`,
        );
      await tx.execute(
        sql`UPDATE project_parcels SET status = 'VERIFICATION_PENDING' WHERE parcel_id = ${s.parcelId} AND status IN ('PROPOSED','VERIFIED')`,
      );
    }
    await writeOutbox(tx, {
      type: 'FIELD_SURVEY_SUBMITTED',
      aggregateType: 'field_survey',
      aggregateId: s.id,
      payload: { surveyId: s.id, projectId: s.projectId, parcelId: s.parcelId, flags: Object.keys(flags) },
    });
    await this.audit.record({
      action: 'FIELD_SURVEY_SUBMITTED',
      entityType: 'field_survey',
      entityId: s.id,
      after: { flags, vertices: usable.length, parcelVersion },
    });
    return { surveyId: s.id, parcelId: s.parcelId, parcelVersion, vertices: usable.length, flags };
  }
}
