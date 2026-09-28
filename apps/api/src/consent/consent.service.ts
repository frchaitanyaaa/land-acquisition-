import { consentRecords, consentRegisterEntries, consentRegisters, objections } from '@bhoomisetu/db';
import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { IdentityService } from '../adapters/identity/identity.adapter';
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

type ConsentType = 'PRIVATE_80' | 'PPP_70' | 'GRAM_SABHA_S41';
type ObjectionGround = 'AREA_SUITABILITY' | 'PUBLIC_PURPOSE' | 'SIA_FINDINGS';
type ObjectionCategory = 'A_PUBLIC_PURPOSE' | 'B_ALIGNMENT_SHIFT' | 'C_SURVEY_ERROR';

/**
 * Advisory objection triage (§18.3, G3). A transparent keyword model standing in for the LLM
 * adapter: it only ever fills ai_suggested_* columns; an officer confirms the authoritative ones.
 */
export function triageObjection(body: string): {
  ground: ObjectionGround;
  category: ObjectionCategory;
  confidence: number;
  language: string;
} {
  const t = body.toLowerCase();
  const has = (...ws: string[]) => ws.filter((w) => t.includes(w)).length;
  const survey = has('survey', 'boundary', 'area', 'measurement', 'wrong', 'गट', 'सर्वे', 'क्षेत्र', 'मोजणी');
  const shift = has('alignment', 'shift', 'route', 'instead', 'move', 'alternate', 'मार्ग', 'बदल');
  const purpose = has('purpose', 'not needed', 'private', 'benefit', 'public', 'उद्देश', 'गरज');
  const sia = has('sia', 'social impact', 'hearing', 'report', 'सामाजिक');
  const scores: Array<[ObjectionCategory, ObjectionGround, number]> = [
    ['C_SURVEY_ERROR', 'AREA_SUITABILITY', survey],
    ['B_ALIGNMENT_SHIFT', 'AREA_SUITABILITY', shift],
    ['A_PUBLIC_PURPOSE', 'PUBLIC_PURPOSE', purpose],
    ['A_PUBLIC_PURPOSE', 'SIA_FINDINGS', sia],
  ];
  scores.sort((a, b) => b[2] - a[2]);
  const [category, ground, hits] = scores[0]!;
  const total = scores.reduce((a, s) => a + s[2], 0);
  const language = /[ऀ-ॿ]/.test(body) ? 'mr' : 'en';
  return { ground, category, confidence: total ? Math.round((hits / total) * 1000) / 1000 : 0.25, language };
}

