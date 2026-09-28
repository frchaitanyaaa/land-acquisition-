import { decryptPii, landParcels, parcelCorrections, projectParcels, spatialFlags, type Tx } from '@bhoomisetu/db';
import { tagEntity, type Role } from '@bhoomisetu/shared';
import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth-user';
import { ClockService } from '../common/clock/clock.service';
import { DbService } from '../common/db/db.service';
import { one, rows } from '../common/db/raw';
import { ProblemException } from '../common/errors/problem';
import { writeOutbox } from '../common/outbox/outbox';

const GIS_ROLES: Role[] = ['LAO', 'COLLECTOR', 'DILR', 'TEHSILDAR', 'SUPER_ADMIN'];
const VERIFY_ROLES: Role[] = ['TEHSILDAR', 'DILR', 'LAO', 'SUPER_ADMIN'];

function requireRole(user: AuthUser, roles: Role[], what: string) {
  if (!roles.includes(user.post.role)) {
    throw new ProblemException(403, 'ROLE_NOT_PERMITTED', `${what} needs one of: ${roles.join(', ')}.`, {
      requiredRoles: roles,
    });
  }
}

export type ColorBy = 'stage' | 'payment' | 'risk';

/** Module B — intersection, parcel map, chainage, flags, verification, corrections (§15). */
@Injectable()
export class GisService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  intersect(user: AuthUser, projectId: string) {
    requireRole(user, GIS_ROLES, 'Running the corridor intersection');
    return this.db.withScope(user, async (tx) => {
      const p = await one<{ id: string; has: boolean }>(
        tx,
        sql`SELECT id, footprint IS NOT NULL AS has FROM projects WHERE id = ${projectId}`,
      );
      if (!p) throw new ProblemException(404, 'PROJECT_NOT_FOUND', 'No such project in your jurisdiction.');
      if (!p.has) throw new ProblemException(422, 'NO_FOOTPRINT', 'The project has no footprint yet.');
      const r = await one<{ parcels: number; families: number; flags: number }>(
        tx,
        sql`SELECT intersect_project_parcels(${projectId}) AS parcels, create_family_stubs(${projectId}) AS families,
                   screen_project_constraints(${projectId}) AS flags`,
      );
      await this.audit.record({ action: 'PROJECT_INTERSECTED', entityType: 'project', entityId: projectId, after: r });
      return r;
    });
  }

  /** GeoJSON FeatureCollection of the project's parcels, each with a `category` for the colour-by switcher. */
  parcels(user: AuthUser, projectId: string, colorBy: ColorBy) {
    return this.db.withScope(user, async (tx) => {
      const feats = await rows<Record<string, unknown> & { geometry: unknown }>(
        tx,
        sql`WITH fam AS (
              SELECT pp.id AS ppid, e.status, e.amount_awarded_paise
              FROM project_parcels pp
              JOIN parcel_interests pi ON pi.parcel_id = pp.parcel_id
              JOIN affected_families af ON af.project_id = pp.project_id AND af.head_person_id = pi.person_id
              JOIN entitlements e ON e.affected_family_id = af.id
              WHERE pp.project_id = ${projectId}),
            pay AS (
              SELECT ppid,
                     CASE WHEN count(*) = 0 THEN 'NONE'
                          WHEN bool_and(status IN ('ACKNOWLEDGED','DEPOSITED_WITH_AUTHORITY')) THEN 'ACKNOWLEDGED'
                          WHEN bool_and(status IN ('ACKNOWLEDGED','DEPOSITED_WITH_AUTHORITY','DISBURSED','UNDER_PROTEST')) THEN 'PAID'
                          WHEN bool_or(status IN ('ACKNOWLEDGED','DEPOSITED_WITH_AUTHORITY','DISBURSED','UNDER_PROTEST')) THEN 'PART_PAID'
                          ELSE 'UNPAID' END AS payment
              FROM fam GROUP BY ppid),
            risk AS (
              SELECT pp.id AS ppid,
                     max(CASE b.live_status WHEN 'BREACHED' THEN 3 WHEN 'DUE_SOON' THEN 2 ELSE 1 END) AS r
              FROM project_parcels pp
              JOIN v_deadline_board b ON b.project_id = pp.project_id
                AND (b.subject_type IN ('PROJECT','STAGE') OR b.subject_id = pp.id
                     OR b.subject_id IN (SELECT e.id FROM parcel_interests pi
                                         JOIN affected_families af ON af.project_id = pp.project_id AND af.head_person_id = pi.person_id
                                         JOIN entitlements e ON e.affected_family_id = af.id WHERE pi.parcel_id = pp.parcel_id))
              WHERE pp.project_id = ${projectId} GROUP BY pp.id)
            SELECT pp.id AS project_parcel_id, lp.id AS parcel_id, lp.village_code, v.name AS village_name,
                   lp.survey_number || coalesce('/' || lp.sub_division, '') AS survey_no,
                   lp.land_class, lp.boundary_source, lp.version, pp.status, pp.flags, pp.affected_area_sqm, pp.affected_pct,
                   pp.chainage_km, lp.recorded_area_sqm, lp.field_area_sqm, lp.area_diff_pct, lp.transfer_frozen_at,
                   coalesce(pay.payment, 'NONE') AS payment,
                   CASE coalesce(risk.r, 1) WHEN 3 THEN 'BREACHED' WHEN 2 THEN 'DUE_SOON' ELSE 'SAFE' END AS risk,
                   ST_AsGeoJSON(lp.geom, 7)::json AS geometry,
                   ST_AsGeoJSON(pp.affected_geom, 7)::json AS affected_geometry
            FROM project_parcels pp
            JOIN land_parcels lp ON lp.id = pp.parcel_id
            JOIN villages v ON v.code = lp.village_code
            LEFT JOIN pay ON pay.ppid = pp.id
            LEFT JOIN risk ON risk.ppid = pp.id
            WHERE pp.project_id = ${projectId}
            ORDER BY pp.chainage_km NULLS LAST, lp.village_code, lp.survey_number`,
      );
      const project = await one<Record<string, unknown>>(
        tx,
        sql`SELECT id, code, name, ST_AsGeoJSON(footprint, 7)::json AS footprint, ST_AsGeoJSON(alignment, 7)::json AS alignment,
                   ST_AsGeoJSON(ST_Envelope(footprint))::json AS bbox FROM projects WHERE id = ${projectId}`,
      );
      if (!project) throw new ProblemException(404, 'PROJECT_NOT_FOUND', 'No such project in your jurisdiction.');
      return {
        type: 'FeatureCollection' as const,
        colorBy,
        project,
        features: feats.map(({ geometry, ...props }) => ({
          type: 'Feature' as const,
          id: props.project_parcel_id,
          geometry,
          properties: {
            ...props,
            category: colorBy === 'stage' ? props.status : colorBy === 'payment' ? props.payment : props.risk,
          },
        })),
      };
    });
  }

  /** §15.7 chainage strip: bins along a linear project, coloured by the worst status inside. */
  chainage(user: AuthUser, projectId: string, binM: number) {
    return this.db.withScope(user, (tx) =>
      rows(
        tx,
        sql`SELECT floor(pp.chainage_km * 1000 / ${binM})::int AS bin,
                   (floor(pp.chainage_km * 1000 / ${binM}) * ${binM} / 1000.0)::numeric(9,3) AS from_km,
                   ((floor(pp.chainage_km * 1000 / ${binM}) + 1) * ${binM} / 1000.0)::numeric(9,3) AS to_km,
                   count(*)::int AS parcels, sum(pp.affected_area_sqm) AS affected_area_sqm,
                   count(*) FILTER (WHERE cardinality(pp.flags) > 0)::int AS flagged,
                   count(*) FILTER (WHERE pp.status IN ('ACQUIRED_POSSESSED','CLOSED'))::int AS possessed,
                   array_agg(DISTINCT pp.status) AS statuses
            FROM project_parcels pp WHERE pp.project_id = ${projectId} AND pp.chainage_km IS NOT NULL
            GROUP BY 1, 2, 3 ORDER BY 1`,
      ),
    );
  }

  flags(user: AuthUser, projectId: string) {
    return this.db.withScope(user, (tx) =>
      rows(
        tx,
        sql`SELECT f.*, lp.survey_number || coalesce('/' || lp.sub_division, '') AS survey_no, v.name AS village_name
            FROM spatial_flags f
            LEFT JOIN project_parcels pp ON pp.id = f.project_parcel_id
            LEFT JOIN land_parcels lp ON lp.id = pp.parcel_id
            LEFT JOIN villages v ON v.code = lp.village_code
            WHERE f.project_id = ${projectId} ORDER BY f.acknowledged_at NULLS FIRST, f.flag_type, f.layer_type`,
      ),
    );
  }

  acknowledgeFlag(user: AuthUser, flagId: string) {
    requireRole(user, GIS_ROLES, 'Acknowledging a spatial flag');
    return this.db.withScope(user, async (tx) => {
      const [before] = await tx.select().from(spatialFlags).where(eq(spatialFlags.id, flagId));
      if (!before) throw new ProblemException(404, 'FLAG_NOT_FOUND', 'No such flag.');
      const [after] = await tx
        .update(spatialFlags)
        .set({ acknowledgedByPostId: user.post.id, acknowledgedAt: this.clock.now() })
        .where(eq(spatialFlags.id, flagId))
        .returning();
      await this.audit.record({
        action: 'FLAG_ACKNOWLEDGED',
        entityType: 'spatial_flag',
        entityId: flagId,
        before,
        after,
      });
      return after;
    });
  }

  parcel(user: AuthUser, parcelId: string) {
    return this.db.withScope(user, async (tx) => {
      const p = await one<Record<string, unknown>>(
        tx,
        sql`SELECT lp.id, lp.village_code, v.name AS village_name, v.name_local AS village_name_local,
                   lp.survey_number, lp.sub_division, lp.survey_number || coalesce('/' || lp.sub_division, '') AS survey_no,
                   lp.recorded_area_sqm, lp.field_area_sqm, lp.area_diff_pct, lp.boundary_source, lp.land_class,
                   lp.is_irrigated_multicrop, lp.in_scheduled_area, lp.transfer_frozen_at, lp.geom_hash, lp.version,
                   lp.data_source, area_sqm(lp.geom) AS geom_area_sqm, ST_AsGeoJSON(lp.geom, 7)::json AS geometry
            FROM land_parcels lp JOIN villages v ON v.code = lp.village_code WHERE lp.id = ${parcelId}`,
      );
      if (!p) throw new ProblemException(404, 'PARCEL_NOT_FOUND', 'No such parcel in your jurisdiction.');
      const versions = await rows(
        tx,
        sql`SELECT version, geom_hash, recorded_area_sqm, field_area_sqm, boundary_source, superseded_at,
                   ST_AsGeoJSON(geom, 7)::json AS geometry
            FROM land_parcels_versions WHERE id = ${parcelId} ORDER BY version`,
      );
      const projects = await rows(
        tx,
        sql`SELECT pp.id AS project_parcel_id, pp.project_id, pr.code AS project_code, pr.name AS project_name, pp.status, pp.flags,
                   pp.affected_area_sqm, pp.affected_pct, pp.chainage_km
            FROM project_parcels pp JOIN projects pr ON pr.id = pp.project_id WHERE pp.parcel_id = ${parcelId}`,
      );
      const interestRows = await rows<
        Record<string, unknown> & { phone_enc: Buffer | null; bank_ref_enc: Buffer | null }
      >(
        tx,
        sql`SELECT pi.id, pi.interest_type, pi.share_fraction, pi.verification_status, pe.id AS person_id, pe.full_name,
                   pe.full_name_local, pe.guardian_name, pe.gender, pe.social_category, pe.phone_enc, pe.bank_ref_enc,
                   pe.phone_masked, pe.bank_ref_masked, pe.data_source
            FROM parcel_interests pi JOIN persons pe ON pe.id = pi.person_id WHERE pi.parcel_id = ${parcelId}
            ORDER BY pi.interest_type, pe.full_name`,
      );
      const district = user.post.level === 'DISTRICT';
      const interests = interestRows.map(({ phone_enc, bank_ref_enc, phone_masked, bank_ref_masked, ...r }) => ({
        ...r,
        person: tagEntity('person', {
          id: r.person_id,
          fullName: r.full_name,
          // Decrypted only for viewers the redaction map allows (§11.5); others get the stored mask.
          phone: district && phone_enc ? decryptPii(phone_enc) : phone_masked,
          bankRef: district && bank_ref_enc ? decryptPii(bank_ref_enc) : bank_ref_masked,
        }),
      }));
      const surveys = await rows(
        tx,
        sql`SELECT fs.id, fs.project_id, fs.survey_type, fs.status, fs.started_at, fs.submitted_at, fs.notice_served_on,
                   fs.plausibility, fs.verification_remarks, fs.override_reason, fs.verified_by_post_id,
                   ST_AsGeoJSON(fs.track, 7)::json AS track
            FROM field_surveys fs WHERE fs.parcel_id = ${parcelId} ORDER BY fs.started_at DESC NULLS LAST`,
      );
      const vertices = await rows(
        tx,
        sql`SELECT pv.id, pv.survey_id, pv.seq, pv.lat, pv.lng, pv.accuracy_m, pv.capture_method, pv.samples_averaged,
                   pv.photo_document_id, pv.captured_at, pv.synced_at
            FROM parcel_vertices pv WHERE pv.parcel_id = ${parcelId} ORDER BY pv.survey_id, pv.seq`,
      );
      const jir = await rows(tx, sql`SELECT * FROM jir_items WHERE parcel_id = ${parcelId} ORDER BY item_type`);
      const pillars = await rows(
        tx,
        sql`SELECT id, pillar_no, ST_AsGeoJSON(point)::json AS point, photo_document_id FROM boundary_pillars WHERE parcel_id = ${parcelId} ORDER BY pillar_no`,
      );
      const corrections = await rows(
        tx,
        sql`SELECT id, from_version, to_version, reason, status, requested_by_post_id, approved_by_post_id, decided_at, ST_AsGeoJSON(proposed_geom, 7)::json AS proposed_geometry FROM parcel_corrections WHERE parcel_id = ${parcelId} ORDER BY created_at`,
      );
      const chain = await rows(
        tx,
        sql`SELECT entity_version, event_type, status, tx_hash, block_number, anchored_at, data_hash FROM chain_events
            WHERE entity_type = 'land_parcel' AND entity_id = ${parcelId} ORDER BY entity_version, created_at`,
      ).catch(() => []);
      return { ...p, versions, projects, interests, surveys, vertices, jirItems: jir, pillars, corrections, chain };
    });
  }

  verify(user: AuthUser, parcelId: string, body: { remarks?: string | null; overrideReason?: string | null }) {
    requireRole(user, VERIFY_ROLES, 'Verifying a parcel');
    return this.db.withScope(user, async (tx) => {
      const [parcel] = await tx.select().from(landParcels).where(eq(landParcels.id, parcelId));
      if (!parcel) throw new ProblemException(404, 'PARCEL_NOT_FOUND', 'No such parcel in your jurisdiction.');
      const links = await tx.select().from(projectParcels).where(eq(projectParcels.parcelId, parcelId));
      const flags = [...new Set(links.flatMap((l) => l.flags))];
      const plaus = await one<{ flags: string[] | null }>(
        tx,
        sql`SELECT array_agg(DISTINCT k) FILTER (WHERE k IS NOT NULL) AS flags FROM field_surveys fs,
                   LATERAL jsonb_object_keys(coalesce(fs.plausibility -> 'flags', '{}'::jsonb)) k
            WHERE fs.parcel_id = ${parcelId} AND fs.status = 'submitted'`,
      );
      const allFlags = [...flags, ...(plaus?.flags ?? [])];
      if (allFlags.length && !body.overrideReason?.trim()) {
        throw new ProblemException(
          422,
          'OVERRIDE_REASON_REQUIRED',
          `The parcel has flags (${allFlags.join(', ')}) — record an override reason.`,
          { flags: allFlags },
        );
      }
      const now = this.clock.now();
      await tx.execute(sql`UPDATE field_surveys SET status = 'verified', verified_by_post_id = ${user.post.id},
                             verification_remarks = ${body.remarks ?? null}, override_reason = ${body.overrideReason ?? null}
                           WHERE parcel_id = ${parcelId} AND status = 'submitted'`);
      const updated = await tx
        .update(projectParcels)
        .set({ status: 'VERIFIED' })
        .where(
          and(
            eq(projectParcels.parcelId, parcelId),
            sql`${projectParcels.status} IN ('PROPOSED','VERIFICATION_PENDING')`,
          ),
        )
        .returning();
      await writeOutbox(tx, {
        type: 'PARCEL_VERIFIED',
        aggregateType: 'land_parcel',
        aggregateId: parcelId,
        payload: {
          parcelId,
          version: parcel.version,
          villageCode: parcel.villageCode,
          surveyNumber: parcel.surveyNumber,
          subDivision: parcel.subDivision,
          geomHash: parcel.geomHash,
          fieldAreaSqm: parcel.fieldAreaSqm,
          recordedAreaSqm: parcel.recordedAreaSqm,
          boundarySource: parcel.boundarySource,
          verifiedByPostId: user.post.id,
          verifiedAt: now,
          projectParcelIds: updated.map((u) => u.id),
        },
      });
      await this.audit.record({
        action: 'PARCEL_VERIFIED',
        entityType: 'land_parcel',
        entityId: parcelId,
        after: {
          overrideReason: body.overrideReason ?? null,
          remarks: body.remarks ?? null,
          projectParcels: updated.map((u) => u.id),
        },
      });
      return { parcelId, version: parcel.version, projectParcelsVerified: updated.length, flags: allFlags };
    });
  }

  requestCorrection(user: AuthUser, parcelId: string, body: { geometry: unknown; reason: string }) {
    requireRole(user, VERIFY_ROLES, 'Requesting a parcel correction');
    return this.db.withScope(user, async (tx) => {
      const [parcel] = await tx.select().from(landParcels).where(eq(landParcels.id, parcelId));
      if (!parcel) throw new ProblemException(404, 'PARCEL_NOT_FOUND', 'No such parcel in your jurisdiction.');
      const gj = JSON.stringify(body.geometry);
      const v = await one<{ valid: boolean; type: string }>(
        tx,
        sql`SELECT ST_IsValid(g) AS valid, GeometryType(g) AS type FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(${gj}), 4326) g) x`,
      );
      if (!v?.valid || !['POLYGON', 'MULTIPOLYGON'].includes(v.type)) {
        throw new ProblemException(422, 'GEOMETRY_INVALID', 'The corrected boundary must be a valid polygon.');
      }
      const [row] = await tx
        .insert(parcelCorrections)
        .values({
          parcelId,
          fromVersion: parcel.version,
          reason: body.reason,
          requestedByPostId: user.post.id,
          status: 'requested',
          proposedGeom: sql`ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${gj}), 4326))` as unknown as string,
        })
        .returning({
          id: parcelCorrections.id,
          parcelId: parcelCorrections.parcelId,
          fromVersion: parcelCorrections.fromVersion,
          status: parcelCorrections.status,
          reason: parcelCorrections.reason,
        });
      await this.audit.record({
        action: 'PARCEL_CORRECTION_REQUESTED',
        entityType: 'parcel_correction',
        entityId: row!.id,
        after: row,
      });
      return row;
    });
  }

  decideCorrection(user: AuthUser, correctionId: string, body: { approve: boolean; geometry?: unknown }) {
    requireRole(user, VERIFY_ROLES, 'Deciding a parcel correction');
    return this.db.withScope(user, async (tx) => {
      const [c] = await tx
        .select({
          id: parcelCorrections.id,
          parcelId: parcelCorrections.parcelId,
          fromVersion: parcelCorrections.fromVersion,
          status: parcelCorrections.status,
          requestedByPostId: parcelCorrections.requestedByPostId,
        })
        .from(parcelCorrections)
        .where(eq(parcelCorrections.id, correctionId));
      if (!c) throw new ProblemException(404, 'CORRECTION_NOT_FOUND', 'No such correction.');
      if (c.status !== 'requested') throw new ProblemException(409, 'ALREADY_DECIDED', 'Already decided.');
      if (c.requestedByPostId === user.post.id)
        throw new ProblemException(422, 'MAKER_CHECKER', 'The requesting post cannot decide its own correction (G20).');
      const now = this.clock.now();
      if (!body.approve) {
        const [after] = await tx
          .update(parcelCorrections)
          .set({ status: 'rejected', approvedByPostId: user.post.id, decidedAt: now })
          .where(eq(parcelCorrections.id, correctionId))
          .returning({ id: parcelCorrections.id, status: parcelCorrections.status });
        await this.audit.record({
          action: 'PARCEL_CORRECTION_REJECTED',
          entityType: 'parcel_correction',
          entityId: correctionId,
          before: c,
          after,
        });
        return after;
      }
      const toVersion = c.fromVersion + 1;
      const applied = await rows(
        tx,
        sql`UPDATE land_parcels lp SET geom = pc.proposed_geom, version = ${toVersion}
                           FROM parcel_corrections pc WHERE pc.id = ${correctionId} AND lp.id = pc.parcel_id AND lp.version = pc.from_version
                           RETURNING lp.id`,
      );
      if (!applied.length)
        throw new ProblemException(
          409,
          'PARCEL_CHANGED',
          'The parcel changed since the correction was requested — request it again.',
        );
      const [after] = await tx
        .update(parcelCorrections)
        .set({ status: 'approved', approvedByPostId: user.post.id, toVersion, decidedAt: now })
        .where(eq(parcelCorrections.id, correctionId))
        .returning({
          id: parcelCorrections.id,
          parcelId: parcelCorrections.parcelId,
          fromVersion: parcelCorrections.fromVersion,
          toVersion: parcelCorrections.toVersion,
          status: parcelCorrections.status,
        });
      // Re-derive every project's affected part of this parcel.
      const projs = await rows<{ project_id: string }>(
        tx,
        sql`SELECT DISTINCT project_id FROM project_parcels WHERE parcel_id = ${c.parcelId}`,
      );
      for (const p of projs)
        await tx.execute(
          sql`SELECT intersect_project_parcels(${p.project_id}), screen_project_constraints(${p.project_id})`,
        );
      const [parcel] = await tx.select().from(landParcels).where(eq(landParcels.id, c.parcelId));
      await writeOutbox(tx, {
        type: 'PARCEL_CORRECTED',
        aggregateType: 'land_parcel',
        aggregateId: c.parcelId,
        payload: {
          parcelId: c.parcelId,
          fromVersion: c.fromVersion,
          version: toVersion,
          geomHash: parcel?.geomHash,
          approvedByPostId: user.post.id,
          at: now,
        },
      });
      await this.audit.record({
        action: 'PARCEL_CORRECTED',
        entityType: 'land_parcel',
        entityId: c.parcelId,
        before: c,
        after,
      });
      return { ...after, geomHash: parcel?.geomHash };
    });
  }
}
