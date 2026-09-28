import { amenityMilestones, resettlementSites, rnrCensusRecords, rnrSchemes } from '@bhoomisetu/db';
import { Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth-user';
import { ClockService } from '../common/clock/clock.service';
import { DbService } from '../common/db/db.service';
import { one, rows } from '../common/db/raw';
import { ProblemException } from '../common/errors/problem';
import { writeOutbox } from '../common/outbox/outbox';
import { projectPack } from '../common/project-pack';
import { requireRole } from '../common/roles';
import { RulesService } from '../rules/rules.service';
import { parseCsv } from '../sia/sia.service';
import { DeadlinesService } from '../workflow/deadlines.service';

/** The 25 Third Schedule amenity codes (§39.3). Applicability per site is the Administrator's call. */
export const THIRD_SCHEDULE = [
  'ROADS_ALL_WEATHER_LINK',
  'DRAINAGE_SANITATION',
  'SAFE_DRINKING_WATER',
  'CATTLE_DRINKING_WATER',
  'GRAZING_LAND',
  'FAIR_PRICE_SHOP',
  'PANCHAYAT_GHAR',
  'POST_OFFICE_SAVINGS',
  'SEED_FERTILIZER_STORAGE',
  'BASIC_IRRIGATION',
  'TRANSPORT_LINK',
  'BURIAL_CREMATION_GROUND',
  'INDIVIDUAL_TOILETS',
  'ELECTRIC_CONNECTIONS',
  'ANGANWADI',
  'SCHOOL_RTE',
  'SUB_HEALTH_CENTRE_2KM',
  'PRIMARY_HEALTH_CENTRE',
  'CHILDREN_PLAYGROUND',
  'COMMUNITY_CENTRE_PER_100',
  'WORSHIP_CHOWPAL_PER_50',
  'TRIBAL_INSTITUTION_LAND',
  'FOREST_RIGHTS_CPR_ACCESS',
  'SECURITY_ARRANGEMENTS',
  'VETERINARY_CENTRE',
] as const;

/** Module E — R&R census, scheme, sites & amenities (§19). */
@Injectable()
export class RnrService {
  constructor(
    private readonly db: DbService,
    private readonly rules: RulesService,
    private readonly deadlines: DeadlinesService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  /** R&R census (s.16) — SEPARATE from the SIA census. CSV: affected_family_id, categorisation, then vulnerability columns. */
  importCensus(user: AuthUser, projectId: string, csv: string) {
    requireRole(user, ['RNR_ADMINISTRATOR'], 'Importing the R&R census');
    return this.db.withScope(user, async (tx) => {
      const recs = parseCsv(csv);
      const now = this.clock.now();
      const values = recs.map((r, i) => {
        const { affected_family_id, categorisation, ...vulnerability } = r;
        if (!affected_family_id || !categorisation)
          throw new ProblemException(
            422,
            'CSV_COLUMNS',
            `Row ${i + 2}: affected_family_id and categorisation are required.`,
          );
        return {
          projectId,
          affectedFamilyId: affected_family_id,
          categorisation: categorisation as (typeof rnrCensusRecords.$inferInsert)['categorisation'],
          vulnerability,
          administratorPostId: user.post.id,
          capturedAt: now,
        };
      });
      for (let i = 0; i < values.length; i += 500) await tx.insert(rnrCensusRecords).values(values.slice(i, i + 500));
      await this.audit.record({
        action: 'RNR_CENSUS_IMPORTED',
        entityType: 'project',
        entityId: projectId,
        after: { rows: values.length },
      });
      return { imported: values.length };
    });
  }

  schemes(user: AuthUser, projectId: string) {
    return this.db.withScope(user, (tx) =>
      tx.select().from(rnrSchemes).where(eq(rnrSchemes.projectId, projectId)).orderBy(desc(rnrSchemes.version)),
    );
  }

  draftScheme(user: AuthUser, projectId: string, draftDocumentId: string) {
    requireRole(user, ['RNR_ADMINISTRATOR'], 'Drafting the R&R scheme');
    return this.db.withScope(user, async (tx) => {
      const v = await one<{ n: number }>(
        tx,
        sql`SELECT coalesce(max(version), 0)::int AS n FROM rnr_schemes WHERE project_id = ${projectId}`,
      );
      const [s] = await tx
        .insert(rnrSchemes)
        .values({ projectId, version: (v?.n ?? 0) + 1, status: 'draft', draftDocumentId, createdBy: user.id })
        .returning();
      await this.audit.record({ action: 'RNR_SCHEME_DRAFTED', entityType: 'rnr_scheme', entityId: s!.id, after: s });
      return s;
    });
  }

  /** draft → hearing → committee (≥ threshold acres, s.45) → approved (Commissioner, maker ≠ checker) → published. */
  advance(
    user: AuthUser,
    schemeId: string,
    to: 'hearing' | 'committee' | 'approved' | 'published',
    gazetteDocumentId?: string | null,
  ) {
    return this.db.withScope(user, async (tx) => {
      const [s] = await tx.select().from(rnrSchemes).where(eq(rnrSchemes.id, schemeId));
      if (!s) throw new ProblemException(404, 'SCHEME_NOT_FOUND', 'No such scheme.');
      const order = ['draft', 'hearing', 'committee', 'approved', 'published'];
      if (order.indexOf(to) <= order.indexOf(s.status))
        throw new ProblemException(409, 'SCHEME_STATUS', `The scheme is already ${s.status}.`);
      if (to === 'approved') {
        requireRole(user, ['RNR_COMMISSIONER'], 'Approving the R&R scheme');
        if (s.createdBy === user.id)
          throw new ProblemException(422, 'MAKER_CHECKER', 'The drafting officer cannot approve (G20).');
      } else if (to === 'published') requireRole(user, ['RNR_COMMISSIONER', 'COLLECTOR'], 'Publishing the scheme');
      else requireRole(user, ['RNR_ADMINISTRATOR'], 'Advancing the scheme');
      if (to === 'published' && !gazetteDocumentId)
        throw new ProblemException(422, 'GAZETTE_REQUIRED', 'Attach the gazette notification.');
      const [after] = await tx
        .update(rnrSchemes)
        .set({
          status: to,
          ...(to === 'approved' ? { approvedByPostId: user.post.id, approvedAt: this.clock.now() } : {}),
          ...(gazetteDocumentId ? { gazetteDocumentId } : {}),
        })
        .where(eq(rnrSchemes.id, schemeId))
        .returning();
      await this.audit.record({
        action: `RNR_SCHEME_${to.toUpperCase()}`,
        entityType: 'rnr_scheme',
        entityId: schemeId,
        before: s,
        after,
      });
      return after;
    });
  }

  sites(user: AuthUser, projectId: string) {
    return this.db.withScope(user, (tx) =>
      rows(
        tx,
        sql`SELECT s.id, s.name, s.capacity_families, s.commissioning_certificate_document_id, ST_AsGeoJSON(s.geom, 7)::json AS geometry,
                   (SELECT count(*)::int FROM affected_families af WHERE af.resettlement_site_id = s.id) AS families_allotted,
                   round(100.0 * count(m.*) FILTER (WHERE m.status = 'complete') / nullif(count(m.*), 0)) AS readiness_pct,
                   coalesce(jsonb_agg(jsonb_build_object('code', m.amenity_code, 'status', m.status, 'completedAt', m.completed_at) ORDER BY m.amenity_code) FILTER (WHERE m.id IS NOT NULL), '[]') AS milestones
            FROM resettlement_sites s LEFT JOIN amenity_milestones m ON m.site_id = s.id WHERE s.project_id = ${projectId}
            GROUP BY s.id ORDER BY s.name`,
      ),
    );
  }

  createSite(
    user: AuthUser,
    projectId: string,
    body: { name: string; capacityFamilies: number; geometry?: unknown; amenities: string[] },
  ) {
    requireRole(user, ['RNR_ADMINISTRATOR'], 'Creating a resettlement site');
    return this.db.withScope(user, async (tx) => {
      const bad = body.amenities.filter((a) => !(THIRD_SCHEDULE as readonly string[]).includes(a));
      if (bad.length) throw new ProblemException(422, 'AMENITY_UNKNOWN', `Not Third Schedule codes: ${bad.join(', ')}`);
      const geom = body.geometry
        ? (sql`ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(body.geometry)}), 4326))` as unknown as string)
        : null;
      const [s] = await tx
        .insert(resettlementSites)
        .values({ projectId, name: body.name, capacityFamilies: body.capacityFamilies, geom })
        .returning({ id: resettlementSites.id, name: resettlementSites.name });
      if (body.amenities.length)
        await tx
          .insert(amenityMilestones)
          .values(body.amenities.map((a) => ({ siteId: s!.id, amenityCode: a, status: 'planned' as const })));
      await this.audit.record({
        action: 'SITE_CREATED',
        entityType: 'resettlement_site',
        entityId: s!.id,
        after: body,
      });
      return s;
    });
  }

  milestone(
    user: AuthUser,
    siteId: string,
    code: string,
    body: { status: 'planned' | 'in_progress' | 'complete'; evidenceDocumentId?: string | null },
  ) {
    requireRole(user, ['RNR_ADMINISTRATOR'], 'Updating an amenity milestone');
    return this.db.withScope(user, async (tx) => {
      if (body.status === 'complete' && !body.evidenceDocumentId)
        throw new ProblemException(422, 'EVIDENCE_REQUIRED', 'A completed amenity needs an evidence document.');
      const r = await rows(
        tx,
        sql`UPDATE amenity_milestones SET status = ${body.status}, evidence_document_id = coalesce(${body.evidenceDocumentId ?? null}, evidence_document_id),
                   completed_at = CASE WHEN ${body.status} = 'complete' THEN app_now() ELSE NULL END
            WHERE site_id = ${siteId} AND amenity_code = ${code} RETURNING id, amenity_code, status`,
      );
      if (!r.length) throw new ProblemException(404, 'MILESTONE_NOT_FOUND', 'No such amenity on this site.');
      await this.audit.record({
        action: 'AMENITY_MILESTONE',
        entityType: 'resettlement_site',
        entityId: siteId,
        after: { code, ...body },
      });
      return r[0];
    });
  }

  /** All applicable amenities complete + commissioning certificate → SITE_COMMISSIONED (satisfies INFRA_RNR, s.38). */
  commission(user: AuthUser, siteId: string, certificateDocumentId: string) {
    requireRole(user, ['RNR_ADMINISTRATOR', 'COLLECTOR'], 'Commissioning a site');
    return this.db.withScope(user, async (tx) => {
      const [s] = await tx
        .select({ id: resettlementSites.id, projectId: resettlementSites.projectId })
        .from(resettlementSites)
        .where(eq(resettlementSites.id, siteId));
      if (!s) throw new ProblemException(404, 'SITE_NOT_FOUND', 'No such site.');
      const open = await one<{ n: number }>(
        tx,
        sql`SELECT count(*)::int AS n FROM amenity_milestones WHERE site_id = ${siteId} AND status <> 'complete'`,
      );
      if (open?.n)
        throw new ProblemException(422, 'AMENITIES_INCOMPLETE', `${open.n} amenity milestone(s) are not complete.`);
      await tx
        .update(resettlementSites)
        .set({ commissioningCertificateDocumentId: certificateDocumentId })
        .where(eq(resettlementSites.id, siteId));
      const { pack } = await projectPack(tx, this.rules, s.projectId);
      const now = this.clock.now();
      await writeOutbox(tx, {
        type: 'SITE_COMMISSIONED',
        aggregateType: 'resettlement_site',
        aggregateId: siteId,
        payload: { projectId: s.projectId, siteId, at: now },
      });
      const satisfied = await this.deadlines.satisfyForEvent(tx, {
        pack,
        projectId: s.projectId,
        event: 'SITE_COMMISSIONED',
        at: now,
      });
      await this.audit.record({
        action: 'SITE_COMMISSIONED',
        entityType: 'resettlement_site',
        entityId: siteId,
        after: { certificateDocumentId },
      });
      return { siteId, commissioned: true, clocksSatisfied: satisfied.map((d) => d.clockCode) };
    });
  }
}
