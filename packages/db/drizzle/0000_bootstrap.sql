-- Functions that table DEFAULTs reference, so they must exist before the schema migration.
-- Everything else (functions, triggers, RLS, views) lives in sql/ and is re-applied on every migrate.

-- G16: the database's "now". Request and job transactions set app.now from ClockService, so a
-- frozen demo clock is honoured by DEFAULTs and triggers too; outside them it is the real now().
CREATE OR REPLACE FUNCTION app_now() RETURNS timestamptz
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('app.now', true), '')::timestamptz, now())
$$;
