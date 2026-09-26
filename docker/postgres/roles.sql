-- Database roles (CLAUDE.md §8). Run as a superuser, connected to the `postgres` database:
--   psql -v db_name=bhoomisetu -v owner_pass=... -v app_pass=... -v worker_pass=... -f roles.sql
--
--   owner       owns every table; migrations only. RLS is FORCED, so owner sees nothing through policies.
--   app_user    HTTP request handlers. No BYPASSRLS. Scope comes from withScope() session settings.
--   app_worker  background jobs and seed. BYPASSRLS. Never handed to a request handler.

\set ON_ERROR_STOP on

CREATE ROLE owner LOGIN PASSWORD :'owner_pass';
CREATE ROLE app_user LOGIN PASSWORD :'app_pass' NOBYPASSRLS;
CREATE ROLE app_worker LOGIN PASSWORD :'worker_pass' BYPASSRLS;

-- Lets migrations create objects AS app_worker (materialized views, the few SECURITY DEFINER
-- lookups that must read past RLS). owner can already disable RLS on its own tables, so this
-- grants it nothing new.
GRANT app_worker TO owner;

CREATE DATABASE :"db_name" OWNER owner;

\connect :"db_name"

-- postgis is not a trusted extension, so a superuser installs all three here.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

GRANT CREATE ON SCHEMA public TO app_worker;
