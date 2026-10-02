import { tagEntity } from '@bhoomisetu/shared';
import { Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DbService } from '../common/db/db.service';
import { one, rows } from '../common/db/raw';
import { ProblemException } from '../common/errors/problem';

export interface RegistryFilters {
  projectId?: string;
  q?: string;
  district?: string;
  subDistrict?: string;
  village?: string;
  landClass?: string;
  status?: string;
  payment?: 'NONE' | 'UNPAID' | 'PART_PAID' | 'PAID' | 'ACKNOWLEDGED';
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  flagged?: boolean;
  cursor?: string;
  limit: number;
  geometry: boolean;
}

/** Points per factor of the advisory parcel risk score (heuristic, not a legal finding). */
export const RISK_POINTS = {
  LEGAL_STAY: 30,
  DEADLINE_BREACHED: 25,
  DEADLINE_DUE_SOON: 10,
  NOT_ACKNOWLEDGED: 15,
  OPEN_FLAGS: 10,
  AREA_MISMATCH: 10,
  OPEN_OBJECTIONS: 10,
  NOT_VERIFIED: 5,
} as const;
const HIGH = 60;
const MEDIUM = 30;

type Cursor = [string, string, string, string, string];
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url');
function decodeCursor(s: string): Cursor {
  try {
    const c = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as unknown;
    if (Array.isArray(c) && c.length === 5 && c.every((x) => typeof x === 'string')) return c as Cursor;
  } catch {
    /* fall through */
  }
  throw new ProblemException(400, 'CURSOR_INVALID', 'The cursor is not valid — start again without one.');
}

/**
 * Land registry / GIS list (A2, A3): every project parcel the caller can see (RLS), with
 * server-side filters, keyset cursor pagination and an ADVISORY risk score per parcel. The
 * summary (KPI strip + legend counts) covers the whole filtered set, not just the page.
 */
@Injectable()
export class GisRegistryService {
  constructor(private readonly db: DbService) {}

