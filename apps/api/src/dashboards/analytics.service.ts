import { riskScore } from '@bhoomisetu/rules';
import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { ClockService } from '../common/clock/clock.service';
import { DbService } from '../common/db/db.service';
import { rows } from '../common/db/raw';

const DAY_MS = 86_400_000;

/** §24.4 analytics: delay risk per open deadline, stage bottlenecks, MIS report rows. */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly db: DbService,
    private readonly clock: ClockService,
  ) {}

  risk(user: AuthUser, projectId?: string) {
    return this.db.withScope(user, async (tx) => {
      const now = this.clock.now();
      const r = await rows<{
        id: string;
        project_id: string;
        project_code: string;
        project_name: string;
        clock_code: string;
        label: string | null;
        consequence_text: string | null;
        live_status: string;
        days_remaining: number;
        started_at: Date;
        due_at: Date;
        returns: number;
        stage_started_at: Date | null;
        median_days: string | null;
        open_oc: number;
        demand: string | null;
        deposited: string | null;
        voided: number;
        stays: number;
      }>(
        tx,
        sql`SELECT b.id, b.project_id, b.project_code, b.project_name, b.clock_code, b.label, b.consequence_text, b.live_status,
                   b.days_remaining, b.started_at, b.due_at,
                   (SELECT count(*)::int FROM stage_transitions t JOIN projects p ON p.id = t.project_id
                    JOIN stage_instances si ON si.id = t.stage_instance_id
                    WHERE t.project_id = b.project_id AND t.action = 'RETURN' AND si.stage_code = p.current_stage) AS returns,
                   (SELECT min(si.started_at) FROM stage_instances si JOIN projects p ON p.id = si.project_id
                    WHERE si.project_id = b.project_id AND si.stage_code = p.current_stage AND si.status IN ('IN_PROGRESS','SUBMITTED','RETURNED')) AS stage_started_at,
                   (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM si.completed_at - si.started_at) / 86400)
                    FROM stage_instances si JOIN projects p ON p.id = b.project_id
                    WHERE si.stage_code = p.current_stage AND si.status = 'APPROVED' AND si.completed_at IS NOT NULL) AS median_days,
                   ((SELECT count(*) FROM objections o WHERE o.project_id = b.project_id AND o.status IN ('FILED','SCHEDULED','HEARD'))
                    + (SELECT count(*) FROM claims c WHERE c.project_id = b.project_id AND c.status IN ('filed','accepted')))::int AS open_oc,
                   (SELECT sum(demand_amount_paise)::text FROM escrow_accounts e WHERE e.project_id = b.project_id AND e.status <> 'certified') AS demand,
                   (SELECT sum(deposited_amount_paise)::text FROM escrow_accounts e WHERE e.project_id = b.project_id AND e.status <> 'certified') AS deposited,
                   (SELECT count(*)::int FROM hearings h WHERE h.project_id = b.project_id AND h.status = 'VOID') AS voided,
                   (SELECT count(*)::int FROM legal_cases l WHERE l.project_id = b.project_id AND l.case_type = 'WRIT' AND l.status IN ('filed','hearing')) AS stays
            FROM v_deadline_board b
            WHERE b.subject_type IN ('PROJECT','STAGE') AND (${projectId ?? null}::uuid IS NULL OR b.project_id = ${projectId ?? null}::uuid)`,
      );
      return r
        .map((d) => {
          const s = riskScore({
            startedAt: new Date(d.started_at),
            dueAt: new Date(d.due_at),
            now,
            returns: d.returns,
            stageElapsedDays: d.stage_started_at
              ? (now.getTime() - new Date(d.stage_started_at).getTime()) / DAY_MS
              : 0,
            districtMedianDays: d.median_days ? Number(d.median_days) : null,
            openObjectionsClaims: d.open_oc,
            escrowDemandPaise: BigInt(d.demand ?? '0'),
            escrowDepositedPaise: BigInt(d.deposited ?? '0'),
            hearingsVoided: d.voided,
            legalStays: d.stays,
          });
          return {
            deadlineId: d.id,
            projectId: d.project_id,
            projectCode: d.project_code,
            projectName: d.project_name,
            clockCode: d.clock_code,
            label: d.label,
            consequenceText: d.consequence_text,
            liveStatus: d.live_status,
            daysRemaining: d.days_remaining,
            dueAt: d.due_at,
            ...s,
            heuristic: true,
          };
        })
        .sort((a, b) => b.score - a.score);
    });
  }

  bottlenecks(user: AuthUser) {
    return this.db.withScope(user, async (tx) => ({
      byStage: await rows(
        tx,
        sql`SELECT si.stage_code,
                   count(*)::int AS instances,
                   count(*) FILTER (WHERE si.status = 'APPROVED')::int AS approved,
                   (SELECT count(*)::int FROM stage_transitions t JOIN stage_instances s2 ON s2.id = t.stage_instance_id
                    WHERE s2.stage_code = si.stage_code AND t.action = 'RETURN') AS returns,
                   round(percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM si.completed_at - si.started_at) / 86400)
                         FILTER (WHERE si.completed_at IS NOT NULL)::numeric, 1) AS median_days_in_stage,
                   count(*) FILTER (WHERE si.status IN ('IN_PROGRESS','SUBMITTED','RETURNED'))::int AS open_now
            FROM stage_instances si GROUP BY si.stage_code ORDER BY si.stage_code`,
      ),
      topReasonCodes: await rows(
        tx,
        sql`SELECT t.reason_code, si.stage_code, count(*)::int AS n FROM stage_transitions t
            JOIN stage_instances si ON si.id = t.stage_instance_id
            WHERE t.reason_code IS NOT NULL GROUP BY 1, 2 ORDER BY n DESC LIMIT 20`,
      ),
    }));
  }

  /** MIS report rows (§24.4). Report templates are code-defined; filters narrow them. */
  report(user: AuthUser, type: string, f: { stateCode?: string; districtCode?: string; projectId?: string }) {
    const filter = sql`(${f.stateCode ?? null}::text IS NULL OR p.state_code = ${f.stateCode ?? null})
      AND (${f.districtCode ?? null}::text IS NULL OR EXISTS (SELECT 1 FROM project_districts pd WHERE pd.project_id = p.id AND pd.district_code = ${f.districtCode ?? null}))
      AND (${f.projectId ?? null}::uuid IS NULL OR p.id = ${f.projectId ?? null}::uuid)`;
    const q: Record<string, ReturnType<typeof sql>> = {
      'project-progress': sql`SELECT p.code, p.name, p.state_code, p.status, p.current_stage, k.parcels_total, k.parcels_possessed,
                                     k.area_affected_sqm, k.area_notified_sqm, k.area_acquired_sqm, k.possession_pct, k.timeline_adherence_pct
                              FROM projects p JOIN v_project_kpis k ON k.project_id = p.id WHERE ${filter} ORDER BY p.code`,
      'compensation-register': sql`SELECT p.code AS project, af.id AS family_id, pe.full_name AS head, e.head_code, e.schedule_ref,
                                          e.amount_awarded_paise, e.status, e.due_by
                                   FROM entitlements e JOIN affected_families af ON af.id = e.affected_family_id
                                   JOIN persons pe ON pe.id = af.head_person_id JOIN projects p ON p.id = af.project_id
                                   WHERE ${filter} ORDER BY p.code, pe.full_name, e.head_code`,
      'rnr-status': sql`SELECT p.code AS project, af.id AS family_id, af.affected_type, af.is_displaced, af.is_sc_st,
                               m.assessed_paise, m.disbursed_paise, m.acknowledged_paise, m.unconfirmed_paise, m.deposited_paise
                        FROM affected_families af JOIN projects p ON p.id = af.project_id JOIN v_family_money m ON m.affected_family_id = af.id
                        WHERE ${filter} ORDER BY p.code`,
      'deadline-compliance': sql`SELECT b.project_code, b.clock_code, b.section, b.subject_type, b.started_at, b.due_at, b.days_remaining, b.live_status, b.consequence
                                 FROM v_deadline_board b JOIN projects p ON p.id = b.project_id WHERE ${filter} ORDER BY b.days_remaining`,
      'district-comparison': sql`SELECT pd.district_code, count(DISTINCT p.id)::int AS projects, sum(k.parcels_total)::int AS parcels,
                                        sum(k.compensation_paid_paise)::bigint AS paid_paise, sum(k.compensation_acknowledged_paise)::bigint AS acknowledged_paise,
                                        sum(k.deadlines_breached)::int AS breaches
                                 FROM projects p JOIN v_project_kpis k ON k.project_id = p.id JOIN project_districts pd ON pd.project_id = p.id
                                 WHERE ${filter} GROUP BY pd.district_code ORDER BY pd.district_code`,
    };
    const query = q[type];
    if (!query) return null;
    return this.db.withScope(user, (tx) => rows<Record<string, unknown>>(tx, query));
  }
}

/** Minimal RFC 4180 CSV. */
export function toCsv(data: Array<Record<string, unknown>>): string {
  if (!data.length) return '';
  const cols = Object.keys(data[0]!);
  const cell = (v: unknown) => {
    const s =
      v === null || v === undefined
        ? ''
        : v instanceof Date
          ? v.toISOString()
          : typeof v === 'object'
            ? JSON.stringify(v)
            : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...data.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
}
