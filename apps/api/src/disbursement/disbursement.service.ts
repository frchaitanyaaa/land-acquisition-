import {
  accessTokens,
  acknowledgements,
  disbursements,
  entitlements,
  legalCases,
  possessionEvents,
  projectParcels,
  statutoryDeadlines,
  type Tx,
} from '@bhoomisetu/db';
import { possessionGate, runChecks, startClock, type GateEntitlement, type GateFamily } from '@bhoomisetu/rules';
import { rupeesToPaise, tagEntity, type Role } from '@bhoomisetu/shared';
import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { PaymentService } from '../adapters/payment/payment.adapter';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth-user';
import { ClockService } from '../common/clock/clock.service';
import { DbService } from '../common/db/db.service';
import { one, rows } from '../common/db/raw';
import { ProblemException } from '../common/errors/problem';
import { idempotent } from '../common/idempotency/idempotency';
import { writeOutbox } from '../common/outbox/outbox';
import { projectPack } from '../common/project-pack';
import { env } from '../config/env';
import { RulesService } from '../rules/rules.service';
import { newToken } from './tokens';

const PAY_ROLES: Role[] = ['LAO', 'TREASURY_OFFICER', 'SUPER_ADMIN'];
const HOLD_ROLES: Role[] = ['LAO', 'COLLECTOR', 'TREASURY_OFFICER', 'SUPER_ADMIN'];
const FIELD_ROLES: Role[] = ['LAO', 'COLLECTOR', 'TEHSILDAR', 'FIELD_OFFICER', 'RNR_ADMINISTRATOR', 'SUPER_ADMIN'];
const POSSESSION_ROLES: Role[] = ['LAO', 'COLLECTOR', 'SUPER_ADMIN'];
const ENROL_LINK_MIN = 30;
const ACK_LINK_DAYS = 30;
const MINUTE = 60_000;

function requireRole(user: AuthUser, roles: Role[], what: string) {
  if (!roles.includes(user.post.role))
    throw new ProblemException(403, 'ROLE_NOT_PERMITTED', `${what} needs one of: ${roles.join(', ')}.`, {
      requiredRoles: roles,
    });
}

