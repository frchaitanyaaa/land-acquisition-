-- Grants and Row-Level Security (CLAUDE.md §8, §11.3, G13, G14). Re-applied on every migrate.
--
-- app_user   (request handlers): SELECT/INSERT/UPDATE, never DELETE (G14), and every scoped table
--            is filtered by the policies below — RLS is ENABLED and FORCED.
-- app_worker (jobs, seed):       full DML, BYPASSRLS.
--
-- A policy either names project_id (inherits the caller's project visibility through the projects
-- policy) or a parent table (inherits that table's policy). Only projects and land-level tables
-- decide visibility themselves.

GRANT USAGE ON SCHEMA public TO app_user, app_worker;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner = 'owner' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_worker', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO app_user', t);
  END LOOP;
END $$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user, app_worker;

-- Reference data: read-only for request handlers.
REVOKE INSERT, UPDATE ON states, districts, sub_districts, villages, requiring_bodies,
  constraint_layers, rule_packs FROM app_user;

-- Append-only logs. app_user writes audit and outbox rows but cannot read them back.
REVOKE SELECT, UPDATE ON audit_log, outbox_events FROM app_user;
REVOKE INSERT, UPDATE ON chain_events FROM app_user;
REVOKE UPDATE ON stage_transitions, attestations,
  land_parcels_versions, awards_versions, rnr_schemes_versions, entitlements_versions FROM app_user;

-- Password hashes only through auth_credentials().
REVOKE SELECT, UPDATE ON users FROM app_user;
GRANT SELECT (id, full_name, email, phone_masked, is_active, last_login_at, created_at, updated_at, created_by)
  ON users TO app_user;
GRANT UPDATE (last_login_at) ON users TO app_user;

-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION pg_temp.scope(tbl text, cond text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
  EXECUTE format('DROP POLICY IF EXISTS scope ON %I', tbl);
  EXECUTE format('CREATE POLICY scope ON %I FOR ALL TO app_user USING (%s) WITH CHECK (%s)', tbl, cond, cond);
END $$;

-- The root: who sees which project.
SELECT pg_temp.scope('projects',
  'project_in_scope(projects.id, projects.state_code, projects.requiring_body_id, projects.created_by)');

-- Tables that carry project_id.
SELECT pg_temp.scope(t, 'project_id IN (SELECT id FROM projects)')
FROM unnest(ARRAY[
  'project_districts', 'stage_instances', 'stage_transitions', 'expert_recommendations',
  'government_overrides', 'hearings', 'statutory_deadlines', 'project_parcels', 'field_surveys',
  'spatial_flags', 'common_property_resources', 'affected_families', 'sia_census_records',
  'rnr_census_records', 'consent_registers', 'objections', 'claims', 'escrow_accounts', 'awards',
  'awards_versions', 'rnr_schemes', 'rnr_schemes_versions', 'resettlement_sites', 'legal_cases',
  'monitoring_audits'
]) AS t;

-- Tables that reach a project through a parent.
SELECT pg_temp.scope(t, c) FROM (VALUES
  ('stage_checklist',          'stage_instance_id IN (SELECT id FROM stage_instances)'),
  ('parcel_vertices',          'survey_id IN (SELECT id FROM field_surveys)'),
  ('jir_items',                'survey_id IN (SELECT id FROM field_surveys)'),
  ('family_members',           'affected_family_id IN (SELECT id FROM affected_families)'),
  ('consent_register_entries', 'register_id IN (SELECT id FROM consent_registers)'),
  ('consent_records',          'register_entry_id IN (SELECT id FROM consent_register_entries)'),
  ('escrow_transactions',      'escrow_account_id IN (SELECT id FROM escrow_accounts)'),
  ('entitlements',             'affected_family_id IN (SELECT id FROM affected_families)'),
  ('entitlements_versions',    'affected_family_id IN (SELECT id FROM affected_families)'),
  ('disbursements',            'entitlement_id IN (SELECT id FROM entitlements)'),
  ('acknowledgements',         'disbursement_id IN (SELECT id FROM disbursements)'),
  ('annuity_schedules',        'entitlement_id IN (SELECT id FROM entitlements)'),
  ('amenity_milestones',       'site_id IN (SELECT id FROM resettlement_sites)'),
  ('rnr_passbooks',            'affected_family_id IN (SELECT id FROM affected_families)'),
  ('possession_events',        'project_parcel_id IN (SELECT id FROM project_parcels)'),
  ('severance_claims',         'project_parcel_id IN (SELECT id FROM project_parcels)'),
  ('utilisation_audits',       'project_parcel_id IN (SELECT id FROM project_parcels)'),
  ('value_sharing_events',     'project_parcel_id IN (SELECT id FROM project_parcels)'),
  ('legal_case_events',        'case_id IN (SELECT id FROM legal_cases)'),
  ('attestations',             'document_id IN (SELECT id FROM documents)'),
  ('ocr_extractions',          'document_id IN (SELECT id FROM documents)')
) AS p(t, c);

-- Documents are polymorphic, so they carry project_id for scoping (see schema/trust.ts).
SELECT pg_temp.scope('documents',
  '(project_id IS NOT NULL AND project_id IN (SELECT id FROM projects)) OR uploaded_by_user_id = app_user_id()');

-- Land-level tables: scoped by geography, plus whatever the caller's projects touch.
SELECT pg_temp.scope(t, 'can_see_village(village_code) OR id IN (SELECT parcel_id FROM project_parcels)')
FROM unnest(ARRAY['land_parcels', 'land_parcels_versions']) AS t;

SELECT pg_temp.scope(t, c) FROM (VALUES
  ('parcel_interests',     'parcel_id IN (SELECT id FROM land_parcels)'),
  ('boundary_pillars',     'parcel_id IN (SELECT id FROM land_parcels)'),
  ('mutations',            'parcel_id IN (SELECT id FROM land_parcels)'),
  ('parcel_corrections',   'parcel_id IN (SELECT id FROM land_parcels)'),
  ('persons',              'can_see_village(village_code)
                            OR id IN (SELECT person_id FROM parcel_interests)
                            OR id IN (SELECT head_person_id FROM affected_families)
                            OR id IN (SELECT person_id FROM family_members)'),
  ('webauthn_credentials', 'person_id IN (SELECT id FROM persons)'),
  ('access_tokens',        'person_id IN (SELECT id FROM persons)')
) AS p(t, c);

-- A post sees its own inbox.
SELECT pg_temp.scope('notifications', 'recipient_post_id = app_post_id() OR recipient_user_id = app_user_id()');
