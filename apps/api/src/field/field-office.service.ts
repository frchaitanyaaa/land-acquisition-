import type { Role } from '@bhoomisetu/shared';
import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth-user';
import { ClockService } from '../common/clock/clock.service';
import { DbService } from '../common/db/db.service';
import { one, rows } from '../common/db/raw';
import { ProblemException } from '../common/errors/problem';
import { writeOutbox } from '../common/outbox/outbox';

/** Who works the verification queue (A4). LAO reads it; only these return a survey. */
const QUEUE_ROLES: Role[] = ['TEHSILDAR', 'DILR', 'FIELD_OFFICER', 'LAO', 'COLLECTOR', 'SUPER_ADMIN'];
const RETURN_ROLES: Role[] = ['TEHSILDAR', 'DILR', 'SUPER_ADMIN'];

function requireRole(user: AuthUser, roles: Role[], what: string) {
  if (!roles.includes(user.post.role))
    throw new ProblemException(403, 'ROLE_NOT_PERMITTED', `${what} needs one of: ${roles.join(', ')}.`, { requiredRoles: roles });
}

export type SurveyQueueStatus = 'submitted' | 'verified' | 'returned';

/**
 * Field office work queue (A4): synced surveys to verify, returned and verified ones. Everything is
 * read under the caller's RLS scope (field_surveys inherit project visibility). Approving is the
 * existing POST /parcels/:id/verify; corrections are POST /parcels/:id/corrections + decide.
 */
