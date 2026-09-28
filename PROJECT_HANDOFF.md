# PROJECT_HANDOFF — BhoomiSetu

Branch: `claude/magical-galileo-j0afiu` (PR frchaitanyaaa/land-acquisition-#2). Spec: `CLAUDE.md` (read §1 Golden Rules).

## Completed
- Phase 0 foundations (monorepo, DB schema/RLS/triggers/views, auth/posts, audit chain, outbox relay, rule packs + golden test).
- `packages/rules/src/engine/*` — pure engine: computeDueAt, clockStatus, startClock, checkGuards, availableActions, planTransition, estimateInterestPaise, runChecks, possessionGate, startForDueOn. 113 unit tests.
- `apps/api/src/workflow/*` — generic stage action endpoint (§13), timeline, deadlines; DeadlinesService; `jobs/deadline-scan.service.ts`.
- Seed replays stage history through the engine (`packages/db/src/scripts/seed/history.ts`).

## Currently working on
- (see bottom "Progress log")

## Commands
```bash
pg_ctlcluster 16 main start            # local PG16+PostGIS (no docker in cloud container)
export DEMO_NOW='2026-12-10T10:00:00+05:30'
pnpm db:reset                          # drop, migrate, seed
pnpm lint && pnpm typecheck && pnpm test && pnpm rules:check && pnpm test:db
pnpm turbo run build --filter=@bhoomisetu/api && (cd apps/api && set -a && . ../../.env && set +a && OUTBOX_RELAY=off node dist/main.js)
```
First-time in a fresh cloud container: `apt-get install -y postgresql-16-postgis-3`, then
`su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres'\""` and
`PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -v db_name=bhoomisetu -v owner_pass=owner_pass -v app_pass=app_pass -v worker_pass=worker_pass -f docker/postgres/roles.sql`, `cp .env.example .env`.
Login: any seeded email (see `packages/db/src/scripts/seed/fixtures.ts` USERS), password `bhoomisetu-demo`. API: POST /api/v1/auth/login → `accessToken` (Bearer).

## Progress log
