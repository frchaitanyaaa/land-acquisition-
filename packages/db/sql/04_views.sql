-- Views (CLAUDE.md §10.4). Re-created on every `pnpm db:migrate`.
--
-- v_*  are security_invoker: they run with the caller's privileges, so RLS scopes them for free.
-- mv_* are materialised as app_worker (BYPASSRLS) so roll-ups cover every project; the deadline
--      and refresh jobs set `app.now` from ClockService before REFRESH.
-- Statutory numbers (thresholds, rates) are read from the project's pinned rule pack (G8).

DROP VIEW IF EXISTS v_interest_liability, v_deadline_board, v_project_kpis, v_family_money, v_consent_tally CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_national_kpis, mv_state_kpis, mv_district_kpis, mv_interest_liability CASCADE;

-- ---------------------------------------------------------------------------------------------

CREATE VIEW v_consent_tally WITH (security_invoker = true) AS
SELECT r.id                                                       AS register_id,
       r.project_id,
       r.consent_type,
       r.status,
       count(e.id) FILTER (WHERE e.status = 'eligible')            AS eligible,
       count(c.id) FILTER (WHERE e.status = 'eligible' AND c.decision = 'CONSENT') AS consented,
       count(c.id) FILTER (WHERE e.status = 'eligible' AND c.decision = 'REFUSE')  AS refused,
       round(100.0 * count(c.id) FILTER (WHERE e.status = 'eligible' AND c.decision = 'CONSENT')
             / nullif(count(e.id) FILTER (WHERE e.status = 'eligible'), 0), 2)     AS pct,
       t.threshold,
       CASE WHEN t.threshold IS NULL THEN NULL
            ELSE count(c.id) FILTER (WHERE e.status = 'eligible' AND c.decision = 'CONSENT')
                 >= t.threshold * count(e.id) FILTER (WHERE e.status = 'eligible')
       END                                                        AS met
