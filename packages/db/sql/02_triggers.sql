-- Triggers (CLAUDE.md §11.2). Re-applied on every `pnpm db:migrate`.

-- ---------------------------------------------------------------------------------------------
-- trg_parcel_geom: G11 hash + field area, whenever the geometry or its source changes.

CREATE OR REPLACE FUNCTION parcel_geom() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.geom_hash := geom_canonical_hash(NEW.geom);
  IF NEW.boundary_source = 'FIELD_DRAWN' THEN
    NEW.field_area_sqm := area_sqm(NEW.geom);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER trg_parcel_geom
  BEFORE INSERT OR UPDATE OF geom, boundary_source ON land_parcels
  FOR EACH ROW EXECUTE FUNCTION parcel_geom();

-- ---------------------------------------------------------------------------------------------
-- trg_versions_*: a correction bumps `version`; the old row is copied to <table>_versions (G14).
-- The history table is created (and kept in column-sync) here, so a schema change to a versioned
-- table needs no hand-written migration for its history.

CREATE OR REPLACE FUNCTION record_version() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO cols
  FROM pg_attribute WHERE attrelid = TG_RELID AND attnum > 0 AND NOT attisdropped;

  EXECUTE format('INSERT INTO %I (%s, superseded_at) SELECT %s, app_now() FROM (SELECT ($1).*) o',
                 TG_TABLE_NAME || '_versions', cols, cols)
    USING OLD;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.ensure_versions(base text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  vt text := base || '_versions';
  c record;
BEGIN
  IF to_regclass(vt) IS NULL THEN
    -- LIKE without INCLUDING GENERATED turns generated columns into plain ones: we keep the value.
    EXECUTE format('CREATE TABLE %I (LIKE %I)', vt, base);
    EXECUTE format('ALTER TABLE %I ADD COLUMN superseded_at timestamptz NOT NULL', vt);
    EXECUTE format('ALTER TABLE %I ADD PRIMARY KEY (id, version)', vt);
  END IF;

  FOR c IN
    SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS typ
    FROM pg_attribute a
    WHERE a.attrelid = base::regclass AND a.attnum > 0 AND NOT a.attisdropped
      AND NOT EXISTS (SELECT 1 FROM pg_attribute b
                      WHERE b.attrelid = vt::regclass AND b.attname = a.attname AND NOT b.attisdropped)
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', vt, c.attname, c.typ);
  END LOOP;

  EXECUTE format(
    'CREATE OR REPLACE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW
       WHEN (OLD.version IS DISTINCT FROM NEW.version) EXECUTE FUNCTION record_version()',
    'trg_versions_' || base, base);
END $$;

SELECT pg_temp.ensure_versions(t)
FROM unnest(ARRAY['land_parcels', 'awards', 'rnr_schemes', 'entitlements']) AS t;

-- ---------------------------------------------------------------------------------------------
-- trg_append_only (G14, G15). Legal history is never edited or deleted.

CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'audit_log', 'stage_transitions', 'attestations',
    'land_parcels_versions', 'awards_versions', 'rnr_schemes_versions', 'entitlements_versions'
  ] LOOP
    EXECUTE format('CREATE OR REPLACE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON %I
                    FOR EACH ROW EXECUTE FUNCTION forbid_mutation()', t);
  END LOOP;
END $$;

-- chain_events: only the anchoring job's status columns may change.
CREATE OR REPLACE FUNCTION chain_events_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR
     (NEW.id, NEW.entity_type, NEW.entity_id, NEW.entity_version, NEW.event_type,
      NEW.canonical_payload, NEW.data_hash, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.entity_type, OLD.entity_id, OLD.entity_version, OLD.event_type,
      OLD.canonical_payload, OLD.data_hash, OLD.created_at)
  THEN
    RAISE EXCEPTION 'chain_events is append-only: only status/tx columns may change'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON chain_events
  FOR EACH ROW EXECUTE FUNCTION chain_events_guard();

-- ---------------------------------------------------------------------------------------------
-- trg_audit_chain (§11.6). The lock serialises writers; re-numbering the id under the lock keeps
-- id order equal to chain order even when two transactions interleave.

CREATE OR REPLACE FUNCTION audit_chain() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  last_hash text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('audit_log'));
  NEW.id := nextval(pg_get_serial_sequence('audit_log', 'id'));
  SELECT hash INTO last_hash FROM audit_log ORDER BY id DESC LIMIT 1;
  NEW.prev_hash := coalesce(last_hash, 'GENESIS');
  NEW.hash := audit_row_hash(NEW.prev_hash, NEW);
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER trg_audit_chain
  BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_chain();

-- ---------------------------------------------------------------------------------------------
-- trg_updated_at on every table that has the column (history tables excluded: append-only).

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := app_now();
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN pg_tables pt ON pt.schemaname = c.table_schema AND pt.tablename = c.table_name
    WHERE c.table_schema = 'public' AND c.column_name = 'updated_at'
      AND pt.tableowner = 'owner' AND c.table_name NOT LIKE '%\_versions'
  LOOP
    EXECUTE format('CREATE OR REPLACE TRIGGER trg_updated_at BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;
