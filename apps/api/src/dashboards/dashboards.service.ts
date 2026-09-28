import type { Tx } from '@bhoomisetu/db';
import { Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { ClockService } from '../common/clock/clock.service';
import { DbService } from '../common/db/db.service';
import { one, rows } from '../common/db/raw';

// Module J (§24). Every figure is computed from v_* views under the caller's RLS scope, so a
// district Collector's "national" numbers are simply their district's — no filter in code (G13).

const KPI_SUMS = sql`
  count(*)::int AS projects,
  coalesce(sum(area_affected_sqm), 0) AS area_affected_sqm,
  coalesce(sum(area_notified_sqm), 0) AS area_notified_sqm,
  coalesce(sum(area_acquired_sqm), 0) AS area_acquired_sqm,
  coalesce(sum(compensation_assessed_paise), 0)::bigint AS compensation_assessed_paise,
  coalesce(sum(compensation_paid_paise), 0)::bigint AS compensation_paid_paise,
  coalesce(sum(compensation_acknowledged_paise), 0)::bigint AS compensation_acknowledged_paise,
  (coalesce(sum(compensation_paid_paise), 0) - coalesce(sum(compensation_acknowledged_paise), 0))::bigint AS compensation_unconfirmed_paise,
  coalesce(sum(affected_families), 0)::int AS affected_families,
  coalesce(sum(displaced_families), 0)::int AS displaced_families,
  round(100.0 * sum(parcels_possessed) / nullif(sum(parcels_total), 0), 1) AS possession_pct,
  round(100.0 * sum(rnr_entitlements_settled) / nullif(sum(rnr_entitlements_total), 0), 1) AS rnr_completion_pct,
  round(100.0 * sum(deadlines_started - deadlines_breached) / nullif(sum(deadlines_started), 0), 1) AS timeline_adherence_pct,
  coalesce(sum(deadlines_breached), 0)::int AS deadlines_breached`;

type Filter = { stateCode?: string; districtCode?: string; projectId?: string };

function where(f: Filter): SQL {
  const parts: SQL[] = [sql`true`];
  if (f.stateCode) parts.push(sql`k.state_code = ${f.stateCode}`);
  if (f.districtCode)
    parts.push(
      sql`EXISTS (SELECT 1 FROM project_districts pd WHERE pd.project_id = k.project_id AND pd.district_code = ${f.districtCode})`,
    );
  if (f.projectId) parts.push(sql`k.project_id = ${f.projectId}`);
  return sql.join(parts, sql` AND `);
}

@Injectable()
export class DashboardsService {
  constructor(
    private readonly db: DbService,
    private readonly clock: ClockService,
  ) {}

  private kpis(tx: Tx, f: Filter) {
    return one<Record<string, unknown>>(tx, sql`SELECT ${KPI_SUMS} FROM v_project_kpis k WHERE ${where(f)}`);
  }

  /** Breach alerts: stage/project clocks individually; per-entitlement clocks rolled up per project. */
  private alerts(tx: Tx, f: Filter, limit = 12) {
    return rows(
      tx,
      sql`WITH b AS (SELECT b.* FROM v_deadline_board b JOIN v_project_kpis k ON k.project_id = b.project_id WHERE ${where(f)})
          SELECT * FROM (
            SELECT b.id, b.project_id, b.project_code, b.project_name, b.clock_code, b.label, b.section, b.consequence,
                   b.consequence_text, b.due_at, b.days_remaining, b.live_status, b.subject_type, 1 AS instances
            FROM b WHERE b.subject_type IN ('PROJECT','STAGE') AND b.live_status IN ('BREACHED','DUE_SOON')
            UNION ALL
            SELECT (array_agg(b.id ORDER BY b.due_at))[1], b.project_id, b.project_code, b.project_name, b.clock_code,
                   min(b.label), min(b.section), min(b.consequence), min(b.consequence_text), min(b.due_at), min(b.days_remaining),
                   CASE WHEN bool_or(b.live_status = 'BREACHED') THEN 'BREACHED' ELSE 'DUE_SOON' END, min(b.subject_type), count(*)::int
            FROM b WHERE b.subject_type NOT IN ('PROJECT','STAGE') AND b.live_status IN ('BREACHED','DUE_SOON')
            GROUP BY b.project_id, b.project_code, b.project_name, b.clock_code
          ) x ORDER BY (live_status = 'BREACHED') DESC, days_remaining LIMIT ${limit}`,
    );
  }

  private projectsMap(tx: Tx, f: Filter) {
    return rows(
      tx,
      sql`SELECT k.project_id, k.code, k.name, k.status, k.current_stage, k.state_code,
                 ST_AsGeoJSON(ST_SimplifyPreserveTopology(p.footprint, 0.0005), 6)::json AS footprint,
                 ST_AsGeoJSON(ST_PointOnSurface(p.footprint), 6)::json AS centroid,
                 coalesce((SELECT CASE WHEN bool_or(live_status = 'BREACHED') THEN 'BREACHED'
                                       WHEN bool_or(live_status = 'DUE_SOON') THEN 'DUE_SOON' ELSE 'SAFE' END
                           FROM v_deadline_board b WHERE b.project_id = k.project_id), 'SAFE') AS risk
          FROM v_project_kpis k JOIN projects p ON p.id = k.project_id WHERE ${where(f)} AND p.footprint IS NOT NULL`,
    );
  }

  private byState(tx: Tx, f: Filter) {
    return rows(
      tx,
      sql`SELECT k.state_code, s.name AS state_name, ${KPI_SUMS}
          FROM v_project_kpis k JOIN states s ON s.code = k.state_code WHERE ${where(f)}
          GROUP BY k.state_code, s.name ORDER BY s.name`,
    );
  }

  private byDistrict(tx: Tx, f: Filter) {
    return rows(
      tx,
      sql`SELECT pd.district_code, d.name AS district_name, ${KPI_SUMS}
          FROM v_project_kpis k JOIN project_districts pd ON pd.project_id = k.project_id JOIN districts d ON d.code = pd.district_code
          WHERE ${where(f)} GROUP BY pd.district_code, d.name ORDER BY d.name`,
    );
  }

  private interest(tx: Tx, f: Filter) {
    return one<{ estimated_interest_paise: string; entitlements: number }>(
      tx,
      sql`SELECT coalesce(sum(i.estimated_interest_paise), 0)::bigint AS estimated_interest_paise, count(*)::int AS entitlements
          FROM v_interest_liability i JOIN v_project_kpis k ON k.project_id = i.project_id WHERE ${where(f)}`,
    );
  }

  private dash(user: AuthUser, f: Filter, scope: Record<string, unknown>) {
    return this.db.withScope(user, async (tx) => ({
      scope,
      asOf: this.clock.now(),
      kpis: await this.kpis(tx, f),
      alerts: await this.alerts(tx, f),
      estimatedInterestLiability: await this.interest(tx, f),
      projects: await this.projectsMap(tx, f),
      states: await this.byState(tx, f),
      districts: await this.byDistrict(tx, f),
    }));
  }

  national(user: AuthUser) {
    return this.dash(user, {}, { level: 'NATIONAL' });
  }

  state(user: AuthUser, stateCode: string) {
    return this.dash(user, { stateCode }, { level: 'STATE', stateCode });
  }

  district(user: AuthUser, districtCode: string) {
    return this.dash(user, { districtCode }, { level: 'DISTRICT', districtCode });
  }

  project(user: AuthUser, projectId: string) {
    return this.db.withScope(user, async (tx) => ({
      asOf: this.clock.now(),
      kpis: await one(tx, sql`SELECT * FROM v_project_kpis WHERE project_id = ${projectId}`),
      deadlines: await rows(
        tx,
        sql`SELECT * FROM v_deadline_board WHERE project_id = ${projectId} ORDER BY due_at LIMIT 200`,
      ),
      estimatedInterestLiability: await this.interest(tx, { projectId }),
      money: await one(
        tx,
        sql`SELECT count(*)::int AS families,
                   coalesce(sum(assessed_paise),0)::bigint AS assessed_paise, coalesce(sum(disbursed_paise),0)::bigint AS disbursed_paise,
                   coalesce(sum(acknowledged_paise),0)::bigint AS acknowledged_paise, coalesce(sum(unconfirmed_paise),0)::bigint AS unconfirmed_paise,
                   coalesce(sum(held_paise),0)::bigint AS held_paise, coalesce(sum(deposited_paise),0)::bigint AS deposited_paise,
                   count(*) FILTER (WHERE unconfirmed_paise > 0)::int AS families_unconfirmed
            FROM v_family_money WHERE project_id = ${projectId}`,
      ),
      consent: await rows(tx, sql`SELECT * FROM v_consent_tally WHERE project_id = ${projectId}`),
      flags: await one(
        tx,
        sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE acknowledged_at IS NULL)::int AS open FROM spatial_flags WHERE project_id = ${projectId}`,
      ),
    }));
  }

  /** §24.2 "What breaches a statutory deadline on my watch?" — scoped by the Collector's post. */
  collector(user: AuthUser) {
    return this.db.withScope(user, async (tx) => ({
      asOf: this.clock.now(),
      post: { designation: user.post.designation, districtCode: user.post.districtCode },
      kpis: await this.kpis(tx, {}),
      deadlineBoard: await rows(
        tx,
        sql`SELECT b.* FROM v_deadline_board b WHERE b.subject_type IN ('PROJECT','STAGE')
            ORDER BY (b.live_status = 'BREACHED') DESC, b.days_remaining LIMIT 50`,
      ),
      entitlementClocks: await this.alerts(tx, {}, 50),
      estimatedInterestLiability: await this.interest(tx, {}),
      consentMeters: await rows(
        tx,
        sql`SELECT t.*, p.code AS project_code, p.name AS project_name FROM v_consent_tally t JOIN projects p ON p.id = t.project_id ORDER BY p.code`,
      ),
      pendingVerifications: await rows(
        tx,
        sql`SELECT pp.id AS project_parcel_id, pp.parcel_id, p.code AS project_code, lp.survey_number || coalesce('/' || lp.sub_division, '') AS survey_no,
                   v.name AS village_name, pp.status, pp.flags
            FROM project_parcels pp JOIN projects p ON p.id = pp.project_id JOIN land_parcels lp ON lp.id = pp.parcel_id
            JOIN villages v ON v.code = lp.village_code
            WHERE pp.status IN ('PROPOSED','VERIFICATION_PENDING')
               OR EXISTS (SELECT 1 FROM field_surveys fs WHERE fs.parcel_id = pp.parcel_id AND fs.status = 'submitted')
            ORDER BY p.code LIMIT 100`,
      ),
      returnedFiles: await rows(
        tx,
        sql`SELECT si.project_id, p.code AS project_code, si.stage_code, si.attempt, t.reason_code, t.remarks, t.at
            FROM stage_instances si JOIN projects p ON p.id = si.project_id
            JOIN LATERAL (SELECT * FROM stage_transitions st WHERE st.stage_instance_id = si.id ORDER BY st.at DESC LIMIT 1) t ON true
            WHERE si.status = 'RETURNED' ORDER BY t.at DESC LIMIT 50`,
      ),
      unacknowledged: await rows(
        tx,
        sql`SELECT m.affected_family_id, m.project_id, p.code AS project_code, pe.full_name AS head_name,
                   m.disbursed_paise, m.acknowledged_paise, m.unconfirmed_paise, m.held_paise
            FROM v_family_money m JOIN projects p ON p.id = m.project_id
            JOIN affected_families af ON af.id = m.affected_family_id JOIN persons pe ON pe.id = af.head_person_id
            WHERE m.unconfirmed_paise > 0 ORDER BY m.unconfirmed_paise DESC LIMIT 100`,
      ),
    }));
  }

  /** Every open deadline in scope, optionally only those due within N days (also the AI tool). */
  deadlineBoard(user: AuthUser, withinDays?: number) {
    return this.db.withScope(user, (tx) =>
      rows(
        tx,
        sql`SELECT * FROM v_deadline_board
            WHERE (${withinDays ?? null}::int IS NULL OR days_remaining <= ${withinDays ?? null}::int)
            ORDER BY (live_status = 'BREACHED') DESC, days_remaining LIMIT 500`,
      ),
    );
  }
}
