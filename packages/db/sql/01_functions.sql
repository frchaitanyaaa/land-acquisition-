-- Functions (CLAUDE.md §11.1, §11.3, §11.6). Re-applied on every `pnpm db:migrate`.
-- app_now() lives in drizzle/0000_bootstrap.sql because table defaults need it first.

-- ---------------------------------------------------------------------------------------------
-- Session settings written by withScope() (packages/db/src/scope.ts). Empty string = unset.

CREATE OR REPLACE FUNCTION app_setting(name text) RETURNS text
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.' || name, true), '') $$;

CREATE OR REPLACE FUNCTION app_level() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT app_setting('jurisdiction_level') $$;

CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT app_setting('user_id')::uuid $$;

CREATE OR REPLACE FUNCTION app_post_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT app_setting('post_id')::uuid $$;

CREATE OR REPLACE FUNCTION app_state_code() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT app_setting('state_code') $$;

CREATE OR REPLACE FUNCTION app_district_code() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT app_setting('district_code') $$;

CREATE OR REPLACE FUNCTION app_requiring_body_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT app_setting('requiring_body_id')::uuid $$;

CREATE OR REPLACE FUNCTION app_project_ids() RETURNS uuid[]
LANGUAGE sql STABLE AS $$ SELECT coalesce(string_to_array(app_setting('project_ids'), ',')::uuid[], '{}') $$;

-- G17: statutory dates are computed in this zone.
CREATE OR REPLACE FUNCTION statutory_tz() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT coalesce(app_setting('statutory_tz'), 'Asia/Kolkata') $$;

-- ---------------------------------------------------------------------------------------------
-- Geometry (§11.1)

-- G11: the ONLY way to hash geometry. 1e-7 degrees ≈ 1.1 cm.
CREATE OR REPLACE FUNCTION geom_canonical_hash(g geometry) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT encode(digest(
    ST_AsBinary(ST_Normalize(ST_ReducePrecision(ST_Force2D(g), 0.0000001))),
  'sha256'), 'hex')
$$;

-- G10: authoritative area, on the spheroid.
CREATE OR REPLACE FUNCTION area_sqm(g geometry) RETURNS numeric
LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT round(ST_Area(g::geography)::numeric, 2) $$;

-- Linear corridor from an alignment.
CREATE OR REPLACE FUNCTION corridor(line geometry, row_width_m numeric) RETURNS geometry
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT ST_Multi(ST_Buffer(line::geography, row_width_m / 2.0)::geometry)
$$;

-- Chainage (km) of a geometry along an alignment.
CREATE OR REPLACE FUNCTION chainage_km(line geometry, g geometry) RETURNS numeric
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT round((ST_LineLocatePoint(line, ST_PointOnSurface(g)) * ST_Length(line::geography) / 1000.0)::numeric, 3)
$$;

-- ---------------------------------------------------------------------------------------------
-- Canonical JSON for hashing inside the database (audit chain).
-- Keys are ordered with COLLATE "C" (byte order), which equals JCS's UTF-16 order for the ASCII
-- keys we use; numbers drop trailing zeros so 12.50 hashes like JavaScript's 12.5.

