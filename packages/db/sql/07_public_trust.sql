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