/** Module D — consent (§18.1) and objections (§18.3). */
@Injectable()
export class ConsentService {
  constructor(
    private readonly db: DbService,
    private readonly rules: RulesService,
    private readonly identity: IdentityService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  createRegister(user: AuthUser, projectId: string, consentType: ConsentType) {
    requireRole(user, ['LAO', 'COLLECTOR'], 'Creating a consent register');
    return this.db.withScope(user, async (tx) => {
      const { pack, project } = await projectPack(tx, this.rules, projectId);
      const need =
        project.acquisitionType === 'PRIVATE'
          ? 'PRIVATE_80'
          : project.acquisitionType === 'PPP'
            ? 'PPP_70'
            : project.inScheduledArea
              ? 'GRAM_SABHA_S41'
              : null;
      if (!need)
        throw new ProblemException(
          422,
          'CONSENT_NOT_APPLICABLE',
          `${pack.code}: consent does not apply to a government project outside a Scheduled Area.`,
        );
      if (consentType !== need && !(consentType === 'GRAM_SABHA_S41' && project.inScheduledArea)) {
        throw new ProblemException(422, 'CONSENT_TYPE_MISMATCH', `This project needs a ${need} register.`);
      }
      const [reg] = await tx.insert(consentRegisters).values({ projectId, consentType, status: 'draft' }).returning();
      // Draft entries from the land records: owners (or, for Gram Sabha, every affected family head).
      await tx.execute(
        consentType === 'GRAM_SABHA_S41'
          ? sql`INSERT INTO consent_register_entries (register_id, person_id, affected_family_id, eligibility_basis)
                SELECT ${reg!.id}, af.head_person_id, af.id, 'Gram Sabha member (s.41)' FROM affected_families af WHERE af.project_id = ${projectId}
                ON CONFLICT DO NOTHING`
          : sql`INSERT INTO consent_register_entries (register_id, person_id, eligibility_basis)
                SELECT DISTINCT ${reg!.id}::uuid, pi.person_id, 'Recorded owner (Record of Rights)' FROM project_parcels pp
                JOIN parcel_interests pi ON pi.parcel_id = pp.parcel_id AND pi.interest_type = 'OWNER' WHERE pp.project_id = ${projectId}
                ON CONFLICT DO NOTHING`,
      );
      const n = await one<{ n: number }>(
        tx,
        sql`SELECT count(*)::int AS n FROM consent_register_entries WHERE register_id = ${reg!.id}`,
      );
      await this.audit.record({
        action: 'CONSENT_REGISTER_CREATED',
        entityType: 'consent_register',
        entityId: reg!.id,
        after: { ...reg, entries: n?.n },
      });
      return { ...reg, entries: n?.n ?? 0 };
    });
  }

  private async register(
    user: AuthUser,
    id: string,
    fn: (r: typeof consentRegisters.$inferSelect) => Promise<unknown>,
  ) {
    return this.db.withScope(user, async (tx) => {
      const [r] = await tx.select().from(consentRegisters).where(eq(consentRegisters.id, id));
      if (!r) throw new ProblemException(404, 'REGISTER_NOT_FOUND', 'No such consent register.');
      return fn(r);
    });
  }

  display(user: AuthUser, id: string, body: { displayFrom: string; displayTo: string }) {
    requireRole(user, ['LAO', 'COLLECTOR'], 'Displaying the consent register');
    return this.register(user, id, async (r) =>
      this.db.withScope(user, async (tx) => {
        if (r.status === 'certified')
          throw new ProblemException(409, 'REGISTER_CERTIFIED', 'A certified register is locked.');
        const [after] = await tx
          .update(consentRegisters)
          .set({ status: 'displayed', displayFrom: body.displayFrom, displayTo: body.displayTo })
          .where(eq(consentRegisters.id, id))
          .returning();
        await this.audit.record({
          action: 'CONSENT_REGISTER_DISPLAYED',
          entityType: 'consent_register',
          entityId: id,
          before: r,
          after,
        });
        return after;
      }),
    );
  }

  addEntry(user: AuthUser, id: string, body: { personId: string; eligibilityBasis: string; isHeirUpdate: boolean }) {
    requireRole(user, ['LAO', 'COLLECTOR'], 'Correcting the consent register');
    return this.register(user, id, async (r) =>
      this.db.withScope(user, async (tx) => {
        if (r.status === 'certified')
          throw new ProblemException(409, 'REGISTER_CERTIFIED', 'A certified register is locked.');
        const [e] = await tx
          .insert(consentRegisterEntries)
          .values({
            registerId: id,
            personId: body.personId,
            eligibilityBasis: body.eligibilityBasis,
            isHeirUpdate: body.isHeirUpdate,
          })
          .onConflictDoNothing()
          .returning();
        await this.audit.record({
          action: 'CONSENT_ENTRY_ADDED',
          entityType: 'consent_register',
          entityId: id,
          after: e ?? body,
        });
        return e ?? { duplicate: true };
      }),
    );
  }

  removeEntry(user: AuthUser, entryId: string, reason: string) {
    requireRole(user, ['LAO', 'COLLECTOR'], 'Correcting the consent register');
    return this.db.withScope(user, async (tx) => {
      const e = await one<{ register_id: string; status: string }>(
        tx,
        sql`SELECT e.register_id, r.status FROM consent_register_entries e JOIN consent_registers r ON r.id = e.register_id WHERE e.id = ${entryId}`,
      );
      if (!e) throw new ProblemException(404, 'ENTRY_NOT_FOUND', 'No such entry.');
      if (e.status === 'certified')
        throw new ProblemException(409, 'REGISTER_CERTIFIED', 'A certified register is locked.');
      await tx.update(consentRegisterEntries).set({ status: 'removed' }).where(eq(consentRegisterEntries.id, entryId));
      await this.audit.record({
        action: 'CONSENT_ENTRY_REMOVED',
        entityType: 'consent_register',
        entityId: e.register_id,
        after: { entryId, reason },
      });
      return { removed: entryId };
    });
  }

  certify(user: AuthUser, id: string) {
    requireRole(user, ['COLLECTOR'], 'Certifying the consent register');
    return this.register(user, id, async (r) =>
      this.db.withScope(user, async (tx) => {
        if (r.status !== 'displayed')
          throw new ProblemException(409, 'NOT_DISPLAYED', 'Display the register for objections before certifying it.');
        const [after] = await tx
          .update(consentRegisters)
          .set({ status: 'certified', certifiedAt: this.clock.now(), certifiedByPostId: user.post.id })
          .where(eq(consentRegisters.id, id))
          .returning();
        await this.audit.record({
          action: 'CONSENT_REGISTER_CERTIFIED',
          entityType: 'consent_register',
          entityId: id,
          before: r,
          after,
        });
        return after;
      }),
    );
  }

  /** One consent per eligible entry, after certification and a VALID awareness hearing; identity via the MOCK adapter. */
  record(
    user: AuthUser,
    id: string,
    body: {
      registerEntryId: string;
      decision: 'CONSENT' | 'REFUSE';
      formDocumentId?: string | null;
      observerPostId?: string | null;
      lat?: number | null;
      lng?: number | null;
    },
  ) {
    requireRole(user, ['LAO', 'COLLECTOR'], 'Recording consent');
    return this.register(user, id, async (r) =>
      this.db.withScope(user, async (tx) => {
        if (r.status !== 'certified')
          throw new ProblemException(
            409,
            'REGISTER_NOT_CERTIFIED',
            'Consent is collected only against a certified register.',
          );
        const heard = await one<{ ok: boolean }>(
          tx,
          sql`SELECT EXISTS (SELECT 1 FROM hearings WHERE project_id = ${r.projectId} AND type = 'GRAM_SABHA_CONSENT' AND status = 'VALID') AS ok`,
        );
        if (!heard?.ok)
          throw new ProblemException(
            409,
            'AWARENESS_HEARING_REQUIRED',
            'A VALID awareness hearing must precede consent collection.',
          );
        const entry = await one<{ person_id: string; status: string }>(
          tx,
          sql`SELECT person_id, status FROM consent_register_entries WHERE id = ${body.registerEntryId} AND register_id = ${id}`,
        );
        if (!entry || entry.status !== 'eligible')
          throw new ProblemException(422, 'ENTRY_NOT_ELIGIBLE', 'Not an eligible entry of this register.');
        const idv = await this.identity.verify({ personId: entry.person_id, method: 'consent' });
        const before = await one<{ met: boolean | null }>(
          tx,
          sql`SELECT met FROM v_consent_tally WHERE register_id = ${id}`,
        );
        const point =
          body.lat != null && body.lng != null
            ? (sql`ST_SetSRID(ST_MakePoint(${body.lng}, ${body.lat}), 4326)` as unknown as string)
            : null;
        const [rec] = await tx
          .insert(consentRecords)
          .values({
            registerEntryId: body.registerEntryId,
            decision: body.decision,
            formDocumentId: body.formDocumentId ?? null,
            collectedByPostId: user.post.id,
            observerPostId: body.observerPostId ?? null,
            collectedAt: this.clock.now(),
            point,
            identityCheckRef: idv.ref,
            identityProvider: idv.provider,
          })
          .returning({
            id: consentRecords.id,
            decision: consentRecords.decision,
            identityProvider: consentRecords.identityProvider,
          });
        const tally = await one<{ met: boolean | null; pct: string }>(
          tx,
          sql`SELECT met, pct FROM v_consent_tally WHERE register_id = ${id}`,
        );
        if (tally?.met && !before?.met) {
          await writeOutbox(tx, {
            type: 'CONSENT_THRESHOLD_MET',
            aggregateType: 'consent_register',
            aggregateId: id,
            payload: { projectId: r.projectId, registerId: id, pct: tally.pct },
          });
        }
        await this.audit.record({
          action: 'CONSENT_RECORDED',
          entityType: 'consent_record',
          entityId: rec!.id,
          after: rec,
        });
        return { ...rec, tally };
      }),
    );
  }

  observerCertify(user: AuthUser, recordId: string) {
    requireRole(user, ['DLSA_OBSERVER'], 'Certifying non-coercion');
    return this.db.withScope(user, async (tx) => {
      const [after] = await tx
        .update(consentRecords)
        .set({ observerCertified: true, observerPostId: user.post.id })
        .where(eq(consentRecords.id, recordId))
        .returning({ id: consentRecords.id, observerCertified: consentRecords.observerCertified });
      if (!after) throw new ProblemException(404, 'RECORD_NOT_FOUND', 'No such consent record in your scope.');
      await this.audit.record({
        action: 'CONSENT_OBSERVER_CERTIFIED',
        entityType: 'consent_record',
        entityId: recordId,
      });
      return after;
    });
  }

  tally(user: AuthUser, projectId: string) {
    return this.db.withScope(user, (tx) =>
      rows(
        tx,
        sql`SELECT t.*, (SELECT count(*)::int FROM consent_records c JOIN consent_register_entries e ON e.id = c.register_entry_id
                         WHERE e.register_id = t.register_id AND c.observer_certified) AS observer_certified
            FROM v_consent_tally t WHERE t.project_id = ${projectId}`,
      ),
    );
  }

  entries(user: AuthUser, registerId: string) {
    return this.db.withScope(user, (tx) =>
      rows(
        tx,
        sql`SELECT e.id, e.person_id, pe.full_name, e.eligibility_basis, e.is_heir_update, e.status, c.decision, c.collected_at, c.observer_certified
            FROM consent_register_entries e JOIN persons pe ON pe.id = e.person_id LEFT JOIN consent_records c ON c.register_entry_id = e.id
            WHERE e.register_id = ${registerId} ORDER BY pe.full_name`,
      ),
    );
  }

  // ------------------------------------------------------------------ objections (§18.3)

  fileObjection(
    user: AuthUser,
    projectId: string,
    body: {
      personId?: string | null;
      parcelId?: string | null;
      body: string;
      language?: string | null;
      channel: 'helpdesk' | 'hearing_audio';
    },
  ) {
    requireRole(user, ['LAO', 'COLLECTOR', 'DISTRICT_STAFF', 'TEHSILDAR'], 'Filing an objection');
    return this.db.withScope(user, async (tx) => {
      const [o] = await tx
        .insert(objections)
        .values({
          projectId,
          personId: body.personId ?? null,
          parcelId: body.parcelId ?? null,
          channel: body.channel,
          filedAt: this.clock.now(),
          language: body.language ?? null,
          body: body.body,
          status: 'FILED',
        })
        .returning();
      await writeOutbox(tx, {
        type: 'OBJECTION_FILED',
        aggregateType: 'objection',
        aggregateId: o!.id,
        payload: { projectId, channel: body.channel },
      });
      await this.audit.record({ action: 'OBJECTION_FILED', entityType: 'objection', entityId: o!.id, after: o });
      return o;
    });
  }

  listObjections(user: AuthUser, projectId: string) {
    return this.db.withScope(user, (tx) =>
      tx.select().from(objections).where(eq(objections.projectId, projectId)).orderBy(objections.filedAt),
    );
  }

  /** AI triage → ai_suggested_* only (G3). */
  triage(user: AuthUser, id: string) {
    requireRole(user, ['LAO', 'COLLECTOR', 'DISTRICT_STAFF'], 'Triaging an objection');
    return this.db.withScope(user, async (tx) => {
      const [o] = await tx.select().from(objections).where(eq(objections.id, id));
      if (!o) throw new ProblemException(404, 'OBJECTION_NOT_FOUND', 'No such objection.');
      const s = triageObjection(o.body);
      const [after] = await tx
        .update(objections)
        .set({
          aiSuggestedGround: s.ground,
          aiSuggestedCategory: s.category,
          aiConfidence: String(s.confidence),
          language: o.language ?? s.language,
        })
        .where(eq(objections.id, id))
        .returning();
      await this.audit.record({
        action: 'OBJECTION_TRIAGED',
        entityType: 'objection',
        entityId: id,
        after: { ...s, provider: 'MOCK' },
      });
      return { ...after, suggestion: { ...s, provider: 'MOCK', advisory: true } };
    });
  }

  /** The officer's classification (copies or overrides the suggestion) — the authoritative value. */
  classify(
    user: AuthUser,
    id: string,
    body: { statutoryGround: ObjectionGround; operationalCategory: ObjectionCategory },
  ) {
    requireRole(user, ['LAO', 'COLLECTOR'], 'Classifying an objection');
    return this.db.withScope(user, async (tx) => {
      const [after] = await tx
        .update(objections)
        .set({ statutoryGround: body.statutoryGround, operationalCategory: body.operationalCategory })
        .where(eq(objections.id, id))
        .returning();
      if (!after) throw new ProblemException(404, 'OBJECTION_NOT_FOUND', 'No such objection.');
      await this.audit.record({ action: 'OBJECTION_CLASSIFIED', entityType: 'objection', entityId: id, after: body });
      return after;
    });
  }

  schedule(user: AuthUser, id: string, hearingId: string) {
    requireRole(user, ['LAO', 'COLLECTOR'], 'Scheduling an objection hearing');
    return this.db.withScope(user, async (tx) => {
      const [after] = await tx
        .update(objections)
        .set({ hearingId, status: 'SCHEDULED' })
        .where(eq(objections.id, id))
        .returning();
      if (!after) throw new ProblemException(404, 'OBJECTION_NOT_FOUND', 'No such objection.');
      await this.audit.record({
        action: 'OBJECTION_SCHEDULED',
        entityType: 'objection',
        entityId: id,
        after: { hearingId },
      });
      return after;
    });
  }

  decide(user: AuthUser, id: string, body: { decision: 'UPHELD' | 'REJECTED'; remarks: string }) {
    requireRole(user, ['LAO', 'COLLECTOR'], 'Deciding an objection');
    return this.db.withScope(user, async (tx) => {
      const [o] = await tx.select().from(objections).where(eq(objections.id, id));
      if (!o) throw new ProblemException(404, 'OBJECTION_NOT_FOUND', 'No such objection.');
      if (!o.statutoryGround)
        throw new ProblemException(
          409,
          'NOT_CLASSIFIED',
          'Classify the objection (statutory ground) before deciding it.',
        );
      const [after] = await tx
        .update(objections)
        .set({
          status: body.decision,
          decisionRemarks: body.remarks,
          decidedByPostId: user.post.id,
          decidedAt: this.clock.now(),
        })
        .where(and(eq(objections.id, id)))
        .returning();
      await this.audit.record({ action: 'OBJECTION_DECIDED', entityType: 'objection', entityId: id, before: o, after });
      return after;
    });
  }

  /** s.11 draft (§18.2): the schedule of survey numbers and the particulars an officer reviews. */
  s11Draft(user: AuthUser, projectId: string) {
    return this.db.withScope(user, async (tx) => {
      const { project, pack } = await projectPack(tx, this.rules, projectId);
      const schedule = await rows(
        tx,
        sql`SELECT v.name AS village, v.code AS village_code, d.name AS district, lp.survey_number || coalesce('/' || lp.sub_division, '') AS survey_no,
                   pp.affected_area_sqm, lp.land_class
            FROM project_parcels pp JOIN land_parcels lp ON lp.id = pp.parcel_id JOIN villages v ON v.code = lp.village_code
            JOIN sub_districts sd ON sd.code = v.sub_district_code JOIN districts d ON d.code = sd.district_code
            WHERE pp.project_id = ${projectId} ORDER BY d.name, v.name, lp.survey_number, lp.sub_division`,
      );
      const admin = await rows(
        tx,
        sql`SELECT po.designation FROM posts po WHERE po.role = 'RNR_ADMINISTRATOR' AND po.district_code = ANY(project_district_codes(${projectId}::uuid))`,
      );
      const sia = await rows(
        tx,
        sql`SELECT d.id, d.title, d.sha256 FROM documents d WHERE d.project_id = ${projectId} AND d.doc_type IN ('SIA_REPORT_FINAL','SIMP_FINAL')`,
      );
      return {
        section: '11',
        rulePack: `${pack.code}@${pack.version}`,
        purpose: `${project.name} (${project.category}${project.subCategory ? ` — ${project.subCategory}` : ''})`,
        administrator: admin.map((a) => (a as { designation: string }).designation),
        siaDocuments: sia,
        schedule,
        publicationChecklist: [
          'GAZETTE_COPY',
          'NEWSPAPER_CLIPPING (two, one in the local language)',
          'AFFIXATION_CERTIFICATE',
          'Website upload',
        ],
        note: 'Draft assembled for officer review; publish by approving S05 (emits S11_PUBLISHED).',
      };
    });
  }
}
