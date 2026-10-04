-- Public trust surface (§27, G22). Read by no-login handlers running as app_user with an EMPTY scope.
-- Only hashes, statuses, block numbers and times — never the canonical payload, names or amounts.

SET ROLE app_worker;

-- One-row summary of the anchoring ledger for the landing page and the public verify page.
DROP VIEW IF EXISTS public_chain_summary CASCADE;
CREATE VIEW public_chain_summary AS
SELECT count(*) FILTER (WHERE status = 'ANCHORED')::int                  AS anchored,
       count(*) FILTER (WHERE status IN ('QUEUED', 'SUBMITTED'))::int     AS pending,
       count(*) FILTER (WHERE status = 'FAILED')::int                    AS failed,
       count(DISTINCT event_type) FILTER (WHERE status = 'ANCHORED')::int AS event_types,
       max(block_number) FILTER (WHERE status = 'ANCHORED')               AS latest_block,
       max(anchored_at)                                                   AS last_anchored_at
FROM chain_events;

-- Per-record anchor rows (no payload) for the public verify page.
DROP VIEW IF EXISTS public_chain_anchor CASCADE;
CREATE VIEW public_chain_anchor AS
SELECT entity_type, entity_id, entity_version, event_type, data_hash, status, tx_hash, block_number, anchored_at
FROM chain_events;

RESET ROLE;

GRANT SELECT ON public_chain_summary, public_chain_anchor TO app_user;

-- ---------------------------------------------------------------------------------------------
-- Audit log page for the trust screens (§11.6). app_user cannot SELECT audit_log (03_grants_rls),
-- so officers read it only through this function: who (post designation), what, which record, the
-- NAMES of the fields that changed and the hash links — never the before/after values (PII).
-- The caller's role is checked by the API (national oversight roles only).
CREATE OR REPLACE FUNCTION audit_log_page(p_before_id bigint, p_limit int)
RETURNS TABLE (id bigint, at timestamptz, actor_designation text, action text, entity_type text, entity_id uuid,
               changed_keys text[], prev_hash text, hash text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT a.id, a.at, p.designation, a.action, a.entity_type, a.entity_id,
         ARRAY(SELECT k FROM (SELECT jsonb_object_keys(coalesce(a.after, '{}'::jsonb)) AS k
                              UNION SELECT jsonb_object_keys(coalesce(a.before, '{}'::jsonb))) keys
               WHERE (a.before -> k) IS DISTINCT FROM (a.after -> k) ORDER BY k),
         a.prev_hash, a.hash
  FROM audit_log a LEFT JOIN posts p ON p.id = a.actor_post_id
  WHERE p_before_id IS NULL OR a.id < p_before_id
  ORDER BY a.id DESC
  LIMIT least(greatest(coalesce(p_limit, 50), 1), 500)
$$;
REVOKE ALL ON FUNCTION audit_log_page(bigint, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION audit_log_page(bigint, int) TO app_user;
