import { monitoringAudits, severanceClaims, utilisationAudits, valueSharingEvents } from '@bhoomisetu/db';
import { rupeesToPaise } from '@bhoomisetu/shared';
import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth-user';
import { ClockService } from '../common/clock/clock.service';
import { DbService } from '../common/db/db.service';
import { rows } from '../common/db/raw';
import { ProblemException } from '../common/errors/problem';
import { requireRole } from '../common/roles';

/** Module I — long-term compliance (§23): annuities, severance, utilisation, value sharing, monitoring. */
@Injectable()
export class ComplianceService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  annuities(user: AuthUser, projectId?: string) {
    return this.db.withScope(user, async (tx) => ({
      summary: await rows(
        tx,
        sql`SELECT af.project_id, p.code AS project_code,
                   count(DISTINCT s.entitlement_id)::int AS families_on_annuity,
                   count(*) FILTER (WHERE s.status = 'paid')::int AS paid,
                   count(*) FILTER (WHERE s.status = 'missed')::int AS missed,
                   count(*) FILTER (WHERE s.status = 'scheduled' AND date_trunc('month', s.due_on) = date_trunc('month', (app_now() AT TIME ZONE statutory_tz())::date))::int AS due_this_month
            FROM annuity_schedules s JOIN entitlements e ON e.id = s.entitlement_id JOIN affected_families af ON af.id = e.affected_family_id
            JOIN projects p ON p.id = af.project_id
            WHERE (${projectId ?? null}::uuid IS NULL OR af.project_id = ${projectId ?? null}::uuid) GROUP BY 1, 2`,
      ),
      missed: await rows(
        tx,
        sql`SELECT s.id, s.entitlement_id, s.instalment_no, s.due_on, s.amount_paise FROM annuity_schedules s WHERE s.status = 'missed' ORDER BY s.due_on LIMIT 100`,
      ),
    }));
  }

  severance(user: AuthUser, projectParcelId: string, inspectionDocumentId?: string | null) {
    requireRole(user, ['LAO', 'COLLECTOR'], 'Recording a severance claim (s.94)');
    return this.db.withScope(user, async (tx) => {
      const [c] = await tx
        .insert(severanceClaims)
        .values({ projectParcelId, filedAt: this.clock.now(), inspectionDocumentId: inspectionDocumentId ?? null })
        .returning();
      await tx.execute(sql`UPDATE project_parcels SET severance_claimed = true WHERE id = ${projectParcelId}`);
      await this.audit.record({
        action: 'SEVERANCE_CLAIMED',
        entityType: 'severance_claim',
        entityId: c!.id,
        after: c,
      });
      return c;
    });
  }

  decideSeverance(user: AuthUser, id: string, decision: 'acquire_whole' | 's28_damages' | 'rejected') {
    requireRole(user, ['COLLECTOR'], 'Deciding a severance claim');
    return this.db.withScope(user, async (tx) => {
      const [after] = await tx
        .update(severanceClaims)
        .set({ decision, decidedAt: this.clock.now() })
        .where(eq(severanceClaims.id, id))
        .returning();
      if (!after) throw new ProblemException(404, 'CLAIM_NOT_FOUND', 'No such severance claim.');
      await this.audit.record({ action: 'SEVERANCE_DECIDED', entityType: 'severance_claim', entityId: id, after });
      return after;
    });
  }

  utilisation(user: AuthUser) {
    return this.db.withScope(user, (tx) =>
      rows(
        tx,
        sql`SELECT b.*, ua.status AS audit_status, ua.finding, ua.reversion FROM v_deadline_board b
            LEFT JOIN utilisation_audits ua ON ua.project_parcel_id = b.subject_id
            WHERE b.clock_code = 'UTILISATION' ORDER BY b.days_remaining LIMIT 500`,
      ),
    );
  }

  utilisationAudit(
    user: AuthUser,
    projectParcelId: string,
    body: {
      status: 'utilised' | 'unutilised';
      finding: string;
      reversion?: 'owner' | 'land_bank' | 'custody_transfer' | null;
    },
  ) {
    requireRole(user, ['COLLECTOR', 'MONITORING_COMMITTEE'], 'Recording a utilisation audit (s.101)');
    return this.db.withScope(user, async (tx) => {
      const d = await rows<{ due_at: Date }>(
        tx,
        sql`SELECT due_at FROM statutory_deadlines WHERE subject_id = ${projectParcelId} AND clock_code = 'UTILISATION' LIMIT 1`,
      );
      const [a] = await tx
        .insert(utilisationAudits)
        .values({
          projectParcelId,
          dueAt: d[0]?.due_at ?? this.clock.now(),
          status: body.status,
          finding: body.finding,
          reversion: body.reversion ?? null,
        })
        .returning();
      if (body.status === 'utilised') {
        await tx.execute(
          sql`UPDATE statutory_deadlines SET status = 'SATISFIED', satisfied_at = app_now() WHERE subject_id = ${projectParcelId} AND clock_code = 'UTILISATION' AND status NOT IN ('SATISFIED','WAIVED','VOIDED')`,
        );
      }
      await this.audit.record({
        action: 'UTILISATION_AUDITED',
        entityType: 'utilisation_audit',
        entityId: a!.id,
        after: a,
      });
      return a;
    });
  }

  /** s.102 value sharing: the officer ENTERS the appreciated value and the share (G1/G2 — nothing computed here). */
  valueSharing(
    user: AuthUser,
    projectParcelId: string,
    body: {
      transferDate: string;
      considerationRupees: string | number;
      appreciatedValueRupees: string | number;
      shareRupees: string | number;
    },
  ) {
    requireRole(user, ['COLLECTOR', 'LAO'], 'Recording a value-sharing event (s.102)');
    return this.db.withScope(user, async (tx) => {
      const [v] = await tx
        .insert(valueSharingEvents)
        .values({
          projectParcelId,
          transferDate: body.transferDate,
          considerationPaise: rupeesToPaise(body.considerationRupees),
          appreciatedValuePaise: rupeesToPaise(body.appreciatedValueRupees),
          sharePaise: rupeesToPaise(body.shareRupees),
          confirmedByPostId: user.post.id,
        })
        .returning();
      await this.audit.record({
        action: 'VALUE_SHARING_RECORDED',
        entityType: 'value_sharing_event',
        entityId: v!.id,
        after: v,
      });
      return v;
    });
  }

  monitoringAudit(
    user: AuthUser,
    projectId: string,
    body: { committee: 'national' | 'state'; period: string; reportDocumentId?: string | null; findings?: unknown },
  ) {
    requireRole(
      user,
      ['MONITORING_COMMITTEE', 'STATE_REVENUE', 'CENTRAL_VIEWER'],
      'Recording a monitoring audit (ss.48–50)',
    );
    return this.db.withScope(user, async (tx) => {
      const [m] = await tx
        .insert(monitoringAudits)
        .values({
          projectId,
          committee: body.committee,
          period: body.period,
          reportDocumentId: body.reportDocumentId ?? null,
          findings: body.findings ?? null,
        })
        .returning();
      await this.audit.record({
        action: 'MONITORING_AUDIT',
        entityType: 'monitoring_audit',
        entityId: m!.id,
        after: m,
      });
      return m;
    });
  }
}
