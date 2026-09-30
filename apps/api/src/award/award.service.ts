import { affectedFamilies, awards, entitlements, ocrExtractions, statutoryDeadlines, type Tx } from '@bhoomisetu/db';
import { findClock, runChecks, startClock, type CheckResult, type Pack } from '@bhoomisetu/rules';
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
import { projectPack } from '../common/project-pack';
import { env } from '../config/env';
import { RulesService } from '../rules/rules.service';

const DRAFT_ROLES: Role[] = ['LAO', 'SUPER_ADMIN'];
const SIGN_ROLES: Role[] = ['COLLECTOR', 'SUPER_ADMIN'];

function requireRole(user: AuthUser, roles: Role[], what: string) {
  if (!roles.includes(user.post.role))
    throw new ProblemException(403, 'ROLE_NOT_PERMITTED', `${what} needs one of: ${roles.join(', ')}.`, {
      requiredRoles: roles,
    });
}

type AwardRow = typeof awards.$inferSelect;

/**
 * Module F — awards and entitlements (§20). The system RECORDS the Collector's award (G1): every
 * amount is entered by the LAO (or accepted from OCR by a human), then validated by the pack's
 * checks. Nothing here computes a compensation figure.
 */
@Injectable()
export class AwardService {
  constructor(
    private readonly db: DbService,
    private readonly rules: RulesService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  private async award(tx: Tx, id: string): Promise<AwardRow> {
    const [a] = await tx.select().from(awards).where(eq(awards.id, id));
    if (!a) throw new ProblemException(404, 'AWARD_NOT_FOUND', 'No such award in your jurisdiction.');
    return a;
  }

  create(
    user: AuthUser,
    projectId: string,
    body: { awardType: 'LAND' | 'RNR'; awardNo: string; documentId?: string | null },
  ) {
    requireRole(user, DRAFT_ROLES, 'Drafting an award');
    return this.db.withScope(user, async (tx) => {
      await projectPack(tx, this.rules, projectId);
      const [row] = await tx
        .insert(awards)
        .values({
          projectId,
          awardType: body.awardType,
          awardNo: body.awardNo,
          documentId: body.documentId ?? null,
          laoPostId: user.post.id,
          status: 'draft',
        })
        .returning();
      await this.audit.record({ action: 'AWARD_DRAFTED', entityType: 'award', entityId: row!.id, after: row });
      // The award PDF (already attested and stored via the documents pipeline) is queued for OCR
      // (§26.3); the ocr job (§31) does the slow pdf-parse/tesseract work off this request.
      let ocrExtractionId: string | null = null;
      if (body.documentId) {
        const [x] = await tx
          .insert(ocrExtractions)
          .values({ documentId: body.documentId, engine: 'pending', fields: [], status: 'pending' })
          .returning({ id: ocrExtractions.id });
        ocrExtractionId = x!.id;
      }
      return { ...row, ocrExtractionId };
    });
  }

  listForProject(user: AuthUser, projectId: string) {
    return this.db.withScope(user, (tx) =>
      rows(
        tx,
        sql`SELECT a.*, (SELECT count(*)::int FROM entitlements e WHERE e.award_id = a.id) AS entitlements,
                   (SELECT coalesce(sum(amount_awarded_paise),0)::bigint FROM entitlements e WHERE e.award_id = a.id) AS total_paise,
                   (SELECT x.id FROM ocr_extractions x WHERE x.document_id = a.document_id ORDER BY x.created_at DESC LIMIT 1) AS ocr_extraction_id
            FROM awards a WHERE a.project_id = ${projectId} ORDER BY a.created_at`,
      ),
    );
  }

  /** Manual entry path (§20). Each entry is one head for one family, amount in rupees as entered. */
  addEntitlements(
    user: AuthUser,
    awardId: string,
    entries: Array<{ affectedFamilyId: string; headCode: string; amountRupees: string | number }>,
    source: 'manual' | 'ocr_confirmed' = 'manual',
  ) {
    requireRole(user, DRAFT_ROLES, 'Entering award amounts');
    return this.db.withScope(user, (tx) => this.insertEntitlements(tx, user, awardId, entries, source));
  }

  async insertEntitlements(
    tx: Tx,
    user: AuthUser,
    awardId: string,
    entries: Array<{ affectedFamilyId: string; headCode: string; amountRupees: string | number }>,
    source: 'manual' | 'ocr_confirmed',
  ) {
    const a = await this.award(tx, awardId);
    if (a.status !== 'draft')
      throw new ProblemException(409, 'AWARD_SIGNED', 'A signed award is corrected by a new version, not edited.');
    const { pack } = await projectPack(tx, this.rules, a.projectId);
    const fams = await tx
      .select({ id: affectedFamilies.id })
      .from(affectedFamilies)
      .where(
        and(
          eq(affectedFamilies.projectId, a.projectId),
          inArray(affectedFamilies.id, [...new Set(entries.map((e) => e.affectedFamilyId))]),
        ),
      );
    const known = new Set(fams.map((f) => f.id));
    const values = entries.map((e) => {
      const head = pack.entitlementHeads.find((h) => h.code === e.headCode);
      if (!head)
        throw new ProblemException(
          422,
          'HEAD_UNKNOWN',
          `${e.headCode} is not an entitlement head in ${pack.code}@${pack.version}.`,
        );
      if (!known.has(e.affectedFamilyId))
        throw new ProblemException(
          422,
          'FAMILY_UNKNOWN',
          `Family ${e.affectedFamilyId} is not affected by this project.`,
        );
      const isLandHead = head.kind === 'LAND';
      if (isLandHead !== (a.awardType === 'LAND')) {
        throw new ProblemException(
          422,
          'HEAD_AWARD_MISMATCH',
          `${e.headCode} belongs on the ${isLandHead ? 'LAND' : 'R&R'} award.`,
        );
      }
      return {
        affectedFamilyId: e.affectedFamilyId,
        awardId,
        scheduleRef: head.schedule,
        headCode: e.headCode,
        amountAwardedPaise: rupeesToPaise(e.amountRupees),
        source,
        status: 'ASSESSED' as const,
      };
    });
    const inserted = values.length ? await tx.insert(entitlements).values(values).returning() : [];
    await this.audit.record({
      action: 'ENTITLEMENTS_ENTERED',
      entityType: 'award',
      entityId: awardId,
      after: { source, count: inserted.length },
    });
    return inserted;
  }

  /** Runs the pack's award-entry checks per family over every head entered on the project (G1: validate only). */
  async checksFor(tx: Tx, pack: Pack, projectId: string, isUrgency: boolean) {
    const ents = await rows<{ affected_family_id: string; head_code: string; amount: string; is_sc_st: boolean }>(
      tx,
      sql`SELECT e.affected_family_id, e.head_code, e.amount_awarded_paise::text AS amount, af.is_sc_st
          FROM entitlements e JOIN awards a ON a.id = e.award_id JOIN affected_families af ON af.id = e.affected_family_id
          WHERE a.project_id = ${projectId}`,
    );
    const byFamily = new Map<string, { isScSt: boolean; heads: Array<{ headCode: string; amountPaise: bigint }> }>();
    for (const e of ents) {
      const f = byFamily.get(e.affected_family_id) ?? { isScSt: e.is_sc_st, heads: [] };
      f.heads.push({ headCode: e.head_code, amountPaise: BigInt(e.amount) });
      byFamily.set(e.affected_family_id, f);
    }
    const families = [...byFamily.entries()].map(([familyId, f]) => {
      const results: CheckResult[] = runChecks(pack, { heads: f.heads, isScSt: f.isScSt, isUrgency });
      return { familyId, results, failed: results.filter((r) => r.status === 'FAIL') };
    });
    return { families, failures: families.reduce((n, f) => n + f.failed.length, 0) };
  }

  checks(user: AuthUser, awardId: string) {
    return this.db.withScope(user, async (tx) => {
      const a = await this.award(tx, awardId);
      const { project, pack } = await projectPack(tx, this.rules, a.projectId);
      return this.checksFor(tx, pack, a.projectId, project.isUrgency);
    });
  }

  get(user: AuthUser, awardId: string) {
    return this.db.withScope(user, async (tx) => {
      const a = await this.award(tx, awardId);
      const ents = await rows(
        tx,
        sql`SELECT e.*, pe.full_name AS head_name FROM entitlements e JOIN affected_families af ON af.id = e.affected_family_id
            JOIN persons pe ON pe.id = af.head_person_id WHERE e.award_id = ${awardId} ORDER BY pe.full_name, e.head_code`,
      );
      return { ...a, entitlements: ents };
    });
  }

  /**
   * The Collector signs (maker ≠ checker vs the drafting LAO post). Failed checks block signing
   * unless an override reason is recorded. Entitlements become SANCTIONED and their payment clocks
   * (COMPENSATION_PAYMENT / MONETARY_RNR, s.38) start now.
   */
  sign(user: AuthUser, awardId: string, body: { overrideReason?: string | null }) {
    requireRole(user, SIGN_ROLES, 'Signing an award');
    return this.db.withScope(user, async (tx) => {
      const a = await this.award(tx, awardId);
      if (a.status === 'signed') throw new ProblemException(409, 'AWARD_SIGNED', 'Already signed.');
      if (a.laoPostId && a.laoPostId === user.post.id)
        throw new ProblemException(422, 'MAKER_CHECKER', 'The post that drafted the award cannot sign it (G20).');
      const { project, pack } = await projectPack(tx, this.rules, a.projectId);
      const count = await one<{ n: number }>(
        tx,
        sql`SELECT count(*)::int AS n FROM entitlements WHERE award_id = ${awardId}`,
      );
      if (!count?.n) throw new ProblemException(422, 'AWARD_EMPTY', 'Enter the award amounts before signing.');
      const checks = await this.checksFor(tx, pack, a.projectId, project.isUrgency);
      if (checks.failures && !body.overrideReason?.trim()) {
        throw new ProblemException(
          422,
          'AWARD_CHECKS_FAILED',
          `${checks.failures} statutory check(s) failed — correct the entries or record an override reason.`,
          {
            families: checks.families
              .filter((f) => f.failed.length)
              .map((f) => ({ familyId: f.familyId, failed: f.failed })),
          },
        );
      }
      const now = this.clock.now();
      const [signed] = await tx
        .update(awards)
        .set({ status: 'signed', pronouncedAt: now, collectorPostId: user.post.id })
        .where(eq(awards.id, awardId))
        .returning();

      // Payment clocks per entitlement (s.38) — from the pinned pack.
      const ents = await tx.select().from(entitlements).where(eq(entitlements.awardId, awardId));
      const kindOf = new Map(pack.entitlementHeads.map((h) => [h.code, h.kind]));
      for (const e of ents) {
        const kind = kindOf.get(e.headCode);
        const clock = pack.clocks.find(
          (c) =>
            c.subject === 'ENTITLEMENT' &&
            c.startsOn === 'AWARD_SIGNED' &&
            c.appliesToHeadKinds?.includes(kind as never),
        );
        const started = clock ? startClock(pack, clock.code, now, {}, env().STATUTORY_TZ) : null;
        await tx
          .update(entitlements)
          .set({ status: 'SANCTIONED', dueBy: started?.dueAt ?? null })
          .where(eq(entitlements.id, e.id));
        if (clock && started) {
          await tx.insert(statutoryDeadlines).values({
            projectId: a.projectId,
            clockCode: clock.code,
            section: clock.section,
            subjectType: 'ENTITLEMENT',
            subjectId: e.id,
            rulePackCode: pack.code,
            rulePackVersion: pack.version,
            startEvent: clock.startsOn,
            startedAt: now,
            dueAt: started.dueAt,
            consequence: clock.consequence,
            status: 'SAFE',
            conditionInputs: {},
          });
        }
      }
      await writeOutbox(tx, {
        type: 'AWARD_SIGNED',
        aggregateType: 'award',
        aggregateId: awardId,
        payload: {
          awardId,
          projectId: a.projectId,
          awardNo: a.awardNo,
          version: a.version,
          awardDocumentId: a.documentId,
          entitlements: ents
            .map((e) => ({ id: e.id, headCode: e.headCode, amountPaise: e.amountAwardedPaise }))
            .sort((x, y) => x.id.localeCompare(y.id)),
          signedByPostId: user.post.id,
          signedAt: now,
          overrideReason: body.overrideReason ?? null,
        },
      });
      await this.audit.record({
        action: 'AWARD_SIGNED',
        entityType: 'award',
        entityId: awardId,
        before: a,
        after: { ...signed, overrideReason: body.overrideReason ?? null, checksFailed: checks.failures },
      });
      return { award: signed, entitlements: ents.length, checksFailed: checks.failures };
    });
  }

  /** s.37 notices; each starts the s.64 reference window for that family (6 weeks if present). */
  s37Notices(user: AuthUser, awardId: string, entries: Array<{ affectedFamilyId: string; presentAtAward: boolean }>) {
    requireRole(user, [...DRAFT_ROLES, 'COLLECTOR'], 'Recording s.37 notices');
    return this.db.withScope(user, async (tx) => {
      const a = await this.award(tx, awardId);
      if (a.status !== 'signed')
        throw new ProblemException(409, 'AWARD_NOT_SIGNED', 'Serve s.37 notices after the award is signed.');
      const { pack } = await projectPack(tx, this.rules, a.projectId);
      const now = this.clock.now();
      const out = [];
      for (const e of entries) {
        for (const clock of pack.clocks.filter(
          (c) => c.startsOn === 'S37_NOTICE_SERVED' && c.subject === 'AFFECTED_FAMILY',
        )) {
          const inputs = { presentAtAward: e.presentAtAward };
          const s = startClock(pack, clock.code, now, inputs, env().STATUTORY_TZ);
          if (!s) continue;
          const [d] = await tx
            .insert(statutoryDeadlines)
            .values({
              projectId: a.projectId,
              clockCode: clock.code,
              section: clock.section,
              subjectType: 'AFFECTED_FAMILY',
              subjectId: e.affectedFamilyId,
              rulePackCode: pack.code,
              rulePackVersion: pack.version,
              startEvent: 'S37_NOTICE_SERVED',
              startedAt: now,
              dueAt: s.dueAt,
              consequence: clock.consequence,
              status: 'SAFE',
              conditionInputs: inputs,
            })
            .returning();
          out.push(d);
        }
        await writeOutbox(tx, {
          type: 'S37_NOTICE_SERVED',
          aggregateType: 'affected_family',
          aggregateId: e.affectedFamilyId,
          payload: { awardId, presentAtAward: e.presentAtAward, at: now },
        });
      }
      await this.audit.record({
        action: 'S37_NOTICES_SERVED',
        entityType: 'award',
        entityId: awardId,
        after: { count: entries.length },
      });
      return out;
    });
  }

  familyEntitlements(user: AuthUser, familyId: string) {
    return this.db.withScope(user, (tx) =>
      rows(
        tx,
        sql`SELECT e.*, a.award_no, a.award_type, a.status AS award_status,
                   (SELECT coalesce(sum(d.amount_paise),0)::bigint FROM disbursements d WHERE d.entitlement_id = e.id AND d.payment_status = 'SUCCESS') AS paid_paise
            FROM entitlements e JOIN awards a ON a.id = e.award_id WHERE e.affected_family_id = ${familyId} ORDER BY a.award_type, e.head_code`,
      ),
    );
  }

  /** Clock lookup helper for other modules (display). */
  clockLabel(pack: Pack, code: string) {
    return findClock(pack, code).label;
  }

  // ------------------------------------------------------------------ OCR review (§20, §26.3)

  getExtraction(user: AuthUser, id: string) {
    return this.db.withScope(user, async (tx) => {
      const r = await one(tx, sql`SELECT * FROM ocr_extractions WHERE id = ${id}`);
      if (!r) throw new ProblemException(404, 'EXTRACTION_NOT_FOUND', 'No such OCR extraction.');
      return r;
    });
  }

  /**
   * The review screen accepts fields one at a time (or edited); only accepted values create
   * entitlements (G3 — the extractor's `fields` never write anything on their own). A field's key
   * is `<affectedFamilyId>:<headCode>` (see ocr-extract.ts); `value` is rupees, officer-confirmed.
   */
  reviewExtraction(
    user: AuthUser,
    id: string,
    body: { accepted: Array<{ key: string; value: string | number }> },
  ) {
    requireRole(user, DRAFT_ROLES, 'Reviewing OCR-extracted award fields');
    return this.db.withScope(user, async (tx) => {
      const extraction = await one<{ id: string; document_id: string; accepted: unknown }>(
        tx,
        sql`SELECT id, document_id, accepted FROM ocr_extractions WHERE id = ${id}`,
      );
      if (!extraction) throw new ProblemException(404, 'EXTRACTION_NOT_FOUND', 'No such OCR extraction.');
      const award = await one<{ id: string }>(
        tx,
        sql`SELECT id FROM awards WHERE document_id = ${extraction.document_id}`,
      );
      if (!award)
        throw new ProblemException(409, 'AWARD_NOT_FOUND', 'No award is linked to this extraction’s document.');
      const entries = body.accepted.map((f) => {
        const sep = f.key.lastIndexOf(':');
        if (sep < 0)
          throw new ProblemException(422, 'FIELD_KEY_INVALID', `${f.key} is not "<affectedFamilyId>:<headCode>".`);
        return { affectedFamilyId: f.key.slice(0, sep), headCode: f.key.slice(sep + 1), amountRupees: f.value };
      });
      const inserted = await this.insertEntitlements(tx, user, award.id, entries, 'ocr_confirmed');
      const now = this.clock.now();
      const acceptedSoFar = (Array.isArray(extraction.accepted) ? extraction.accepted : []) as Array<{
        key: string;
        value: string | number;
        acceptedAt: string;
      }>;
      const accepted = [
        ...acceptedSoFar.filter((a) => !body.accepted.some((f) => f.key === a.key)),
        ...body.accepted.map((f) => ({ key: f.key, value: f.value, acceptedAt: now.toISOString() })),
      ];
      await tx.execute(
        sql`UPDATE ocr_extractions SET status = 'reviewed', reviewed_by_post_id = ${user.post.id}, accepted = ${JSON.stringify(accepted)}::jsonb WHERE id = ${id}`,
      );
      await this.audit.record({
        action: 'OCR_EXTRACTION_REVIEWED',
        entityType: 'ocr_extraction',
        entityId: id,
        after: { accepted: body.accepted.length, entitlements: inserted.length },
      });
      return { extractionId: id, entitlements: inserted };
    });
  }
}