/** Module G — disbursement, holds, deposits, acknowledgement links, fallbacks, possession (§21). */
@Injectable()
export class DisbursementService {
  constructor(
    private readonly db: DbService,
    private readonly rules: RulesService,
    private readonly payments: PaymentService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  private async entitlementCtx(tx: Tx, entitlementId: string) {
    const e = await one<{
      id: string;
      affected_family_id: string;
      project_id: string;
      head_code: string;
      amount: string;
      status: string;
      award_status: string;
      is_sc_st: boolean;
      paid: string;
      pending: string;
      bank_ref_masked: string | null;
      person_id: string;
    }>(
      tx,
      sql`SELECT e.id, e.affected_family_id, af.project_id, e.head_code, e.amount_awarded_paise::text AS amount, e.status,
                 a.status AS award_status, af.is_sc_st, pe.bank_ref_masked, pe.id AS person_id,
                 (SELECT coalesce(sum(amount_paise),0)::text FROM disbursements d WHERE d.entitlement_id = e.id AND d.payment_status = 'SUCCESS') AS paid,
                 (SELECT coalesce(sum(amount_paise),0)::text FROM disbursements d WHERE d.entitlement_id = e.id AND d.payment_status IN ('INITIATED','PENDING')) AS pending
          FROM entitlements e JOIN awards a ON a.id = e.award_id JOIN affected_families af ON af.id = e.affected_family_id
          JOIN persons pe ON pe.id = af.authorised_recipient_person_id
          WHERE e.id = ${entitlementId}`,
    );
    if (!e) throw new ProblemException(404, 'ENTITLEMENT_NOT_FOUND', 'No such entitlement in your jurisdiction.');
    return e;
  }

  /** §21.1. Idempotency-Key is REQUIRED (payment endpoint, §13). */
  disburse(
    user: AuthUser,
    entitlementId: string,
    idemKey: string | undefined,
    body: {
      amountRupees?: string | number | null;
      isFirstInstalment: boolean;
      acceptanceType: 'ABSOLUTE' | 'UNDER_PROTEST';
      indemnityBondDocumentId?: string | null;
    },
  ) {
    requireRole(user, PAY_ROLES, 'Initiating a disbursement');
    return this.db.withScope(user, (tx) =>
      idempotent(
        tx,
        user,
        idemKey,
        `disburse:${entitlementId}`,
        body,
        async () => {
          const e = await this.entitlementCtx(tx, entitlementId);
          if (e.award_status !== 'signed')
            throw new ProblemException(409, 'AWARD_NOT_SIGNED', 'Only amounts in a signed award can be paid.');
          if (['DEPOSITED_WITH_AUTHORITY', 'DISPUTED'].includes(e.status))
            throw new ProblemException(409, 'ENTITLEMENT_BLOCKED', `Entitlement is ${e.status}.`);
          const remaining = BigInt(e.amount) - BigInt(e.paid) - BigInt(e.pending);
          const amount = body.amountRupees != null ? rupeesToPaise(body.amountRupees) : remaining;
          if (amount <= 0n || amount > remaining) {
            throw new ProblemException(
              422,
              'AMOUNT_INVALID',
              'Amount must be positive and within the unpaid balance.',
              { remainingPaise: remaining.toString() },
            );
          }
          // s.41: SC/ST first instalment ≥ the pack's fraction of the family's land compensation.
          if (body.isFirstInstalment && e.is_sc_st) {
            const { pack } = await projectPack(tx, this.rules, e.project_id);
            const heads = await rows<{ head_code: string; amount: string }>(
              tx,
              sql`SELECT head_code, amount_awarded_paise::text AS amount FROM entitlements WHERE affected_family_id = ${e.affected_family_id}`,
            );
            const r = runChecks(pack, {
              heads: heads.map((h) => ({ headCode: h.head_code, amountPaise: BigInt(h.amount) })),
              isScSt: true,
              firstInstalmentPaise: amount,
            });
            const fail = r.find((c) => c.code === 'SC_ST_FIRST_INSTALMENT' && c.status === 'FAIL');
            if (fail) throw new ProblemException(422, 'SC_ST_FIRST_INSTALMENT', fail.message);
          }
          const now = this.clock.now();
          const [d] = await tx
            .insert(disbursements)
            .values({
              entitlementId,
              amountPaise: amount,
              instrument: 'DBT',
              initiatedAt: now,
              paymentStatus: 'INITIATED',
              isFirstInstalment: body.isFirstInstalment,
              acceptanceType: body.acceptanceType,
              indemnityBondDocumentId: body.indemnityBondDocumentId ?? null,
            })
            .returning();
          const res = await this.payments.initiate({
            disbursementId: d!.id,
            amountPaise: amount,
            beneficiaryRef: e.bank_ref_masked,
          });
          const [after] = await tx
            .update(disbursements)
            .set({ paymentStatus: res.status, adapterRef: res.ref, adapterProvider: res.provider })
            .where(eq(disbursements.id, d!.id))
            .returning();
          await this.audit.record({
            action: 'DISBURSEMENT_INITIATED',
            entityType: 'disbursement',
            entityId: d!.id,
            after,
          });
          return after;
        },
        { required: true },
      ),
    );
  }

  hold(user: AuthUser, disbursementId: string, body: { reasonCode: string; reason: string }) {
    requireRole(user, HOLD_ROLES, 'Holding a payment');
    return this.db.withScope(user, async (tx) => {
      const [d] = await tx.select().from(disbursements).where(eq(disbursements.id, disbursementId));
      if (!d) throw new ProblemException(404, 'DISBURSEMENT_NOT_FOUND', 'No such disbursement.');
      if (d.paymentStatus === 'SUCCESS')
        throw new ProblemException(409, 'ALREADY_PAID', 'A completed payment cannot be held.');
      const [after] = await tx
        .update(disbursements)
        .set({ holdReasonCode: body.reasonCode, holdReason: body.reason })
        .where(eq(disbursements.id, disbursementId))
        .returning();
      await this.audit.record({
        action: 'DISBURSEMENT_HELD',
        entityType: 'disbursement',
        entityId: disbursementId,
        before: d,
        after,
      });
      return after;
    });
  }

  release(user: AuthUser, disbursementId: string) {
    requireRole(user, HOLD_ROLES, 'Releasing a hold');
    return this.db.withScope(user, async (tx) => {
      const [d] = await tx.select().from(disbursements).where(eq(disbursements.id, disbursementId));
      if (!d) throw new ProblemException(404, 'DISBURSEMENT_NOT_FOUND', 'No such disbursement.');
      const [after] = await tx
        .update(disbursements)
        .set({ holdReasonCode: null, holdReason: null })
        .where(eq(disbursements.id, disbursementId))
        .returning();
      await this.audit.record({
        action: 'DISBURSEMENT_RELEASED',
        entityType: 'disbursement',
        entityId: disbursementId,
        before: d,
        after,
      });
      return after;
    });
  }

  /** s.77 deposit with the Authority (refusal, incapacity, title/apportionment dispute). */
  depositWithAuthority(user: AuthUser, entitlementId: string, body: { reason: string; openReference: boolean }) {
    requireRole(user, PAY_ROLES, 'Depositing with the Authority');
    return this.db.withScope(user, async (tx) => {
      const e = await this.entitlementCtx(tx, entitlementId);
      if (e.award_status !== 'signed')
        throw new ProblemException(409, 'AWARD_NOT_SIGNED', 'Only amounts in a signed award can be deposited.');
      const remaining = BigInt(e.amount) - BigInt(e.paid);
      if (remaining <= 0n)
        throw new ProblemException(409, 'NOTHING_DUE', 'Nothing remains unpaid on this entitlement.');
      const now = this.clock.now();
      // Any pending DBT attempt is superseded by the deposit.
      await tx.execute(sql`UPDATE disbursements SET payment_status = 'FAILED', hold_reason_code = coalesce(hold_reason_code, 'SUPERSEDED_BY_DEPOSIT')
                           WHERE entitlement_id = ${entitlementId} AND payment_status IN ('INITIATED','PENDING')`);
      const [d] = await tx
        .insert(disbursements)
        .values({
          entitlementId,
          amountPaise: remaining,
          instrument: 'DEPOSIT_WITH_AUTHORITY',
          initiatedAt: now,
          paidOn: now.toISOString().slice(0, 10),
          paymentStatus: 'SUCCESS',
          adapterProvider: 'AUTHORITY_DEPOSIT',
        })
        .returning();
      await tx
        .update(entitlements)
        .set({ status: 'DEPOSITED_WITH_AUTHORITY' })
        .where(eq(entitlements.id, entitlementId));
      let legalCase = null;
      if (body.openReference) {
        [legalCase] = await tx
          .insert(legalCases)
          .values({
            projectId: e.project_id,
            personId: e.person_id,
            caseType: 'S64_REFERENCE',
            filedAt: now,
            status: 'filed',
          })
          .returning();
      }
      await this.onPaid(tx, e.project_id, entitlementId, now);
      await this.audit.record({
        action: 'DEPOSITED_WITH_AUTHORITY',
        entityType: 'entitlement',
        entityId: entitlementId,
        after: { disbursement: d, reason: body.reason, legalCase },
      });
      return { disbursement: d, legalCase };
    });
  }

  /** ENTITLEMENT_PAID: satisfies that entitlement's payment clock (s.38). Shared with the payment job. */
  async onPaid(tx: Tx, projectId: string, entitlementId: string, at: Date) {
    await tx.execute(sql`UPDATE statutory_deadlines SET status = 'SATISFIED', satisfied_at = ${at}
                         WHERE subject_type = 'ENTITLEMENT' AND subject_id = ${entitlementId} AND status NOT IN ('SATISFIED','WAIVED','VOIDED')`);
    await writeOutbox(tx, {
      type: 'ENTITLEMENT_PAID',
      aggregateType: 'entitlement',
      aggregateId: entitlementId,
      payload: { projectId, entitlementId, at },
    });
  }

  // ------------------------------------------------------------------ links (§21.2)

  enrolLink(user: AuthUser, personId: string) {
    requireRole(user, FIELD_ROLES, 'Creating an enrolment link');
    return this.db.withScope(user, async (tx) => {
      const person = await one<{ id: string }>(tx, sql`SELECT id FROM persons WHERE id = ${personId}`);
      if (!person) throw new ProblemException(404, 'PERSON_NOT_FOUND', 'No such person in your jurisdiction.');
      const { token, hash } = newToken();
      const expiresAt = new Date(this.clock.realNow().getTime() + ENROL_LINK_MIN * MINUTE);
      // Real-clock expiry: a frozen demo clock must not keep links alive forever.
      await tx.insert(accessTokens).values({
        purpose: 'enrol',
        personId,
        tokenHash: hash,
        expiresAt: this.shiftToAppClock(expiresAt),
        issuedByPostId: user.post.id,
      });
      await this.audit.record({ action: 'ENROL_LINK_ISSUED', entityType: 'person', entityId: personId });
      return { url: `${env().PUBLIC_BASE_URL}/enrol/${token}`, token, expiresInMinutes: ENROL_LINK_MIN };
    });
  }

  ackLink(user: AuthUser, disbursementId: string) {
    requireRole(user, FIELD_ROLES, 'Creating an acknowledgement link');
    return this.db.withScope(user, async (tx) => this.issueAckLink(tx, disbursementId, user.post.id));
  }

  async issueAckLink(tx: Tx, disbursementId: string, issuedByPostId: string | null) {
    const d = await one<{ id: string; status: string; person_id: string; instrument: string }>(
      tx,
      sql`SELECT d.id, d.payment_status AS status, d.instrument, af.authorised_recipient_person_id AS person_id
          FROM disbursements d JOIN entitlements e ON e.id = d.entitlement_id JOIN affected_families af ON af.id = e.affected_family_id
          WHERE d.id = ${disbursementId}`,
    );
    if (!d) throw new ProblemException(404, 'DISBURSEMENT_NOT_FOUND', 'No such disbursement.');
    if (d.status !== 'SUCCESS' || d.instrument !== 'DBT')
      throw new ProblemException(409, 'NOT_PAYABLE', 'Only a successful DBT payment is acknowledged by the family.');
    const { token, hash } = newToken();
    const expiresAt = new Date(this.clock.now().getTime() + ACK_LINK_DAYS * 24 * 60 * MINUTE);
    await tx.insert(accessTokens).values({
      purpose: 'acknowledge',
      personId: d.person_id,
      subjectId: disbursementId,
      tokenHash: hash,
      expiresAt,
      issuedByPostId,
    });
    return { url: `${env().PUBLIC_BASE_URL}/ack/${token}`, token, personId: d.person_id };
  }

  passbookLink(user: AuthUser, familyId: string) {
    requireRole(user, [...FIELD_ROLES, 'RNR_COMMISSIONER'], 'Issuing a passbook link');
    return this.db.withScope(user, async (tx) => {
      const f = await one<{ head_person_id: string }>(
        tx,
        sql`SELECT head_person_id FROM affected_families WHERE id = ${familyId}`,
      );
      if (!f) throw new ProblemException(404, 'FAMILY_NOT_FOUND', 'No such family.');
      const { token, hash } = newToken();
      await tx.insert(accessTokens).values({
        purpose: 'passbook',
        personId: f.head_person_id,
        subjectId: familyId,
        tokenHash: hash,
        expiresAt: new Date(this.clock.now().getTime() + 90 * 24 * 60 * MINUTE),
        issuedByPostId: user.post.id,
      });
      await this.audit.record({ action: 'PASSBOOK_ISSUED', entityType: 'affected_family', entityId: familyId });
      return { url: `${env().PUBLIC_BASE_URL}/passbook/${token}`, token };
    });
  }

  /** Access-token expiry is compared with app_now(); express a real-clock horizon on the app clock. */
  private shiftToAppClock(realExpiry: Date): Date {
    return new Date(this.clock.now().getTime() + (realExpiry.getTime() - this.clock.realNow().getTime()));
  }

  /** OFFICER_ATTESTED fallback (§21.2): witness post, reason, geo-tagged photo — never for WebAuthn. */
  attestFallback(
    user: AuthUser,
    disbursementId: string,
    body: { fallbackReason: string; photoDocumentId?: string | null; lat?: number | null; lng?: number | null },
  ) {
    requireRole(user, FIELD_ROLES, 'Recording an officer-attested acknowledgement');
    return this.db.withScope(user, async (tx) => {
      const [d] = await tx.select().from(disbursements).where(eq(disbursements.id, disbursementId));
      if (!d) throw new ProblemException(404, 'DISBURSEMENT_NOT_FOUND', 'No such disbursement.');
      if (d.paymentStatus !== 'SUCCESS' || d.instrument !== 'DBT')
        throw new ProblemException(409, 'NOT_PAYABLE', 'Only a successful DBT payment can be acknowledged.');
      const now = this.clock.now();
      const point =
        body.lat != null && body.lng != null
          ? (sql`ST_SetSRID(ST_MakePoint(${body.lng}, ${body.lat}), 4326)` as unknown as string)
          : null;
      const [ack] = await tx
        .insert(acknowledgements)
        .values({
          disbursementId,
          method: 'OFFICER_ATTESTED',
          witnessPostId: user.post.id,
          fallbackReason: body.fallbackReason,
          photoDocumentId: body.photoDocumentId ?? null,
          point,
          confirmedAt: now,
        })
        .returning({
          id: acknowledgements.id,
          method: acknowledgements.method,
          confirmedAt: acknowledgements.confirmedAt,
        });
      await tx.execute(sql`UPDATE entitlements e SET status = 'ACKNOWLEDGED' WHERE e.id = ${d.entitlementId} AND e.status = 'DISBURSED'
                           AND NOT EXISTS (SELECT 1 FROM disbursements x WHERE x.entitlement_id = e.id AND x.payment_status = 'SUCCESS' AND x.instrument = 'DBT'
                                           AND NOT EXISTS (SELECT 1 FROM acknowledgements a WHERE a.disbursement_id = x.id))`);
      await writeOutbox(tx, {
        type: 'COMPENSATION_ACKNOWLEDGED',
        aggregateType: 'acknowledgement',
        aggregateId: ack!.id,
        payload: {
          acknowledgementId: ack!.id,
          disbursementId,
          method: 'OFFICER_ATTESTED',
          witnessPostId: user.post.id,
          confirmedAt: now,
        },
      });
      await this.audit.record({
        action: 'COMPENSATION_ACKNOWLEDGED',
        entityType: 'acknowledgement',
        entityId: ack!.id,
        after: { ...ack, fallbackReason: body.fallbackReason },
      });
      return ack;
    });
  }

  // ------------------------------------------------------------------ family money view

  familyMoney(user: AuthUser, familyId: string) {
    return this.db.withScope(user, async (tx) => {
      const money = await one(tx, sql`SELECT * FROM v_family_money WHERE affected_family_id = ${familyId}`);
      if (!money) throw new ProblemException(404, 'FAMILY_NOT_FOUND', 'No such family in your jurisdiction.');
      const family = await one(
        tx,
        sql`SELECT af.*, pe.full_name AS head_name, pe.phone_masked, p.code AS project_code, p.name AS project_name,
                   EXISTS (SELECT 1 FROM webauthn_credentials c WHERE c.person_id = af.authorised_recipient_person_id AND c.revoked_at IS NULL) AS has_passkey
            FROM affected_families af JOIN persons pe ON pe.id = af.head_person_id JOIN projects p ON p.id = af.project_id WHERE af.id = ${familyId}`,
      );
      const items = await rows<Record<string, unknown>>(
        tx,
        sql`SELECT e.id AS entitlement_id, e.head_code, e.schedule_ref, e.amount_awarded_paise, e.status, e.due_by, a.award_no, a.award_type,
                   coalesce((SELECT jsonb_agg(jsonb_build_object(
                       'id', d.id, 'amountPaise', d.amount_paise::text, 'instrument', d.instrument, 'paymentStatus', d.payment_status,
                       'paidOn', d.paid_on, 'initiatedAt', d.initiated_at, 'acceptanceType', d.acceptance_type, 'adapterProvider', d.adapter_provider,
                       'holdReasonCode', d.hold_reason_code, 'holdReason', d.hold_reason,
                       'acknowledgement', (SELECT jsonb_build_object('method', ak.method, 'confirmedAt', ak.confirmed_at) FROM acknowledgements ak WHERE ak.disbursement_id = d.id))
                     ORDER BY d.initiated_at) FROM disbursements d WHERE d.entitlement_id = e.id), '[]'::jsonb) AS disbursements
            FROM entitlements e JOIN awards a ON a.id = e.award_id WHERE e.affected_family_id = ${familyId} ORDER BY a.award_type, e.head_code`,
      );
      const interest = await one(
        tx,
        sql`SELECT coalesce(sum(estimated_interest_paise),0)::bigint AS estimated_interest_paise FROM v_interest_liability i
            JOIN entitlements e ON e.id = i.entitlement_id WHERE e.affected_family_id = ${familyId}`,
      );
      // Hold reasons are restricted (§11.4): tag each disbursement for the redaction interceptor.
      for (const it of items) {
        it.disbursements = (it.disbursements as Array<Record<string, unknown>>).map((d) =>
          tagEntity('disbursement', d),
        );
      }
      return {
        family,
        money,
        entitlements: items,
        estimatedInterestLiability: interest,
        label: 'Estimated interest liability (s.80)',
      };
    });
  }

  projectFamilies(user: AuthUser, projectId: string, q: { state?: string; limit: number }) {
    return this.db.withScope(user, (tx) =>
      rows(
        tx,
        sql`SELECT af.id, af.affected_type, af.is_displaced, af.is_sc_st, pe.full_name AS head_name, pe.village_code, m.*,
                   CASE WHEN m.assessed_paise = 0 THEN 'NOT_AWARDED'
                        WHEN m.acknowledged_paise + m.deposited_paise >= m.assessed_paise AND m.assessed_paise > 0 THEN 'ACKNOWLEDGED'
                        WHEN m.unconfirmed_paise > 0 THEN 'DISBURSED_NOT_ACKNOWLEDGED'
                        WHEN m.disbursed_paise + m.deposited_paise > 0 THEN 'PART_PAID'
                        ELSE 'UNPAID' END AS money_state
            FROM affected_families af JOIN persons pe ON pe.id = af.head_person_id JOIN v_family_money m ON m.affected_family_id = af.id
            WHERE af.project_id = ${projectId}
            ORDER BY m.unconfirmed_paise DESC, pe.full_name LIMIT ${q.limit}`,
      ),
    );
  }

  // ------------------------------------------------------------------ possession (§21.3)

  private async gateInput(tx: Tx, projectParcelId: string) {
    const pp = await one<{ id: string; project_id: string; parcel_id: string; status: string }>(
      tx,
      sql`SELECT id, project_id, parcel_id, status FROM project_parcels WHERE id = ${projectParcelId}`,
    );
    if (!pp)
      throw new ProblemException(404, 'PROJECT_PARCEL_NOT_FOUND', 'No such project parcel in your jurisdiction.');
    const { pack } = await projectPack(tx, this.rules, pp.project_id);
    const fams = await rows<{ id: string; is_displaced: boolean; readiness: string | null }>(
      tx,
      sql`SELECT DISTINCT af.id, af.is_displaced,
                 (SELECT round(100.0 * count(*) FILTER (WHERE m.status = 'complete') / nullif(count(*), 0)) FROM amenity_milestones m WHERE m.site_id = af.resettlement_site_id) AS readiness
          FROM parcel_interests pi JOIN affected_families af ON af.head_person_id = pi.person_id AND af.project_id = ${pp.project_id}
          WHERE pi.parcel_id = ${pp.parcel_id}`,
    );
    const ents = await rows<{
      id: string;
      family_id: string;
      head_code: string;
      status: GateEntitlement['status'];
      payment_status: GateEntitlement['paymentStatus'];
    }>(
      tx,
      sql`SELECT e.id, e.affected_family_id AS family_id, e.head_code, e.status,
                 (SELECT d.payment_status FROM disbursements d WHERE d.entitlement_id = e.id ORDER BY d.initiated_at DESC LIMIT 1) AS payment_status
          FROM entitlements e WHERE e.affected_family_id = ANY(string_to_array(${fams.map((f) => f.id).join(',')}, ',')::uuid[])`,
    );
    const vacation = await one<{ ok: boolean }>(
      tx,
      sql`SELECT EXISTS (SELECT 1 FROM documents d JOIN attestations a ON a.document_id = d.id
                         WHERE d.doc_type = 'VACATION_CERTIFICATE' AND d.entity_id IN (${projectParcelId}::uuid, ${pp.parcel_id}::uuid)) AS ok`,
    );
    const stay = await one<{ ok: boolean }>(
      tx,
      sql`SELECT EXISTS (SELECT 1 FROM legal_cases WHERE parcel_id = ${pp.parcel_id} AND case_type = 'WRIT' AND status IN ('filed','hearing')) AS ok`,
    );
    const families: GateFamily[] = fams.map((f) => ({
      id: f.id,
      isDisplaced: f.is_displaced,
      siteReadinessPct: f.readiness == null ? null : Number(f.readiness),
    }));
    const entitlementsIn: GateEntitlement[] = ents.map((e) => ({
      id: e.id,
      familyId: e.family_id,
      headCode: e.head_code,
      status: e.status,
      paymentStatus: e.payment_status,
    }));
    return {
      pp,
      pack,
      input: {
        entitlements: entitlementsIn,
        families,
        vacationCertificateAttested: !!vacation?.ok,
        legalStay: !!stay?.ok,
      },
    };
  }

  possessionGate(user: AuthUser, projectParcelId: string) {
    return this.db.withScope(user, async (tx) => {
      const { pack, input, pp } = await this.gateInput(tx, projectParcelId);
      return {
        projectParcelId,
        status: pp.status,
        ...possessionGate(pack, input),
        families: input.families.length,
        entitlements: input.entitlements.length,
      };
    });
  }

  takePossession(
    user: AuthUser,
    projectParcelId: string,
    body: {
      panchnamaDocumentId: string;
      noticeDocumentId?: string | null;
      possessionCertificateDocumentId?: string | null;
      handoverDocumentId?: string | null;
      vacationCertificateDocumentId?: string | null;
      witnesses: Array<{ name: string; role?: string }>;
      lat?: number | null;
      lng?: number | null;
      siteExceptionReason?: string | null;
    },
  ) {
    requireRole(user, POSSESSION_ROLES, 'Recording possession');
    return this.db.withScope(user, async (tx) => {
      const { pp, pack, input } = await this.gateInput(tx, projectParcelId);
      if (pp.status === 'ACQUIRED_POSSESSED')
        throw new ProblemException(409, 'ALREADY_POSSESSED', 'Possession is already recorded.');
      // A recorded Collector exception may waive only the site-readiness condition (§12.6).
      if (body.siteExceptionReason?.trim()) {
        if (user.post.role !== 'COLLECTOR' && user.post.role !== 'SUPER_ADMIN')
          throw new ProblemException(
            403,
            'EXCEPTION_NEEDS_COLLECTOR',
            'Only the Collector can record a site-readiness exception.',
          );
        input.families = input.families.map((f) => ({ ...f, siteException: true }));
      }
      const gate = possessionGate(pack, input);
      if (!gate.allowed)
        throw new ProblemException(422, 'POSSESSION_GATE_FAILED', 'Possession cannot be recorded yet (s.38).', {
          failures: gate.failures,
        });
      const now = this.clock.now();
      const point =
        body.lat != null && body.lng != null
          ? (sql`ST_SetSRID(ST_MakePoint(${body.lng}, ${body.lat}), 4326)` as unknown as string)
          : null;
      const [ev] = await tx
        .insert(possessionEvents)
        .values({
          projectParcelId,
          vacationCertificateDocumentId: body.vacationCertificateDocumentId ?? null,
          noticeDocumentId: body.noticeDocumentId ?? null,
          panchnamaDocumentId: body.panchnamaDocumentId,
          possessionCertificateDocumentId: body.possessionCertificateDocumentId ?? null,
          handoverDocumentId: body.handoverDocumentId ?? null,
          witnesses: body.witnesses,
          point,
          takenAt: now,
          takenByPostId: user.post.id,
        })
        .returning({ id: possessionEvents.id, takenAt: possessionEvents.takenAt });
      await tx
        .update(projectParcels)
        .set({ status: 'ACQUIRED_POSSESSED' })
        .where(eq(projectParcels.id, projectParcelId));

      // Clocks: utilisation (s.101) for the parcel; interest step (s.80) for any unpaid entitlement.
      const util = pack.clocks.find((c) => c.startsOn === 'POSSESSION_TAKEN' && c.subject === 'PROJECT_PARCEL');
      if (util) {
        const s = startClock(pack, util.code, now, {}, env().STATUTORY_TZ)!;
        await tx.insert(statutoryDeadlines).values({
          projectId: pp.project_id,
          clockCode: util.code,
          section: util.section,
          subjectType: 'PROJECT_PARCEL',
          subjectId: projectParcelId,
          rulePackCode: pack.code,
          rulePackVersion: pack.version,
          startEvent: 'POSSESSION_TAKEN',
          startedAt: now,
          dueAt: s.dueAt,
          consequence: util.consequence,
          status: 'SAFE',
          conditionInputs: {},
        });
      }
      const interestClock = pack.clocks.find((c) => c.startsOn === 'POSSESSION_TAKEN' && c.subject === 'ENTITLEMENT');
      if (interestClock) {
        const unpaid = await rows<{ id: string }>(
          tx,
          sql`SELECT e.id FROM entitlements e WHERE e.id = ANY(string_to_array(${input.entitlements.map((x) => x.id).join(',')}, ',')::uuid[])
                AND e.amount_awarded_paise > (SELECT coalesce(sum(amount_paise),0) FROM disbursements d WHERE d.entitlement_id = e.id AND d.payment_status = 'SUCCESS')`,
        );
        for (const u of unpaid) {
          const s = startClock(pack, interestClock.code, now, { unpaidAmountExists: true }, env().STATUTORY_TZ);
          if (s)
            await tx.insert(statutoryDeadlines).values({
              projectId: pp.project_id,
              clockCode: interestClock.code,
              section: interestClock.section,
              subjectType: 'ENTITLEMENT',
              subjectId: u.id,
              rulePackCode: pack.code,
              rulePackVersion: pack.version,
              startEvent: 'POSSESSION_TAKEN',
              startedAt: now,
              dueAt: s.dueAt,
              consequence: interestClock.consequence,
              status: 'SAFE',
              conditionInputs: { unpaidAmountExists: true },
            });
        }
      }
      await writeOutbox(tx, {
        type: 'POSSESSION_TAKEN',
        aggregateType: 'project_parcel',
        aggregateId: projectParcelId,
        payload: {
          projectParcelId,
          parcelId: pp.parcel_id,
          projectId: pp.project_id,
          panchnamaDocumentId: body.panchnamaDocumentId,
          takenByPostId: user.post.id,
          takenAt: now,
          siteExceptionReason: body.siteExceptionReason ?? null,
        },
      });
      await this.audit.record({
        action: 'POSSESSION_TAKEN',
        entityType: 'project_parcel',
        entityId: projectParcelId,
        after: { ...ev, siteExceptionReason: body.siteExceptionReason ?? null },
      });
      return { possession: ev, projectParcelId };
    });
  }

  recordMutation(
    user: AuthUser,
    parcelId: string,
    body: {
      direction: 'pre_award_heir' | 'post_possession_transfer';
      fromHolder: string;
      toHolder: string;
      extractDocumentId?: string | null;
    },
  ) {
    requireRole(user, ['TEHSILDAR', 'LAO', 'DILR', 'SUPER_ADMIN'], 'Recording a mutation');
    return this.db.withScope(user, async (tx) => {
      const [row] = await tx
        .execute(
          sql`INSERT INTO mutations (parcel_id, direction, from_holder, to_holder, extract_document_id, recorded_at)
                          VALUES (${parcelId}, ${body.direction}, ${body.fromHolder}, ${body.toHolder}, ${body.extractDocumentId ?? null}, ${this.clock.now()}) RETURNING id`,
        )
        .then((r) => (r as unknown as { rows: Array<{ id: string }> }).rows);
      await this.audit.record({
        action: 'MUTATION_RECORDED',
        entityType: 'land_parcel',
        entityId: parcelId,
        after: body,
      });
      return row;
    });
  }
}