FROM consent_registers r
JOIN projects p ON p.id = r.project_id
LEFT JOIN rule_packs rp ON rp.code = p.rule_pack_code AND rp.version = p.rule_pack_version
LEFT JOIN consent_register_entries e ON e.register_id = r.id
LEFT JOIN consent_records c ON c.register_entry_id = e.id
CROSS JOIN LATERAL (
  SELECT CASE r.consent_type
           WHEN 'PRIVATE_80' THEN (rp.definition #>> '{consent,PRIVATE}')::numeric
           WHEN 'PPP_70'     THEN (rp.definition #>> '{consent,PPP}')::numeric
         END AS threshold   -- GRAM_SABHA_S41 is a resolution, not a percentage: NULL
) t
GROUP BY r.id, r.project_id, r.consent_type, r.status, t.threshold;

-- Disbursed is what the office says; acknowledged is what the family says (innovation 1).
CREATE VIEW v_family_money WITH (security_invoker = true) AS
SELECT af.id                                                          AS affected_family_id,
       af.project_id,
       coalesce(e.assessed, 0)::bigint                                AS assessed_paise,
       coalesce(e.sanctioned, 0)::bigint                              AS sanctioned_paise,
       coalesce(d.disbursed, 0)::bigint                               AS disbursed_paise,
       coalesce(d.acknowledged, 0)::bigint                            AS acknowledged_paise,
       (coalesce(d.disbursed, 0) - coalesce(d.acknowledged, 0))::bigint AS unconfirmed_paise,
       coalesce(d.held, 0)::bigint                                    AS held_paise,
       coalesce(d.deposited, 0)::bigint                               AS deposited_paise
FROM affected_families af
LEFT JOIN LATERAL (
  SELECT sum(amount_awarded_paise)                                 AS assessed,
         sum(amount_awarded_paise) FILTER (WHERE status <> 'ASSESSED') AS sanctioned
  FROM entitlements WHERE affected_family_id = af.id
) e ON true
LEFT JOIN LATERAL (
  SELECT sum(x.amount_paise) FILTER (WHERE x.instrument = 'DBT' AND x.payment_status = 'SUCCESS') AS disbursed,
         sum(x.amount_paise) FILTER (WHERE x.instrument = 'DBT' AND x.payment_status = 'SUCCESS'
                                     AND EXISTS (SELECT 1 FROM acknowledgements a WHERE a.disbursement_id = x.id)) AS acknowledged,
         sum(x.amount_paise) FILTER (WHERE x.hold_reason_code IS NOT NULL AND x.payment_status <> 'SUCCESS') AS held,
         sum(x.amount_paise) FILTER (WHERE x.instrument = 'DEPOSIT_WITH_AUTHORITY' AND x.payment_status = 'SUCCESS') AS deposited
  FROM disbursements x
  JOIN entitlements en ON en.id = x.entitlement_id
  WHERE en.affected_family_id = af.id
) d ON true;

-- The PS dashboard parameters per project, with numerators and denominators so roll-ups can
-- compute percentages correctly.
CREATE VIEW v_project_kpis WITH (security_invoker = true) AS
SELECT p.id                                       AS project_id,
       p.code,
       p.name,
       p.state_code,
       p.status,
       p.current_stage,
       coalesce(pp.area_affected, 0)              AS area_affected_sqm,
       coalesce(pp.area_notified, 0)              AS area_notified_sqm,
       coalesce(pp.area_acquired, 0)              AS area_acquired_sqm,
       coalesce(m.assessed, 0)::bigint            AS compensation_assessed_paise,
       coalesce(m.disbursed, 0)::bigint           AS compensation_paid_paise,
       coalesce(m.acknowledged, 0)::bigint        AS compensation_acknowledged_paise,
       coalesce(f.families, 0)::int               AS affected_families,
       coalesce(f.displaced, 0)::int              AS displaced_families,
       coalesce(pp.parcels, 0)::int               AS parcels_total,
       coalesce(pp.possessed, 0)::int             AS parcels_possessed,
       coalesce(r.total, 0)::int                  AS rnr_entitlements_total,
       coalesce(r.settled, 0)::int                AS rnr_entitlements_settled,
       coalesce(dl.started, 0)::int               AS deadlines_started,
       coalesce(dl.breached, 0)::int              AS deadlines_breached,
       round(100.0 * pp.possessed / nullif(pp.parcels, 0), 1)               AS possession_pct,
       round(100.0 * r.settled / nullif(r.total, 0), 1)                     AS rnr_completion_pct,
       round(100.0 * (dl.started - dl.breached) / nullif(dl.started, 0), 1) AS timeline_adherence_pct
FROM projects p
LEFT JOIN LATERAL (
  SELECT sum(affected_area_sqm) AS area_affected,
         sum(affected_area_sqm) FILTER (WHERE status IN ('CONSENT_ACQUIRED_NOTIFIED', 'CLEARED_FOR_AWARD_RNR',
           'AWARDED', 'READY_FOR_POSSESSION', 'ACQUIRED_POSSESSED', 'CLOSED')) AS area_notified,
         sum(affected_area_sqm) FILTER (WHERE status IN ('ACQUIRED_POSSESSED', 'CLOSED')) AS area_acquired,
         count(*) AS parcels,
         count(*) FILTER (WHERE status IN ('ACQUIRED_POSSESSED', 'CLOSED')) AS possessed
  FROM project_parcels WHERE project_id = p.id
) pp ON true
LEFT JOIN LATERAL (
  SELECT sum(assessed_paise) AS assessed, sum(disbursed_paise) AS disbursed, sum(acknowledged_paise) AS acknowledged
  FROM v_family_money WHERE project_id = p.id
) m ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS families, count(*) FILTER (WHERE is_displaced) AS displaced
  FROM affected_families WHERE project_id = p.id
) f ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS total,
         count(*) FILTER (WHERE e.status IN ('ACKNOWLEDGED', 'DEPOSITED_WITH_AUTHORITY')) AS settled
  FROM entitlements e JOIN awards a ON a.id = e.award_id
  WHERE a.project_id = p.id AND a.award_type = 'RNR'
) r ON true
LEFT JOIN LATERAL (
  SELECT count(*) FILTER (WHERE status NOT IN ('NOT_STARTED', 'WAIVED', 'VOIDED')) AS started,
         count(*) FILTER (WHERE status = 'BREACHED' OR breached_at IS NOT NULL) AS breached
  FROM statutory_deadlines WHERE project_id = p.id
) dl ON true;

