import {
  commonPropertyResources,
  expertRecommendations,
  governmentOverrides,
  hearings,
  siaCensusRecords,
  type Tx,
} from '@bhoomisetu/db';
import { hearingValidity } from '@bhoomisetu/rules';
import { Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth-user';
import { ClockService } from '../common/clock/clock.service';
import { DbService } from '../common/db/db.service';
import { one, rows } from '../common/db/raw';
import { ProblemException } from '../common/errors/problem';
import { writeOutbox } from '../common/outbox/outbox';
import { projectPack } from '../common/project-pack';
import { requireRole } from '../common/roles';
import { env } from '../config/env';
import { DeadlinesService } from '../workflow/deadlines.service';
import { RulesService } from '../rules/rules.service';

type HearingRow = typeof hearings.$inferSelect;
const HEARING_DOC_FIELDS = {
  NOTICE: 'noticeDocumentId',
  LOCAL_LANGUAGE_SUMMARY: 'localLanguageSummaryDocumentId',
  RECORDING: 'recordingDocumentId',
  ATTENDANCE: 'attendanceDocumentId',
  RESPONSE_MATRIX: 'responseMatrixDocumentId',
} as const;
export type HearingDocKind = keyof typeof HEARING_DOC_FIELDS;

/** Module C — SIA, hearings, CPR, expert group, override (§17). Also serves consent/R&R hearings. */
@Injectable()
export class SiaService {
  constructor(
    private readonly db: DbService,
    private readonly rules: RulesService,
    private readonly deadlines: DeadlinesService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  /** Emits a statutory event that is not a stage action (SIA commenced, report final…) and runs its clocks. */
  private async event(tx: Tx, projectId: string, type: string, payload: Record<string, unknown>) {
    const { pack } = await projectPack(tx, this.rules, projectId);
    const now = this.clock.now();
    await writeOutbox(tx, {
      type,
      aggregateType: 'project',
      aggregateId: projectId,
      payload: { projectId, ...payload, at: now },
    });
    await this.deadlines.satisfyForEvent(tx, { pack, projectId, event: type, at: now });
    const stage = await one<{ id: string }>(
      tx,
      sql`SELECT si.id FROM stage_instances si WHERE si.project_id = ${projectId} AND si.status IN ('IN_PROGRESS','SUBMITTED','RETURNED')
          AND si.stage_code = ${type.startsWith('EXPERT') ? 'S03_APPRAISAL' : 'S02_SIA'} ORDER BY si.attempt DESC LIMIT 1`,
    );
    const started = [
      ...(await this.deadlines.startForEvent(tx, {
        pack,
        projectId,
        event: type,
        at: now,
        subject: { type: 'PROJECT', id: projectId },
      })),
      ...(stage
        ? await this.deadlines.startForEvent(tx, {
            pack,
            projectId,
            event: type,
            at: now,
            subject: { type: 'STAGE', id: stage.id },
          })
        : []),
    ];
    return started.map((d) => ({ clockCode: d.clockCode, dueAt: d.dueAt }));
  }

  commence(user: AuthUser, projectId: string) {
    requireRole(user, ['COLLECTOR', 'SIA_AGENCY'], 'Recording SIA commencement');
    return this.db.withScope(user, async (tx) => {
      const clocks = await this.event(tx, projectId, 'SIA_COMMENCED', { byPostId: user.post.id });
      await this.audit.record({ action: 'SIA_COMMENCED', entityType: 'project', entityId: projectId });
      return { event: 'SIA_COMMENCED', clocks };
    });
  }

  reportFinal(user: AuthUser, projectId: string) {
    requireRole(user, ['COLLECTOR', 'SIA_AGENCY'], 'Finalising the SIA report');
    return this.db.withScope(user, async (tx) => {
      const docs = await one<{ n: number }>(
        tx,
        sql`SELECT count(DISTINCT d.doc_type)::int AS n FROM documents d JOIN attestations a ON a.document_id = d.id
            WHERE d.project_id = ${projectId} AND d.doc_type IN ('SIA_REPORT_FINAL','SIMP_FINAL')`,
      );
      if ((docs?.n ?? 0) < 2)
        throw new ProblemException(422, 'SIA_DOCS_MISSING', 'Upload the final SIA report and SIMP (attested) first.');
      const clocks = await this.event(tx, projectId, 'SIA_REPORT_FINAL', {});
      await this.audit.record({ action: 'SIA_REPORT_FINAL', entityType: 'project', entityId: projectId });
      return { event: 'SIA_REPORT_FINAL', clocks };
    });
  }

  // ------------------------------------------------------------------ hearings

  listHearings(user: AuthUser, projectId: string) {
    return this.db.withScope(user, async (tx) => {
      const hs = await tx
        .select()
        .from(hearings)
        .where(eq(hearings.projectId, projectId))
        .orderBy(desc(hearings.scheduledAt));
      return hs.map((h) => ({ ...h, validity: hearingValidity(h, env().STATUTORY_TZ) }));
    });
  }

  scheduleHearing(
    user: AuthUser,
    projectId: string,
    body: {
      type: HearingRow['type'];
      scheduledAt: string;
      venue?: string | null;
      villageCode?: string | null;
      noticePublishedAt?: string | null;
    },
  ) {
    requireRole(user, ['COLLECTOR', 'LAO', 'SIA_AGENCY', 'RNR_ADMINISTRATOR'], 'Scheduling a hearing');
    return this.db.withScope(user, async (tx) => {
      await projectPack(tx, this.rules, projectId);
      const prev = await one<{ n: number }>(
        tx,
        sql`SELECT coalesce(max(attempt), 0)::int AS n FROM hearings WHERE project_id = ${projectId} AND type = ${body.type}`,
      );
      const [h] = await tx
        .insert(hearings)
        .values({
          projectId,
          type: body.type,
          attempt: (prev?.n ?? 0) + 1,
          scheduledAt: new Date(body.scheduledAt),
          venue: body.venue ?? null,
          villageCode: body.villageCode ?? null,
          noticePublishedAt: body.noticePublishedAt ? new Date(body.noticePublishedAt) : null,
          status: 'SCHEDULED',
        })
        .returning();
      await this.audit.record({ action: 'HEARING_SCHEDULED', entityType: 'hearing', entityId: h!.id, after: h });
      return h;
    });
  }

  updateHearing(
    user: AuthUser,
    hearingId: string,
    body: {
      documents?: Partial<Record<HearingDocKind, string>>;
      noticePublishedAt?: string | null;
      quorumMet?: boolean | null;
      held?: boolean;
    },
  ) {
    requireRole(user, ['COLLECTOR', 'LAO', 'SIA_AGENCY', 'RNR_ADMINISTRATOR'], 'Recording hearing evidence');
    return this.db.withScope(user, async (tx) => {
      const [h] = await tx.select().from(hearings).where(eq(hearings.id, hearingId));
      if (!h) throw new ProblemException(404, 'HEARING_NOT_FOUND', 'No such hearing.');
      if (h.status === 'VOID' || h.status === 'VALID')
        throw new ProblemException(409, 'HEARING_CLOSED', `The hearing is ${h.status}.`);
      const patch: Record<string, unknown> = {};
      for (const [k, id] of Object.entries(body.documents ?? {})) patch[HEARING_DOC_FIELDS[k as HearingDocKind]] = id;
      if (body.noticePublishedAt !== undefined)
        patch.noticePublishedAt = body.noticePublishedAt ? new Date(body.noticePublishedAt) : null;
      if (body.quorumMet !== undefined) patch.quorumMet = body.quorumMet;
      if (body.held) patch.status = 'HELD';
      const [after] = Object.keys(patch).length
        ? await tx.update(hearings).set(patch).where(eq(hearings.id, hearingId)).returning()
        : [h];
      await this.audit.record({
        action: 'HEARING_UPDATED',
        entityType: 'hearing',
        entityId: hearingId,
        before: h,
        after,
      });
      return { ...after, validity: hearingValidity(after!, env().STATUTORY_TZ) };
    });
  }

  /** Evaluates the validity conditions; a passing hearing becomes VALID (satisfies the stage checklist). */
  validateHearing(user: AuthUser, hearingId: string) {
    requireRole(user, ['COLLECTOR', 'LAO', 'RNR_COMMISSIONER', 'RNR_ADMINISTRATOR'], 'Validating a hearing');
    return this.db.withScope(user, async (tx) => {
      const [h] = await tx.select().from(hearings).where(eq(hearings.id, hearingId));
      if (!h) throw new ProblemException(404, 'HEARING_NOT_FOUND', 'No such hearing.');
      const v = hearingValidity(h, env().STATUTORY_TZ);
      if (v.valid && h.status !== 'VALID')
        await tx.update(hearings).set({ status: 'VALID' }).where(eq(hearings.id, hearingId));
      await this.audit.record({
        action: v.valid ? 'HEARING_VALID' : 'HEARING_VALIDATION_FAILED',
        entityType: 'hearing',
        entityId: hearingId,
        after: v,
      });
      return { hearingId, status: v.valid ? 'VALID' : h.status, ...v };
    });
  }

  /** The Collector voids a hearing with a reason code → a fresh attempt must be scheduled (§17). */
  nullifyHearing(user: AuthUser, hearingId: string, reasonCode: string) {
    requireRole(user, ['COLLECTOR', 'RNR_COMMISSIONER'], 'Nullifying a hearing');
    return this.db.withScope(user, async (tx) => {
      const [h] = await tx.select().from(hearings).where(eq(hearings.id, hearingId));
      if (!h) throw new ProblemException(404, 'HEARING_NOT_FOUND', 'No such hearing.');
      const { pack } = await projectPack(tx, this.rules, h.projectId);
      if (!(pack.reasonCodes.HEARING ?? []).includes(reasonCode))
        throw new ProblemException(422, 'REASON_NOT_ALLOWED', `${reasonCode} is not a hearing reason code.`);
      const [after] = await tx
        .update(hearings)
        .set({ status: 'VOID', voidReasonCode: reasonCode, voidedByPostId: user.post.id })
        .where(eq(hearings.id, hearingId))
        .returning();
      await this.audit.record({
        action: 'HEARING_NULLIFIED',
        entityType: 'hearing',
        entityId: hearingId,
        before: h,
        after,
      });
      return after;
    });
  }

  // ------------------------------------------------------------------ CPR & census

  addCpr(
    user: AuthUser,
    projectId: string,
    body: {
      villageCode: string;
      cprType: (typeof commonPropertyResources.$inferInsert)['cprType'];
      name: string;
      lat?: number | null;
      lng?: number | null;
      affected: boolean;
      notes?: string | null;
    },
  ) {
    requireRole(user, ['SIA_AGENCY', 'LAO', 'COLLECTOR'], 'Recording a common property resource');
    return this.db.withScope(user, async (tx) => {
      const point =
        body.lat != null && body.lng != null
          ? (sql`ST_SetSRID(ST_MakePoint(${body.lng}, ${body.lat}), 4326)` as unknown as string)
          : null;
      const [r] = await tx
        .insert(commonPropertyResources)
        .values({
          projectId,
          villageCode: body.villageCode,
          cprType: body.cprType,
          name: body.name,
          point,
          affected: body.affected,
          notes: body.notes ?? null,
        })
        .returning({ id: commonPropertyResources.id });
      await this.audit.record({
        action: 'CPR_RECORDED',
        entityType: 'common_property_resource',
        entityId: r!.id,
        after: body,
      });
      return r;
    });
  }

  listCpr(user: AuthUser, projectId: string) {
    return this.db.withScope(user, (tx) =>
      rows(
        tx,
        sql`SELECT id, village_code, cpr_type, name, affected, notes, ST_AsGeoJSON(point)::json AS point FROM common_property_resources WHERE project_id = ${projectId} ORDER BY village_code, name`,
      ),
    );
  }

  /** SIA census CSV (header row; `village_code,household_ref,…` — every other column goes into payload). */
  importCensus(user: AuthUser, projectId: string, csv: string) {
    requireRole(user, ['SIA_AGENCY', 'LAO', 'COLLECTOR'], 'Importing the SIA census');
    return this.db.withScope(user, async (tx) => {
      const recs = parseCsv(csv);
      if (!recs.length) throw new ProblemException(422, 'CSV_EMPTY', 'No rows found.');
      const now = this.clock.now();
      const values = recs.map((r, i) => {
        const { village_code, household_ref, ...payload } = r;
        if (!village_code || !household_ref)
          throw new ProblemException(422, 'CSV_COLUMNS', `Row ${i + 2}: village_code and household_ref are required.`);
        return {
          projectId,
          villageCode: village_code,
          householdRef: household_ref,
          payload,
          enumeratorPostId: user.post.id,
          capturedAt: now,
        };
      });
      for (let i = 0; i < values.length; i += 500) await tx.insert(siaCensusRecords).values(values.slice(i, i + 500));
      await this.audit.record({
        action: 'SIA_CENSUS_IMPORTED',
        entityType: 'project',
        entityId: projectId,
        after: { rows: values.length },
      });
      return { imported: values.length };
    });
  }

  // ------------------------------------------------------------------ expert group (s.7–8)

  constituteExpertGroup(
    user: AuthUser,
    projectId: string,
    body: { members: Array<{ name: string; seat: string; coiDeclarationDocId?: string | null }>; chairperson: string },
  ) {
    requireRole(user, ['STATE_REVENUE'], 'Constituting the expert group');
    return this.db.withScope(user, async (tx) => {
      if (body.members.some((m) => !m.coiDeclarationDocId))
        throw new ProblemException(
          422,
          'COI_REQUIRED',
          'Every member needs a conflict-of-interest declaration document.',
        );
      const [r] = await tx
        .insert(expertRecommendations)
        .values({ projectId, outcome: 'A_UNCONDITIONAL', members: body.members, chairperson: body.chairperson })
        .returning();
      const clocks = await this.event(tx, projectId, 'EXPERT_GROUP_CONSTITUTED', { expertRecommendationId: r!.id });
      await this.audit.record({
        action: 'EXPERT_GROUP_CONSTITUTED',
        entityType: 'expert_recommendation',
        entityId: r!.id,
        after: body,
      });
      return { expertGroupId: r!.id, clocks };
    });
  }

  recommend(
    user: AuthUser,
    projectId: string,
    body: {
      outcome: 'A_UNCONDITIONAL' | 'B_CONDITIONAL' | 'C_REJECTION';
      conditions?: string | null;
      dissentNotes?: unknown;
      reportDocumentId: string;
    },
  ) {
    requireRole(user, ['EXPERT_GROUP_MEMBER', 'STATE_REVENUE'], 'Recording the expert recommendation');
    return this.db.withScope(user, async (tx) => {
      const [g] = await tx
        .select()
        .from(expertRecommendations)
        .where(and(eq(expertRecommendations.projectId, projectId)))
        .orderBy(desc(expertRecommendations.createdAt))
        .limit(1);
      if (!g) throw new ProblemException(409, 'NO_EXPERT_GROUP', 'Constitute the expert group first.');
      if (g.signedAt) throw new ProblemException(409, 'ALREADY_SIGNED', 'The recommendation is already signed.');
      if (body.outcome === 'B_CONDITIONAL' && !body.conditions?.trim())
        throw new ProblemException(
          422,
          'CONDITIONS_REQUIRED',
          'A conditional recommendation must state its conditions.',
        );
      const now = this.clock.now();
      const [after] = await tx
        .update(expertRecommendations)
        .set({
          outcome: body.outcome,
          conditions: body.conditions ?? null,
          dissentNotes: body.dissentNotes ?? null,
          reportDocumentId: body.reportDocumentId,
          signedAt: now,
        })
        .where(eq(expertRecommendations.id, g.id))
        .returning();
      const clocks = await this.event(tx, projectId, 'EXPERT_RECOMMENDATION_SIGNED', { outcome: body.outcome });
      await this.audit.record({
        action: 'EXPERT_RECOMMENDATION_SIGNED',
        entityType: 'expert_recommendation',
        entityId: g.id,
        before: g,
        after,
      });
      // Outcome C: the appraisal stage is then REJECTed (→ ABANDONED) or OVERRIDDEN with written reasons.
      return {
        recommendation: after,
        clocks,
        next:
          body.outcome === 'C_REJECTION'
            ? 'S03 REJECT, or OVERRIDE with written reasons (s.8(2))'
            : 'S03 APPROVE / APPROVE_CONDITIONAL',
      };
    });
  }

  /** s.8(2): the government may proceed despite outcome C, with written reasons — recorded here, then S03 OVERRIDE. */
  override(user: AuthUser, projectId: string, body: { writtenReasons: string; orderDocumentId?: string | null }) {
    requireRole(user, ['STATE_REVENUE'], 'Recording a government override');
    return this.db.withScope(user, async (tx) => {
      const g = await one<{ id: string; outcome: string }>(
        tx,
        sql`SELECT id, outcome FROM expert_recommendations WHERE project_id = ${projectId} AND signed_at IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
      );
      if (!g)
        throw new ProblemException(409, 'NO_RECOMMENDATION', 'There is no signed expert recommendation to override.');
      if (!body.writtenReasons.trim())
        throw new ProblemException(422, 'WRITTEN_REASONS_REQUIRED', 's.8(2) requires written reasons.');
      const [o] = await tx
        .insert(governmentOverrides)
        .values({
          projectId,
          expertRecommendationId: g.id,
          writtenReasons: body.writtenReasons,
          orderDocumentId: body.orderDocumentId ?? null,
          decidedByPostId: user.post.id,
          decidedAt: this.clock.now(),
        })
        .returning();
      await this.audit.record({
        action: 'GOVERNMENT_OVERRIDE',
        entityType: 'government_override',
        entityId: o!.id,
        after: o,
      });
      return o;
    });
  }

  expertGroup(user: AuthUser, projectId: string) {
    return this.db.withScope(user, async (tx) => ({
      recommendations: await tx
        .select()
        .from(expertRecommendations)
        .where(eq(expertRecommendations.projectId, projectId))
        .orderBy(desc(expertRecommendations.createdAt)),
      overrides: await tx.select().from(governmentOverrides).where(eq(governmentOverrides.projectId, projectId)),
    }));
  }
}

/** Minimal CSV parser (quoted fields, commas, newlines in quotes). First row is the header. */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rowsOut: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      rowsOut.push(row);
      row = [];
      cur = '';
    } else cur += c;
  }
  if (cur || row.length) {
    row.push(cur);
    rowsOut.push(row);
  }
  const [header, ...data] = rowsOut.filter((r) => r.some((x) => x.trim()));
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return data.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}
