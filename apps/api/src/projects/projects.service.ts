import { randomBytes } from 'node:crypto';
import {
  attestations,
  documents,
  escrowAccounts,
  escrowTransactions,
  projectDistricts,
  projects,
  stageInstances,
  type Tx,
} from '@bhoomisetu/db';
import { applicableStages } from '@bhoomisetu/rules';
import { rupeesToPaise, type Role } from '@bhoomisetu/shared';
import { Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth-user';
import { ClockService } from '../common/clock/clock.service';
import { DbService } from '../common/db/db.service';
import { one, rows } from '../common/db/raw';
import { ProblemException } from '../common/errors/problem';
import { writeOutbox } from '../common/outbox/outbox';
import { env } from '../config/env';
import { RulesService } from '../rules/rules.service';
import type { ParsedAlignment } from './alignment-parser';
import type { CreateProjectBody, UpdateProjectBody } from './projects.dto';

type ProjectRow = typeof projects.$inferSelect;

const INTAKE_ROLES: Role[] = ['REQUIRING_BODY', 'LAO', 'COLLECTOR', 'SUPER_ADMIN'];
const ESCROW_DEMAND_ROLES: Role[] = ['LAO', 'COLLECTOR', 'SUPER_ADMIN'];
const ESCROW_DEPOSIT_ROLES: Role[] = ['REQUIRING_BODY', 'TREASURY_OFFICER', 'LAO', 'SUPER_ADMIN'];
const ESCROW_CERTIFY_ROLES: Role[] = ['COLLECTOR', 'TREASURY_OFFICER', 'SUPER_ADMIN'];

/** Documents the pre-scrutiny expects before a proposal is submitted (§14 step 3). */
const PRESCRUTINY_DOCS = ['DPR_SUMMARY', 'ADMIN_FINANCIAL_SANCTION', 'FUNDING_CLEARANCE'] as const;
/** Declared-district containment tolerance (§14 step 3) — not statutory. */
const DISTRICT_TOLERANCE_M = 500;

function requireRole(user: AuthUser, roles: Role[], what: string) {
  if (!roles.includes(user.post.role)) {
    throw new ProblemException(403, 'ROLE_NOT_PERMITTED', `${what} needs one of: ${roles.join(', ')}.`, {
      requiredRoles: roles,
    });
  }
}

/** Module A — proposal intake, alignment, pre-scrutiny, routing, escrow gates (§14). */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly db: DbService,
    private readonly rules: RulesService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  private async load(tx: Tx, id: string): Promise<ProjectRow> {
    const [p] = await tx.select().from(projects).where(eq(projects.id, id));
    if (!p) throw new ProblemException(404, 'PROJECT_NOT_FOUND', 'No such project in your jurisdiction.');
    return p;
  }

  // ------------------------------------------------------------------ reads

  list(user: AuthUser, q: { status?: string; district?: string; q?: string; limit: number }) {
    return this.db.withScope(user, (tx) =>
      rows(
        tx,
        sql`SELECT k.*, p.acquisition_type, p.category, p.is_linear, p.rule_pack_code, p.rule_pack_version,
                   p.data_source, p.submitted_at,
                   (SELECT array_agg(district_code ORDER BY district_code) FROM project_districts WHERE project_id = p.id) AS district_codes,
                   nd.clock_code AS next_clock, nd.due_at AS next_due_at, nd.days_remaining AS next_days_remaining,
                   nd.live_status AS next_status, nd.consequence_text AS next_consequence
            FROM v_project_kpis k JOIN projects p ON p.id = k.project_id
            LEFT JOIN LATERAL (SELECT * FROM v_deadline_board b WHERE b.project_id = p.id ORDER BY b.due_at LIMIT 1) nd ON true
            WHERE (${q.status ?? null}::project_status IS NULL OR p.status = ${q.status ?? null}::project_status)
              AND (${q.district ?? null}::text IS NULL OR EXISTS (SELECT 1 FROM project_districts pd WHERE pd.project_id = p.id AND pd.district_code = ${q.district ?? null}))
              AND (${q.q ?? null}::text IS NULL OR p.name ILIKE '%' || ${q.q ?? null} || '%' OR p.code ILIKE '%' || ${q.q ?? null} || '%')
            ORDER BY p.code LIMIT ${q.limit}`,
      ),
    );
  }

  get(user: AuthUser, id: string) {
    return this.db.withScope(user, async (tx) => {
      const p = await one<Record<string, unknown>>(
        tx,
        sql`SELECT p.id, p.code, p.name, p.name_local, p.category, p.sub_category, p.acquisition_type,
                   p.requiring_body_id, rb.name AS requiring_body_name, p.national_importance,
                   p.estimated_budget_paise, p.rule_pack_code, p.rule_pack_version, p.appropriate_govt, p.state_code,
                   p.is_linear, p.row_width_m, p.total_area_proposed_sqm, p.is_urgency, p.in_scheduled_area,
                   p.status, p.current_stage, p.submitted_at, p.data_source,
                   ST_AsGeoJSON(p.alignment, 7)::json AS alignment,
                   ST_AsGeoJSON(p.footprint, 7)::json AS footprint,
                   CASE WHEN p.footprint IS NOT NULL THEN area_sqm(p.footprint) END AS footprint_area_sqm,
                   CASE WHEN p.alignment IS NOT NULL THEN round((ST_Length(p.alignment::geography) / 1000)::numeric, 3) END AS alignment_km
            FROM projects p JOIN requiring_bodies rb ON rb.id = p.requiring_body_id WHERE p.id = ${id}`,
      );
      if (!p) throw new ProblemException(404, 'PROJECT_NOT_FOUND', 'No such project in your jurisdiction.');
      const districts = await rows(
        tx,
        sql`SELECT d.code, d.name, d.state_code FROM project_districts pd JOIN districts d ON d.code = pd.district_code
            WHERE pd.project_id = ${id} ORDER BY d.code`,
      );
      const kpis = await one(tx, sql`SELECT * FROM v_project_kpis WHERE project_id = ${id}`);
      const deadlines = await rows(tx, sql`SELECT * FROM v_deadline_board WHERE project_id = ${id} ORDER BY due_at`);
      const escrow = await tx.select().from(escrowAccounts).where(eq(escrowAccounts.projectId, id));
      const pack = p.rule_pack_code ? this.rules.get(String(p.rule_pack_code), String(p.rule_pack_version)) : undefined;
      return {
        ...p,
        rulePack: pack
          ? { code: pack.code, version: pack.version, title: pack.title, verify: pack.verify ?? [] }
          : null,
        districts,
        kpis,
        nextDeadline: deadlines[0] ?? null,
        openDeadlines: deadlines,
        escrow,
      };
    });
  }

  // ------------------------------------------------------------------ intake

  create(user: AuthUser, body: CreateProjectBody) {
    requireRole(user, INTAKE_ROLES, 'Creating a proposal');
    return this.db.withScope(user, async (tx) => {
      const code =
        body.code ?? `PRJ-${this.clock.now().getUTCFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;
      const [row] = await tx
        .insert(projects)
        .values({
          code,
          name: body.name,
          nameLocal: body.nameLocal ?? null,
          category: body.category,
          subCategory: body.subCategory ?? null,
          acquisitionType: body.acquisitionType,
          requiringBodyId: user.post.requiringBodyId ?? body.requiringBodyId,
          nationalImportance: body.nationalImportance,
          estimatedBudgetPaise: body.estimatedBudgetRupees != null ? rupeesToPaise(body.estimatedBudgetRupees) : null,
          totalAreaProposedSqm:
            body.totalAreaHa != null ? String(Math.round(body.totalAreaHa * 10_000 * 100) / 100) : null,
          appropriateGovt: body.appropriateGovt,
          stateCode: body.stateCode,
          isLinear: body.isLinear,
          rowWidthM: body.rowWidthM != null ? String(body.rowWidthM) : null,
          isUrgency: body.isUrgency,
          status: 'DRAFT',
          dataSource: env().DEMO_MODE ? 'SYNTHETIC_DEMO' : 'IMPORTED',
          createdBy: user.id,
        })
        .returning();
      if (!row) throw new Error('insert returned nothing');
      if (body.districtCodes.length) {
        await tx
          .insert(projectDistricts)
          .values(body.districtCodes.map((districtCode) => ({ projectId: row.id, districtCode })));
      }
      await this.audit.record({ action: 'PROJECT_CREATED', entityType: 'project', entityId: row.id, after: row });
      return row;
    });
  }

  update(user: AuthUser, id: string, body: UpdateProjectBody) {
    requireRole(user, INTAKE_ROLES, 'Editing a proposal');
    return this.db.withScope(user, async (tx) => {
      const before = await this.load(tx, id);
      if (before.status !== 'DRAFT')
        throw new ProblemException(409, 'NOT_DRAFT', 'Only a draft proposal can be edited.');
      const { districtCodes, estimatedBudgetRupees, totalAreaHa, rowWidthM, ...rest } = body;
      const patch = {
        ...rest,
        ...(estimatedBudgetRupees !== undefined
          ? { estimatedBudgetPaise: estimatedBudgetRupees == null ? null : rupeesToPaise(estimatedBudgetRupees) }
          : {}),
        ...(totalAreaHa !== undefined
          ? { totalAreaProposedSqm: totalAreaHa == null ? null : String(totalAreaHa * 10_000) }
          : {}),
        ...(rowWidthM !== undefined ? { rowWidthM: rowWidthM == null ? null : String(rowWidthM) } : {}),
      };
      const [after] = Object.keys(patch).length
        ? await tx.update(projects).set(patch).where(eq(projects.id, id)).returning()
        : [before];
      if (districtCodes) {
        const existing = (await tx.select().from(projectDistricts).where(eq(projectDistricts.projectId, id))).map(
          (d) => d.districtCode,
        );
        const add = districtCodes.filter((d) => !existing.includes(d));
        if (add.length)
          await tx.insert(projectDistricts).values(add.map((districtCode) => ({ projectId: id, districtCode })));
      }
      await this.audit.record({ action: 'PROJECT_UPDATED', entityType: 'project', entityId: id, before, after });
      return after;
    });
  }

  setAlignment(user: AuthUser, id: string, parsed: ParsedAlignment) {
    requireRole(user, INTAKE_ROLES, 'Uploading an alignment');
    return this.db.withScope(user, async (tx) => {
      const p = await this.load(tx, id);
      if (p.status !== 'DRAFT')
        throw new ProblemException(409, 'NOT_DRAFT', 'The alignment is fixed once the proposal is submitted.');
      const gj = JSON.stringify(parsed.geometry);
      if (parsed.kind === 'LINE') {
        if (!p.isLinear)
          throw new ProblemException(422, 'NOT_LINEAR', 'This project is an area project — upload polygons.');
        if (!p.rowWidthM)
          throw new ProblemException(
            422,
            'ROW_WIDTH_REQUIRED',
            'Set the right-of-way width before uploading a centreline.',
          );
        const merged = await one<{ type: string; valid: boolean }>(
          tx,
          sql`SELECT GeometryType(ST_LineMerge(ST_SetSRID(ST_GeomFromGeoJSON(${gj}), 4326))) AS type,
                     ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON(${gj}), 4326)) AS valid`,
        );
        if (merged?.type !== 'LINESTRING') {
          throw new ProblemException(
            422,
            'ALIGNMENT_DISCONTINUOUS',
            'The centreline segments do not join into one continuous line.',
          );
        }
        await tx.execute(sql`UPDATE projects SET
            alignment = ST_LineMerge(ST_SetSRID(ST_GeomFromGeoJSON(${gj}), 4326)),
            footprint = corridor(ST_LineMerge(ST_SetSRID(ST_GeomFromGeoJSON(${gj}), 4326)), row_width_m)
          WHERE id = ${id}`);
      } else {
        const v = await one<{ valid: boolean }>(
          tx,
          sql`SELECT ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON(${gj}), 4326)) AS valid`,
        );
        if (!v?.valid)
          throw new ProblemException(422, 'GEOMETRY_INVALID', 'The polygon is not valid (self-intersection?).');
        await tx.execute(sql`UPDATE projects SET alignment = NULL,
            footprint = ST_Multi(ST_UnaryUnion(ST_SetSRID(ST_GeomFromGeoJSON(${gj}), 4326))) WHERE id = ${id}`);
      }
      const preview = await one(
        tx,
        sql`SELECT ST_AsGeoJSON(alignment, 7)::json AS alignment, ST_AsGeoJSON(footprint, 7)::json AS footprint,
                   area_sqm(footprint) AS footprint_area_sqm,
                   CASE WHEN alignment IS NOT NULL THEN round((ST_Length(alignment::geography)/1000)::numeric, 3) END AS alignment_km
            FROM projects WHERE id = ${id}`,
      );
      await this.audit.record({
        action: 'PROJECT_ALIGNMENT_SET',
        entityType: 'project',
        entityId: id,
        after: { kind: parsed.kind },
      });
      return preview;
    });
  }

  // ------------------------------------------------------------------ pre-scrutiny

  prescrutiny(user: AuthUser, id: string) {
    return this.db.withScope(user, async (tx) => {
      const p = await this.load(tx, id);
      const items: Array<{
        code: string;
        status: 'PASS' | 'FAIL' | 'WARN' | 'NOT_EVALUATED';
        message: string;
        detail?: unknown;
      }> = [];
      const push = (code: string, status: (typeof items)[number]['status'], message: string, detail?: unknown) =>
        items.push({ code, status, message, detail });

      const missing = [
        !p.name && 'name',
        !p.category && 'category',
        !p.acquisitionType && 'acquisitionType',
        p.estimatedBudgetPaise == null && 'estimatedBudget',
        !p.totalAreaProposedSqm && 'totalArea',
        p.isLinear && !p.rowWidthM && 'rowWidthM',
      ].filter(Boolean);
      push(
        'MANDATORY_FIELDS',
        missing.length ? 'FAIL' : 'PASS',
        missing.length ? `Missing: ${missing.join(', ')}` : 'All mandatory fields present',
      );

      const docs = await tx
        .selectDistinct({ docType: documents.docType })
        .from(documents)
        .innerJoin(attestations, eq(attestations.documentId, documents.id))
        .where(and(eq(documents.projectId, id), inArray(documents.docType, [...PRESCRUTINY_DOCS])));
      const have = new Set<string>(docs.map((d) => d.docType));
      for (const d of PRESCRUTINY_DOCS) {
        push(
          `DOC_${d}`,
          have.has(d) ? 'PASS' : 'FAIL',
          have.has(d) ? `${d} uploaded and attested` : `${d} not uploaded (with attestation)`,
        );
      }

      const geo = await one<{ has: boolean; valid: boolean | null; districts_known: boolean; inside: boolean | null }>(
        tx,
        sql`SELECT p.footprint IS NOT NULL AS has, ST_IsValid(p.footprint) AS valid,
                   EXISTS (SELECT 1 FROM villages v JOIN sub_districts sd ON sd.code = v.sub_district_code
                           JOIN project_districts pd ON pd.district_code = sd.district_code AND pd.project_id = p.id
                           WHERE v.boundary IS NOT NULL) AS districts_known,
                   (SELECT ST_Covers(ST_Buffer(ST_Union(v.boundary)::geography, ${DISTRICT_TOLERANCE_M})::geometry, p.footprint)
                    FROM villages v JOIN sub_districts sd ON sd.code = v.sub_district_code
                    JOIN project_districts pd ON pd.district_code = sd.district_code AND pd.project_id = p.id
                    WHERE v.boundary IS NOT NULL) AS inside
            FROM projects p WHERE p.id = ${id}`,
      );
      push(
        'GEOMETRY',
        !geo?.has ? 'FAIL' : geo.valid ? 'PASS' : 'FAIL',
        !geo?.has ? 'No alignment / footprint uploaded' : geo.valid ? 'Geometry valid' : 'Geometry invalid',
      );
      if (geo?.has) {
        if (!geo.districts_known)
          push('INSIDE_DECLARED_DISTRICTS', 'NOT_EVALUATED', 'No village boundaries loaded for the declared districts');
        else
          push(
            'INSIDE_DECLARED_DISTRICTS',
            geo.inside ? 'PASS' : 'WARN',
            geo.inside
              ? 'Footprint lies within the declared districts'
              : 'Footprint extends beyond the declared districts',
          );

        const overlaps = await rows<{ code: string; name: string; overlap_area_sqm: string }>(
          tx,
          sql`SELECT * FROM project_footprint_overlaps(${id})`,
        );
        push(
          'NATIONAL_DUPLICATE_FOOTPRINT',
          overlaps.length ? 'WARN' : 'PASS',
          overlaps.length
            ? `Footprint overlaps ${overlaps.length} other active project(s)`
            : 'No overlap with other active projects',
          overlaps,
        );

        const hits = await rows<{ layer_type: string; name: string; overlap_area_sqm: string; data_source: string }>(
          tx,
          sql`SELECT c.layer_type, c.name, c.data_source, area_sqm(ST_Intersection(c.geom, p.footprint)) AS overlap_area_sqm
              FROM constraint_layers c, projects p WHERE p.id = ${id} AND ST_Intersects(c.geom, p.footprint)`,
        );
        push(
          'CONSTRAINT_LAYERS',
          hits.length ? 'WARN' : 'PASS',
          hits.length ? `${hits.length} constraint layer hit(s)` : 'No constraint layers intersected',
          hits,
        );
        const scheduled = hits.some((h) => h.layer_type === 'SCHEDULED_AREA');
        if (scheduled !== p.inScheduledArea)
          await tx.update(projects).set({ inScheduledArea: scheduled }).where(eq(projects.id, id));
      }

      const today = this.clock.now().toISOString().slice(0, 10);
      const eligible = this.rules.eligible(p, today);
      push(
        'RULE_PACK',
        eligible.length ? 'PASS' : 'FAIL',
        eligible.length
          ? `Will pin ${eligible[0]!.code}@${eligible[0]!.version}`
          : 'No rule pack applies to this project',
        eligible.map((k) => ({ code: k.code, version: k.version, title: k.title })),
      );

      return { projectId: id, ok: !items.some((i) => i.status === 'FAIL'), items };
    });
  }

  // ------------------------------------------------------------------ submit & routing

  submit(user: AuthUser, id: string, choice?: { code: string; version: string }) {
    requireRole(user, INTAKE_ROLES, 'Submitting a proposal');
    return this.db.withScope(user, async (tx) => {
      const p = await this.load(tx, id);
      if (p.status !== 'DRAFT') throw new ProblemException(409, 'NOT_DRAFT', 'Already submitted.');
      const hasFootprint = await one<{ ok: boolean }>(
        tx,
        sql`SELECT footprint IS NOT NULL AS ok FROM projects WHERE id = ${id}`,
      );
      if (!hasFootprint?.ok)
        throw new ProblemException(422, 'ALIGNMENT_REQUIRED', 'Upload the alignment / footprint before submitting.');

      const now = this.clock.now();
      const eligible = this.rules.eligible(p, now.toISOString().slice(0, 10));
      const pack = choice ? eligible.find((k) => k.code === choice.code && k.version === choice.version) : eligible[0];
      if (!pack)
        throw new ProblemException(
          422,
          'NO_ELIGIBLE_PACK',
          'No eligible rule pack (or the chosen one does not apply).',
        );

      // Routing: districts from the footprint through village boundaries, plus the declared ones.
      await tx.execute(sql`
        INSERT INTO project_districts (project_id, district_code)
        SELECT DISTINCT ${id}::uuid, sd.district_code
        FROM villages v JOIN sub_districts sd ON sd.code = v.sub_district_code, projects p
        WHERE p.id = ${id} AND v.boundary IS NOT NULL AND ST_Intersects(v.boundary, p.footprint)
        ON CONFLICT DO NOTHING`);
      const districtCodes = (await tx.select().from(projectDistricts).where(eq(projectDistricts.projectId, id))).map(
        (d) => d.districtCode,
      );
      if (!districtCodes.length)
        throw new ProblemException(
          422,
          'NO_DISTRICT',
          'Declare at least one district — none could be derived from the footprint.',
        );

      const first = applicableStages(pack, {
        acquisitionType: p.acquisitionType,
        isUrgency: p.isUrgency,
        inScheduledArea: p.inScheduledArea,
        status: 'SUBMITTED',
      })[0];
      if (!first) throw new Error('pack has no applicable stage');
      const [after] = await tx
        .update(projects)
        .set({
          status: 'SUBMITTED',
          submittedAt: now,
          rulePackCode: pack.code,
          rulePackVersion: pack.version,
          currentStage: first.code,
        })
        .where(eq(projects.id, id))
        .returning();
      await tx
        .insert(stageInstances)
        .values({ projectId: id, stageCode: first.code, attempt: 1, status: 'IN_PROGRESS', startedAt: now });
      await writeOutbox(tx, {
        type: 'PROJECT_SUBMITTED',
        aggregateType: 'project',
        aggregateId: id,
        payload: {
          projectId: id,
          code: p.code,
          districtCodes,
          stateCode: p.stateCode,
          rulePack: `${pack.code}@${pack.version}`,
          at: now,
        },
      });
      await this.audit.record({ action: 'PROJECT_SUBMITTED', entityType: 'project', entityId: id, before: p, after });
      return { project: after, districtCodes, rulePack: { code: pack.code, version: pack.version } };
    });
  }

  // ------------------------------------------------------------------ escrow gates (§14 step 5, §20)

  private async escrow(tx: Tx, projectId: string, gate: 'INITIAL' | 'FULL') {
    const [a] = await tx
      .select()
      .from(escrowAccounts)
      .where(and(eq(escrowAccounts.projectId, projectId), eq(escrowAccounts.gate, gate)));
    return a;
  }

  escrowDemand(
    user: AuthUser,
    projectId: string,
    gate: 'INITIAL' | 'FULL',
    amountRupees: string | number,
    documentId?: string | null,
  ) {
    requireRole(user, ESCROW_DEMAND_ROLES, 'Raising an escrow demand');
    return this.db.withScope(user, async (tx) => {
      await this.load(tx, projectId);
      const demand = rupeesToPaise(amountRupees);
      if (demand <= 0n) throw new ProblemException(422, 'AMOUNT_INVALID', 'Demand must be positive.');
      const existing = await this.escrow(tx, projectId, gate);
      if (existing?.status === 'certified') throw new ProblemException(409, 'ESCROW_CERTIFIED', 'Already certified.');
      const status = this.escrowStatus(existing?.depositedAmountPaise ?? 0n, demand);
      const [row] = existing
        ? await tx
            .update(escrowAccounts)
            .set({ demandAmountPaise: demand, demandDocumentId: documentId ?? existing.demandDocumentId, status })
            .where(eq(escrowAccounts.id, existing.id))
            .returning()
        : await tx
            .insert(escrowAccounts)
            .values({ projectId, gate, demandAmountPaise: demand, demandDocumentId: documentId ?? null, status })
            .returning();
      await this.audit.record({
        action: 'ESCROW_DEMANDED',
        entityType: 'escrow_account',
        entityId: row!.id,
        before: existing ?? null,
        after: row,
      });
      return row;
    });
  }

  escrowDeposit(
    user: AuthUser,
    projectId: string,
    gate: 'INITIAL' | 'FULL',
    amountRupees: string | number,
    reference?: string | null,
  ) {
    requireRole(user, ESCROW_DEPOSIT_ROLES, 'Recording an escrow deposit');
    return this.db.withScope(user, async (tx) => {
      const a = await this.escrow(tx, projectId, gate);
      if (!a) throw new ProblemException(409, 'NO_DEMAND', 'Raise the demand note first.');
      if (a.status === 'certified') throw new ProblemException(409, 'ESCROW_CERTIFIED', 'Already certified.');
      const amount = rupeesToPaise(amountRupees);
      if (amount <= 0n) throw new ProblemException(422, 'AMOUNT_INVALID', 'Deposit must be positive.');
      await tx
        .insert(escrowTransactions)
        .values({
          escrowAccountId: a.id,
          kind: 'deposit',
          amountPaise: amount,
          reference: reference ?? null,
          at: this.clock.now(),
        });
      const deposited = a.depositedAmountPaise + amount;
      const [row] = await tx
        .update(escrowAccounts)
        .set({ depositedAmountPaise: deposited, status: this.escrowStatus(deposited, a.demandAmountPaise) })
        .where(eq(escrowAccounts.id, a.id))
        .returning();
      await this.audit.record({
        action: 'ESCROW_DEPOSITED',
        entityType: 'escrow_account',
        entityId: a.id,
        before: a,
        after: row,
      });
      return row;
    });
  }

  escrowCertify(user: AuthUser, projectId: string, gate: 'INITIAL' | 'FULL') {
    requireRole(user, ESCROW_CERTIFY_ROLES, 'Certifying escrow sufficiency');
    return this.db.withScope(user, async (tx) => {
      const a = await this.escrow(tx, projectId, gate);
      if (!a) throw new ProblemException(409, 'NO_DEMAND', 'Raise the demand note first.');
      if (a.depositedAmountPaise < a.demandAmountPaise) {
        throw new ProblemException(422, 'ESCROW_SHORTFALL', 'Deposits do not yet cover the demand.', {
          demandPaise: a.demandAmountPaise.toString(),
          depositedPaise: a.depositedAmountPaise.toString(),
        });
      }
      const [row] = await tx
        .update(escrowAccounts)
        .set({ status: 'certified', sufficiencyCertifiedAt: this.clock.now(), certifiedByPostId: user.post.id })
        .where(eq(escrowAccounts.id, a.id))
        .returning();
      await this.audit.record({
        action: 'ESCROW_CERTIFIED',
        entityType: 'escrow_account',
        entityId: a.id,
        before: a,
        after: row,
      });
      return row;
    });
  }

  private escrowStatus(deposited: bigint, demand: bigint): 'demanded' | 'partially_funded' | 'funded' {
    if (deposited <= 0n) return 'demanded';
    return deposited >= demand ? 'funded' : 'partially_funded';
  }
}
