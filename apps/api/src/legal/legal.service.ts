import { legalCaseEvents, legalCases } from '@bhoomisetu/db';
import { rupeesToPaise, tagEntity } from '@bhoomisetu/shared';
import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth-user';
import { ClockService } from '../common/clock/clock.service';
import { DbService } from '../common/db/db.service';
import { one, rows } from '../common/db/raw';
import { ProblemException } from '../common/errors/problem';
import { writeOutbox } from '../common/outbox/outbox';
import { requireRole } from '../common/roles';

type CaseType = 'S64_REFERENCE' | 'S73_REDETERMINATION' | 'S74_APPEAL' | 'WRIT';
type CaseStatus = 'filed' | 'hearing' | 'decided' | 'appealed' | 'closed';
const LEGAL_ROLES = ['COLLECTOR', 'LAO', 'LEGAL_CELL', 'STATE_REVENUE'] as const;

/** Module H — LARR Authority cases (§22). Every legal-case field is role-restricted (legalCase.*). */
@Injectable()
export class LegalService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  list(user: AuthUser, projectId?: string) {
    return this.db.withScope(user, async (tx) => {
      const r = await rows<Record<string, unknown>>(
        tx,
        sql`SELECT l.*, p.code AS project_code FROM legal_cases l JOIN projects p ON p.id = l.project_id
            WHERE (${projectId ?? null}::uuid IS NULL OR l.project_id = ${projectId ?? null}::uuid) ORDER BY l.next_hearing_at NULLS LAST, l.filed_at DESC`,
      );
      return r.map((x) => tagEntity('legalCase', x));
    });
  }

  file(
    user: AuthUser,
    projectId: string,
    body: {
      caseType: CaseType;
      caseNo?: string | null;
      parcelId?: string | null;
      personId?: string | null;
      affectedFamilyId?: string | null;
      filedAt?: string | null;
    },
  ) {
    requireRole(user, LEGAL_ROLES, 'Recording a legal case');
    return this.db.withScope(user, async (tx) => {
      const filedAt = body.filedAt ? new Date(body.filedAt) : this.clock.now();
      const [c] = await tx
        .insert(legalCases)
        .values({
          projectId,
          caseType: body.caseType,
          caseNo: body.caseNo ?? null,
          parcelId: body.parcelId ?? null,
          personId: body.personId ?? null,
          filedAt,
          status: 'filed',
        })
        .returning();
      let timeBarred = false;
      // s.64: a reference satisfies the family's REFERENCE_WINDOW clock — or is flagged time-barred.
      if (body.caseType === 'S64_REFERENCE' && body.affectedFamilyId) {
        const d = await one<{ id: string; due_at: Date }>(
          tx,
          sql`SELECT id, due_at FROM statutory_deadlines WHERE subject_type = 'AFFECTED_FAMILY' AND subject_id = ${body.affectedFamilyId}
                AND clock_code = 'REFERENCE_WINDOW' ORDER BY started_at DESC LIMIT 1`,
        );
        if (d) {
          timeBarred = filedAt.getTime() > new Date(d.due_at).getTime();
          if (!timeBarred)
            await tx.execute(
              sql`UPDATE statutory_deadlines SET status = 'SATISFIED', satisfied_at = ${filedAt} WHERE id = ${d.id}`,
            );
          await tx
            .insert(legalCaseEvents)
            .values({
              caseId: c!.id,
              eventType: timeBarred ? 'TIME_BARRED_FLAG' : 'REFERENCE_WITHIN_WINDOW',
              at: filedAt,
              notes: timeBarred ? 'Filed after the s.64 window (REFERENCE_TIME_BARRED)' : null,
            });
        }
        await writeOutbox(tx, {
          type: 'REFERENCE_FILED',
          aggregateType: 'legal_case',
          aggregateId: c!.id,
          payload: { projectId, affectedFamilyId: body.affectedFamilyId, timeBarred },
        });
      }
      await this.audit.record({
        action: 'LEGAL_CASE_FILED',
        entityType: 'legal_case',
        entityId: c!.id,
        after: { ...c, timeBarred },
      });
      return tagEntity('legalCase', { ...c, timeBarred });
    });
  }

  update(
    user: AuthUser,
    id: string,
    body: {
      status?: CaseStatus;
      nextHearingAt?: string | null;
      differentialLiabilityRupees?: string | number | null;
      orderDocumentId?: string | null;
      note?: string | null;
    },
  ) {
    requireRole(user, LEGAL_ROLES, 'Updating a legal case');
    return this.db.withScope(user, async (tx) => {
      const [c] = await tx.select().from(legalCases).where(eq(legalCases.id, id));
      if (!c) throw new ProblemException(404, 'CASE_NOT_FOUND', 'No such case.');
      const [after] = await tx
        .update(legalCases)
        .set({
          ...(body.status ? { status: body.status } : {}),
          ...(body.nextHearingAt !== undefined
            ? { nextHearingAt: body.nextHearingAt ? new Date(body.nextHearingAt) : null }
            : {}),
          // Entered from the order — never computed (§22).
          ...(body.differentialLiabilityRupees !== undefined
            ? {
                differentialLiabilityPaise:
                  body.differentialLiabilityRupees == null ? null : rupeesToPaise(body.differentialLiabilityRupees),
              }
            : {}),
          ...(body.orderDocumentId !== undefined ? { orderDocumentId: body.orderDocumentId } : {}),
        })
        .where(eq(legalCases.id, id))
        .returning();
      await tx
        .insert(legalCaseEvents)
        .values({
          caseId: id,
          eventType: body.status ? `STATUS_${body.status.toUpperCase()}` : 'UPDATED',
          at: this.clock.now(),
          notes: body.note ?? null,
          documentId: body.orderDocumentId ?? null,
        });
      await this.audit.record({
        action: 'LEGAL_CASE_UPDATED',
        entityType: 'legal_case',
        entityId: id,
        before: c,
        after,
      });
      return tagEntity('legalCase', after!);
    });
  }

  dashboard(user: AuthUser) {
    return this.db.withScope(user, async (tx) =>
      tagEntity('legalCase', {
        byDistrict: await rows(
          tx,
          sql`SELECT pd.district_code, count(DISTINCT l.id)::int AS open_cases FROM legal_cases l JOIN project_districts pd ON pd.project_id = l.project_id
              WHERE l.status <> 'closed' GROUP BY 1 ORDER BY 2 DESC`,
        ),
        byType: await rows(
          tx,
          sql`SELECT case_type, status, count(*)::int AS n FROM legal_cases GROUP BY 1, 2 ORDER BY 1, 2`,
        ),
        nextHearings: await rows(
          tx,
          sql`SELECT l.id, l.case_no, l.case_type, l.next_hearing_at, p.code AS project_code FROM legal_cases l JOIN projects p ON p.id = l.project_id
              WHERE l.next_hearing_at >= app_now() ORDER BY l.next_hearing_at LIMIT 15`,
        ),
        liabilityPaise:
          (
            await one<{ s: string }>(
              tx,
              sql`SELECT coalesce(sum(differential_liability_paise), 0)::text AS s FROM legal_cases`,
            )
          )?.s ?? '0',
        parcelsUnderStay:
          (
            await one<{ n: number }>(
              tx,
              sql`SELECT count(DISTINCT parcel_id)::int AS n FROM legal_cases WHERE case_type = 'WRIT' AND status IN ('filed','hearing') AND parcel_id IS NOT NULL`,
            )
          )?.n ?? 0,
      }),
    );
  }
}