  /** The filtered set, one row per project parcel, with derived payment/deadline/risk columns. */
  private base(f: RegistryFilters): SQL {
    const q = f.q?.trim() ? `%${f.q.trim()}%` : null;
    return sql`
      WITH pay AS (
        SELECT pp.id AS ppid,
               CASE WHEN count(e.id) = 0 THEN 'NONE'
                    WHEN bool_and(e.status IN ('ACKNOWLEDGED','DEPOSITED_WITH_AUTHORITY')) THEN 'ACKNOWLEDGED'
                    WHEN bool_and(e.status IN ('ACKNOWLEDGED','DEPOSITED_WITH_AUTHORITY','DISBURSED','UNDER_PROTEST')) THEN 'PAID'
                    WHEN bool_or(e.status IN ('ACKNOWLEDGED','DEPOSITED_WITH_AUTHORITY','DISBURSED','UNDER_PROTEST')) THEN 'PART_PAID'
                    ELSE 'UNPAID' END AS payment,
               bool_or(e.status = 'DISBURSED') AS unacknowledged
        FROM project_parcels pp
        JOIN parcel_interests pi ON pi.parcel_id = pp.parcel_id
        JOIN affected_families af ON af.project_id = pp.project_id AND af.head_person_id = pi.person_id
        LEFT JOIN entitlements e ON e.affected_family_id = af.id
        GROUP BY pp.id),
      dl AS (
        SELECT pp.id AS ppid, max(CASE b.live_status WHEN 'BREACHED' THEN 3 WHEN 'DUE_SOON' THEN 2 ELSE 1 END) AS r
        FROM project_parcels pp
        JOIN v_deadline_board b ON b.project_id = pp.project_id AND (b.subject_type IN ('PROJECT','STAGE') OR b.subject_id = pp.id)
        GROUP BY pp.id),
      base AS (
        SELECT pp.id AS project_parcel_id, lp.id AS parcel_id, pp.project_id, p.code AS project_code, p.name AS project_name,
               lp.survey_number, coalesce(lp.sub_division, '') AS sub_division,
               lp.survey_number || coalesce('/' || lp.sub_division, '') AS survey_no,
               lp.village_code, v.name AS village_name, sd.code AS sub_district_code, sd.name AS sub_district,
               d.code AS district_code, d.name AS district, lp.land_class, lp.boundary_source, lp.version,
               pp.status, pp.flags, pp.affected_area_sqm, pp.affected_pct, pp.chainage_km,
               lp.recorded_area_sqm, lp.field_area_sqm, lp.area_diff_pct, lp.transfer_frozen_at,
               coalesce(pay.payment, 'NONE') AS payment,
               CASE coalesce(dl.r, 1) WHEN 3 THEN 'BREACHED' WHEN 2 THEN 'DUE_SOON' ELSE 'SAFE' END AS deadline_risk,
               EXISTS (SELECT 1 FROM legal_cases lc WHERE lc.parcel_id = lp.id AND lc.case_type = 'WRIT' AND lc.status IN ('filed','hearing')) AS legal_stay,
               (SELECT count(*)::int FROM spatial_flags sf WHERE sf.project_parcel_id = pp.id AND sf.acknowledged_at IS NULL) AS open_flags,
               (SELECT count(*)::int FROM objections o WHERE o.parcel_id = lp.id AND o.status IN ('FILED','SCHEDULED','HEARD')) AS open_objections,
               coalesce(pay.unacknowledged, false) AS unacknowledged
        FROM project_parcels pp
        JOIN projects p ON p.id = pp.project_id
        JOIN land_parcels lp ON lp.id = pp.parcel_id
        JOIN villages v ON v.code = lp.village_code
        JOIN sub_districts sd ON sd.code = v.sub_district_code
        JOIN districts d ON d.code = sd.district_code
        LEFT JOIN pay ON pay.ppid = pp.id
        LEFT JOIN dl ON dl.ppid = pp.id
        WHERE (${f.projectId ?? null}::uuid IS NULL OR pp.project_id = ${f.projectId ?? null}::uuid)
          AND (${f.district ?? null}::text IS NULL OR d.code = ${f.district ?? null})
          AND (${f.subDistrict ?? null}::text IS NULL OR sd.code = ${f.subDistrict ?? null})
          AND (${f.village ?? null}::text IS NULL OR lp.village_code = ${f.village ?? null})
          AND (${f.landClass ?? null}::text IS NULL OR lp.land_class::text = ${f.landClass ?? null})
          AND (${f.status ?? null}::text IS NULL OR pp.status::text = ${f.status ?? null})
          AND (${q}::text IS NULL
               OR (lp.survey_number || coalesce('/' || lp.sub_division, '')) ILIKE ${q}
               OR EXISTS (SELECT 1 FROM parcel_interests pi JOIN persons pe ON pe.id = pi.person_id
                          WHERE pi.parcel_id = lp.id AND pe.full_name ILIKE ${q}))),
      scored AS (
        SELECT b.*,
               ( CASE WHEN legal_stay THEN ${RISK_POINTS.LEGAL_STAY} ELSE 0 END
               + CASE deadline_risk WHEN 'BREACHED' THEN ${RISK_POINTS.DEADLINE_BREACHED} WHEN 'DUE_SOON' THEN ${RISK_POINTS.DEADLINE_DUE_SOON} ELSE 0 END
               + CASE WHEN unacknowledged THEN ${RISK_POINTS.NOT_ACKNOWLEDGED} ELSE 0 END
               + CASE WHEN open_flags > 0 OR coalesce(array_length(flags, 1), 0) > 0 THEN ${RISK_POINTS.OPEN_FLAGS} ELSE 0 END
               + CASE WHEN abs(coalesce(area_diff_pct, 0)) > 5 THEN ${RISK_POINTS.AREA_MISMATCH} ELSE 0 END
               + CASE WHEN open_objections > 0 THEN ${RISK_POINTS.OPEN_OBJECTIONS} ELSE 0 END
               + CASE WHEN status IN ('PROPOSED','VERIFICATION_PENDING') THEN ${RISK_POINTS.NOT_VERIFIED} ELSE 0 END
               )::int AS risk_score
        FROM base b),
      filtered AS (
        SELECT s.*, CASE WHEN risk_score >= ${HIGH} THEN 'HIGH' WHEN risk_score >= ${MEDIUM} THEN 'MEDIUM' ELSE 'LOW' END AS risk_level
        FROM scored s
        WHERE (${f.payment ?? null}::text IS NULL OR s.payment = ${f.payment ?? null})
          AND (${f.flagged ? true : null}::boolean IS NULL OR s.open_flags > 0 OR coalesce(array_length(s.flags, 1), 0) > 0)
          AND (${f.riskLevel ?? null}::text IS NULL
               OR CASE WHEN s.risk_score >= ${HIGH} THEN 'HIGH' WHEN s.risk_score >= ${MEDIUM} THEN 'MEDIUM' ELSE 'LOW' END = ${f.riskLevel ?? null}))`;
  }