-- Open deadlines with live days-remaining against ClockService's now (G16, G17).
CREATE VIEW v_deadline_board WITH (security_invoker = true) AS
SELECT d.id,
       d.project_id,
       p.code                                  AS project_code,
       p.name                                  AS project_name,
       d.clock_code,
       d.section,
       d.subject_type,
       d.subject_id,
       d.started_at,
       d.due_at,
       d.consequence,
       clk.consequence_text,
       clk.label,
       dr.days_remaining,
       CASE WHEN app_now() > d.due_at THEN 'BREACHED'
            WHEN dr.days_remaining <= (rp.definition #>> '{thresholds,deadlineDueSoonDays}')::int THEN 'DUE_SOON'
            ELSE 'SAFE'
       END                                     AS live_status,
       d.status                                AS stored_status,
       si.assigned_post_id
FROM statutory_deadlines d
JOIN projects p ON p.id = d.project_id
LEFT JOIN rule_packs rp ON rp.code = d.rule_pack_code AND rp.version = d.rule_pack_version
LEFT JOIN LATERAL (
  SELECT c ->> 'consequenceText' AS consequence_text, c ->> 'label' AS label, (c ? 'endsOn') AS has_end
  FROM jsonb_array_elements(rp.definition -> 'clocks') c WHERE c ->> 'code' = d.clock_code
) clk ON true
CROSS JOIN LATERAL (
  SELECT (d.due_at AT TIME ZONE statutory_tz())::date - (app_now() AT TIME ZONE statutory_tz())::date AS days_remaining
) dr
LEFT JOIN stage_instances si ON d.subject_type = 'STAGE' AND si.id = d.subject_id
WHERE d.status NOT IN ('SATISFIED', 'WAIVED', 'VOIDED')
  -- A period with no ending event (the s.15 objection window) elapses; it is never a breach.
  AND NOT (app_now() > d.due_at AND coalesce(clk.has_end, true) = false);

GRANT SELECT ON v_consent_tally, v_family_money, v_project_kpis, v_deadline_board TO app_user, app_worker;

-- ---------------------------------------------------------------------------------------------
-- Materialised as app_worker. Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY … (as app_worker).

SET ROLE app_worker;

CREATE MATERIALIZED VIEW mv_district_kpis AS
SELECT pd.district_code,
       count(*)::int                                  AS projects,
       sum(k.area_affected_sqm)                       AS area_affected_sqm,
       sum(k.area_notified_sqm)                       AS area_notified_sqm,
       sum(k.area_acquired_sqm)                       AS area_acquired_sqm,
       sum(k.compensation_assessed_paise)::bigint     AS compensation_assessed_paise,
       sum(k.compensation_paid_paise)::bigint         AS compensation_paid_paise,
       sum(k.compensation_acknowledged_paise)::bigint AS compensation_acknowledged_paise,
       sum(k.affected_families)::int                  AS affected_families,
       sum(k.displaced_families)::int                 AS displaced_families,
       round(100.0 * sum(k.parcels_possessed) / nullif(sum(k.parcels_total), 0), 1) AS possession_pct,
       round(100.0 * sum(k.rnr_entitlements_settled) / nullif(sum(k.rnr_entitlements_total), 0), 1) AS rnr_completion_pct,
       round(100.0 * sum(k.deadlines_started - k.deadlines_breached) / nullif(sum(k.deadlines_started), 0), 1) AS timeline_adherence_pct,
       sum(k.deadlines_breached)::int                 AS deadlines_breached,
       app_now()                                      AS refreshed_at
FROM project_districts pd
JOIN v_project_kpis k ON k.project_id = pd.project_id
GROUP BY pd.district_code;
CREATE UNIQUE INDEX mv_district_kpis_pk ON mv_district_kpis (district_code);

CREATE MATERIALIZED VIEW mv_state_kpis AS
SELECT k.state_code,
       count(*)::int                                  AS projects,
       sum(k.area_affected_sqm)                       AS area_affected_sqm,
       sum(k.area_notified_sqm)                       AS area_notified_sqm,
       sum(k.area_acquired_sqm)                       AS area_acquired_sqm,
       sum(k.compensation_assessed_paise)::bigint     AS compensation_assessed_paise,
       sum(k.compensation_paid_paise)::bigint         AS compensation_paid_paise,
       sum(k.compensation_acknowledged_paise)::bigint AS compensation_acknowledged_paise,
       sum(k.affected_families)::int                  AS affected_families,
       sum(k.displaced_families)::int                 AS displaced_families,
       round(100.0 * sum(k.parcels_possessed) / nullif(sum(k.parcels_total), 0), 1) AS possession_pct,
       round(100.0 * sum(k.rnr_entitlements_settled) / nullif(sum(k.rnr_entitlements_total), 0), 1) AS rnr_completion_pct,
       round(100.0 * sum(k.deadlines_started - k.deadlines_breached) / nullif(sum(k.deadlines_started), 0), 1) AS timeline_adherence_pct,
       sum(k.deadlines_breached)::int                 AS deadlines_breached,
       app_now()                                      AS refreshed_at
FROM v_project_kpis k
GROUP BY k.state_code;
CREATE UNIQUE INDEX mv_state_kpis_pk ON mv_state_kpis (state_code);

CREATE MATERIALIZED VIEW mv_national_kpis AS
SELECT 'NATIONAL'::text                               AS scope,
       count(*)::int                                  AS projects,
       coalesce(sum(k.area_affected_sqm), 0)          AS area_affected_sqm,
       coalesce(sum(k.area_notified_sqm), 0)          AS area_notified_sqm,
       coalesce(sum(k.area_acquired_sqm), 0)          AS area_acquired_sqm,
       coalesce(sum(k.compensation_assessed_paise), 0)::bigint     AS compensation_assessed_paise,
       coalesce(sum(k.compensation_paid_paise), 0)::bigint         AS compensation_paid_paise,
       coalesce(sum(k.compensation_acknowledged_paise), 0)::bigint AS compensation_acknowledged_paise,
       coalesce(sum(k.affected_families), 0)::int     AS affected_families,
       coalesce(sum(k.displaced_families), 0)::int    AS displaced_families,
       round(100.0 * sum(k.parcels_possessed) / nullif(sum(k.parcels_total), 0), 1) AS possession_pct,
       round(100.0 * sum(k.rnr_entitlements_settled) / nullif(sum(k.rnr_entitlements_total), 0), 1) AS rnr_completion_pct,
       round(100.0 * sum(k.deadlines_started - k.deadlines_breached) / nullif(sum(k.deadlines_started), 0), 1) AS timeline_adherence_pct,
       coalesce(sum(k.deadlines_breached), 0)::int    AS deadlines_breached,
       app_now()                                      AS refreshed_at
FROM v_project_kpis k;
CREATE UNIQUE INDEX mv_national_kpis_pk ON mv_national_kpis (scope);

-- G2: the one computed money figure — ESTIMATED s.80 interest on land-head compensation still
-- unpaid after possession, as of app_now(). Simple interest on the pack's day-count basis:
--   d1 = min(days, basis), d2 = max(days - basis, 0)
--   interest = unpaid × (rateYear1 × d1 + rateAfter × d2) / (100 × basis), rounded once.
-- Must agree with estimateInterestPaise() in packages/rules (parity test lands with the engine).
CREATE MATERIALIZED VIEW mv_interest_liability AS
WITH possession AS (
  SELECT e.id AS entitlement_id, min(pe.taken_at) AS possession_at
  FROM entitlements e
  JOIN affected_families af ON af.id = e.affected_family_id
  JOIN parcel_interests pi ON pi.person_id = af.head_person_id
  JOIN project_parcels pp ON pp.parcel_id = pi.parcel_id AND pp.project_id = af.project_id
  JOIN possession_events pe ON pe.project_parcel_id = pp.id
  GROUP BY e.id
)
SELECT e.id                                   AS entitlement_id,
       af.project_id,
       e.head_code,
       u.unpaid_paise,
       po.possession_at,
       dd.days,
       round(u.unpaid_paise * (cfg.rate1 * least(dd.days, cfg.basis) + cfg.rate2 * greatest(dd.days - cfg.basis, 0))
             / (100.0 * cfg.basis))::bigint   AS estimated_interest_paise,
       app_now()                              AS as_of
FROM entitlements e
JOIN affected_families af ON af.id = e.affected_family_id
JOIN projects pr ON pr.id = af.project_id
JOIN rule_packs rp ON rp.code = pr.rule_pack_code AND rp.version = pr.rule_pack_version
JOIN possession po ON po.entitlement_id = e.id
CROSS JOIN LATERAL (
  SELECT (rp.definition #>> '{interest,rateYear1Pct}')::numeric AS rate1,
         (rp.definition #>> '{interest,rateAfterPct}')::numeric AS rate2,
         CASE rp.definition #>> '{interest,dayCount}' WHEN 'ACT_365' THEN 365 END AS basis
) cfg
CROSS JOIN LATERAL (
  SELECT e.amount_awarded_paise - coalesce((
           SELECT sum(d.amount_paise) FROM disbursements d
           WHERE d.entitlement_id = e.id AND d.payment_status = 'SUCCESS'), 0) AS unpaid_paise
) u
CROSS JOIN LATERAL (
  SELECT greatest(0, (app_now() AT TIME ZONE statutory_tz())::date
                   - (po.possession_at AT TIME ZONE statutory_tz())::date) AS days
) dd
WHERE u.unpaid_paise > 0
  AND e.head_code IN (SELECT h ->> 'code' FROM jsonb_array_elements(rp.definition -> 'entitlementHeads') h
                      WHERE h ->> 'kind' = 'LAND');
CREATE UNIQUE INDEX mv_interest_liability_pk ON mv_interest_liability (entitlement_id);

-- Per-entitlement money must stay scoped, so request handlers read the MV only through this view.
-- It is owned by app_worker (reads past RLS) and re-applies the caller's scope from the session.
CREATE VIEW v_interest_liability WITH (security_barrier = true) AS
SELECT m.*
FROM mv_interest_liability m
JOIN projects p ON p.id = m.project_id
WHERE project_in_scope(p.id, p.state_code, p.requiring_body_id, p.created_by);

GRANT SELECT ON mv_district_kpis, mv_state_kpis, mv_national_kpis, v_interest_liability TO app_user;

RESET ROLE;