@Injectable()
export class FieldOfficeService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  list(user: AuthUser, q: { status: SurveyQueueStatus; projectId?: string; limit: number }) {
    requireRole(user, QUEUE_ROLES, 'Reading the field survey queue');
    return this.db.withScope(user, (tx) =>
      rows(
        tx,
        sql`SELECT fs.id, fs.project_id, p.code AS project_code, fs.parcel_id, fs.survey_type, fs.status,
                   fs.started_at, fs.submitted_at, fs.updated_at,
                   lp.survey_number || coalesce('/' || lp.sub_division, '') AS survey_no, lp.village_code, v.name AS village_name,
                   u.full_name AS surveyor_name, po.designation AS surveyor_designation,
                   vp.designation AS verified_by_designation, fs.verification_remarks,
                   coalesce((SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(coalesce(fs.plausibility -> 'flags', '{}'::jsonb)) k), '{}') AS flags,
                   (SELECT count(*)::int FROM parcel_vertices pv WHERE pv.survey_id = fs.id) AS vertex_count
            FROM field_surveys fs
            JOIN projects p ON p.id = fs.project_id
            LEFT JOIN land_parcels lp ON lp.id = fs.parcel_id
            LEFT JOIN villages v ON v.code = lp.village_code
            JOIN users u ON u.id = fs.surveyor_user_id
            JOIN posts po ON po.id = fs.surveyor_post_id
            LEFT JOIN posts vp ON vp.id = fs.verified_by_post_id
            WHERE fs.status = ${q.status}::field_survey_status
              AND (${q.projectId ?? null}::uuid IS NULL OR fs.project_id = ${q.projectId ?? null}::uuid)
            ORDER BY coalesce(fs.submitted_at, fs.updated_at) DESC
            LIMIT ${q.limit}`,
      ),
    );
  }

  get(user: AuthUser, id: string) {
    requireRole(user, QUEUE_ROLES, 'Reading a field survey');
    return this.db.withScope(user, async (tx) => {
      const survey = await one<Record<string, unknown> & { parcel_id: string | null }>(
        tx,
        sql`SELECT fs.id, fs.project_id, p.code AS project_code, p.name AS project_name, fs.parcel_id, fs.survey_type, fs.status,
                   fs.started_at, fs.submitted_at, fs.device_info, fs.plausibility, fs.verification_remarks, fs.override_reason,
                   fs.notice_served_on, fs.notice_document_id,
                   u.full_name AS surveyor_name, po.designation AS surveyor_designation, vp.designation AS verified_by_designation,
                   ST_AsGeoJSON(fs.track, 7)::json AS track,
                   lp.survey_number || coalesce('/' || lp.sub_division, '') AS survey_no, lp.village_code, v.name AS village_name,
                   lp.version AS parcel_version, lp.boundary_source, lp.recorded_area_sqm, lp.field_area_sqm, lp.area_diff_pct,
                   ST_AsGeoJSON(lp.geom, 7)::json AS parcel_geometry,
                   (SELECT ST_AsGeoJSON(v1.geom, 7)::json FROM land_parcels_versions v1
                     WHERE v1.id = lp.id AND v1.version = (SELECT min(version) FROM land_parcels_versions WHERE id = lp.id)) AS recorded_geometry
            FROM field_surveys fs
            JOIN projects p ON p.id = fs.project_id
            LEFT JOIN land_parcels lp ON lp.id = fs.parcel_id
            LEFT JOIN villages v ON v.code = lp.village_code
            JOIN users u ON u.id = fs.surveyor_user_id
            JOIN posts po ON po.id = fs.surveyor_post_id
            LEFT JOIN posts vp ON vp.id = fs.verified_by_post_id
            WHERE fs.id = ${id}`,
      );
      if (!survey) throw new ProblemException(404, 'SURVEY_NOT_FOUND', 'No such field survey in your jurisdiction.');
      const vertices = await rows(
        tx,
        sql`SELECT seq, lat, lng, accuracy_m, capture_method, samples_averaged, photo_document_id, captured_at, synced_at
            FROM parcel_vertices WHERE survey_id = ${id} ORDER BY seq`,
      );
      const jir = await rows(
        tx,
        sql`SELECT id, item_type, description, quantity, unit, photo_document_id, ST_AsGeoJSON(point, 7)::json AS point
            FROM jir_items WHERE survey_id = ${id} ORDER BY created_at`,
      );
      const pillars = survey.parcel_id
        ? await rows(
            tx,
            sql`SELECT pillar_no, photo_document_id, ST_AsGeoJSON(point, 7)::json AS point
                FROM boundary_pillars WHERE parcel_id = ${survey.parcel_id} ORDER BY pillar_no`,
          )
        : [];
      return { ...survey, vertices, jirItems: jir, pillars };
    });
  }

  /** Boundary corrections waiting for (or past) a decision — decided by a different post (A4). */
  corrections(user: AuthUser, status: 'requested' | 'approved' | 'rejected') {
    requireRole(user, QUEUE_ROLES, 'Reading boundary corrections');
    return this.db.withScope(user, (tx) =>
      rows(
        tx,
        sql`SELECT pc.id, pc.parcel_id, pc.from_version, pc.to_version, pc.reason, pc.status, pc.created_at, pc.decided_at,
                   pc.requested_by_post_id, rq.designation AS requested_by_designation, ap.designation AS decided_by_designation,
                   lp.survey_number || coalesce('/' || lp.sub_division, '') AS survey_no, v.name AS village_name, lp.version AS current_version,
                   ST_AsGeoJSON(coalesce(
                     (SELECT lv.geom FROM land_parcels_versions lv WHERE lv.id = lp.id AND lv.version = pc.from_version),
                     lp.geom), 7)::json AS from_geometry,
                   ST_AsGeoJSON(pc.proposed_geom, 7)::json AS proposed_geometry,
                   round(area_sqm(pc.proposed_geom)::numeric, 1) AS proposed_area_sqm,
                   round(area_sqm(lp.geom)::numeric, 1) AS current_area_sqm
            FROM parcel_corrections pc
            JOIN land_parcels lp ON lp.id = pc.parcel_id
            JOIN villages v ON v.code = lp.village_code
            JOIN posts rq ON rq.id = pc.requested_by_post_id
            LEFT JOIN posts ap ON ap.id = pc.approved_by_post_id
            WHERE pc.status = ${status}::correction_status
            ORDER BY pc.created_at DESC LIMIT 200`,
      ),
    );
  }

  /** Send a submitted survey back to the surveyor with a reason (A4). The parcel is not changed. */
  returnSurvey(user: AuthUser, id: string, reason: string) {
    requireRole(user, RETURN_ROLES, 'Returning a field survey');
    return this.db.withScope(user, async (tx) => {
      const s = await one<{ id: string; status: string; project_id: string; parcel_id: string | null; surveyor_post_id: string }>(
        tx,
        sql`SELECT id, status, project_id, parcel_id, surveyor_post_id FROM field_surveys WHERE id = ${id}`,
      );
      if (!s) throw new ProblemException(404, 'SURVEY_NOT_FOUND', 'No such field survey in your jurisdiction.');
      if (s.status !== 'submitted')
        throw new ProblemException(409, 'SURVEY_NOT_SUBMITTED', `Only a submitted survey can be returned (this one is ${s.status}).`);
      if (s.surveyor_post_id === user.post.id)
        throw new ProblemException(422, 'MAKER_CHECKER', 'The post that walked the survey cannot return it (G20).');
      const now = this.clock.now();
      await tx.execute(
        sql`UPDATE field_surveys SET status = 'returned', verified_by_post_id = ${user.post.id}, verification_remarks = ${reason}
            WHERE id = ${id}`,
      );
      await writeOutbox(tx, {
        type: 'FIELD_SURVEY_RETURNED',
        aggregateType: 'field_survey',
        aggregateId: id,
        payload: { surveyId: id, projectId: s.project_id, parcelId: s.parcel_id, returnedByPostId: user.post.id, reason, at: now },
      });
      await this.audit.record({
        action: 'FIELD_SURVEY_RETURNED',
        entityType: 'field_survey',
        entityId: id,
        before: { status: s.status },
        after: { status: 'returned', reason },
      });
      return { id, status: 'returned', reason, returnedAt: now };
    });
  }
}