CREATE OR REPLACE FUNCTION jcs(j jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  CASE jsonb_typeof(j)
    WHEN 'object' THEN
      RETURN '{' || coalesce((
        SELECT string_agg(to_json(k)::text || ':' || jcs(v), ',' ORDER BY k COLLATE "C")
        FROM jsonb_each(j) AS e(k, v)), '') || '}';
    WHEN 'array' THEN
      RETURN '[' || coalesce((
        SELECT string_agg(jcs(v), ',' ORDER BY n)
        FROM jsonb_array_elements(j) WITH ORDINALITY AS a(v, n)), '') || ']';
    WHEN 'number' THEN
      RETURN trim_scale(j::text::numeric)::text;
    ELSE
      RETURN j::text;
  END CASE;
END $$;

-- ---------------------------------------------------------------------------------------------
-- Scope (§11.3). project_in_scope() is THE definition of project visibility: the projects policy
-- uses it, and so do the few views that must read past RLS and re-apply the caller's scope.

-- Owned by app_worker (BYPASSRLS) so the projects policy can read project_districts without the
-- two policies recursing into each other.
CREATE OR REPLACE FUNCTION project_district_codes(pid uuid) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(array_agg(district_code ORDER BY district_code), '{}')
  FROM project_districts WHERE project_id = pid
$$;
ALTER FUNCTION project_district_codes(uuid) OWNER TO app_worker;
REVOKE ALL ON FUNCTION project_district_codes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION project_district_codes(uuid) TO app_user, app_worker;

CREATE OR REPLACE FUNCTION project_in_scope(
  p_id uuid, p_state_code text, p_requiring_body_id uuid, p_created_by uuid
) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT
    (CASE app_level()
       WHEN 'NATIONAL' THEN true
       WHEN 'STATE' THEN
         p_state_code = app_state_code()
         OR EXISTS (SELECT 1 FROM districts d
                    WHERE d.code = ANY (project_district_codes(p_id)) AND d.state_code = app_state_code())
       WHEN 'DISTRICT' THEN app_district_code() = ANY (project_district_codes(p_id))
       WHEN 'PROJECT' THEN p_id = ANY (app_project_ids()) OR p_requiring_body_id = app_requiring_body_id()
       ELSE false
     END)
    OR (p_created_by IS NOT NULL AND p_created_by = app_user_id())
$$;

-- Land-level tables have no project_id; they are scoped by geography (§11.3).
CREATE OR REPLACE FUNCTION can_see_village(v text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT CASE app_level()
    WHEN 'NATIONAL' THEN true
    WHEN 'STATE' THEN EXISTS (
      SELECT 1 FROM villages vi
      JOIN sub_districts sd ON sd.code = vi.sub_district_code
      JOIN districts d ON d.code = sd.district_code
      WHERE vi.code = v AND d.state_code = app_state_code())
    WHEN 'DISTRICT' THEN EXISTS (
      SELECT 1 FROM villages vi
      JOIN sub_districts sd ON sd.code = vi.sub_district_code
      WHERE vi.code = v AND sd.district_code = app_district_code())
    ELSE false
  END
$$;

-- ---------------------------------------------------------------------------------------------
-- Login reads the password hash through this, never through a table grant.

CREATE OR REPLACE FUNCTION auth_credentials(p_email text)
RETURNS TABLE (user_id uuid, password_hash text, is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT id, password_hash, is_active FROM users WHERE lower(email) = lower(p_email)
$$;
REVOKE ALL ON FUNCTION auth_credentials(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_credentials(text) TO app_user;

-- ---------------------------------------------------------------------------------------------
-- Audit hash chain (§11.6): hash = sha256(prev_hash || JCS(row fields)); the first prev is GENESIS.

CREATE OR REPLACE FUNCTION audit_row_hash(prev text, a audit_log) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT encode(digest(prev || jcs(jsonb_build_object(
    'at',            to_char(a.at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'actor_user_id', a.actor_user_id,
    'actor_post_id', a.actor_post_id,
    'action',        a.action,
    'entity_type',   a.entity_type,
    'entity_id',     a.entity_id,
    'before',        a.before,
    'after',         a.after
  )), 'sha256'), 'hex')
$$;

-- Walks the chain in id order. first_broken_id is NULL when every link holds.
CREATE OR REPLACE FUNCTION audit_verify() RETURNS TABLE (checked bigint, first_broken_id bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  r audit_log;
  prev text := 'GENESIS';
  n bigint := 0;
BEGIN
  FOR r IN SELECT * FROM audit_log ORDER BY id LOOP
    n := n + 1;
    IF r.prev_hash IS DISTINCT FROM prev OR r.hash IS DISTINCT FROM audit_row_hash(prev, r) THEN
      checked := n; first_broken_id := r.id; RETURN NEXT; RETURN;
    END IF;
    prev := r.hash;
  END LOOP;
  checked := n; first_broken_id := NULL; RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION audit_verify() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION audit_verify() TO app_user, app_worker;
