# PROJECT_HANDOFF — BhoomiSetu

Branch: `claude/magical-galileo-j0afiu` (PR frchaitanyaaa/land-acquisition-#2). Spec: `CLAUDE.md` (read §1 Golden Rules).

## Completed
- Phase 0 foundations (monorepo, DB schema/RLS/triggers/views, auth/posts, audit chain, outbox relay, rule packs + golden test).
- `packages/rules/src/engine/*` — pure engine: computeDueAt, clockStatus, startClock, checkGuards, availableActions, planTransition, estimateInterestPaise, runChecks, possessionGate, startForDueOn. 113 unit tests.
- `apps/api/src/workflow/*` — generic stage action endpoint (§13), timeline, deadlines; DeadlinesService; `jobs/deadline-scan.service.ts`.
- Seed replays stage history through the engine (`packages/db/src/scripts/seed/history.ts`).

## Currently working on
- See "Progress log" (last line = most recent).

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
- DONE Module A `apps/api/src/projects/*` (create/patch/alignment GeoJSON|KML|KMZ/prescrutiny/submit/escrow demand|deposit|certify). SQL fn `project_footprint_overlaps` in `packages/db/sql/01_functions.sql`.
- DONE gate resolvers `apps/api/src/workflow/gates.ts` (ESCROW_*, OBJECTIONS_DISPOSED, CONSENT_THRESHOLD_MET, ALL_PARCELS_*, …).
- DONE Module B server `apps/api/src/gis/*` + SQL `packages/db/sql/05_domain.sql` (intersect_project_parcels, create_family_stubs, screen_project_constraints). Migration 0002 adds parcel_corrections.proposed_geom.
- DONE seed v1 `packages/db/src/scripts/seed/{fixtures,v1,history,rng,names}.ts`: 11 projects/5 states, 1510 parcels, 3002 persons, consent registers (NGP 71%, HBL 76%, KRK Gram Sabha), MH-SIN-2025-004 money scenario (demo family / held family / possession-blocked parcel printed by seed), 40 legal cases, exactly 3 BREACHED clocks.
- DONE `packages/rules/packs/nh-act-1956@1.0.0.json` (illustrative, verify[] notes).
- DONE Module J `apps/api/src/dashboards/*` (national/state/district/project/collector, /deadlines/board, /analytics/risk, /analytics/bottlenecks, /reports/:type csv|json); `packages/rules/src/risk.ts`.
- DONE documents `apps/api/src/documents/*` (+ `adapters/storage`): POST /documents multipart (attest=true required for legal types), GET /documents, /documents/:id, /documents/:id/download, /declarations/current. Set STORAGE_PROVIDER=local in .env when MinIO is absent.
- DONE money: `apps/api/src/award/*` (awards, entitlements, checks, sign, s37), `apps/api/src/disbursement/*` (disburse w/ Idempotency-Key, hold/release, deposit-authority, ack-link, enrol-link, passbook link, attest-fallback, family money, possession gate/possession, mutations), `apps/api/src/public/public.controller.ts` (villages, parcels search, notices, enrol/ack/otp/dispute/passbook), `jobs/payment-status.service.ts`. Public DB access only via `packages/db/sql/06_public.sql`.
- DONE migrations 0003 (idempotency_keys, dev_outbox_sms, access_tokens.issued_by_post_id).
- DONE field API `apps/api/src/field/*` (+ `packages/geo/src/plausibility.ts`).
- DONE notifications `apps/api/src/notifications/*`, consumers `jobs/event-handlers.service.ts`, `jobs/event-worker.service.ts`, `jobs/mv-refresh.service.ts`, escalation in `jobs/deadline-scan.service.ts`. Set OUTBOX_RELAY=inline in .env when Redis is absent.
- DONE chain: `packages/chain/{contracts,test,scripts}`, `apps/api/src/chain/{payloads,chain.service,chain.controller}.ts`, `jobs/anchor.service.ts`, `packages/db/src/scripts/tamper.ts`. Run: `pnpm chain:node` (bg) → `pnpm chain:deploy` → restart API.
