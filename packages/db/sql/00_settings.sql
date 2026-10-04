-- Database-level settings, applied by every `pnpm db:migrate` (runs as `owner`, the database owner).
--
-- JIT off: the RLS-scoped dashboard views (v_project_kpis and the roll-ups over it) have a high
-- planner cost, so Postgres JIT-compiles them on every call — ~2 s of LLVM work for a query that
-- executes in under 70 ms. Measured on the seeded demo: GET /dashboards/national 6.5 s → 0.19 s.
-- Takes effect for new connections.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET jit = off', current_database());
END $$;