  registry(user: AuthUser, f: RegistryFilters) {
    return this.db.withScope(user, async (tx) => {
      const c = f.cursor ? decodeCursor(f.cursor) : null;
      const page = await rows<Record<string, unknown> & { project_code: string; village_code: string; survey_number: string; sub_division: string; project_parcel_id: string }>(
        tx,
        sql`${this.base(f)}
            SELECT f.*, ${f.geometry ? sql`ST_AsGeoJSON(lp.geom, 7)::json` : sql`NULL::json`} AS geometry
            FROM filtered f JOIN land_parcels lp ON lp.id = f.parcel_id
            WHERE ${c ? sql`(f.project_code, f.village_code, f.survey_number, f.sub_division, f.project_parcel_id::text) > (${c[0]}, ${c[1]}, ${c[2]}, ${c[3]}, ${c[4]})` : sql`true`}
            ORDER BY f.project_code, f.village_code, f.survey_number, f.sub_division, f.project_parcel_id::text
            LIMIT ${f.limit + 1}`,
      );
      const more = page.length > f.limit;
      const items = more ? page.slice(0, f.limit) : page;
      const last = items[items.length - 1];
      // The KPI strip and legend describe the whole filtered set — sent with the first page only.
      const summary = c
        ? undefined
        : await one(
            tx,
            sql`${this.base(f)}
                SELECT count(*)::int AS parcels,
                       coalesce(sum(affected_area_sqm), 0)::text AS affected_area_sqm,
                       count(*) FILTER (WHERE risk_level = 'HIGH')::int AS high_risk,
                       count(*) FILTER (WHERE payment IN ('UNPAID','PART_PAID') OR unacknowledged)::int AS payments_pending,
                       count(*) FILTER (WHERE legal_stay)::int AS legal_stays,
                       count(*) FILTER (WHERE open_flags > 0 OR coalesce(array_length(flags, 1), 0) > 0)::int AS flagged,
                       coalesce((SELECT jsonb_object_agg(status, n) FROM (SELECT status::text, count(*) n FROM filtered GROUP BY 1) x), '{}') AS by_status,
                       coalesce((SELECT jsonb_object_agg(payment, n) FROM (SELECT payment, count(*) n FROM filtered GROUP BY 1) x), '{}') AS by_payment,
                       coalesce((SELECT jsonb_object_agg(deadline_risk, n) FROM (SELECT deadline_risk, count(*) n FROM filtered GROUP BY 1) x), '{}') AS by_deadline_risk,
                       coalesce((SELECT jsonb_object_agg(risk_level, n) FROM (SELECT risk_level, count(*) n FROM filtered GROUP BY 1) x), '{}') AS by_risk_level
                FROM filtered`,
          );
      return {
        items,
        nextCursor: more && last ? encodeCursor([last.project_code, last.village_code, last.survey_number, last.sub_division, last.project_parcel_id]) : null,
        summary,
        riskNote: 'Risk score (advisory) — heuristic, not a legal finding.',
        riskPoints: RISK_POINTS,
      };
    });
  }

  /**
   * Affected families with an interest in this parcel, their entitlements, disbursements and how
   * each payment was acknowledged (A3 Payment + Families tabs). Disbursements are tagged so the
   * redaction interceptor strips hold reasons for posts that may not see them (§11.4).
   */
  parcelFamilies(user: AuthUser, projectParcelId: string) {
    return this.db.withScope(user, async (tx) => {
      const pp = await one<{ project_id: string; parcel_id: string }>(
        tx,
        sql`SELECT project_id, parcel_id FROM project_parcels WHERE id = ${projectParcelId}`,
      );
      if (!pp) throw new ProblemException(404, 'PROJECT_PARCEL_NOT_FOUND', 'No such project parcel in your jurisdiction.');
      const fams = await rows<Record<string, unknown> & { entitlements: Array<Record<string, unknown> & { disbursements: Array<Record<string, unknown>> }> }>(
        tx,
        sql`SELECT af.id, af.affected_type, af.is_displaced, af.is_sc_st, pe.full_name AS head_name, pi.interest_type,
                   m.assessed_paise, m.disbursed_paise, m.acknowledged_paise, m.unconfirmed_paise, m.held_paise, m.deposited_paise,
                   coalesce((SELECT jsonb_agg(jsonb_build_object(
                       'id', e.id, 'headCode', e.head_code, 'amountPaise', e.amount_awarded_paise::text, 'status', e.status, 'dueBy', e.due_by,
                       'disbursements', coalesce((SELECT jsonb_agg(jsonb_build_object(
                           'id', d.id, 'amountPaise', d.amount_paise::text, 'instrument', d.instrument, 'paymentStatus', d.payment_status,
                           'paidOn', d.paid_on, 'adapterProvider', d.adapter_provider, 'adapterRef', d.adapter_ref,
                           'holdReasonCode', d.hold_reason_code, 'holdReason', d.hold_reason,
                           'acknowledgement', (SELECT jsonb_build_object('method', ak.method, 'confirmedAt', ak.confirmed_at)
                                               FROM acknowledgements ak WHERE ak.disbursement_id = d.id))
                         ORDER BY d.initiated_at) FROM disbursements d WHERE d.entitlement_id = e.id), '[]'::jsonb))
                     ORDER BY e.head_code) FROM entitlements e WHERE e.affected_family_id = af.id), '[]'::jsonb) AS entitlements
            FROM parcel_interests pi
            JOIN affected_families af ON af.head_person_id = pi.person_id AND af.project_id = ${pp.project_id}
            JOIN persons pe ON pe.id = af.head_person_id
            LEFT JOIN v_family_money m ON m.affected_family_id = af.id
            WHERE pi.parcel_id = ${pp.parcel_id}
            ORDER BY pe.full_name`,
      );
      for (const f of fams)
        for (const e of f.entitlements) e.disbursements = e.disbursements.map((d) => tagEntity('disbursement', d));
      return fams;
    });
  }

