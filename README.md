# BhoomiSetu (NLAMS)

SIH 26016 — Real-Time National Land Acquisition & Management System. The build specification is
[`CLAUDE.md`](CLAUDE.md); read §1 (Golden Rules) before writing code.

## Quick start

Needs Node ≥ 20.12 (CI uses 24, see `.nvmrc`), pnpm 10 and Docker.

```bash
cp .env.example .env
pnpm i
pnpm infra:up        # postgres+postgis, redis, minio, mailhog, hardhat node
pnpm db:reset        # drop → migrate → seed (deterministic: SEED, DEMO_NOW)
pnpm dev             # api :3001 · portal :3000 · field :5173
```

Sign in at <http://localhost:3000/login>. Every seeded account uses the password `bhoomisetu-demo`;
`demo@bhoomisetu.local` holds several posts for the role switcher. All data is synthetic.

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | api + portal + field, packages rebuilt on change |
| `pnpm db:migrate` | drizzle migrations, then `packages/db/sql/*.sql` (functions, triggers, RLS, views) |
| `pnpm db:seed` / `pnpm db:reset` | seed an empty database / drop, migrate, seed |
| `pnpm db:generate` | new drizzle migration after editing `packages/db/src/schema` |
| `pnpm test` | unit tests |
| `pnpm test:db` | RLS, geometry and audit-chain tests against the running database |
| `pnpm rules:check` | golden statutory test + forbidden-literal scan |
| `pnpm lint` / `pnpm typecheck` | |

## Layout

```
apps/api       NestJS — /api/v1, OpenAPI at /api/docs
apps/portal    Next.js — dashboards, workflow, public portal (proxies /api to the API)
apps/field     Vite + React PWA — offline field capture
packages/shared  enums, redaction map, canonical JSON
packages/rules   rule packs (JSON) + pure engine
packages/db      drizzle schema, raw SQL, seed
packages/geo     geometry helpers
packages/chain   Hardhat node (contracts in Phase 4)
```