  /** Why a parcel scored what it did: the factors with points and the rows behind them (A3 "Risk factors"). */
  parcelRisk(user: AuthUser, projectParcelId: string) {
    return this.db.withScope(user, async (tx) => {
      const pp = await one<{ project_id: string; parcel_id: string }>(
        tx,
        sql`SELECT project_id, parcel_id FROM project_parcels WHERE id = ${projectParcelId}`,
      );
      if (!pp) throw new ProblemException(404, 'PROJECT_PARCEL_NOT_FOUND', 'No such project parcel in your jurisdiction.');
      const row = await one<Record<string, unknown> & { risk_score: number; risk_level: string }>(
        tx,
        sql`${this.base({ projectId: pp.project_id, limit: 1, geometry: false })}
            SELECT * FROM filtered WHERE project_parcel_id = ${projectParcelId}`,
      );
      if (!row) throw new ProblemException(404, 'PROJECT_PARCEL_NOT_FOUND', 'No such project parcel in your jurisdiction.');
      const evidence = {
        legalCases: await rows(
          tx,
          sql`SELECT id, case_type, case_no, status, filed_at, next_hearing_at FROM legal_cases WHERE parcel_id = ${pp.parcel_id} ORDER BY filed_at DESC`,
        ),
        deadlines: await rows(
          tx,
          sql`SELECT id, clock_code, label, section, live_status, days_remaining, due_at, consequence_text
              FROM v_deadline_board WHERE project_id = ${pp.project_id} AND live_status <> 'SAFE'
                AND (subject_type IN ('PROJECT','STAGE') OR subject_id = ${projectParcelId})
              ORDER BY days_remaining`,
        ),
        flags: await rows(
          tx,
          sql`SELECT id, flag_type, layer_type, message, overlap_area_sqm, raised_at FROM spatial_flags
              WHERE project_parcel_id = ${projectParcelId} AND acknowledged_at IS NULL ORDER BY raised_at`,
        ),
        objections: await rows(
          tx,
          sql`SELECT id, status, filed_at, channel FROM objections WHERE parcel_id = ${pp.parcel_id} AND status IN ('FILED','SCHEDULED','HEARD')`,
        ),
      };
      const factors = [
        row.legal_stay && { code: 'LEGAL_STAY', points: RISK_POINTS.LEGAL_STAY, label: 'A writ is pending on the parcel (stay blocks possession)' },
        row.deadline_risk === 'BREACHED' && { code: 'DEADLINE_BREACHED', points: RISK_POINTS.DEADLINE_BREACHED, label: 'A statutory deadline on the project or parcel is breached' },
        row.deadline_risk === 'DUE_SOON' && { code: 'DEADLINE_DUE_SOON', points: RISK_POINTS.DEADLINE_DUE_SOON, label: 'A statutory deadline is due soon' },
        row.unacknowledged && { code: 'NOT_ACKNOWLEDGED', points: RISK_POINTS.NOT_ACKNOWLEDGED, label: 'Money disbursed but not acknowledged by the family' },
        (Number(row.open_flags) > 0 || (row.flags as string[] | null)?.length) && { code: 'OPEN_FLAGS', points: RISK_POINTS.OPEN_FLAGS, label: 'Spatial or plausibility flags are open' },
        Math.abs(Number(row.area_diff_pct ?? 0)) > 5 && { code: 'AREA_MISMATCH', points: RISK_POINTS.AREA_MISMATCH, label: 'Recorded and field areas differ by more than 5%' },
        Number(row.open_objections) > 0 && { code: 'OPEN_OBJECTIONS', points: RISK_POINTS.OPEN_OBJECTIONS, label: 'Objections on the parcel are not yet decided' },
        ['PROPOSED', 'VERIFICATION_PENDING'].includes(String(row.status)) && { code: 'NOT_VERIFIED', points: RISK_POINTS.NOT_VERIFIED, label: 'Parcel boundary not yet verified' },
      ].filter((x): x is { code: string; points: number; label: string } => !!x);
      return {
        projectParcelId,
        score: row.risk_score,
        level: row.risk_level,
        factors: factors.sort((a, b) => b.points - a.points),
        evidence,
        note: 'Risk score (advisory) — heuristic, not a legal finding.',
      };
    });
  }
}
