# CLAUDE.md — BhoomiSetu (NLAMS)

> **SIH 26016 · Real-Time National Land Acquisition & Management System**
> Team *Kabhi Code Kabhi Bug* · 5 developers · all working through Claude Code
> This file is the single build specification. Claude Code loads it at the start of every session.

---

## 0. HOW TO USE THIS FILE

### For Claude Code

1. **Read §1 (Golden Rules) before every task.** They override anything else, including a user request that conflicts with them — if a request conflicts, stop and say so.
2. Find the section for the module you are touching (§12 onward) and read it fully before writing code.
3. **Never hard-code a statutory number.** Every deadline, percentage, threshold and amount lives in `packages/rules/packs/*.json`. If you need one, read it from the rule engine.
4. Write tests **first** for anything in: rule engine, money, interest, geometry hashing, redaction, workflow guards.
5. If you change a decision recorded here, update this file in the same PR.
6. If something here is marked **[VERIFY]**, do not present it as settled fact in UI copy, seed data labels or docs.

### For the team

- This file lives at the repo root as `CLAUDE.md`. Changes go through PR review like code.
- Sections are ordered: rules → context → stack → data → engine → modules → cross-cutting → data/demo → plan.
- Diagrams live in `docs/diagrams/`. Research and decision history live in `docs/research/`.

### Source priority (when anything conflicts)

| Rank | Source | Use it for |
|---|---|---|
| 1 | SIH PS 26016 | What must exist |
| 2 | RFCTLARR Act 2013 (uploaded text) | Every number, deadline, section |
| 3 | This file | How we build it |
| 4 | Land Acquisition Process doc | Who does what, documents, rejection routes — **never its numbers** |
| 5 | Project Blueprint (Modules A–J) | Module packaging — **never its numbers or chapter citations** |

---

## 1. GOLDEN RULES — NEVER BREAK THESE

These are product and legal decisions, not style preferences. Each has a reason; the reason is why it cannot be traded away for convenience.

| # | Rule | Why |
|---|---|---|
| **G1** | **Never compute a compensation award.** The system records the Collector's award as input, validates it, and tracks it. | Assessment is a legal act by the Collector (ss.23, 27, 31). If our number differs from the Collector's, we create a legal question. |
| **G2** | **The only money figure we compute is estimated s.80 interest liability** (and display-only derived values an officer confirms). Label it "estimated". | It depends on elapsed time, which only the system knows. |
| **G3** | **AI never writes to an authoritative column.** AI output goes into `ai_suggested_*` columns. Only a human action copies it into the record. | Ownership and possession are legal facts. |
| **G4** | **Hash and anchor only human-approved records.** Never raw field capture, never AI output. | The chain must prove a human decision. |
| **G5** | **Blockchain is never in the request path.** API calls return immediately; anchoring happens in a background job. | If the chain is down, nothing stops — only the proof shows as pending. |
| **G6** | **Never store a fingerprint, biometric template or image of one.** Store only a WebAuthn credential ID, public key and counter. | Legal and privacy liability. Matching happens on the device. |
| **G7** | **Never integrate real Aadhaar, UIDAI e-KYC, PFMS, treasury, bank or Bhu-Naksha.** Use adapters with mocks. Label mocks visibly in the UI. | We have no licence or authorisation. Never claim live access. |
| **G8** | **No statutory literal outside `packages/rules`.** No `0.8`, `60`, `12 months`, `1.25`, `100%` in business code. | The law changes (s.24 proves it). Also stops wrong numbers creeping in. |
| **G9** | **Money is integer paise (`bigint`). Never floats.** | Rounding errors in compensation are unacceptable. |
| **G10** | **Area is computed on `geography`, never on raw EPSG:4326 degrees.** Store m², display ha / acre / guntha. | Degrees² is meaningless. |
| **G11** | **Geometry hashes come only from the SQL function `geom_canonical_hash()`.** | Same polygon serialised differently must give the same hash. |
| **G12** | **Every state change goes through the workflow engine.** No direct `UPDATE ... SET status` from a controller. | Guards (role, maker-checker, documents, gates, deadlines) live there. |
| **G13** | **Scope is enforced in the database (RLS), redaction in the API.** Never rely on the frontend to hide data. | One forgotten filter is a data leak across districts. |
| **G14** | **Never hard-delete a legal record.** Supersede with a new version. | Legal records must be reconstructable. |
| **G15** | **Every mutation writes to `audit_log`.** The log is append-only (enforced by trigger). | Accountability is the product. |
| **G16** | **All "now" comes from `ClockService`.** Never `new Date()` / `Date.now()` in business logic. | The demo freezes time so countdowns are reproducible. |
| **G17** | **Statutory dates are computed in `Asia/Kolkata`**, stored as UTC `timestamptz`. | A deadline is a date in India, not an instant in UTC. |
| **G18** | **Only synthetic personal data.** Every generated record has `data_source = 'synthetic_demo'` and the UI shows a DEMO DATA badge. | We never touch real citizen data. |
| **G19** | **Roles attach to posts, not people.** Actions record both `actor_user_id` and `actor_post_id`. | History must survive officer transfers. |
| **G20** | **Maker ≠ checker** for any action the rule pack marks `makerChecker: true`. | The Act separates them (ss.16–18). |
| **G21** | **Every uploaded document carries a per-document officer attestation** (§26), recording the declaration wording version. | Named accountability; s.84. |
| **G22** | **Public endpoints read only from `public_*` SQL views.** | Defence in depth for citizen privacy. |

---

## 2. PROJECT IN ONE PAGE

### Identity

| | |
|---|---|
| Product | **BhoomiSetu** (working name NLAMS) |
| Problem | SIH 26016 — Ministry of Rural Development |
| Title | Real-Time National Land Acquisition & Management System for End-to-End Digital Monitoring and Decision Support |
| Sub-theme | AI, GIS & Data Analytics for Public Administration and Infrastructure Management |
| Governing law | RFCTLARR Act 2013 (Act No. 30 of 2013) |
| Demo scenario | Pune–Satara Expressway Expansion, Maharashtra — linear corridor, ~50 km, ~150 ha. Villages include Khed Shivapur and Shirwal. |

### The thesis

> **BhoomiSetu tracks a land parcel from proposal to possession to closure — enforced by the law's own deadlines, visible to every stakeholder, on a map, in real time.**

### The six innovations (what makes us different)

Build priority follows this order. Items 1 and 2 are what the demo is built around.

| # | Innovation | One-line build meaning |
|---|---|---|
| 1 | **Payment acknowledgement loop** | Disbursed ≠ received. Family confirms receipt via WebAuthn on their own phone. Dashboard shows the gap. |
| 2 | **Statutory timeline engine** | Every stage has a clock from the rule pack with a legal consequence. "This notification lapses in 34 days." Interest cost of delay computed live. |
| 3 | **Blockchain trust layer** | Human-approved records hashed (canonical JSON) and anchored on a permissioned EVM chain, off the request path. Silent DB edits are detectable. |
| 4 | **GIS field verification** | Officer walks the boundary; GPS point + photo at every corner; works offline; recorded vs measured area both kept. |
| 5 | **Policy-change resilience (rule packs)** | Statute + state rules are versioned JSON. A case keeps the pack version it started under. |
| 6 | **AI administrative intelligence** | Natural-language questions answered through whitelisted analytics tools under the user's own data scope. Advisory only. |

### What the PS requires (floor — every team will show these)

End-to-end workflow · online submission/approval/tracking · GIS geo-tagging · national dashboard (area notified, area acquired, compensation assessed & paid, affected & displaced families, R&R status, project progress, possession status, timeline adherence) · API integration with land records and portals · mobile field interface · secure versioned document repository with audit history · customisable MIS and executive reports · RBAC · alerts · predictive analytics.

Every one of these is covered in §12–§31. The traceability table is §37.

---

## 3. GLOSSARY

Use these terms exactly in code, UI and docs.

| Term | Meaning |
|---|---|
| **Appropriate Government** | The government acquiring the land — State, or Central for inter-state projects |
| **Requiring Body** | The agency that needs the land (e.g. NHAI, MSRDC) |
| **Collector** | District Collector / Deputy Commissioner |
| **LAO** | Land Acquisition Officer / Land Acquisition Collector / Special SDM |
| **CALA** | Competent Authority for Land Acquisition — designation under sector acts such as the NH Act 1956 |
| **Affected family** | s.3 — wider than owners: labourers, tenants, sharecroppers, livelihood-dependent persons, forest dwellers |
| **Person interested** | s.3 — anyone claiming an interest in compensation, including easement and tenancy holders |
| **SIA / SIMP** | Social Impact Assessment / Social Impact Management Plan |
| **R&R** | Rehabilitation and Resettlement |
| **Administrator / Commissioner** | Administrator for R&R (s.43) / Commissioner for R&R (s.44) |
| **LARR Authority** | Land Acquisition, Rehabilitation and Resettlement Authority (ss.51–74) |
| **DLSA** | District Legal Services Authority — provides neutral observers for consent |
| **DILR** | District Inspector of Land Records |
| **RoR** | Record of Rights — 7/12 extract (Maharashtra), Khatauni, Jamabandi |
| **JIR** | Joint Inspection Report — inventory of trees, crops, wells, structures |
| **Panchnama** | Witnessed on-site record, used at possession |
| **Survey number / Gat / Khasra** | Plot identifiers; sub-divisions written as `214/3` |
| **Guntha** | 1/40 acre = 101.17141056 m² (used in Maharashtra) |
| **Rule pack** | Versioned JSON bundle of statute + state rules |
| **Stage** | One of the 10 statutory stages; the unit of approval |
| **Clock** | A statutory deadline instance with a start event, due date and consequence |
| **Post** | A designation + jurisdiction (e.g. "Collector, Pune"). Users are assigned to posts. |
| **Anchor** | A hash of an approved record written to the chain |
| **Acknowledgement** | A family's confirmation that money was received |
| **Paise** | 1/100 rupee. All money is stored in paise. |

---

## 4. TECH STACK

One language (TypeScript) across the whole repo. Pin **major** versions; let the lockfile pin the rest.

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js 24 LTS | Node 20 reached end-of-life in April 2026; `engines` allows ≥ 20.12 |
| Package manager | pnpm workspaces | |
| Monorepo build | Turborepo | |
| Language | TypeScript, `strict: true` | No `any` in domain code |
| Backend | NestJS 11 | REST, `/api/v1`, OpenAPI via `@nestjs/swagger` (NestJS 10 is end-of-life) |
| ORM | Drizzle ORM + drizzle-kit | SQL-first; PostGIS via custom types and `sql` template |
| Database | PostgreSQL 16 + PostGIS 3.4 | Extensions: `postgis`, `pgcrypto`, `pg_trgm` |
| Queue / jobs | BullMQ + Redis 7 | Outbox relay, anchoring, deadlines, OCR, notifications |
| Object storage | MinIO (S3-compatible) | Presigned URLs, short TTL |
| Portal frontend | Next.js 16 (App Router), React 19 | Dashboards, workflow, public portal. The field app uses React 19 too. |
| Field app | Vite + React PWA | `vite-plugin-pwa` (Workbox), Dexie (IndexedDB) |
| UI | **UX4G** (`ux4g-web-components` 3.x) | Decided 1 Oct 2026: replaces Tailwind + shadcn/ui (Tailwind removed screen by screen). CSS + runtime imported once at the root. Theme: navy primary + saffron secondary via `--ux4g-color-primary-*` / `--ux4g-color-secondary-*` root overrides. Identity: text + tricolour strip, **no State Emblem**. See `prompts/team/00-shared-context.md` |
| Data fetching | TanStack Query | |
| Forms / validation | react-hook-form + zod | zod schemas shared from `packages/shared` |
| Maps | Leaflet + react-leaflet | `preferCanvas: true`; protomaps-leaflet for PMTiles basemap |
| Client geometry | @turf/turf | Live area estimate, self-intersection check (client only — server is authoritative) |
| Charts | Recharts | |
| Dates | luxon | ISO-8601 durations (`P6M`, `P60D`, `P6W`, `P5Y`), `Asia/Kolkata` |
| Auth | JWT access (15 min) + rotating refresh (7 days), argon2id | httpOnly cookies on the portal |
| WebAuthn | @simplewebauthn/server + @simplewebauthn/browser | Beneficiary acknowledgement |
| Blockchain | Hardhat (local node), Solidity ^0.8.24, ethers v6, OpenZeppelin AccessControl | Hyperledger Besu = stated production direction, **not built** |
| Canonical JSON | `canonicalize` (RFC 8785 JCS) | For anchor payloads |
| File parsing | @tmcw/togeojson (KML), jszip (KMZ), shpjs (Shapefile zip), proj4 (reprojection) | DXF not parsed in MVP |
| PDF / OCR | pdf-parse (text PDFs), tesseract.js (scans) | |
| LLM | Provider adapter (`mock` / real) | Tool-calling only; never generates SQL |
| Real-time | Server-Sent Events | Dashboard live updates, notification badge |
| i18n | next-intl (portal), i18next (field) | en, hi, mr |
| Testing | Vitest, Supertest, Playwright, Hardhat tests | |
| Lint / format | ESLint + Prettier | |
| CI | GitHub Actions | lint, typecheck, unit, contract tests |
| Local infra | Docker Compose | |
| Phone access in demo | HTTPS tunnel (cloudflared or ngrok) | Required — see §16.1 |

### Explicitly NOT used

GeoServer · BPMN / Camunda · microservices · Python services · MongoDB · GraphQL · real Aadhaar / PFMS / bank APIs · production blockchain network · ML model training.

---

## 5. REPOSITORY STRUCTURE

```
bhoomisetu/
├── CLAUDE.md                     ← this file
├── README.md                     ← quick start only
├── package.json                  ← root scripts
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.yml
├── .env.example
├── .github/workflows/ci.yml
│
├── apps/
│   ├── api/                      ← NestJS backend (all modules, jobs, adapters)
│   ├── portal/                   ← Next.js: official dashboards + workflow + public portal
│   └── field/                    ← Vite React PWA: field capture, offline
│
├── packages/
│   ├── shared/                   ← zod schemas, enums, DTO types, redaction map, formatters, declaration texts
│   ├── rules/                    ← rule packs (JSON) + rule engine (pure TS, no I/O)
│   │   ├── packs/
│   │   │   ├── larr-2013-base@1.0.0.json
│   │   │   ├── larr-2013-maharashtra@1.0.0.json
│   │   │   └── nh-act-1956@1.0.0.json
│   │   ├── schema/pack.schema.ts ← zod schema that every pack must satisfy
│   │   └── src/                  ← engine: resolve, guards, clocks, interest, validation checks
│   ├── db/                       ← drizzle schema, migrations, raw SQL (RLS, functions, triggers, views), seed
│   ├── geo/                      ← server geometry helpers (units, parsing, chainage)
│   └── chain/                    ← Hardhat project: contracts, tests, deploy scripts
│
├── data/
│   ├── lgd/                      ← LGD CSV extracts (downloaded manually — see §33.2)
│   ├── boundaries/               ← village boundary GeoJSON for demo districts
│   ├── constraints/              ← forest / eco-sensitive / water / scheduled-area GeoJSON (synthetic if unavailable)
│   ├── tiles/                    ← regional PMTiles basemap for offline use
│   └── demo-docs/                ← sample award PDF, notification PDF, hearing audio (all synthetic)
│
├── docs/
│   ├── diagrams/                 ← architecture, workflow, ER (mermaid), pipeline + flow (svg)
│   ├── research/                 ← NLAMS_FINAL.md, decision log export
│   └── adr/                      ← architecture decision records
│
└── scripts/                      ← one-off tooling (tile extract, boundary extract)
```

### `apps/api/src` layout

```
main.ts
app.module.ts
common/
  clock/            ClockService (real | frozen via DEMO_NOW)
  db/               drizzle client, withScope() transaction helper (sets RLS settings)
  audit/            AuditInterceptor (writes audit_log for every mutation)
  redaction/        RedactionInterceptor (applies FIELD_VISIBILITY map)
  errors/           RFC 7807 problem+json filter
  outbox/           writeOutbox() used inside domain transactions
  guards/           JwtGuard, PostGuard, PermissionGuard
auth/               login, refresh, logout, me, switch-post
org/                users, posts, post_assignments, requiring bodies
rules/              loads packs at boot, syncs to rule_packs table, exposes RuleEngine
workflow/           stage actions, transitions, guards, hearings validity, overrides
projects/           Module A — intake, alignment upload, pre-scrutiny, routing
gis/                Module B — intersection, parcels, constraints, chainage, corrections, verification
field/              Module B — assignments, offline pack, survey sync
sia/                Module C — SIA census, CPR, hearings, SIA reports, expert group
consent/            Module D — consent registers, records, tally
notice/             Module D — s.11 publication, transfer freeze, objections
rnr/                Module E — R&R census, scheme, sites, amenities, passbook
award/              Module F — escrow, s.19, s.21 claims, awards, OCR review, entitlements
disbursement/       Module G — disbursements, holds, authority deposits, acknowledgement, possession, mutation
legal/              Module H — LARR Authority cases
compliance/         Module I — annuities, severance, utilisation, value sharing, monitoring audits
dashboards/         Module J — national/state/district/project aggregates, MIS reports
analytics/          delay risk scoring, bottleneck analysis
assistant/          AI assistant (tool-calling)
documents/          upload, versioning, presigned URLs, attestation
chain/              chain_events, verify endpoint
notifications/      in-app, email, SMS, SSE stream, escalation
public/             no-login endpoints over public_* views
adapters/           identity, payments, cadastral, sms, email, llm, stt, storage — each with mock + interface
jobs/               BullMQ processors: outbox-relay, anchor, deadline-scan, ocr, notify, mv-refresh
demo/               reset, tamper (guarded by DEMO_MODE=true)
```

---

## 6. COMMANDS

Root `package.json` scripts. Keep these names stable — the team and Claude Code rely on them.

| Command | Does |
|---|---|
| `pnpm i` | Install everything |
| `pnpm infra:up` | `docker compose up -d` (postgres, redis, minio, mailhog, chain) |
| `pnpm infra:down` | Stop infra |
| `pnpm db:migrate` | Run drizzle migrations + raw SQL (functions, triggers, RLS, views) |
| `pnpm db:seed` | Seed reference data + synthetic demo dataset (deterministic, `SEED=26016`) |
| `pnpm db:reset` | Drop, migrate, seed |
| `pnpm chain:deploy` | Deploy `AnchorRegistry` to local Hardhat node; writes address into `.env.local` |
| `pnpm dev` | Turbo: api (3001) + portal (3000) + field (5173) |
| `pnpm test` | Unit tests across packages |
| `pnpm test:contracts` | Hardhat contract tests |
| `pnpm test:e2e` | Playwright — includes the full demo script (§34) |
| `pnpm lint` / `pnpm typecheck` | |
| `pnpm demo:reset` | Restore demo dataset to its starting state (DEMO_MODE only) |
| `pnpm demo:tamper` | Silently edit one parcel geometry via raw SQL to demonstrate MISMATCH detection |
| `pnpm demo:tunnel` | Start HTTPS tunnel for phones; prints URL to put in `WEBAUTHN_RP_ID` / `PUBLIC_BASE_URL` |
| `pnpm rules:check` | Validate all packs against schema + golden statutory test |

First-time setup:

```bash
cp .env.example .env
pnpm i
pnpm infra:up
pnpm db:migrate
pnpm chain:deploy
pnpm db:seed
pnpm dev
```

---

## 7. ENVIRONMENT VARIABLES

`.env.example` must contain every variable below with a safe dev default.

```bash
# --- core
NODE_ENV=development
API_PORT=3001
PORTAL_URL=http://localhost:3000
FIELD_URL=http://localhost:5173
PUBLIC_BASE_URL=http://localhost:3000        # set to tunnel URL for phone demos

# --- database
DATABASE_URL=postgres://app_user:app_pass@localhost:5432/bhoomisetu        # request handlers (RLS enforced)
DATABASE_WORKER_URL=postgres://app_worker:worker_pass@localhost:5432/bhoomisetu  # jobs (BYPASSRLS)
DATABASE_OWNER_URL=postgres://owner:owner_pass@localhost:5432/bhoomisetu   # migrations only

# --- redis / storage
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio12345
S3_BUCKET=bhoomisetu-docs
S3_PRESIGN_TTL_SECONDS=300

# --- auth & crypto
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too
PII_ENCRYPTION_KEY=base64-32-bytes           # AES-256-GCM for phone / bank refs

# --- webauthn (acknowledgement)
WEBAUTHN_RP_ID=localhost                     # tunnel hostname for phone demos, no scheme/port
WEBAUTHN_RP_NAME=BhoomiSetu
WEBAUTHN_ORIGIN=http://localhost:3000        # must match the page origin exactly

# --- chain
CHAIN_RPC_URL=http://localhost:8545
CHAIN_ANCHOR_CONTRACT=                       # written by pnpm chain:deploy
CHAIN_RELAYER_PRIVATE_KEY=                   # hardhat account #1 in dev
CHAIN_CONFIRMATIONS=1

# --- adapters (mock | real)
IDENTITY_PROVIDER=mock
PAYMENT_PROVIDER=mock
CADASTRAL_PROVIDER=mock
SMS_PROVIDER=mock
STT_PROVIDER=mock
LLM_PROVIDER=mock
LLM_API_KEY=
LLM_MODEL=
SMTP_HOST=localhost
SMTP_PORT=1025

# --- time
STATUTORY_TZ=Asia/Kolkata
DEMO_MODE=true
DEMO_NOW=                                    # e.g. 2026-12-10T10:00:00+05:30 — freezes ClockService when set
SEED=26016

# --- maps
TILES_PMTILES_URL=/tiles/demo-region.pmtiles
SATELLITE_TILE_URL=                          # optional, online only, portal only, with attribution
```

---

## 8. DOCKER COMPOSE

Services and ports. Nothing else in compose.

| Service | Image | Ports | Notes |
|---|---|---|---|
| `postgres` | `postgis/postgis:16-3.4` | 5432 | Init script creates roles `owner`, `app_user` (no BYPASSRLS), `app_worker` (BYPASSRLS) |
| `redis` | `redis:7-alpine` | 6379 | |
| `minio` | `chainguard/minio` | 9000, 9001 | MinIO no longer publishes images; `minio-init` (`chainguard/minio-client`) creates the bucket |
| `mailhog` | `mailhog/mailhog` | 1025, 8025 | Dev email inbox at :8025 |
| `chain` | built from `packages/chain/Dockerfile` (`node:24-slim` + `npx hardhat node`) | 8545 | Deterministic accounts |

Tables are owned by `owner`. RLS is enabled **and forced** on every scoped table. `app_user` is used by HTTP request handlers; `app_worker` only by background jobs.

---

## 9. CODE CONVENTIONS

### General

- TypeScript strict. No `any` in domain code. No non-null assertions without a comment.
- Files: `kebab-case.ts`. Classes: `PascalCase`. DB columns: `snake_case`. JSON/DTO fields: `camelCase`.
- Enums are defined **once** in `packages/shared/src/enums.ts` and mirrored as Postgres enums by migration.
- Errors: RFC 7807 `application/problem+json` with a stable `type` URI and `code`.
- Pagination: cursor-based (`?cursor=&limit=`), default 50, max 500.
- IDs: `uuid` via `gen_random_uuid()`. Human-readable codes where officials use them (project code, award no).
- Commits: Conventional Commits (`feat(gis): ...`, `fix(rules): ...`).
- Branches: `main` protected; `feat/<module>-<thing>`.

### Money

- Stored as `bigint` paise. Type alias `Paise = bigint` in `packages/shared`.
- Parsing officer input: accept rupees with up to 2 decimals → convert to paise with exact decimal parsing (no float).
- Display: `formatINR(paise)` → `₹4,20,00,000` (Indian digit grouping via `Intl.NumberFormat('en-IN')`); `formatCrore(paise)` → `₹4.2 Cr`; `formatLakh(paise)` → `₹42 L`.

### Area

- Stored as `numeric(14,2)` square metres.
- `formatArea(sqm)` → `2.37 ha · 5.86 acre · 234.3 guntha`.
- Constants: `SQM_PER_HECTARE = 10_000`, `SQM_PER_ACRE = 4046.8564224`, `SQM_PER_GUNTHA = 101.17141056`.

### Time

- DB: `timestamptz` (UTC).
- Statutory computations: convert to `Asia/Kolkata`, apply ISO-8601 duration with calendar arithmetic (luxon `plus`), due at **end of day IST** on the resulting date. **[VERIFY]** exact legal day-counting convention; the engine isolates it in one function (`computeDueAt`) so it can change in one place.
- Display: `dd MMM yyyy` (e.g. `10 Dec 2026`); relative countdowns ("34 days left").
- All "now" from `ClockService.now()`.

### Geometry

- Storage SRID 4326. Parcels `geometry(MultiPolygon, 4326)`. Alignments `geometry(LineString, 4326)`. Points `geometry(Point, 4326)`.
- Area: `ST_Area(geom::geography)`. Distance: `ST_Distance(a::geography, b::geography)`.
- Hash: `geom_canonical_hash(geom)` only.
- GeoJSON out: `ST_AsGeoJSON(geom, 7)` (7 decimals ≈ 1 cm).

### API

- Controllers are thin: validate DTO (zod pipe) → call service → return DTO.
- Services own transactions. Use `withScope(user, fn)` for every request transaction — it sets RLS settings (§11.3).
- Any state change that other modules care about writes an **outbox event** in the same transaction.

### Frontend

- Server state in TanStack Query; no global client state library unless needed.
- All strings through i18n keys. Marathi and Hindi strings are marked `needs_native_review` until checked by a native speaker.
- WCAG AA contrast. Every interactive element keyboard-reachable.
- Show `DEMO DATA` badge in the app shell when `DEMO_MODE=true`.
- Show `MOCK` badge next to any value that came from a mock adapter.

---

## 10. DATA MODEL

### 10.1 Design rules

- **A parcel is land, not part of a project.** Projects affect parcels through `project_parcels`. This is what makes cross-project overlap detection and partial acquisition possible.
- **A person is not an owner.** Rights are `parcel_interests` with a type. Affected families link a person to a project. This is how tenants, sharecroppers and labourers exist (s.3).
- **Every table** has `created_at timestamptz default now()`, `updated_at timestamptz`, `created_by uuid null`. Omitted below for brevity.
- **Versioned legal records** (parcels, awards, rnr schemes, entitlements) carry `version int not null default 1`. A correction creates a new version; the old row is kept in a `*_versions` history table populated by trigger.
- **Scoped tables** carry enough keys for RLS to decide visibility: `project_id` directly, or a path to it.
- `[MVP]` = must exist for the demo. `[LATER]` = design it, build if time allows.

### 10.2 Enums (`packages/shared/src/enums.ts` ↔ Postgres enums)

```ts
Role = SUPER_ADMIN | CENTRAL_VIEWER | POLICY_MAKER | STATE_REVENUE | RNR_COMMISSIONER
     | COLLECTOR | LAO | DISTRICT_STAFF | RNR_ADMINISTRATOR | TEHSILDAR | DILR | FIELD_OFFICER
     | REQUIRING_BODY | SIA_AGENCY | EXPERT_GROUP_MEMBER | DLSA_OBSERVER | TREASURY_OFFICER
     | LEGAL_CELL | MONITORING_COMMITTEE

JurisdictionLevel = NATIONAL | STATE | DISTRICT | PROJECT

AcquisitionType = GOVERNMENT | PPP | PRIVATE

ProjectCategory = STRATEGIC_DEFENCE | TRANSPORT | ENERGY_UTILITIES | WATER_AGRICULTURE
                | INDUSTRIAL | URBAN_HOUSING | PUBLIC_SERVICES | PPP_CORPORATE

ProjectStatus = DRAFT | SUBMITTED | ACTIVE | ON_HOLD | TERMINATED | DENOTIFIED | ABANDONED | LAPSED | CLOSED

StageCode = S01_PROPOSAL | S02_SIA | S03_APPRAISAL | S04_CONSENT | S05_NOTIFICATION
          | S06_RNR_SCHEME | S07_DECLARATION | S08_AWARD | S09_PAYMENT_POSSESSION | S10_POST_ACQUISITION
          // NH Act pack uses its own codes, e.g. NH_3A_INTENT, NH_3C_OBJECTIONS … (see §12.5)

StageStatus = NOT_STARTED | IN_PROGRESS | SUBMITTED | RETURNED | APPROVED | NULLIFIED | SKIPPED | TERMINATED

TransitionAction = SUBMIT | APPROVE | APPROVE_CONDITIONAL | RETURN | REJECT | NULLIFY | OVERRIDE | TERMINATE | SKIP

ParcelStatus = PROPOSED | VERIFICATION_PENDING | VERIFIED | CONSENT_ACQUIRED_NOTIFIED | CLEARED_FOR_AWARD_RNR
             | AWARDED | READY_FOR_POSSESSION | ACQUIRED_POSSESSED | CLOSED | DENOTIFIED | TERMINATED
ParcelFlag   = DISPUTED | DELAYED | AREA_MISMATCH | OVERLAP | OUTSIDE_VILLAGE | CONSTRAINT_HIT   // flags, not statuses

BoundarySource = CADASTRAL_IMPORT | FIELD_DRAWN | SURVEY_REFERENCE_ONLY
VertexCaptureMethod = GPS_WALKED | MAP_DRAWN
LandClass = IRRIGATED_MULTICROP | AGRICULTURAL | UNIRRIGATED | NON_AGRI_COMMERCIAL | RESIDENTIAL | GOVT_WASTE | FOREST
InterestType = OWNER | TENANT | SHARECROPPER | LABOURER | FOREST_RIGHT_HOLDER | EASEMENT | MORTGAGEE
AffectedType = LAND_LOSER | LIVELIHOOD_DEPENDENT | FOREST_DWELLER | HOMESTEAD_LOSER | URBAN_LIVELIHOOD
SocialCategory = GENERAL | OBC | SC | ST

SurveyType = PARCEL_IDENTIFICATION | JOINT_INSPECTION
JirItemType = TREE | CROP | WELL | BOREWELL | IRRIGATION_PIPE | STRUCTURE | OTHER
ConstraintLayer = PROTECTED_FOREST | ECO_SENSITIVE | WATER_BODY | SCHEDULED_AREA | IRRIGATED_MULTICROP

HearingType = SIA_PUBLIC | GRAM_SABHA_CONSENT | RNR_PUBLIC | S15_OBJECTION
HearingStatus = SCHEDULED | HELD | VALID | VOID

ExpertOutcome = A_UNCONDITIONAL | B_CONDITIONAL | C_REJECTION
ConsentType = PRIVATE_80 | PPP_70 | GRAM_SABHA_S41
ConsentDecision = CONSENT | REFUSE

ObjectionGround = AREA_SUITABILITY | PUBLIC_PURPOSE | SIA_FINDINGS              // statutory (s.15)
ObjectionCategory = A_PUBLIC_PURPOSE | B_ALIGNMENT_SHIFT | C_SURVEY_ERROR       // operational routing tag
ObjectionStatus = FILED | SCHEDULED | HEARD | UPHELD | REJECTED
ClaimCategory = LAND_VALUATION | STRUCTURE_ASSET | RNR_ENTITLEMENT

EscrowGate = INITIAL | FULL
AwardType = LAND | RNR
ScheduleRef = FIRST | SECOND | SC_ST_ADDITIONAL
EntitlementStatus = ASSESSED | SANCTIONED | DISBURSED | ACKNOWLEDGED | DEPOSITED_WITH_AUTHORITY | DISPUTED | UNDER_PROTEST
PaymentInstrument = DBT | DEPOSIT_WITH_AUTHORITY
PaymentStatus = INITIATED | PENDING | SUCCESS | FAILED
AcceptanceType = ABSOLUTE | UNDER_PROTEST
AckMethod = WEBAUTHN | OTP | OFFICER_ATTESTED

DeadlineStatus = NOT_STARTED | SAFE | DUE_SOON | BREACHED | SATISFIED | WAIVED | VOIDED
ChainStatus = QUEUED | SUBMITTED | ANCHORED | FAILED
VerifyResult = VERIFIED | MISMATCH | PENDING | NOT_ANCHORED

LegalCaseType = S64_REFERENCE | S73_REDETERMINATION | S74_APPEAL | WRIT
DataSource = SYNTHETIC_DEMO | IMPORTED | FIELD_CAPTURED
```

### 10.3 Tables

Notation: `name  type  constraints  -- comment`.

#### Administrative hierarchy (LGD) `[MVP]`

```
states          code text pk (LGD), name text, name_local text
districts       code text pk, state_code fk, name, name_local
sub_districts   code text pk, district_code fk, name, name_local        -- taluka / tehsil
villages        code text pk, sub_district_code fk, name, name_local,
                boundary geometry(MultiPolygon,4326) null, data_source
```

#### Organisation & identity `[MVP]`

```
requiring_bodies  id uuid pk, name, short_code, type (central|state|psu|private|ppp)
users             id uuid pk, full_name, email unique, phone_masked, password_hash, is_active, last_login_at
posts             id uuid pk, designation text, role Role, jurisdiction_level JurisdictionLevel,
                  state_code null, district_code null, project_id null, requiring_body_id null, is_active
post_assignments  id pk, post_id fk, user_id fk, valid_from timestamptz, valid_to timestamptz null
refresh_tokens    id pk, user_id fk, family_id uuid,          -- a login's rotation chain; reuse revokes the family
                  active_post_id fk,                        -- the post choice survives refreshes
                  token_hash, expires_at, revoked_at, replaced_by
```

A user may hold several posts. The JWT carries `userId` + `activePostId`. Case participants (SIA agency, expert group, DLSA observer) get **PROJECT-level posts** with a `valid_to`.

#### Rule packs `[MVP]`

```
rule_packs  code text, version text, pk(code, version),
            title, governing_act, jurisdiction_level, state_code null,
            extends_code null, extends_version null,
            effective_from date, effective_to date null,
            definition jsonb not null,           -- fully resolved (after extends-merge)
            checksum text not null,              -- sha256 of canonical definition
            loaded_at timestamptz
```

Packs are loaded from `packages/rules/packs/*.json` at API boot. If a `(code, version)` already exists with a **different checksum**, boot **fails** — a published version is immutable. Change = new version.

#### Projects `[MVP]`

```
projects  id pk, code text unique,               -- e.g. MH-PSX-2026-001
          name, name_local, category ProjectCategory, sub_category text,
          acquisition_type AcquisitionType,
          requiring_body_id fk, national_importance bool, estimated_budget_paise bigint,
          rule_pack_code, rule_pack_version,     -- PINNED at submission, never changes
          appropriate_govt (state|central), state_code (lead state),
          is_linear bool, alignment geometry(LineString,4326) null, row_width_m numeric null,
          footprint geometry(MultiPolygon,4326) null,   -- corridor buffer or area polygon
          total_area_proposed_sqm numeric,
          is_urgency bool default false,          -- s.40
          in_scheduled_area bool default false,   -- derived from constraint check
          status ProjectStatus, current_stage StageCode,
          submitted_at, data_source

project_districts  project_id fk, district_code fk, pk(project_id, district_code)   -- multi-district / inter-state
```

#### Workflow `[MVP]`

```
stage_instances   id pk, project_id fk, stage_code, attempt int default 1,
                  status StageStatus, started_at, submitted_at, completed_at,
                  assigned_post_id fk null, submitted_by_user_id, submitted_by_post_id,
                  outcome jsonb null                  -- e.g. expert group outcome, conditions
                  unique(project_id, stage_code, attempt)

stage_transitions id pk, project_id fk, stage_instance_id fk,
                  from_status, to_status, action TransitionAction,
                  target_stage_code null,             -- for RETURN to another stage
                  reason_code text null,              -- from pack's reasonCodes
                  remarks text, actor_user_id, actor_post_id, at timestamptz,
                  document_ids uuid[]                 -- supporting documents
                  -- append-only (trigger)

stage_checklist   id pk, stage_instance_id fk, item_code, item_type (document|event|gate|hearing),
                  satisfied bool, satisfied_at, ref_id uuid null

expert_recommendations  id pk, project_id fk, outcome ExpertOutcome, conditions text null,
                        members jsonb,              -- [{name, seat, coiDeclarationDocId}]
                        chairperson text, dissent_notes jsonb, report_document_id, signed_at

government_overrides    id pk, project_id fk, expert_recommendation_id fk,
                        written_reasons text not null,   -- s.8(2): mandatory
                        order_document_id, decided_by_post_id, decided_at

hearings   id pk, project_id fk, type HearingType, attempt int,
           scheduled_at, venue text, village_code null,
           notice_published_at, notice_document_id,
           local_language_summary_document_id null, recording_document_id null,
           attendance_document_id null, quorum_met bool null,
           response_matrix_document_id null,           -- Public Hearing Response Matrix
           status HearingStatus, void_reason_code null, voided_by_post_id null

outbox_events  id bigserial pk, type text, aggregate_type, aggregate_id uuid, payload jsonb,
               created_at, processed_at null, attempts int default 0, last_error text null
```

#### Deadlines `[MVP]`

```
statutory_deadlines  id pk, project_id fk, clock_code text, section text,
                     subject_type text, subject_id uuid,     -- stage_instance / entitlement / project_parcel
                     rule_pack_code, rule_pack_version,
                     start_event text, started_at timestamptz,
                     due_at timestamptz, consequence text,
                     status DeadlineStatus, satisfied_at null, breached_at null,
                     condition_inputs jsonb null              -- e.g. {presentAtAward:true}
```

#### Land & GIS `[MVP]`

```
land_parcels  id pk, village_code fk, survey_number text, sub_division text null,
              geom geometry(MultiPolygon,4326) not null,
              recorded_area_sqm numeric null,        -- from RoR / cadastral
              field_area_sqm numeric null,           -- computed from walked polygon
              area_diff_pct numeric generated,       -- (field - recorded)/recorded*100
              boundary_source BoundarySource, land_class LandClass,
              is_irrigated_multicrop bool, in_scheduled_area bool,
              transfer_frozen_at timestamptz null,   -- s.11 freeze
              geom_hash text,                        -- geom_canonical_hash(geom), maintained by trigger
              version int, data_source
              -- unique INDEX on (village_code, survey_number, coalesce(sub_division, ''))

project_parcels  id pk, project_id fk, parcel_id fk,
                 affected_geom geometry(MultiPolygon,4326),
                 affected_area_sqm numeric, affected_pct numeric,
                 chainage_km numeric null,           -- linear projects
                 status ParcelStatus, flags ParcelFlag[] default '{}',
                 severance_claimed bool default false,
                 unique(project_id, parcel_id)

field_surveys  id pk, project_id fk, parcel_id fk null, survey_type SurveyType,
               surveyor_user_id, surveyor_post_id,
               started_at, submitted_at, device_info jsonb,
               track geometry(LineString,4326) null,   -- walked track
               notice_served_on date null, notice_document_id null,   -- s.12
               status (draft|submitted|verified|returned),
               verified_by_post_id null, verification_remarks, override_reason text null,
               plausibility jsonb                     -- results of §15.6 checks

parcel_vertices  id pk, survey_id fk, parcel_id fk null, seq int,
                 lat double, lng double, accuracy_m numeric,
                 capture_method VertexCaptureMethod, samples_averaged int,
                 photo_document_id null,
                 captured_at timestamptz,             -- device clock (claimed)
                 synced_at timestamptz,               -- server clock (authoritative)
                 unique(survey_id, seq)

jir_items        id pk, survey_id fk, parcel_id fk, item_type JirItemType,
                 description, quantity numeric, unit text, photo_document_id null, point geometry(Point,4326) null

boundary_pillars id pk, parcel_id fk, pillar_no int, point geometry(Point,4326), photo_document_id

constraint_layers id pk, layer_type ConstraintLayer, name, geom geometry(MultiPolygon,4326), source text, data_source

spatial_flags    id pk, project_id fk, project_parcel_id null, layer_type null, flag_type text,
                 overlap_area_sqm numeric null, message, raised_at, acknowledged_by_post_id null, acknowledged_at

common_property_resources  id pk, project_id fk, village_code, cpr_type
                           (well|grazing|worship|school|clinic|cremation|pond|other),
                           name, point geometry(Point,4326), affected bool, notes

parcel_corrections  id pk, parcel_id fk, from_version int, to_version int,
                    reason text not null, requested_by_post_id, approved_by_post_id null,
                    status (requested|approved|rejected), decided_at
```

#### People & families `[MVP]`

```
persons  id pk, full_name, full_name_local null, guardian_name, gender, social_category SocialCategory,
         village_code, phone_masked text, phone_enc bytea null,     -- AES-GCM
         bank_ref_masked text null, bank_ref_enc bytea null,
         is_deceased bool default false, data_source

parcel_interests  id pk, parcel_id fk, person_id fk, interest_type InterestType,
                  share_fraction numeric(7,6) null, evidence_document_id null,
                  verification_status (pending|verified|disputed), verified_by_post_id null

affected_families  id pk, project_id fk, head_person_id fk, affected_type AffectedType,
                   is_displaced bool, is_multiple_displacement bool,   -- s.39
                   family_size int,
                   is_sc_st bool, is_female_headed bool, is_destitute bool, has_disability bool,
                   relocated_outside_district bool,
                   authorised_recipient_person_id fk, joint_recipient_person_id fk null,
                   resettlement_site_id fk null, data_source

family_members     id pk, affected_family_id fk, person_id fk, relation text

sia_census_records   id pk, project_id fk, village_code, household_ref, affected_family_id null,
                     payload jsonb, enumerator_post_id, captured_at          -- s.4 SIA census
rnr_census_records   id pk, project_id fk, affected_family_id fk, categorisation AffectedType,
                     vulnerability jsonb, administrator_post_id, captured_at  -- s.16 census (SEPARATE)
```

#### Consent `[MVP]`

```
consent_registers  id pk, project_id fk, consent_type ConsentType,
                   status (draft|displayed|certified), display_from date, display_to date,
                   certified_at, certified_by_post_id

consent_register_entries  id pk, register_id fk, person_id fk, affected_family_id null,
                          eligibility_basis text, is_heir_update bool, status (eligible|removed)

consent_records  id pk, register_entry_id fk unique, decision ConsentDecision,
                 form_document_id, collected_by_post_id, observer_post_id,       -- DLSA
                 observer_certified bool, collected_at, point geometry(Point,4326),
                 identity_check_ref text, identity_provider text                 -- 'MOCK' in MVP
```

Tally = `count(consent)/count(eligible entries)` from a view. Threshold from rule pack.

#### Objections & claims `[MVP]`

```
objections  id pk, project_id fk, person_id null, parcel_id null,
            channel (portal|helpdesk|hearing_audio), filed_at, language text,
            body text, transcript_document_id null,
            statutory_ground ObjectionGround null, operational_category ObjectionCategory null,
            ai_suggested_ground null, ai_suggested_category null, ai_confidence numeric null,
            status ObjectionStatus, hearing_id null,
            decision_remarks null, decided_by_post_id null, decided_at null

claims  id pk, project_id fk, person_id fk, parcel_id fk null, category ClaimCategory,
        filed_at, amount_claimed_paise bigint null, body text, status (filed|accepted|defect_memo|decided)
```

#### Money `[MVP]`

```
escrow_accounts      id pk, project_id fk, gate EscrowGate,
                     demand_amount_paise bigint, demand_document_id,
                     deposited_amount_paise bigint default 0,
                     sufficiency_certified_at null, certified_by_post_id null,
                     status (demanded|partially_funded|funded|certified)
                     unique(project_id, gate)
escrow_transactions  id pk, escrow_account_id fk, kind (deposit|withdrawal|refund),
                     amount_paise bigint, reference text, at

awards   id pk, project_id fk, award_type AwardType, award_no text,
         pronounced_at, collector_post_id, lao_post_id,
         document_id, ocr_extraction_id null, status (draft|signed), version int

entitlements  id pk, affected_family_id fk, award_id fk,
              schedule_ref ScheduleRef, head_code text,           -- from pack entitlementHeads
              amount_awarded_paise bigint not null,               -- ENTERED, never computed (G1)
              source (manual|ocr_confirmed),
              due_by timestamptz, status EntitlementStatus, version int

disbursements  id pk, entitlement_id fk, amount_paise bigint, instrument PaymentInstrument,
               initiated_at, paid_on null, payment_status PaymentStatus,
               adapter_ref text, adapter_provider text,            -- 'MOCK'
               is_first_instalment bool, acceptance_type AcceptanceType null,
               indemnity_bond_document_id null,
               hold_reason text null,                              -- RESTRICTED (§11.4)
               hold_reason_code text null

acknowledgements  id pk, disbursement_id fk unique, method AckMethod,
                  webauthn_credential_id text null, assertion_sha256 text null,
                  otp_ref text null,
                  witness_post_id null, fallback_reason text null, photo_document_id null,
                  point geometry(Point,4326) null, confirmed_at

webauthn_credentials  id pk, person_id fk, credential_id text unique, public_key bytea,
                      counter bigint, transports text[], device_label text,
                      enrolled_at, enrolled_witness_post_id,            -- enrolment is witnessed
                      enrolment_point geometry(Point,4326) null, revoked_at null

access_tokens   id pk, purpose (enrol|acknowledge|passbook),
                person_id fk, subject_id uuid null, token_hash text unique,
                expires_at, used_at null                               -- single-use magic links

annuity_schedules  id pk, entitlement_id fk, instalment_no int, due_on date,
                   amount_paise bigint, status (scheduled|paid|missed), disbursement_id null
```

#### R&R `[MVP thin]`

```
rnr_schemes        id pk, project_id fk, version int, status (draft|hearing|committee|approved|published),
                   draft_document_id, approved_by_post_id null, approved_at, gazette_document_id null
resettlement_sites id pk, project_id fk, name, geom geometry(MultiPolygon,4326), capacity_families int,
                   layout_document_id null, commissioning_certificate_document_id null
amenity_milestones id pk, site_id fk, amenity_code text,                 -- Third Schedule codes (§39.3)
                   status (planned|in_progress|complete), completed_at, evidence_document_id
rnr_passbooks      id pk, affected_family_id fk, version int, payload_sha256 text,
                   issued_at, public_token_id fk                          -- rendered from entitlements
```

#### Possession, legal, long-term `[MVP thin / LATER]`

```
possession_events  id pk, project_parcel_id fk unique,
                   vacation_certificate_document_id, notice_document_id,
                   panchnama_document_id, possession_certificate_document_id, handover_document_id,
                   witnesses jsonb, point geometry(Point,4326), taken_at, taken_by_post_id
mutations          id pk, parcel_id fk, direction (pre_award_heir|post_possession_transfer),
                   from_holder text, to_holder text, extract_document_id, recorded_at
legal_cases        id pk, project_id fk, parcel_id null, person_id null, case_type LegalCaseType,
                   case_no text, filed_at, status (filed|hearing|decided|appealed|closed),
                   next_hearing_at null, differential_liability_paise bigint null, order_document_id null
legal_case_events  id pk, case_id fk, event_type, at, notes, document_id null
severance_claims   id pk, project_parcel_id fk, filed_at, inspection_document_id null,
                   decision (pending|acquire_whole|s28_damages|rejected), decided_at
utilisation_audits id pk, project_parcel_id fk, due_at, status (pending|utilised|unutilised),
                   finding text, reversion (owner|land_bank|custody_transfer) null
value_sharing_events id pk, project_parcel_id fk, transfer_date, consideration_paise bigint,
                   appreciated_value_paise bigint,     -- ENTERED by officer
                   share_paise bigint,                 -- displayed derived value, officer confirms (G2)
                   confirmed_by_post_id, distributed bool
monitoring_audits  id pk, project_id fk, committee (national|state), period text, report_document_id, findings jsonb
```

#### Documents, trust & audit `[MVP]`

```
documents  id pk, project_id fk null,           -- for RLS: a polymorphic entity_id has no path to a project
           entity_type text, entity_id uuid, doc_type DocType (§39.2),
           title, language, version int, supersedes_id null,
           object_key text, mime text, size_bytes bigint, sha256 text not null,
           uploaded_by_user_id, uploaded_by_post_id, uploaded_at

attestations  id pk, document_id fk unique, user_id, post_id,
              designation_snapshot text, jurisdiction_snapshot text,
              declaration_version text,           -- e.g. ATTEST_V1
              document_sha256 text, ip inet, user_agent text, attested_at

ocr_extractions  id pk, document_id fk, engine text,
                 fields jsonb,     -- [{key, value, confidence, page, bbox}]
                 status (pending|ready|reviewed), reviewed_by_post_id null,
                 accepted jsonb     -- [{key, value, acceptedAt}] only human-accepted values

chain_events  id pk, entity_type, entity_id uuid, entity_version int, event_type text,
              canonical_payload jsonb, data_hash text,       -- 0x-prefixed sha256
              status ChainStatus, tx_hash null, block_number null, anchored_at null,
              attempts int default 0, last_error text null, created_at

audit_log  id bigserial pk, at timestamptz, actor_user_id null, actor_post_id null,
           action text, entity_type text, entity_id uuid,
           before jsonb null, after jsonb null, ip inet null, request_id text,
           prev_hash text, hash text                  -- hash chain (§11.6)

notifications  id pk, recipient_post_id fk, recipient_user_id null,
               trigger text, severity (info|warn|critical), escalation_level int default 0,
               entity_type, entity_id, title, body, deep_link text,
               channels jsonb,          -- {inApp:true, email:'sent', sms:'mock'}
               created_at, read_at null
```

### 10.4 SQL views `[MVP]`

| View | Purpose |
|---|---|
| `v_consent_tally` | Per register: eligible, consented, refused, pct, threshold, met |
| `v_family_money` | Per family: assessed, sanctioned, disbursed, acknowledged, unconfirmed, held, deposited — all paise |
| `v_project_kpis` | The 8 PS dashboard parameters per project |
| `v_deadline_board` | Open deadlines with days remaining, status, consequence, assigned post |
| `mv_interest_liability` (materialised) | Estimated s.80 interest per entitlement as of ClockService now; refreshed by job |
| `mv_district_kpis`, `mv_state_kpis`, `mv_national_kpis` (materialised) | Roll-ups; refreshed every 5 min and on key events |
| `public_parcel_status` | Village, survey no, project name, parcel status, stage, last public notice — **no personal data** |
| `public_notices` | Published s.11 / s.19 / scheme notices with document links |
| `public_passbook` | Rendered only via a valid passbook token |

---

## 11. DATABASE-LEVEL MECHANICS

### 11.1 Required SQL functions

```sql
-- G11: the ONLY way to hash geometry
CREATE FUNCTION geom_canonical_hash(g geometry) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT encode(digest(
    ST_AsBinary(ST_Normalize(ST_ReducePrecision(ST_Force2D(g), 0.0000001))),
  'sha256'), 'hex')
$$;
-- 1e-7 degrees ≈ 1.1 cm. Unit test: same polygon, rotated vertex start / reversed ring → same hash.

-- G10: authoritative area
CREATE FUNCTION area_sqm(g geometry) RETURNS numeric
LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT round(ST_Area(g::geography)::numeric, 2) $$;

-- Linear corridor from alignment
CREATE FUNCTION corridor(line geometry, row_width_m numeric) RETURNS geometry
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT ST_Multi(ST_Buffer(line::geography, row_width_m / 2.0)::geometry)
$$;

-- Chainage (km) of a geometry along an alignment
CREATE FUNCTION chainage_km(line geometry, g geometry) RETURNS numeric
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT round((ST_LineLocatePoint(line, ST_PointOnSurface(g)) * ST_Length(line::geography) / 1000.0)::numeric, 3)
$$;
```

### 11.2 Triggers

| Trigger | On | Does |
|---|---|---|
| `trg_parcel_geom` | `land_parcels` insert/update of `geom` | Sets `geom_hash`, recomputes `field_area_sqm` when source is FIELD_DRAWN |
| `trg_versions_*` | versioned tables update | Copies old row into `*_versions` |
| `trg_append_only` | `audit_log`, `stage_transitions`, `chain_events` (except status columns), `attestations` | Raises on UPDATE/DELETE of immutable columns |
| `trg_audit_chain` | `audit_log` insert | Takes `pg_advisory_xact_lock(hashtext('audit_log'))`, reads last `hash`, sets `prev_hash`, computes `hash = sha256(prev_hash || canonical(row))` |
| `trg_updated_at` | all tables | Maintains `updated_at` |

### 11.3 Row-Level Security

Every request transaction starts with:

```sql
SELECT set_config('app.user_id',            $1, true),
       set_config('app.post_id',            $2, true),
       set_config('app.jurisdiction_level', $3, true),   -- NATIONAL|STATE|DISTRICT|PROJECT
       set_config('app.state_code',         $4, true),
       set_config('app.district_code',      $5, true),
       set_config('app.project_ids',        $6, true);   -- comma list, PROJECT-level posts only
```

`withScope(user, fn)` in `apps/api/src/common/db` does this and runs `fn` inside the transaction.

Core policy (projects); every child table gets an equivalent policy through `project_id`:

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

CREATE POLICY scope ON projects FOR ALL TO app_user USING (
  current_setting('app.jurisdiction_level', true) = 'NATIONAL'
  OR (current_setting('app.jurisdiction_level', true) = 'STATE'
      AND (state_code = current_setting('app.state_code', true)
           OR EXISTS (SELECT 1 FROM project_districts pd JOIN districts d ON d.code = pd.district_code
                      WHERE pd.project_id = projects.id AND d.state_code = current_setting('app.state_code', true))))
  OR (current_setting('app.jurisdiction_level', true) = 'DISTRICT'
      AND EXISTS (SELECT 1 FROM project_districts pd
                  WHERE pd.project_id = projects.id
                    AND pd.district_code = current_setting('app.district_code', true)))
  OR (current_setting('app.jurisdiction_level', true) = 'PROJECT'
      AND id::text = ANY (string_to_array(current_setting('app.project_ids', true), ',')))
);
```

Requiring-body posts: `PROJECT`-level scope over their own projects (set `app.project_ids` from projects where `requiring_body_id` matches).

**Land-level tables have no `project_id`** — `land_parcels`, `parcel_interests`, `persons`, `parcel_vertices` via survey, `boundary_pillars`. Scope them by **geography**: `village_code → sub_district → district → state`. A DISTRICT post sees parcels in its district's villages; a PROJECT post sees parcels linked to its projects through `project_parcels`. Write a helper SQL function `can_see_village(village_code)` and reuse it in these policies.

`app_worker` has `BYPASSRLS` and is **never** used by an HTTP handler. A unit test asserts that request handlers only receive the `app_user` pool.

### 11.4 Field-level visibility (redaction)

Declared once in `packages/shared/src/redaction.ts`, applied by `RedactionInterceptor` on every response DTO.

```ts
export const FIELD_VISIBILITY: Record<string, Visibility> = {
  'disbursement.holdReason':        { levels: ['DISTRICT', 'STATE', 'NATIONAL'] },
  'disbursement.holdReasonCode':    { levels: ['DISTRICT', 'STATE', 'NATIONAL'], fieldOfficer: 'TASK_LEVEL' },
  'person.phone':                   { levels: ['DISTRICT'], else: 'MASKED' },
  'person.bankRef':                 { levels: ['DISTRICT'], else: 'MASKED', maskAlways: 'LAST4' },
  'affectedFamily.vulnerability':   { levels: ['DISTRICT', 'STATE', 'NATIONAL'], roles: ['RNR_ADMINISTRATOR', 'RNR_COMMISSIONER'] },
  'objection.decidedBy':            { levels: ['DISTRICT', 'STATE', 'NATIONAL'] },
  'legalCase.*':                    { roles: ['COLLECTOR', 'LAO', 'LEGAL_CELL', 'STATE_REVENUE', 'SUPER_ADMIN'] },
};
```

| Viewer | What they see about unpaid money |
|---|---|
| Public | Own case only (via token). "Payment in process." No reason. |
| Field officer | Assigned parcels. Task-level reason code only (e.g. `DOCUMENT_PENDING`). |
| District (Collector / LAO) | Full reason, own district |
| State | District totals + drill-down |
| National / Super Admin | Everything |

Unit test: for every key in `FIELD_VISIBILITY`, a disallowed viewer receives it redacted.

### 11.5 PII encryption

- `phone_enc`, `bank_ref_enc`: AES-256-GCM, key from `PII_ENCRYPTION_KEY`, random 12-byte IV per value, stored as `iv || ciphertext || tag`.
- Masked copies (`phone_masked = "98XXXXXX21"`, `bank_ref_masked = "XXXX4821"`) are stored for display.
- Decrypt only in services that pass the redaction check.

### 11.6 Audit hash chain

`hash = sha256(prev_hash + JCS({at, actor_user_id, actor_post_id, action, entity_type, entity_id, before, after}))`. First row uses `prev_hash = 'GENESIS'`. `GET /api/v1/audit/verify` walks the chain and reports the first broken link.

---

## 12. RULE PACKS — MODULE 0 `[MVP]`

The heart of policy-change resilience. `packages/rules` is **pure TypeScript with no I/O** so it can be unit-tested exhaustively and reused by the API, the portal (to render action panels) and the seed script.

### 12.1 Principles

1. A pack is a JSON file named `<code>@<version>.json`.
2. A pack may `extend` another pack; the loader deep-merges (arrays of objects merge by `code`).
3. A published `(code, version)` is **immutable**. Any change = new version with a new `effectiveFrom`.
4. A project **pins** `(rule_pack_code, rule_pack_version)` at submission and keeps it for life — even if a newer version is published. This mirrors s.24 of the Act, which exists because law changed mid-process.
5. Every statutory value in business logic comes from the resolved pack (G8).

### 12.2 Pack schema (zod in `packages/rules/schema/pack.schema.ts`)

```ts
Pack = {
  code: string; version: string;             // semver
  title: string;
  governingAct: 'RFCTLARR_2013' | 'NH_ACT_1956' | string;
  jurisdiction: { level: 'NATIONAL' | 'STATE'; stateCode?: string };
  effectiveFrom: string; effectiveTo?: string; // ISO date
  extends?: { code: string; version: string };
  verify?: string[];                           // list of [VERIFY] notes shown in the pack viewer

  appliesTo: { acquisitionTypes: AcquisitionType[]; categories?: ProjectCategory[] };

  stages: Stage[];
  clocks: Clock[];
  events: string[];                            // allowed domain event names that clocks listen to

  consent: { PRIVATE?: number; PPP?: number; GOVERNMENT?: null; scheduledAreaGramSabha: boolean };
  interest: { section: string; rateYear1Pct: number; rateAfterPct: number; stepAfter: string /*ISO dur*/; dayCount: 'ACT_365' };
  checks: ValidationCheck[];                   // award-entry validations (G1: validate, not compute)
  entitlementHeads: EntitlementHead[];
  thresholds: { rnrCommitteeAcres?: number; scStFirstInstalmentMinFraction?: number;
                deadlineDueSoonDays: number; gpsAccuracyWarnM: number; gpsAccuracyRejectM: number;
                areaMismatchFlagPct: number; photoMaxDistanceFromParcelM: number };
  escalation: { afterBreachDays: number[]; levels: ('POST' | 'DISTRICT' | 'STATE')[] };
  declarations: { attestationVersion: string };
}

Stage = {
  code: StageCode; name: string; order: number; sections: string[];
  ownerRole: Role;
  appliesWhen?: Condition;                     // e.g. { acquisitionTypeIn: ['PPP','PRIVATE'] }
  checklist: { code: string; type: 'document'|'event'|'gate'|'hearing'; docType?: DocType; required: boolean }[];
  actions: Record<TransitionAction, {
    roles: Role[];
    makerChecker?: boolean;
    requiresAttestation?: boolean;
    to?: StageCode | 'SAME' | 'TERMINAL';
    terminalStatus?: ProjectStatus;
    reasonCodes?: string[];                    // required when action is RETURN / REJECT / NULLIFY / TERMINATE
    requiresWrittenReasons?: boolean;          // OVERRIDE (s.8(2))
    emits?: string[];                          // domain events
  }>;
}

Clock = {
  code: string; section: string; label: string;
  subject: 'PROJECT' | 'STAGE' | 'ENTITLEMENT' | 'PROJECT_PARCEL' | 'HEARING';
  startsOn: string;                            // event name
  endsOn?: string;                             // event that satisfies the clock
  duration?: string;                           // ISO-8601
  durationWhen?: { if: string; duration: string }[]; durationElse?: string;  // conditional clocks
  consequence: 'WARN' | 'SIA_LAPSED' | 'DEEMED_RESCINDED' | 'PROCEEDINGS_LAPSE'
             | 'POSSESSION_BLOCKED' | 'WINDOW_CLOSED' | 'REVERSION_DUE' | 'INTEREST_STEP_UP';
  consequenceText: string;                     // human sentence for the UI
}

ValidationCheck = { code: string; section: string; kind: string; params: Record<string, number|string>; message: string }
EntitlementHead = { code: string; schedule: ScheduleRef; label: string; minPaise?: string; notes?: string }
```

### 12.3 `larr-2013-base@1.0.0` — required content

Every value below comes from the Act reference. The golden test (§32.3) asserts these exact values.

**Stages**

| Order | Code | Name | Sections | Owner | Applies when |
|---|---|---|---|---|---|
| 1 | `S01_PROPOSAL` | Pre-Proposal & Identification | — | COLLECTOR | always |
| 2 | `S02_SIA` | Social Impact Assessment & Public Hearing | 4–6 | COLLECTOR | not `is_urgency` (s.9 exemption) |
| 3 | `S03_APPRAISAL` | Expert Group Appraisal | 7–8 | STATE_REVENUE | not `is_urgency` |
| 4 | `S04_CONSENT` | Consent Procurement | 2, 41 | COLLECTOR | `acquisitionType ∈ {PPP, PRIVATE}` **or** `in_scheduled_area` |
| 5 | `S05_NOTIFICATION` | Preliminary Notification & Objections | 11–15 | COLLECTOR | always |
| 6 | `S06_RNR_SCHEME` | R&R Scheme Formulation & Approval | 16–18 | RNR_ADMINISTRATOR | always |
| 7 | `S07_DECLARATION` | Final Declaration & Public Notice | 19–21 | COLLECTOR | always |
| 8 | `S08_AWARD` | Valuation & Compensation Award | 23, 26–31 | LAO | always |
| 9 | `S09_PAYMENT_POSSESSION` | Disbursement, R&R & Possession | 37–38, 77, 80 | LAO | always |
| 10 | `S10_POST_ACQUISITION` | Post-Acquisition, Appeals & Land Return | 48–50, 51–74, 94, 101–102 | COLLECTOR | always |

**Consent sequencing:** S04 precedes S05. Under s.2 the consent process runs **along with the SIA** — the engine allows S04 to start while S02 is IN_PROGRESS, and S05 cannot start until S04 is APPROVED (when S04 applies).

**Key actions per stage** (abbreviated; full lists live in the JSON)

| Stage | APPROVE by | Maker-checker | Special actions |
|---|---|---|---|
| S01 | COLLECTOR | yes (LAO submits) | RETURN to S01 with reason; gate `ESCROW_INITIAL_FUNDED` |
| S02 | COLLECTOR | yes | NULLIFY hearing → repeat; checklist: SIA report, SIMP, CPR inventory, hearing VALID, local-language summary |
| S03 | STATE_REVENUE | yes | `APPROVE` (outcome A), `APPROVE_CONDITIONAL` (outcome B, conditions recorded), `REJECT` (outcome C → TERMINAL `ABANDONED` unless `OVERRIDE`); `OVERRIDE` requires `requiresWrittenReasons` (s.8(2)) |
| S04 | COLLECTOR | yes | `TERMINATE` when tally below threshold → `TERMINATED`; checklist: register certified, awareness hearing VALID, DLSA certification |
| S05 | COLLECTOR | yes | emits `S11_PUBLISHED` on publication (starts objection + declaration clocks, triggers transfer freeze); `TERMINATE` → `DENOTIFIED` |
| S06 | RNR_COMMISSIONER | yes (Administrator submits) | NULLIFY R&R hearing; checklist: R&R census (separate from SIA census), scheme draft, hearing VALID, committee review if ≥100 acres |
| S07 | COLLECTOR | yes | gate `ESCROW_FULL_CERTIFIED`; emits `S19_PUBLISHED`; s.21 notices; claims register |
| S08 | COLLECTOR | yes (LAO drafts) | emits `AWARD_SIGNED`, `S37_NOTICE_SERVED`; award values **entered**, validated by `checks` |
| S09 | COLLECTOR | yes | per-parcel possession gated (§12.6) |
| S10 | COLLECTOR | no | continuous; closes when all parcels closed and no open legal cases |

**Clocks**

| Code | Section | Starts on | Duration | Ends on | Consequence |
|---|---|---|---|---|---|
| `SIA_COMPLETION` | 4 | `SIA_COMMENCED` | `P6M` | `SIA_REPORT_FINAL` | WARN |
| `EXPERT_GROUP` | 7 | `EXPERT_GROUP_CONSTITUTED` | `P2M` | `EXPERT_RECOMMENDATION_SIGNED` | WARN |
| `SIA_LAPSE` | 14 | `SIA_APPRAISED` | `P12M` | `S11_PUBLISHED` | SIA_LAPSED |
| `OBJECTION_WINDOW` | 15 | `S11_PUBLISHED` | `P60D` | — | WINDOW_CLOSED |
| `DECLARATION` | 19 | `S11_PUBLISHED` | `P12M` | `S19_PUBLISHED` | DEEMED_RESCINDED |
| `AWARD` | 25 | `S19_PUBLISHED` | `P12M` | `AWARD_SIGNED` | PROCEEDINGS_LAPSE |
| `COMPENSATION_PAYMENT` | 38 | `AWARD_SIGNED` | `P3M` | `ENTITLEMENT_PAID` (land heads) | POSSESSION_BLOCKED |
| `MONETARY_RNR` | 38 | `AWARD_SIGNED` | `P6M` | `ENTITLEMENT_PAID` (monetary R&R heads) | POSSESSION_BLOCKED |
| `INFRA_RNR` | 38 | `AWARD_SIGNED` | `P18M` | `SITE_COMMISSIONED` | POSSESSION_BLOCKED |
| `REFERENCE_WINDOW` | 64 | `S37_NOTICE_SERVED` | `durationWhen: presentAtAward → P6W`, else `P6M` | `REFERENCE_FILED` | WINDOW_CLOSED |
| `INTEREST_STEP` | 80 | `POSSESSION_TAKEN` (with unpaid amount) | `P1Y` | `ENTITLEMENT_PAID` | INTEREST_STEP_UP |
| `UTILISATION` | 101 | `POSSESSION_TAKEN` | `P5Y` | `PARCEL_UTILISED` | REVERSION_DUE |

Irrigation / hydel submergence (R&R complete 6 months before submergence, s.38) is `[LATER]` — add as a clock with `startsOn: SUBMERGENCE_SCHEDULED` and negative offset.

**Consent:** `PRIVATE: 0.80`, `PPP: 0.70`, `GOVERNMENT: null`, `scheduledAreaGramSabha: true`.

**Interest (s.80):** `rateYear1Pct: 9`, `rateAfterPct: 15`, `stepAfter: 'P1Y'`, `dayCount: 'ACT_365'`.

**Validation checks (award entry)** — these **validate entered values**, they never produce a value:

| Code | Section | Rule |
|---|---|---|
| `SOLATIUM_100` | 30 | Entered solatium head = 100% of entered compensation (land + assets) head for that family, ±₹1 rounding |
| `ADDITIONAL_12PA_PRESENT` | 30(3) | 12% additional amount head exists when land compensation exists (period: **[VERIFY]** — only presence is checked) |
| `RURAL_FACTOR_RANGE` | First Schedule | If the award states a multiplication factor: rural ∈ [1.00, 2.00], urban = 1.00 |
| `SC_ST_FIRST_INSTALMENT` | 41 | For SC/ST families: first disbursement ≥ 1/3 of total compensation |
| `URGENCY_80_TENDERED` | 40 | For urgency projects: ≥ 80% tendered before possession |

**Entitlement heads (Second Schedule)** — `minPaise` used only to flag entries *below* the statutory minimum:

| Code | Label | Minimum / rule |
|---|---|---|
| `LAND_COMPENSATION` | Land compensation (First Schedule) | — |
| `ASSETS` | Value of assets attached to land | — |
| `SOLATIUM` | Solatium | = 100% (check) |
| `ADDITIONAL_12PA` | 12% additional amount | — |
| `HOUSING_RURAL` | House (rural, IAY spec) | in-kind |
| `HOUSING_URBAN` | House ≥ 50 m² plinth (urban) | in-kind |
| `HOUSING_URBAN_OPTOUT` | Urban house opt-out assistance | ≥ ₹1,50,000 |
| `LAND_FOR_LAND` | Land for land (irrigation projects) | ≥ 1 acre; SC/ST = equivalent or 2.5 acres, lower |
| `DEVELOPED_LAND` | 20% developed land (urbanisation) | in-kind |
| `EMPLOYMENT` | Employment | in-kind |
| `ONE_TIME_5L` | One-time payment in lieu of employment | ≥ ₹5,00,000 |
| `ANNUITY` | Annuity | ≥ ₹2,000/month × 20 years (schedule) |
| `SUBSISTENCE` | Subsistence grant | ₹3,000/month × 12 |
| `SUBSISTENCE_SCST_EXTRA` | SC/ST displaced from Scheduled Area | ₹50,000 |
| `TRANSPORT` | Transportation | ₹50,000 |
| `CATTLE_SHED` | Cattle shed / petty shop | ≥ ₹25,000 |
| `ARTISAN_GRANT` | Artisan / small trader | ≥ ₹25,000 |
| `RESETTLEMENT_ALLOWANCE` | One-time resettlement allowance | ₹50,000 |
| `SCST_OUTSIDE_DISTRICT` | SC/ST relocated outside district | +25% R&R monetary + ₹50,000 |
| `MULTIPLE_DISPLACEMENT` | Second/successive displacement (s.39) | flag only |

Monetary R&R heads (drive `MONETARY_RNR` clock): `ONE_TIME_5L`, `SUBSISTENCE*`, `TRANSPORT`, `CATTLE_SHED`, `ARTISAN_GRANT`, `RESETTLEMENT_ALLOWANCE`, `SCST_OUTSIDE_DISTRICT`, `HOUSING_URBAN_OPTOUT`.

**Thresholds:** `rnrCommitteeAcres: 100`, `scStFirstInstalmentMinFraction: 0.3333`, `deadlineDueSoonDays: 30`, `gpsAccuracyWarnM: 20`, `gpsAccuracyRejectM: 50`, `areaMismatchFlagPct: 5`, `photoMaxDistanceFromParcelM: 25`.

**Escalation:** `afterBreachDays: [0, 7, 21]`, `levels: ['POST', 'DISTRICT', 'STATE']`.

### 12.4 `larr-2013-maharashtra@1.0.0`

```json
{ "code": "larr-2013-maharashtra", "version": "1.0.0",
  "extends": { "code": "larr-2013-base", "version": "1.0.0" },
  "jurisdiction": { "level": "STATE", "stateCode": "<LGD code for Maharashtra>" },
  "verify": [
    "Rural multiplication factor bands must be taken from the Maharashtra Government notification — values here are placeholders",
    "Any state-specific R&R enhancement under s.107 must be sourced before demo"
  ],
  "checks": [ { "code": "RURAL_FACTOR_BANDS", "kind": "factorBandsByDistanceKm",
                "params": { "note": "PLACEHOLDER — replace from notification" } } ] }
```

The pack viewer must render `verify[]` prominently so nobody presents placeholder values as law.

### 12.5 `nh-act-1956@1.0.0` — structure illustrative

Purpose: prove the engine runs a **different statute** with the same code. The demo corridor (a national highway) is exactly this case.

**[VERIFY] every section number and duration below against the National Highways Act 1956 text before the demo.** These are not from our uploaded sources.

| Order | Code | Name (illustrative) |
|---|---|---|
| 1 | `NH_PROPOSAL` | Proposal & alignment |
| 2 | `NH_3A_INTENT` | Notification of intention to acquire |
| 3 | `NH_3C_OBJECTIONS` | Objections and hearing by CALA |
| 4 | `NH_3D_DECLARATION` | Declaration of acquisition |
| 5 | `NH_3G_AMOUNT` | Determination of amount by CALA |
| 6 | `NH_3H_DEPOSIT_PAYMENT` | Deposit and payment |
| 7 | `NH_POSSESSION` | Possession |
| 8 | `NH_POST` | Post-acquisition |

No consent stage. Owner role for determination: `LAO` (acting as CALA). `verify[]` lists every assumption.

### 12.6 Workflow engine (`packages/rules/src/engine`)

Pure functions. The API wraps them with persistence.

```ts
resolvePack(code, version): ResolvedPack
applicableStages(pack, project): Stage[]                    // evaluates appliesWhen
availableActions(pack, stageInstance, ctx): ActionOption[]  // for rendering the action panel
checkGuards(pack, stageInstance, action, ctx): GuardResult  // {allowed, failures:[{code, message}]}
planTransition(pack, stageInstance, action, input, ctx): TransitionPlan
  // -> { newStatus, nextStage?, projectStatus?, events: string[], clocksToStart, clocksToSatisfy }
startClock(pack, clockCode, startedAt, conditionInputs): { dueAt, consequence }
computeDueAt(startedAtUtc, isoDuration, tz): Date            // single place for day-counting (G17)
deadlineStatus(dueAt, now, dueSoonDays, satisfiedAt?): DeadlineStatus
estimateInterestPaise(unpaidPaise, possessionAt, asOf, interestCfg): bigint   // G2
runChecks(pack, family, enteredHeads): CheckResult[]
possessionGate(pack, projectParcel, ctx): GateResult        // see below
```

**Guards evaluated by `checkGuards`** (all must pass):

1. Actor's active post role ∈ `action.roles`.
2. Actor's post jurisdiction covers the project.
3. Maker-checker: if `makerChecker`, actor user ≠ submitter user **and** actor post ≠ submitter post.
4. Required checklist items satisfied (documents uploaded **and attested**, events fired, gates met, hearings `VALID`).
5. `reasonCode` present and in the allowed list for RETURN / REJECT / NULLIFY / TERMINATE.
6. `writtenReasons` non-empty for OVERRIDE.
7. Stage ordering: previous applicable stage APPROVED (except S04 may run parallel to S02).
8. Project status is `ACTIVE`.
9. No `LAPSED` / `DEEMED_RESCINDED` consequence has fired on a clock that blocks this stage.

**Engine decisions recorded here (Phase 1):**

- A clock with no `endsOn` (the s.15 objection window) is a *period*, not a duty: once it runs out, `clockStatus()` reports it `SATISFIED` (elapsed), never `BREACHED`. Only clocks with an ending event can breach.
- Guard 9 is derived from the pack, not listed by hand: a stage is blocked when a clock whose `endsOn` event that stage emits, and whose consequence is `SIA_LAPSED` / `DEEMED_RESCINDED` / `PROCEEDINGS_LAPSE`, is past due. Only forward actions (SUBMIT / APPROVE / APPROVE_CONDITIONAL / OVERRIDE) are blocked; RETURN and TERMINATE stay available.
- Checklist items are satisfied by **evidence**, not tick-boxes (`apps/api/src/workflow/workflow.service.ts`): `document` → an attested document of that `docType` on the project; `hearing` → a hearing of that `hearingType` with status `VALID`; `event` / `gate` → the `stage_checklist` row the owning module sets on the current attempt.
- Seed history is replayed through `planTransition` (`packages/db/src/scripts/seed/history.ts`), and "due in N days" hooks are placed with `startForDueOn()` — the inverse of `computeDueAt()`.

**Possession gate** (per project parcel) — possession may be recorded only when **all** hold:

- Every land head entitlement for families with interests in this parcel is `ACKNOWLEDGED`, `DEPOSITED_WITH_AUTHORITY`, or `UNDER_PROTEST` with payment `SUCCESS`
- Monetary R&R heads for displaced families on this parcel likewise settled
- If any family on the parcel is displaced: their resettlement site `readiness = 100%` (all amenity milestones complete) **or** a recorded exception by the Collector
- Vacation certificate uploaded and attested

This is how "possession follows payment and acknowledgement" (s.38) is enforced in code.

### 12.7 Reason codes (from the process document's rejection routes)

Stored in the pack per stage. Minimum set:

| Stage | Reason codes |
|---|---|
| S01 | `MIN_LAND_NOT_PROVEN`, `INCOMPLETE_LAND_RECORDS`, `NO_BUDGET_SANCTION`, `BOUNDARY_CONFLICT`, `UNVERIFIED_TITLE`, `ESCROW_INITIAL_UNFUNDED` |
| S02 | `IMPROPER_AGENCY_SELECTION`, `MISSING_TENANT_ENUMERATION`, `UNMAPPED_SC_ST`, `INCOMPLETE_CPR_LIST`, `UNADDRESSED_OBJECTIONS` |
| Hearings (any) | `INADEQUATE_NOTICE`, `NO_QUORUM`, `NO_VIDEO_RECORDING`, `NO_LOCAL_LANGUAGE_SUMMARY`, `ATTENDANCE_NOT_RECORDED` |
| S03 | `MEMBER_CONFLICT_OF_INTEREST`, `MEMBER_NOT_QUALIFIED`, `SIA_INCOMPLETE`, `SIA_DATA_FLAWED` |
| S04 | `DUPLICATE_ENTRIES`, `UNVERIFIED_HEIRS`, `TENANTS_OMITTED`, `THRESHOLD_NOT_MET` (terminal) |
| S05 | `SINGLE_NEWSPAPER_ONLY`, `INCORRECT_SURVEY_NUMBERS`, `MISSING_SIA_SUMMARY`, `HEARING_NOTICE_NOT_SERVED`, `OBJECTIONS_UPHELD_DENOTIFY` (terminal) |
| S06 | `MISSING_TENANTS`, `UNCOUNTED_LABOURERS`, `EXCLUDED_SC_ST`, `BELOW_STATUTORY_MINIMUM`, `MISSING_SC_ST_LAND`, `UNDERBUDGETED_INFRA`, `BUDGETING_ERROR` |
| S07 | `ESCROW_SHORTFALL`, `SURVEY_BOUNDARY_ERROR`, `TIMELINE_EXPIRED`, `NOTICE_NOT_SERVED` |
| S08 | `HIGH_VALUE_PRECEDENTS_OMITTED`, `UNREPRESENTATIVE_SALES`, `REPLACEMENT_COST_NOT_REFLECTED`, `WRONG_MULTIPLICATION_FACTOR`, `ARITHMETIC_ERROR`, `DUPLICATE_TITLE_CLAIM`, `UNBUDGETED_RNR_LIABILITY` |
| S09 | `TITLE_DISPUTED`, `TITLE_ENCUMBERED`, `RNR_INCOMPLETE`, `LEGAL_STAY` |
| S10 | `REFERENCE_TIME_BARRED` |

Each code has an `en` label and `hi`/`mr` labels in `packages/shared/i18n/reason-codes.*.json`.

### 12.8 Domain events (outbox)

Every event below is written to `outbox_events` in the same transaction as the change. The relay job publishes to BullMQ; consumers are idempotent.

| Event | Consumers |
|---|---|
| `PROJECT_SUBMITTED` | notify, deadline-scan |
| `STAGE_SUBMITTED` / `STAGE_APPROVED` / `STAGE_RETURNED` / `STAGE_NULLIFIED` / `PROJECT_TERMINATED` | notify, deadline-scan, mv-refresh, anchor (APPROVED only) |
| `SIA_COMMENCED`, `SIA_REPORT_FINAL`, `SIA_APPRAISED`, `EXPERT_GROUP_CONSTITUTED`, `EXPERT_RECOMMENDATION_SIGNED` | deadline-scan |
| `S11_PUBLISHED` | deadline-scan, transfer-freeze, notify, anchor |
| `S19_PUBLISHED` | deadline-scan, anchor (`AWARD_DECLARED` is separate) |
| `PARCEL_VERIFIED` | anchor, mv-refresh |
| `PARCEL_CORRECTED` | anchor (new version) |
| `AWARD_SIGNED` | deadline-scan, anchor (`AWARD_DECLARED`), notify |
| `S37_NOTICE_SERVED` | deadline-scan |
| `DISBURSEMENT_SUCCEEDED` | anchor (`COMPENSATION_DISBURSED`), send acknowledgement link, mv-refresh |
| `COMPENSATION_ACKNOWLEDGED` | anchor, mv-refresh, deadline-scan |
| `POSSESSION_TAKEN` | anchor (`POSSESSION_CONFIRMED`), deadline-scan (interest, utilisation) |
| `DOCUMENT_ATTESTED` | anchor (attestation hash) |
| `SITE_COMMISSIONED` | deadline-scan |

---

## 13. API CONVENTIONS

- Base: `/api/v1`. OpenAPI at `/api/docs` (dev only).
- Auth: portal uses httpOnly cookies; field app uses `Authorization: Bearer` (stored in memory + refresh via cookie).
- Every mutation accepts an optional `Idempotency-Key` header; **required** on field sync and payment endpoints.
- Generic stage action endpoint drives the whole workflow — do **not** add bespoke "approve X" endpoints.

```
POST /api/v1/projects/:projectId/stages/:stageCode/actions
{
  "action": "RETURN",
  "reasonCode": "INCOMPLETE_CPR_LIST",
  "remarks": "CPR inventory missing grazing land in Shirwal",
  "targetStageCode": "S02_SIA",          // RETURN only, optional
  "writtenReasons": null,                 // OVERRIDE only
  "documentIds": ["..."],
  "conditions": null                      // APPROVE_CONDITIONAL only
}
→ 200 { stageInstance, transition, projectStatus, eventsEmitted, clocks }
→ 422 problem+json { code: "GUARD_FAILED", failures: [{ code, message }] }
```

`GET /api/v1/projects/:projectId/stages/:stageCode/actions` returns the available actions with guard results so the portal can show disabled buttons with the reason.

---

## 14. MODULE A — PROPOSAL INTAKE `[MVP deep]`

**Stage:** S01. **Owners:** Requiring Body (submits), LAO (scrutiny), Collector (accepts). **Also:** CALA, State Revenue, District Treasury.

### Build

1. **Intake form** — fields: name, name (local), category + sub-category (§39.1), acquisition type, requiring body, national importance, estimated budget (₹ → paise), total land required (ha → m²), target districts and villages (LGD pickers), linear yes/no, right-of-way width (m).
2. **Alignment upload** — accept `.kml`, `.kmz`, `.geojson`, `.zip` (shapefile). Parse server-side:
   - KML/KMZ → `@tmcw/togeojson` (KMZ unzip with jszip)
   - Shapefile zip → `shpjs`; if `.prj` is not WGS84, reproject with `proj4`
   - GeoJSON → assume EPSG:4326 (RFC 7946); reject if coordinates are out of India's bbox
   - `.dxf` → accept as a document only; ask for KML/GeoJSON geometry
   - Linear: expect LineString(s) → merge → `alignment`; footprint = `corridor(alignment, row_width_m)`
   - Area: expect Polygon(s) → `footprint`
3. **Automated pre-scrutiny** (`POST /projects/:id/prescrutiny`) — returns a checklist, does not block saving:
   - Mandatory fields present; DPR summary, administrative & financial sanction, funding clearance documents uploaded
   - Geometry valid (`ST_IsValid`), inside declared districts (tolerance 500 m)
   - **National duplicate-footprint check** — `ST_Intersects(footprint, other active projects' footprints)` → list overlapping projects with overlap area
   - Constraint layers (§15.5) — initial spatial warnings
   - Rule pack auto-selected from `acquisition_type` + category + state (user may choose among eligible packs); pinned on submit
4. **Routing** — on submit: derive districts from footprint (`ST_Intersects` with district boundaries or village → district), fill `project_districts`, notify Collector post(s) of each district, State Revenue post, and CALA post if the pack is a sector act.
5. **Initial escrow gate** — create `escrow_accounts(gate=INITIAL)` with demand for SIA and administrative charges; S01 APPROVE blocked until `funded`.
6. **Acceptance** — Collector APPROVE creates the S02 (or next applicable) stage instance and sets `status=ACTIVE`.

### Endpoints

```
POST   /projects                         create draft
PATCH  /projects/:id                     edit draft
POST   /projects/:id/alignment           multipart upload → parsed geometry preview
POST   /projects/:id/prescrutiny         run checks → checklist
POST   /projects/:id/submit              pin rule pack, route, emit PROJECT_SUBMITTED
GET    /projects?status=&district=&q=
GET    /projects/:id                     summary + current stage + KPIs
GET    /projects/:id/timeline            stage instances + transitions
GET    /projects/:id/deadlines
POST   /projects/:id/escrow/:gate/demand
POST   /projects/:id/escrow/:gate/deposits
POST   /projects/:id/escrow/:gate/certify
```

### Screens

- **New proposal wizard**: Details → Alignment (map preview) → Documents (with attestation) → Pre-scrutiny results → Submit
- **Project header** (shared by all project pages): code, name, pack badge (`larr-2013-maharashtra@1.0.0`), status, current stage, next deadline countdown

### Done when

A requiring-body user uploads a KML for the demo corridor, sees it on a map, sees an overlap warning against a seeded project, submits, and the Pune and Satara Collectors both receive a notification.

---

## 15. MODULE B — GIS & FIELD PARCEL CAPTURE `[MVP deep]`

**Stages:** S01.2, S05.2. **Owners:** Field Officer (Patwari/Talathi), DILR, Tehsildar. **Also:** LAO, Requiring Body engineers.

### 15.1 Two capture paths, one record

| Path | When | Result |
|---|---|---|
| **Cadastral import** | State data available (mock adapter in MVP) | `land_parcels` with `boundary_source = CADASTRAL_IMPORT`, `recorded_area_sqm` set |
| **Walk the boundary** | No cadastral data, or verification of imported data | `field_surveys` + `parcel_vertices` → polygon → `boundary_source = FIELD_DRAWN`, `field_area_sqm` set |

Both write the **same** parcel record. If both exist, keep both areas and flag `AREA_MISMATCH` when `|area_diff_pct| > areaMismatchFlagPct`.

### 15.2 Corridor → parcel intersection

`POST /projects/:id/intersect`:

```sql
INSERT INTO project_parcels (project_id, parcel_id, affected_geom, affected_area_sqm, affected_pct, chainage_km, status)
SELECT p.id, lp.id,
       ST_Multi(ST_CollectionExtract(ST_Intersection(lp.geom, p.footprint), 3)),
       area_sqm(ST_Intersection(lp.geom, p.footprint)),
       round(100 * ST_Area(ST_Intersection(lp.geom, p.footprint)::geography) / ST_Area(lp.geom::geography), 2),
       CASE WHEN p.is_linear THEN chainage_km(p.alignment, lp.geom) END,
       'PROPOSED'
FROM projects p JOIN land_parcels lp ON ST_Intersects(lp.geom, p.footprint)
WHERE p.id = $1
  AND ST_Area(ST_Intersection(lp.geom, p.footprint)::geography) > 1.0   -- ignore slivers < 1 m²
ON CONFLICT (project_id, parcel_id) DO UPDATE SET ...;
```

Then create `affected_families` stubs from `parcel_interests` (one per head person per project), and run constraint checks.

### 15.3 Parcel verification

`POST /parcels/:id/verify` (Tehsildar / DILR / LAO):
- Shows: photos per vertex, GPS accuracy per vertex, plausibility results (§15.6), overlap result, recorded vs field area, s.12 notice
- If any flag is present, `override_reason` is **required**
- On approve: parcel status `VERIFIED`, emit `PARCEL_VERIFIED` → anchor

### 15.4 Corrections (versioned, never silent)

`POST /parcels/:id/corrections` → requested → approved by a different post (maker-checker) → new `land_parcels.version`, old geometry to `land_parcels_versions`, emit `PARCEL_CORRECTED` → new anchor. The chain shows lineage v1 → v2.

**Tamper** = current row's canonical hash ≠ latest anchored hash **for the same version**. That is the only condition that raises "tampering detected".

### 15.5 Constraint screening

Run at pre-scrutiny, after intersection, and after any correction.

| Check | Rule | Flag / consequence |
|---|---|---|
| Irrigated multi-crop (s.10) | any affected parcel with `is_irrigated_multicrop` or intersecting `IRRIGATED_MULTICROP` layer | Spatial flag + S01/S02 checklist item "last-resort justification" and "culturable wasteland plan" |
| Scheduled Area (s.41) | intersects `SCHEDULED_AREA` layer | `projects.in_scheduled_area = true` → S04 applies with Gram Sabha consent; checklist "Development Plan" |
| R&R Committee (s.45) | `sum(affected_area_sqm) ≥ rnrCommitteeAcres × SQM_PER_ACRE` | S06 checklist "R&R Committee constituted" |
| Protected forest | intersects `PROTECTED_FOREST` | Spatial warning |
| Eco-sensitive zone | intersects `ECO_SENSITIVE` | Spatial warning |
| Water body | intersects `WATER_BODY` | Spatial warning |
| Cross-project overlap | project parcel also in another active project | `OVERLAP` flag on both |
| Outside village | parcel not `ST_Within(ST_Buffer(village.boundary::geography, 20)::geometry)` | `OUTSIDE_VILLAGE` flag |

### 15.6 Field plausibility checks (server-side, on sync)

A PWA **cannot read Android's mock-location flag** — only native apps can. So we check plausibility instead and say so honestly.

| Check | Rule | Result |
|---|---|---|
| Accuracy | any vertex `accuracy_m > gpsAccuracyRejectM` | reject vertex; `> gpsAccuracyWarnM` → warn |
| Walking speed | implied speed between consecutive vertices by `captured_at` > 15 km/h | flag `IMPLAUSIBLE_SPEED` |
| Clock skew | `captured_at` > `synced_at` or skew > 48 h beyond offline window | flag `CLOCK_SKEW` |
| Photo location | photo point > `photoMaxDistanceFromParcelM` from polygon | flag `PHOTO_FAR` |
| Assignment area | any vertex > 2 km from the assigned project footprint | flag `OUTSIDE_ASSIGNMENT` |
| Suspicious precision | accuracy exactly an integer repeated ≥ 5 times, or coordinates with ≤ 4 decimals | flag `SUSPICIOUS_FIX` |
| Self-intersection | `NOT ST_IsValid(polygon)` | reject |
| Too few points | < 3 vertices | reject |

Native mock-location detection is a `[LATER]` path via a Capacitor wrapper. Never claim it in the MVP.

### 15.7 Units, formats, map

- Area display: `2.37 ha · 5.86 acre · 234.3 guntha`
- Survey number display: `214/3`
- **Colour-by switcher** on every map: `stage` · `payment` (unpaid / part paid / paid / acknowledged) · `deadline risk` (safe / due soon / breached)
- **Chainage strip** (linear projects): bins of 500 m from `chainage_km`, each bin coloured by the worst status in it; click a bin → filter the parcel list

### Endpoints

```
POST  /projects/:id/intersect
GET   /projects/:id/parcels?colorBy=stage|payment|risk        → GeoJSON FeatureCollection
GET   /projects/:id/chainage?binM=500
GET   /projects/:id/flags
POST  /flags/:id/acknowledge
GET   /parcels/:id                                           → parcel + versions + vertices + photos + interests + chain status
POST  /parcels/:id/verify
POST  /parcels/:id/corrections
POST  /parcel-corrections/:id/decide
GET   /cadastral/parcels?village=&survey=                    → adapter (MOCK in MVP)
POST  /parcels/import-cadastral                              → pull from adapter into land_parcels
```

### Done when

The demo corridor intersects ~200 seeded parcels; partial percentages show; s.10 and s.41 flags fire on the right parcels; clicking a vertex opens its photo; a correction creates v2 and a new anchor; `pnpm demo:tamper` makes that parcel show MISMATCH.

---

## 16. FIELD PWA (`apps/field`) `[MVP deep]`

### 16.1 Hard constraints

- **Must run over HTTPS on phones.** Geolocation, camera (`getUserMedia`) and WebAuthn all require a secure context. `localhost` works on the laptop only. For phones use `pnpm demo:tunnel`.
- **Use one origin for the demo.** Build the field app and serve it statically from the portal under `/field`; the portal proxies `/api/*` to the API with Next.js rewrites. One tunnel then covers field app, portal, public enrol/ack pages and API — and `WEBAUTHN_RP_ID` is a single hostname.
- **Offline first.** Everything captured is stored in IndexedDB first, uploaded later.
- **In-app camera only.** Use `getUserMedia` + canvas capture. No `<input type="file">`, no gallery picker. Photos therefore have no EXIF; location comes from the geolocation API at the capture instant.

### 16.2 Screens

1. **Login** (online) → caches assignments and refresh token
2. **Assignments** — list of parcels/areas to survey, with `Download offline pack` per assignment
3. **Offline pack** — `GET /field/assignments/:id/offline-pack` returns: assignment, project footprint, village boundaries, existing parcel geometries, JIR item types, reason codes. Basemap = regional PMTiles cached by Workbox (§16.5)
4. **Walk & Mark**
   - Map with footprint, existing parcels, live position dot + accuracy circle
   - Accuracy badge: green ≤ 10 m, amber ≤ `gpsAccuracyWarnM`, red above
   - **Mark Point**: hold-to-average for 5 s (collect fixes from `watchPosition({enableHighAccuracy:true, maximumAge:0})`, weight by `1/accuracy²`) → opens camera → capture photo → vertex saved with photo
   - **Undo** last point; running polygon; live area (turf, labelled "estimate") ; self-intersection warning (turf `kinks`)
   - **Close polygon** (≥ 3 points)
   - Walked track recorded continuously while the screen is open
5. **s.12 notice** — record date served + photo of the notice
6. **Joint Inspection** — add JIR items (type, description, quantity, unit, photo); boundary pillars (number + photo)
7. **Review** — summary, flags computed locally (accuracy, too few points, kinks)
8. **Submit** — queue for sync
9. **Sync status** — queued / uploading / synced / rejected (with reason); `Sync now` button

### 16.3 Local storage (Dexie)

```
assignments, offlinePacks, surveys, vertices, photos (Blob + sha256), jirItems, pillars,
outbox (id, idempotencyKey, op, payload, status, attempts, lastError)
```

### 16.4 Sync protocol

- `POST /field/sync` with `{ ops: [{ idempotencyKey, op, payload }] }` — ops applied in order: `CREATE_SURVEY`, `ADD_VERTEX`, `ADD_JIR_ITEM`, `ADD_PILLAR`, `SUBMIT_SURVEY`
- Photos upload first via `POST /field/photos` (multipart, with `sha256`, `lat`, `lng`, `accuracy`, `capturedAt`); server recomputes sha256 and rejects mismatch
- Server dedupes by idempotency key; returns per-op result
- Background Sync plugin where supported; **iOS Safari has no Background Sync** — the `Sync now` button is mandatory
- Server records `synced_at` from ClockService

### 16.5 Basemap — do not bulk-cache OSM tiles

Bulk downloading `tile.openstreetmap.org` violates the OSM tile usage policy. Instead:

- Extract a **regional PMTiles** file for the demo bbox (Protomaps basemap build or a planet extract tool) into `data/tiles/demo-region.pmtiles`, served statically by the portal
- Render with `protomaps-leaflet`
- Workbox caches the PMTiles file (range requests) for offline use
- Satellite imagery: portal only, online only, with the provider's attribution, per its terms. Never cache it offline.
- **Decided 1 Oct 2026:** the officer portal opens on Esri World Imagery (online, attribution visible) with a toggle to the offline PMTiles map; the field PWA uses PMTiles only.

### Done when

On a phone over the tunnel, with airplane mode on, an officer marks 4 corners with photos, adds 2 JIR items, submits; turns airplane mode off; presses Sync; the parcel appears on the portal map with vertex photos within seconds.

---

## 17. MODULE C — SIA & EXPERT GROUP `[MVP thin]`

**Stages:** S02, S03. **Owners:** Independent SIA Agency, State SIA Directorate, Expert Group. **Also:** Gram Sabha/ULB, Collector/LAO, Social & Tribal Welfare, Agriculture, Pollution Control Board, Requiring Body, State Police, affected families.

### Build (thin)

- SIA agency gets a PROJECT-level post; uploads census records (CSV import into `sia_census_records`), CPR inventory (map points), draft SIA report, draft SIMP
- **Hearings** (`hearings` with type `SIA_PUBLIC`): schedule, publish notice, upload local-language summary, recording, attendance, response matrix; `validate` endpoint evaluates validity conditions; Collector may `NULLIFY` with a reason code → new attempt
- Final SIA report + SIMP → emits `SIA_REPORT_FINAL`
- Expert Group: constitute (7 member seats: 2 social scientists, 2 local body reps, 2 R&R experts, 1 technical) with a conflict-of-interest declaration document per member → emits `EXPERT_GROUP_CONSTITUTED`
- Recommendation: outcome A / B (with conditions) / C, dissent notes, signed report → emits `EXPERT_RECOMMENDATION_SIGNED`, `SIA_APPRAISED`
- Outcome C → `REJECT` → project `ABANDONED` unless `OVERRIDE` with written reasons (s.8(2))
- **Speech-to-text for oral objections** `[thin]`: upload hearing audio → STT adapter (MOCK returns demo transcript) → split into objection tickets linked to parcels by the officer

### Hearing validity (computed)

```
VALID when ALL:
  notice_published_at <= scheduled_at - P21D          -- 3 weeks advance notice
  local_language_summary_document_id IS NOT NULL
  recording_document_id IS NOT NULL
  attendance_document_id IS NOT NULL
  quorum_met = true
```

### Endpoints

```
POST /projects/:id/sia/census/import
POST /projects/:id/cpr
POST /projects/:id/hearings                 GET /projects/:id/hearings
POST /hearings/:id/documents                POST /hearings/:id/validate
POST /hearings/:id/nullify
POST /projects/:id/expert-group             POST /projects/:id/expert-group/recommendation
POST /projects/:id/override
POST /hearings/:id/audio                    → STT job → transcript document
```

---

## 18. MODULE D — CONSENT, s.11 NOTIFICATION, OBJECTIONS `[MVP deep]`

**Stages:** S04, S05. **Owners:** Collector/LAO, DLSA observers, landowners. **Also:** Gram Sabha, Sarpanch, Tehsildar, VRO, Requiring Body, Sub-Registrar, Directorate of Printing, State Revenue, Legal Cell.

### 18.1 Consent (S04) — only when the pack says it applies

1. **Register** — generate draft entries from `parcel_interests` (owners + land-dependent families per pack rule); status `draft`
2. **Display** — `display_from`/`display_to` (15 days); public notice document; claims & corrections logged; heir updates (`is_heir_update`)
3. **Certify** — Collector certifies → register locked
4. **Awareness hearing** — `hearings(type=GRAM_SABHA_CONSENT)` with validity rules (3-week notice, local-language booklet, recording) — must be VALID before collection
5. **Collection** — per entry: decision, signed/thumb-printed form (document), identity check via adapter (`POST /identity/verify` → MOCK), **DLSA observer post** records certification of non-coercion
6. **Tally** — `v_consent_tally`; live meter on the Collector dashboard: `71.2% of 70% required · 312 / 438`
7. **Outcome** — met → S04 APPROVE; not met at close → `TERMINATE` with `THRESHOLD_NOT_MET` → project `TERMINATED`

### 18.2 s.11 publication (S05)

- Draft notification auto-assembled: purpose, SIA summary, Administrator particulars, schedule of survey numbers (from `project_parcels`) → document for officer review
- Publication checklist: Gazette copy, 2 newspapers (one local language), local affixation certificates, website upload
- On publish: emit `S11_PUBLISHED` → starts `OBJECTION_WINDOW` (60 days) and `DECLARATION` (12 months) clocks; sets `land_parcels.transfer_frozen_at`; generates **Sub-Registrar transfer-freeze notice** document; public notice appears on the public portal

### 18.3 Objections

- Filed via public portal (token or OTP-light), helpdesk (officer enters), or from a hearing transcript
- AI triage suggests `statutory_ground` (Act: area/suitability · public purpose · SIA findings) and `operational_category` (A public purpose · B alignment shift · C survey error) + language + confidence → stored in `ai_suggested_*` (G3); officer confirms
- Hearing scheduling with individual notices (s.15(2)); decision with remarks: `UPHELD` / `REJECTED`
- LAO inquiry report → government decision: proceed / modify boundary / denotify (`TERMINATE` → `DENOTIFIED`)

### Endpoints

```
POST /projects/:id/consent-registers           POST /consent-registers/:id/display
POST /consent-registers/:id/entries            POST /consent-registers/:id/certify
POST /consent-registers/:id/records            GET  /projects/:id/consent/tally
POST /identity/verify                          (adapter — MOCK)
POST /projects/:id/s11/draft                   POST /projects/:id/s11/publish
POST /projects/:id/objections                  GET  /projects/:id/objections
POST /objections/:id/triage                    POST /objections/:id/decide
```

### Done when

The PPP demo project shows a consent meter crossing 70% with DLSA certifications; publishing s.11 on the demo corridor freezes transfers on all its survey numbers, starts two clocks, and puts the notice on the public portal.

---

## 19. MODULE E — R&R SCHEME & PASSBOOK `[MVP thin]`

**Stage:** S06. **Owners:** Administrator for R&R, Commissioner for R&R. **Also:** R&R Committee, Social Justice/Tribal Welfare, PWD/Rural Development, Gram Sabha, Requiring Body, Dept of Information & PR, affected families.

### Build

- **R&R census** (`rnr_census_records`) — separate from the SIA census; categorisation + vulnerability flags; import CSV or form
- **Scheme** — versions; draft document; R&R public hearing (type `RNR_PUBLIC`, s.16(5)); committee review when ≥ 100 acres; Commissioner approval (maker-checker vs Administrator); gazette publication
- **Resettlement sites** — polygon, capacity, 25 Third Schedule amenity milestones (§39.3), readiness % = complete / applicable; commissioning certificate → emits `SITE_COMMISSIONED`
- **Digital R&R Passbook** — per family, rendered from entitlements + allotments + annuity schedule + grievance status; `payload_sha256` stored; public access via a single-use-per-session passbook token (SMS link in production, QR on screen in demo). Shows: heads, amounts, status per head (with acknowledgement), due dates, site allotment, whom to contact. **Never** shows hold reasons.

### Endpoints

```
POST /projects/:id/rnr/census/import      POST /projects/:id/rnr/schemes
POST /rnr/schemes/:id/submit              POST /rnr/schemes/:id/approve
POST /projects/:id/sites                  POST /sites/:id/milestones/:code
GET  /families/:id/passbook               POST /families/:id/passbook/issue
GET  /public/passbook/:token
```

---

## 20. MODULE F — DECLARATION, CLAIMS, AWARD `[MVP thin]`

**Stages:** S07, S08. **Owners:** LAO / Land Acquisition Collector, Collector. **Also:** Requiring Body, Finance, Registration & Stamps, Sub-Registrar, Valuation Committee, PWD/Forest/Horticulture/Minor Irrigation, Administrator R&R, claimants.

### Build

- **Full escrow gate** — demand note (officer-entered amount), deposits, running balance, Financial Sufficiency Certificate; S07 APPROVE blocked until certified
- **s.19 declaration** — publication checklist; emits `S19_PUBLISHED`; if the `DECLARATION` clock breached before publication → consequence `DEEMED_RESCINDED` is shown and S07 is blocked (the Collector must start a fresh process — the engine does not auto-terminate; it surfaces the legal consequence)
- **s.21 notices & claims** — notice on/near land + individual notices (landowners, tenants, mortgagees, R&R beneficiaries); claims register in 3 categories
- **Valuation inputs — assist and confirm (G1)**: a panel that *displays* officer-entered benchmarks (circle rate, 3-year sale-deed average, consented amount) and department valuation reports (PWD / Forest / Horticulture / Minor Irrigation). **The system does not pick the highest or multiply anything.** The LAO enters final figures.
- **Award entry with OCR assist** (the most important screen in this module):
  1. Upload signed award PDF (attested) → OCR job (`pdf-parse`, fallback `tesseract.js`)
  2. Extractor proposes fields per family per head: `{key, value, confidence, page, bbox}`
  3. Review screen: PDF on the left with highlighted bbox, suggested fields greyed on the right, **Accept** per field (or edit), mismatch warnings against the parcel/interest record — never auto-resolves
  4. Only accepted values create `entitlements` (`source = ocr_confirmed`)
  5. `runChecks` shows validation results (solatium 100%, SC/ST ⅓, factor range, below-minimum heads)
  6. Collector signs → `AWARD_SIGNED` → payment clocks start; `S37_NOTICE_SERVED` recorded per person with `presentAtAward` → reference clock
- Entitlement `due_by` = from the clock (`COMPENSATION_PAYMENT` / `MONETARY_RNR`)

### Endpoints

```
POST /projects/:id/s19/publish            POST /projects/:id/s21/notices
POST /projects/:id/claims                 GET  /projects/:id/claims
POST /projects/:id/valuation-inputs       (entered benchmarks + reports; display only)
POST /projects/:id/awards                 (upload) → OCR job
GET  /ocr-extractions/:id                 POST /ocr-extractions/:id/review
POST /awards/:id/entitlements             (manual entry path)
GET  /awards/:id/checks                   POST /awards/:id/sign
POST /awards/:id/s37-notices
GET  /families/:id/entitlements
```

### Done when

Uploading the synthetic award PDF for one demo family produces suggested fields; accepting them creates entitlements; a deliberately wrong solatium value is flagged; signing starts the 3/6/18-month clocks.

---

## 21. MODULE G — DISBURSEMENT, ACKNOWLEDGEMENT, POSSESSION `[MVP deep]`

**Stage:** S09. **Owners:** LAO, District Treasury Officer. **Also:** banks, affected families, Administrator & Commissioner R&R, PWD, Revenue Inspector, Tehsildar, Patwari, Police, LARR Authority, Land Records.

### 21.1 Disbursement

- `POST /entitlements/:id/disbursements` → payment adapter (MOCK: returns `PENDING`, then a job flips to `SUCCESS` or `FAILED` after a few seconds; 5% seeded failures)
- Fields: amount, first instalment flag (SC/ST ⅓ check), acceptance type (ABSOLUTE / UNDER_PROTEST), indemnity bond document
- **Hold** — `POST /disbursements/:id/hold {reasonCode, reason}` — restricted field (§11.4)
- **Deposit with Authority** (s.77) — refusal / incapacity / title dispute / apportionment dispute → instrument `DEPOSIT_WITH_AUTHORITY`, entitlement status `DEPOSITED_WITH_AUTHORITY`, create/link `legal_cases` where relevant
- On `SUCCESS` → emit `DISBURSEMENT_SUCCEEDED` → anchor `COMPENSATION_DISBURSED` → create acknowledgement access token → SMS (mock) / on-screen QR

### 21.2 Acknowledgement — lead innovation

**Reality check that shapes the design:** a WebAuthn *platform authenticator* uses the **device owner's** biometric. An officer's tablet cannot hold hundreds of families' fingerprints. So the ceremony runs on the **beneficiary's own phone**.

**Enrolment (once per authorised recipient, witnessed):**

1. Officer opens the family in the portal → `Create enrolment link` → QR on screen (token, 30 min, single use)
2. Beneficiary scans with their own phone → public page `/enrol/:token` → `navigator.credentials.create()` with the phone's fingerprint/face unlock
3. Server verifies attestation (`@simplewebauthn/server`, `attestationType: 'none'`), stores credential against `person_id`, records `enrolled_witness_post_id` and location
4. Enrolment is audited and anchored as its own event

**Acknowledgement (per disbursement):**

1. After payment succeeds, the family receives a link (SMS mock in dev; QR at the disbursement camp in the demo)
2. `/ack/:token` shows: amount, head, date, project — "Did you receive this amount?"
3. `navigator.credentials.get()` with the family's registered credential → server verifies assertion + counter → `acknowledgements(method=WEBAUTHN)`
4. Emit `COMPENSATION_ACKNOWLEDGED` → anchor; entitlement → `ACKNOWLEDGED`

**Fallbacks (always available, always recorded):**

| Method | When | Records |
|---|---|---|
| `OTP` | no smartphone / no biometric | OTP to phone (mock SMS), `otp_ref` |
| `OFFICER_ATTESTED` | no phone, worn fingerprints, elderly | witness post, fallback reason, geo-tagged photo, attestation |

**Never:** store fingerprints (G6); allow acknowledgement from the officer's own session for a WebAuthn method; auto-acknowledge.

**Disputed receipt:** the ack page has "I did **not** receive this" → creates a grievance and flags the disbursement for the Collector.

### 21.3 Possession

- Per project parcel: vacation certificate → s.38 notice → **possession gate** (§12.6) → Panchnama with witnesses + geo photos → possession certificate → handover certificate
- `POST /project-parcels/:id/possession` is refused with the gate failures listed if the gate does not pass
- On success: parcel `ACQUIRED_POSSESSED`, emit `POSSESSION_TAKEN` → anchor `POSSESSION_CONFIRMED`, start `UTILISATION` clock and (if unpaid amounts exist) `INTEREST_STEP` clock
- **Mutation** — post-possession revenue record update document

### 21.4 Interest liability (the one computed money figure, G2)

```
estimateInterestPaise(unpaid, possessionAt, asOf, cfg):
  days = max(0, daysBetween(possessionAt, asOf))          -- in Asia/Kolkata calendar days
  d1 = min(days, 365); d2 = max(0, days - 365)
  interest = unpaid × (cfg.rateYear1Pct × d1 + cfg.rateAfterPct × d2) / (100 × 365)
  -- integer arithmetic in paise; round half-up once at the end
```

Simple interest reading of s.80; day-count convention **[VERIFY]**. Displayed as **"Estimated interest liability (s.80)"** — never as an amount owed.

### Endpoints

```
POST /entitlements/:id/disbursements        (Idempotency-Key required)
POST /disbursements/:id/hold                POST /disbursements/:id/deposit-authority
POST /persons/:id/webauthn/enrol-link       GET  /public/enrol/:token/options
POST /public/enrol/:token/verify
POST /disbursements/:id/ack-link            GET  /public/ack/:token
GET  /public/ack/:token/options             POST /public/ack/:token/verify
POST /public/ack/:token/otp/send            POST /public/ack/:token/otp/verify
POST /public/ack/:token/dispute
POST /disbursements/:id/attest-fallback
GET  /project-parcels/:id/possession-gate   POST /project-parcels/:id/possession
POST /parcels/:id/mutations
GET  /families/:id/money                    → v_family_money + interest estimate
```

### Done when

On a phone over the tunnel: enrol a demo beneficiary, disburse, acknowledge with fingerprint, watch the family's row flip from *disbursed* to *acknowledged* on the Collector dashboard and the national gap figure change; attempt possession on a parcel with an unacknowledged family and see it refused with the reason.

---

## 22. MODULE H — LARR AUTHORITY `[dashboard]`

- `legal_cases` + events: s.64 references (with `REFERENCE_WINDOW` clock; filings after it are flagged time-barred), s.73 re-determination, s.74 appeals, writs
- Differential liability entered from the order (not computed)
- Legal dashboard: open cases by district, next hearings, liability total, parcels under stay (blocks possession gate with `LEGAL_STAY`)
- Seeded with ~40 cases for the demo

## 23. MODULE I — LONG-TERM COMPLIANCE `[dashboard]`

- **Annuity audit** — `annuity_schedules` (20 years × 12); dashboard: due this month, paid, missed; missed → notification
- **Severance (s.94)** — claim, inspection, decision (acquire whole / s.28 damages / rejected)
- **Utilisation (s.101)** — `UTILISATION` clock; due in 90 days → notify Requiring Body; breach → reversion workflow (owner / Land Bank / custody transfer)
- **Value sharing (s.102)** — officer enters transfer and appreciated value; system displays 40% (from pack) as a derived figure the officer confirms
- **Monitoring committees (ss.48–50)** — upload periodic audit reports; findings list
- **Civic asset handover** — amenity milestones marked handed over to Panchayat/ULB

---

## 24. MODULE J — DASHBOARDS, ANALYTICS, MIS `[MVP deep for national + collector]`

### 24.1 National dashboard (the opening screen of the demo)

- **KPI tiles** (the 8 PS parameters): area notified · area acquired · compensation assessed · compensation paid · **acknowledged** · affected families · displaced families · R&R completion % · possession % · timeline adherence %
- **The gap tile**: `₹4.2 Cr disbursed · ₹3.1 Cr acknowledged · ₹1.1 Cr unconfirmed` (from seed)
- **Breach alerts** — top deadlines breached or due soon, each with consequence text and days remaining
- **Map** — project footprints coloured by risk; click → project
- **State table** — sortable by any KPI
- Live updates via SSE when materialised views refresh

### 24.2 Collector dashboard — "What breaches a statutory deadline on my watch?"

- Deadline board (own district): countdown, consequence, section, assigned post, action button
- Estimated interest liability accruing in the district
- Consent meters, pending verifications, files returned (with reason), unacknowledged disbursements

### 24.3 Other role dashboards

Requiring Body (where is my project stuck, cost of delay) · Field Officer (task list) · District staff (desk inbox) · R&R (families not yet made whole) · Oversight (districts failing and why).

### 24.4 Analytics

- **Delay risk score (0–100)** per open deadline — transparent weighted formula, no training:

| Feature | Weight |
|---|---|
| Fraction of clock elapsed | 0.35 |
| Returns (RETURN transitions) on this stage | 0.15 |
| District median stage duration vs elapsed | 0.15 |
| Open objections / claims count (normalised) | 0.10 |
| Escrow shortfall ratio | 0.10 |
| Hearings voided on this project | 0.10 |
| Legal stays on project parcels | 0.05 |

Show the top 3 contributing factors next to every score. Weights live in `packages/rules/src/risk.ts` (not statutory, so outside the pack) and are documented as heuristic.

- **Bottleneck analysis** — from `stage_transitions`: returns per stage, top reason codes, median time-in-stage, time-to-resubmit
- **MIS reports** — CSV + PDF export: project progress, compensation register, R&R status, deadline compliance, district comparison; filters by state/district/project/date. Report templates are code-defined, filterable (that is our "customisable").

### 24.5 AI assistant (advisory)

- `POST /assistant/query {question}` → LLM with **tool calling only**. Tools (each runs under the caller's RLS scope):
  `get_kpis(scope)`, `list_breaching_deadlines(scope, withinDays)`, `stage_bottlenecks(scope, period)`, `disbursement_gap(scope)`, `district_ranking(metric, scope)`, `project_summary(projectCode)`, `explain_deadline(deadlineId)`
- The model **never** writes SQL and **never** calls a mutating tool (none exist)
- Answer must cite the numbers from tool results; UI shows "Sources: tool calls" expandable
- `LLM_PROVIDER=mock` returns deterministic answers for the 5 demo questions

### Endpoints

```
GET /dashboards/national            GET /dashboards/state/:code
GET /dashboards/district/:code      GET /dashboards/project/:id
GET /dashboards/collector           GET /analytics/risk?scope=
GET /analytics/bottlenecks?scope=   GET /reports/:type?format=csv|pdf&filters…
POST /assistant/query               GET /stream    (SSE: kpi.updated, notification.created, chain.anchored)
```

---

## 25. PUBLIC PORTAL (no login) + CITIZEN ACCOUNTS `[MVP]`

- Route group `apps/portal/app/(public)` — separate layout, no auth, rate-limited
- **Search**: village (LGD picker) + survey number → `public_parcel_status`: project, stage, parcel status, published notices, contact office
- **Notices**: published s.11 / s.19 / R&R scheme with documents
- **Passbook** and **acknowledgement** pages via tokens
- **File an objection** during an open objection window
- Footer provenance note on every page:
  > This portal displays information as recorded by the concerned authority. For the authoritative record, contact the office of the Collector. Data shown as of [timestamp].
- Languages: en / hi / mr switcher
- **Landing page** `/` with two entry cards (Officer portal — restricted; Public portal — open) and **one login page** with
  tabs Officer / Citizen. Officers choose **"Login as" role** first; the server picks their active post with that role
  and rejects the login if they hold none (the dropdown lists roles, never a person's posts).
- **Citizen accounts** (decided 1 Oct 2026): phone + password, phone verified by OTP (SmsAdapter, MOCK in MVP), PII
  encrypted like `persons` (§11.5). An account is linked to a `persons` row only after OTP match **and** officer
  confirmation. Citizens read only their own records through definer functions (G22); separate JWT audience, never an
  officer post. Throttling + lockout as for officers.
- **Grievances**: any citizen (account or phone OTP) files a grievance → tracking number; routed to the responsible
  post (district LAO, else Collector); SLA is an administrative target held in one constant in `packages/shared`
  (not statutory); public status page by tracking number shows no PII; officer inbox with SLA indicator; every
  mutation audited and notified.

---

## 26. DOCUMENTS, ATTESTATION & OCR `[MVP]`

### 26.1 Upload pipeline

1. Upload goes **through the API** (multipart), never direct-to-bucket, so the server can hash and validate.
2. Max 25 MB. Detect type by **magic bytes** (`file-type`), not by extension. Allowlist: pdf, jpeg, png, webp, m4a, mp3, wav, kml, kmz, geojson, zip (shapefile), csv.
3. Server computes `sha256` while streaming to MinIO.
4. **Attestation is part of the upload** — the request must include `attest: true` and `declarationVersion`; the server rejects uploads of legal document types without it (G21).
5. New version of an existing document = new row with `supersedes_id`; old version stays downloadable.
6. Download = presigned GET, `S3_PRESIGN_TTL_SECONDS`, issued only after a permission check.

### 26.2 Attestation modal (portal + field)

Rendered from `packages/shared/src/declarations.ts`. Current version `ATTEST_V1`:

> ☐ I, **{fullName}**, **{designation}**, **{jurisdiction}**, certify that this document is authentic, that it is true and correct to the best of my knowledge, and that I am authorised to submit it for this project.
>
> *Furnishing false information or a false document is punishable under section 84 of the Act with imprisonment up to six months, or fine up to one lakh rupees, or both.*

Stored in `attestations` with the document's sha256 and `declaration_version`. Emits `DOCUMENT_ATTESTED` → anchor. Shown to the verifier next to every document.

Changing the wording = new version constant (`ATTEST_V2`). Never edit an existing version's text.

### 26.3 OCR (assist, never decide — G3)

- Job `ocr`: `pdf-parse` → if text layer < 200 chars/page, rasterise and run `tesseract.js` (eng + hin + mar traineddata) → field extractor (regex templates for the synthetic award format + optional LLM extraction) → `ocr_extractions.fields`
- Review UI accepts field by field; only `accepted` values flow into `entitlements`
- Mismatch detection (never auto-resolved): extracted survey number not in project parcels; extracted name not matching any person with an interest; totals not summing

---

## 27. TRUST LAYER — BLOCKCHAIN `[MVP deep]`

### 27.1 Contract (`packages/chain/contracts/AnchorRegistry.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/access/AccessControl.sol";

contract AnchorRegistry is AccessControl {
    bytes32 public constant ANCHORER_ROLE = keccak256("ANCHORER_ROLE");

    struct Anchor { bytes32 dataHash; uint64 anchoredAt; address anchorer; string eventType; }

    // key = keccak256(abi.encodePacked(entityType, ":", entityId))
    mapping(bytes32 => mapping(uint32 => Anchor)) private anchors;
    mapping(bytes32 => uint32) public latestVersion;

    event Anchored(bytes32 indexed key, uint32 indexed version, bytes32 dataHash, string eventType, address anchorer);

    constructor(address admin) { _grantRole(DEFAULT_ADMIN_ROLE, admin); }

    function anchor(bytes32 key, uint32 version, bytes32 dataHash, string calldata eventType)
        external onlyRole(ANCHORER_ROLE)
    {
        require(anchors[key][version].anchoredAt == 0, "version already anchored"); // immutable per version
        anchors[key][version] = Anchor(dataHash, uint64(block.timestamp), msg.sender, eventType);
        if (version > latestVersion[key]) latestVersion[key] = version;
        emit Anchored(key, version, dataHash, eventType, msg.sender);
    }

    function anchorBatch(bytes32[] calldata keys, uint32[] calldata versions,
                         bytes32[] calldata hashes, string[] calldata eventTypes)
        external onlyRole(ANCHORER_ROLE) { /* loop anchor(); used by seed */ }

    function getAnchor(bytes32 key, uint32 version) external view returns (Anchor memory) {
        return anchors[key][version];
    }
}
```

Production direction: Hyperledger Besu permissioned network, one validator/anchorer identity per authority (centre, state, district). **Not built.** Hardhat local node only.

### 27.2 Canonical payloads (what gets hashed)

`dataHash = 0x + sha256(JCS(payload))`. Payloads are **defined projections**, not whole rows. **No names, phones, bank references or other personal data.**

| Event | Payload fields |
|---|---|
| `PARCEL_VERIFIED` | entityType, entityId, version, villageCode, surveyNumber, subDivision, geomHash, fieldAreaSqm, recordedAreaSqm, boundarySource, verifiedByPostId, verifiedAt, rulePack |
| `APPROVAL_RECORDED` | projectId, stageCode, attempt, action, reasonCode, actorPostId, at, documentSha256s (sorted) |
| `AWARD_DECLARED` | awardId, projectId, awardNo, version, awardDocSha256, entitlements `[{id, headCode, amountPaise}]` sorted by id, signedByPostId, signedAt |
| `COMPENSATION_DISBURSED` | disbursementId, entitlementId, amountPaise, instrument, paidOn, adapterRef |
| `COMPENSATION_ACKNOWLEDGED` | acknowledgementId, disbursementId, method, credentialIdSha256, confirmedAt, witnessPostId |
| `POSSESSION_CONFIRMED` | projectParcelId, parcelId, panchnamaSha256, takenByPostId, takenAt |
| `DOCUMENT_ATTESTED` | documentId, sha256, postId, declarationVersion, attestedAt |

Payload builders live in `apps/api/src/chain/payloads.ts` and are the **only** code that decides what is hashed. The verify endpoint reuses the same builders.

### 27.3 Anchoring job

- Consumes anchor-worthy outbox events → inserts `chain_events(status=QUEUED)`
- BullMQ `anchor` queue, **concurrency 1** (single relayer, avoids nonce races)
- Submits tx with `CHAIN_RELAYER_PRIVATE_KEY`, waits `CHAIN_CONFIRMATIONS`, stores `tx_hash`, `block_number`, status `ANCHORED`
- Retry with exponential backoff, max 10 attempts → `FAILED` (visible on the ops panel and as a badge)
- **Never** called from a request handler (G5)

### 27.4 Verification

`GET /chain/verify/:entityType/:entityId?version=` →

1. Rebuild payload from **current DB row** using the same builder
2. Hash it
3. Read `getAnchor(key, version)` from chain
4. Return `VERIFIED` (match) · `MISMATCH` (differs) · `PENDING` (queued/submitted) · `NOT_ANCHORED`

UI badge on parcels, awards, acknowledgements, possession records: `✓ Anchored · block #1284` / `⏳ Proof pending` / `✗ Mismatch — record differs from anchored version`.

### 27.5 Tamper demo

`pnpm demo:tamper` (DEMO_MODE only) — as the owner role with `SET session_replication_role = replica` (triggers off), shifts the demo parcel's geometry by ~5 m via raw SQL. This simulates a privileged silent database edit. Reloading the parcel shows **Mismatch**. Contrast on stage with a legitimate correction (§15.4), which produces v2 and a new valid anchor.

---

## 28. NOTIFICATIONS & ESCALATION `[MVP]`

| Trigger | Recipient | Channels |
|---|---|---|
| `STAGE_ASSIGNED` | assigned post | in-app |
| `STAGE_RETURNED` | submitter post | in-app, email |
| `DEADLINE_DUE_SOON` (≤ `deadlineDueSoonDays`) | stage/deadline owner post | in-app, email |
| `DEADLINE_BREACHED` | owner post → escalates | in-app, email, SMS (mock) |
| `ESCALATED` | district Collector post, then state post | in-app, email |
| `CONSENT_THRESHOLD_MET` / `NOT_MET` | Collector | in-app |
| `OBJECTION_FILED` | LAO | in-app |
| `DISBURSEMENT_FAILED` | LAO, Treasury | in-app, email |
| `ACK_DISPUTED` | Collector | in-app, email, SMS |
| `CHAIN_MISMATCH` / `ANCHOR_FAILED` | Super Admin, Collector | in-app, email |
| `ANNUITY_MISSED` | Administrator R&R | in-app |
| `UTILISATION_DUE` | Requiring Body, Collector | in-app, email |
| Beneficiary: `ACK_REQUESTED`, `PASSBOOK_ISSUED` | family phone | SMS (mock) |

- **Escalation ladder** from the pack: breach day 0 → owner post; day 7 → district; day 21 → state. One notification per `(trigger, entity, level)` — dedupe key.
- **Right person, right task, right time:** notifications go to the **responsible post**, never broadcast to all higher authorities.
- In-app delivered over SSE; unread badge in the shell.

---

## 29. SECURITY `[MVP]`

The evaluator explicitly asked for security aspects. This table is also the security slide.

| Area | Implementation |
|---|---|
| **Authentication** | Email + password (argon2id); JWT access 15 min + rotating refresh 7 days (reuse detection revokes the family); lockout 15 min after 5 failures |
| **Authorisation** | Role (action permission, from pack) × Jurisdiction (RLS in Postgres, forced) × Field visibility (redaction interceptor) |
| **Maker-checker** | Enforced in workflow guards for pack-flagged actions |
| **Data protection** | PII encrypted at rest (AES-256-GCM); masked copies for display; no PII on-chain; no PII in logs (pino `redact`) |
| **Biometrics** | Never stored; WebAuthn public keys only |
| **Secure communication** | HTTPS everywhere outside localhost; HSTS; secure, httpOnly, SameSite=Lax cookies; CSRF double-submit token on cookie-auth mutations |
| **API hardening** | Helmet, CORS allowlist, zod validation on every input, `@nestjs/throttler` (public 60/min/IP, auth 10/min/IP), body size limits |
| **Uploads** | Magic-byte type check, size limit, sha256, stored outside web root, presigned short-TTL downloads |
| **Integrity** | Append-only audit log with hash chain; blockchain anchoring of approved records; versioned corrections |
| **Public surface** | Only `public_*` views; token-scoped passbook/ack pages; rate-limited |
| **Secrets** | `.env` only, never committed; CI secret scanning |
| **Supply chain** | `pnpm audit` in CI; lockfile committed |

Production notes (not built): NIC MeghRaj hosting, government SSO, HSM-backed chain keys, CERT-In aligned logging.

---

## 30. ADAPTERS `[MVP — all mock]`

Each adapter: an interface in `apps/api/src/adapters/<name>/<name>.adapter.ts`, a `mock` implementation, and a `real` stub that throws `NotImplementedException`. Selected by env. **Every mock result carries `provider: 'MOCK'`** and the UI shows a `MOCK` badge (G7).

| Adapter | Interface | Mock behaviour |
|---|---|---|
| `IdentityAdapter` | `verify({personId, method}) → {verified, ref, provider}` | Always verified; `ref = DEMO-xxxx` |
| `PaymentAdapter` | `initiate(disbursement) → {ref, status}`; `status(ref)` | `PENDING` → `SUCCESS` after 3 s; 5% `FAILED` (deterministic by seed) |
| `CadastralAdapter` | `getParcels({villageCode, surveyNumber?}) → FeatureCollection` | Returns seeded "cadastral" parcels for the village with `recorded_area_sqm` |
| `SmsAdapter` | `send({to, template, vars})` | Logs + stores in `dev_outbox_sms` table, visible at `/dev/sms` |
| `EmailAdapter` | `send(...)` | SMTP → MailHog |
| `LlmAdapter` | `chat({system, messages, tools})` | Deterministic answers for the 5 scripted demo questions; otherwise "mock mode" message |
| `SttAdapter` | `transcribe(document) → {text, language, segments}` | Returns the committed demo transcript |
| `StorageAdapter` | S3 operations | MinIO |

Stage-on-stage line (§34):

> "This call returns from our mock adapter. In production it points at the state's own service. Nothing above this line changes."

---

## 31. BACKGROUND JOBS

| Queue | Schedule / trigger | Does | Concurrency |
|---|---|---|---|
| `outbox-relay` | continuous (1 s poll or `LISTEN/NOTIFY`) | Publishes unprocessed outbox rows to BullMQ, marks processed | 1 |
| `anchor` | on events | §27.3 | **1** |
| `deadline-scan` | every 15 min + on clock events | Recompute deadline statuses via `ClockService.now()`; fire consequences once; enqueue notifications; escalations | 1 |
| `notify` | on events | Resolve recipient post → user(s), dedupe, deliver channels | 4 |
| `ocr` | on award upload | §26.3 | 2 |
| `stt` | on audio upload | Transcribe via adapter | 1 |
| `payment-status` | on initiate | Poll mock payment, flip status, emit `DISBURSEMENT_SUCCEEDED` | 2 |
| `mv-refresh` | every 5 min + debounced 10 s after money/stage events | `REFRESH MATERIALIZED VIEW CONCURRENTLY …`, push `kpi.updated` over SSE | 1 |
| `annuity-scan` | daily | Mark missed instalments, notify | 1 |

All jobs connect with `DATABASE_WORKER_URL` (BYPASSRLS). All jobs are idempotent.

---

## 32. TESTING

### 32.1 Unit — `packages/rules` (write these first)

- Every clock computes the right `dueAt` in `Asia/Kolkata`, including month-end starts (31 Jan + P1M) and leap years
- Conditional clock: `REFERENCE_WINDOW` = 6 weeks when present, 6 months when absent
- `applicableStages`: GOVERNMENT skips S04; PPP/PRIVATE include S04; scheduled area includes S04; urgency skips S02/S03
- S05 cannot start before S04 APPROVED when S04 applies; S04 may start while S02 is IN_PROGRESS
- Maker-checker blocks same user and same post
- RETURN / REJECT / NULLIFY / TERMINATE without a valid reason code fail
- OVERRIDE without written reasons fails
- Expert outcome C → ABANDONED unless OVERRIDE
- Consent below threshold → TERMINATED
- Possession gate: blocked with any unacknowledged land head; passes with DEPOSITED_WITH_AUTHORITY; blocked when site readiness < 100% for displaced family
- Interest: day 0 → 0; day 365 uses 9% only; day 366 adds 15% for 1 day; integer paise, single rounding
- `runChecks`: solatium ≠ 100% flagged; SC/ST first instalment < ⅓ flagged; factor 1.25 **passes** range check (it is inside 1.00–2.00) but factor 2.10 fails

### 32.2 Geometry — `packages/db` SQL tests

- `geom_canonical_hash`: same polygon with rotated start vertex, reversed ring, and 1e-9° noise → identical hash; a 1 m shift → different hash
- `area_sqm` of a known 100 m × 100 m square near Pune = 10,000 ± 5 m²
- Intersection ignores slivers < 1 m²
- `chainage_km` monotonic along the demo alignment

### 32.3 Golden statutory test (`pnpm rules:check`)

Asserts the resolved `larr-2013-base` pack equals the Act reference (§39.4): consent 0.80/0.70; objection P60D; declaration P12M; award P12M; SIA P6M; expert P2M; SIA lapse P12M; payment P3M/P6M/P18M; interest 9/15 with P1Y step; utilisation P5Y; solatium 100; rural factor [1.00, 2.00]; urban 1.00; R&R committee 100 acres; SC/ST ⅓; Second Schedule minimums.

Also a **forbidden-literal scan**: fails CI if `apps/api/src` or `packages/(shared|db|geo)` contain statutory patterns such as `1.25`, `0.8`, `0.7`, `* 0.09`, `* 0.15`, or if **any** app contains ISO statutory durations `P60D`, `P12M`, `P6M`, `P18M`, `P5Y`, `P6W` outside `packages/rules`. Portal/field numeric literals are not scanned (too noisy — opacity, sizes). Keep an allowlist file for genuine false positives.

### 32.4 Security

- RLS: a DISTRICT post for Pune cannot read a Nagpur project (direct SQL through `app_user` returns 0 rows)
- Redaction: every key in `FIELD_VISIBILITY` is redacted for a disallowed viewer
- Public endpoints only touch `public_*` views (test asserts query plans / repository usage)
- Request handlers never receive the worker pool

### 32.5 API e2e (Supertest)

Full happy path on a GOVERNMENT project S01 → S10; RETURN and resubmit; hearing NULLIFY and repeat; PPP consent success and failure; award upload → OCR review → sign; disburse → acknowledge → possession.

### 32.6 Contracts (Hardhat)

Only `ANCHORER_ROLE` can anchor; same `(key, version)` cannot be anchored twice; `latestVersion` updates; batch anchoring.

### 32.7 Playwright

- **Demo script as a test** (§34): each beat is a test step with screenshots
- Field PWA offline: `context.setOffline(true)` → capture 4 vertices with mocked geolocation + camera → online → sync → parcel visible

### 32.8 CI (GitHub Actions)

On every PR: install → lint → typecheck → unit → `rules:check` → contract tests. Playwright on `main` nightly and on demand.

---

## 33. SEED & REFERENCE DATA

### 33.1 Rules

- Deterministic: `SEED=26016`, a seeded PRNG (mulberry32) — never `Math.random()` in seed code
- All seed dates are **relative to `DEMO_NOW`**, so countdowns read the same every run
- Seed goes **through domain services** where state machines are involved (stages, awards, disbursements), not raw inserts — otherwise guards, clocks and outbox events are skipped
- Every personal record: `data_source = 'SYNTHETIC_DEMO'`
- `pnpm demo:reset` = truncate scoped tables + reseed + re-anchor (fast path: `anchorBatch`)

### 33.2 Reference data you must fetch (one-time, commit the results)

| File | Source | How | Fallback if unavailable |
|---|---|---|---|
| `data/lgd/states.csv`, `districts.csv`, `sub_districts.csv`, `villages.csv` | Local Government Directory (lgdirectory.gov.in) | Download lists for Maharashtra + 3–4 other states used in seed; write a column mapper in `packages/db/seed/lgd.ts` (LGD export columns vary) | Synthetic codes prefixed `SYN-` — clearly labelled |
| `data/boundaries/villages-demo.geojson` | OpenStreetMap (Overpass or Geofabrik Maharashtra extract) | Village boundaries in the corridor talukas where present in OSM; admin-level mapping for India in OSM is **[VERIFY]** | Voronoi of OSM `place=village` points clipped to the taluka boundary |
| `data/boundaries/districts.geojson` | OSM / public boundary datasets | Districts for routing and dashboards | Simplified hand-drawn |
| `data/demo/pune-satara-alignment.geojson` | Traced by the team over the basemap | Trace the highway centreline between the demo villages in QGIS or geojson.io — **do not invent coordinates** | — |
| `data/demo/khed-shivapur-parcels.geojson` | Hand-traced in QGIS over ESRI World Imagery or Bing (**not Google** — its terms prohibit derived data) | 40–60 real field boundaries in one village | Voronoi only |
| `data/constraints/*.geojson` | Public layers where licence allows | forest, eco-sensitive, water, scheduled area | Synthetic polygons placed to trigger flags on specific demo parcels, labelled synthetic |
| `data/tiles/demo-region.pmtiles` | Protomaps basemap extract | Bounding box of the demo corridor + 10 km | — |

**[VERIFY] district mapping:** Khed Shivapur is expected in Pune district and Shirwal in Satara district — so the corridor likely spans **two districts**, which is good for the demo (multi-district routing). Confirm against LGD before seeding.

### 33.3 Synthetic parcel generation

For villages without hand-traced parcels:

```sql
WITH seeds AS (   -- points clustered along roads/canals inside the village, from the PRNG
  SELECT (ST_Dump(ST_GeneratePoints(ST_Buffer(road_geom, 0.002), :n, :seed))).geom AS pt
  FROM village_roads WHERE village_code = :code      -- seed-time staging table loaded from OSM roads/canals
),
cells AS (
  SELECT (ST_Dump(ST_VoronoiPolygons(ST_Collect(pt)))).geom AS cell FROM seeds
)
SELECT ST_Multi(ST_Intersection(c.cell, v.boundary)) AS geom
FROM cells c JOIN villages v ON v.code = :code
WHERE ST_Area(ST_Intersection(c.cell, v.boundary)::geography) > 200;
```

- Consolidated-strip look: recursively split some cells along slightly randomised lines
- Survey numbers sequential per village with ~20% sub-divisions (`214/3`); exact Maharashtra numbering convention **[VERIFY]**
- `recorded_area_sqm` = computed area ± 0–8% noise (so some parcels trip `AREA_MISMATCH`)
- Land class: mix weighted toward agricultural; a cluster of `IRRIGATED_MULTICROP` placed on the corridor for the s.10 flag

### 33.4 Synthetic people

- Names from committed lists of common Marathi / Hindi given names and surnames (`packages/db/seed/names/*.txt`) combined by the PRNG — no real individuals
- Phones: `98xxxxxxxx` from the PRNG, encrypted, masked
- Interests: 1–4 persons per parcel; ~15% tenants/sharecroppers; ~10% labourers on large parcels; some co-owner shares
- Families: vulnerability flags at plausible rates (SC/ST, female-headed, destitute, disability)

### 33.5 Dataset shape

| Item | Target |
|---|---|
| Projects | 10–12 across 4–5 states |
| Parcels | ~2,000 |
| Affected families | ~5,000 |
| Cases late | ~20% of open deadlines |
| Actually breaching | exactly **3** (the three red alerts in beat 1) |
| Family money states | ~60% paid & acknowledged · ~15% **disbursed, not acknowledged** · ~10% part paid · ~10% unpaid · ~3% deposited with Authority · ~2% under protest |
| Legal cases | ~40 |
| Annuities | ~150 families on annuity schedules |

Monetary amounts: per-m² rate ranges per land class are seed parameters (`packages/db/seed/config.ts`) chosen to look plausible for each region. These are synthetic award values entered as if by the Collector — the system still never computes awards. **Whatever gap figure the seed produces is the figure the slides must quote.** Update the slides to the seed, not the other way round.

### 33.6 Demo hooks (the seed must guarantee these)

| Hook | Where |
|---|---|
| Demo corridor project `MH-PSX-2026-001`, pack `larr-2013-maharashtra@1.0.0`, GOVERNMENT, linear | S07 in progress |
| Its `DECLARATION` clock due **34 days** after `DEMO_NOW` | beat 2 |
| 3 breaching deadlines in other projects | beat 1 |
| One PPP project at **71%** consent (threshold 70%) | consent meter |
| One PRIVATE project at 76% (below 80%) | risk example |
| One Scheduled Area project (Gram Sabha consent) | s.41 |
| One urgency project | s.40 check |
| An NH-Act project on `nh-act-1956@1.0.0` | beat 8 |
| On the demo corridor: parcels with irrigated multi-crop and one touching a scheduled-area polygon | beat 3 |
| One demo parcel reserved for live walk-and-mark (unsurveyed) | beat 4 |
| One demo family with a disbursement `SUCCESS` and **not** acknowledged, with an enrolled credential on the demo phone | beat 6 |
| One disbursement on hold with a restricted reason | beat 7 |
| One parcel blocked at the possession gate | Q&A |

---

## 34. DEMO SCRIPT — 7 MINUTES

The deck, the MVP and the submission video tell this **same** story. It is also the Playwright e2e test.

### Pre-flight checklist

- [ ] `pnpm demo:reset` completed; `DEMO_NOW` set; chain node running; all seed anchors `ANCHORED`
- [ ] `pnpm demo:tunnel` running; `PUBLIC_BASE_URL`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` set to the tunnel; API restarted
- [ ] Phone A (field officer): field PWA installed from the tunnel URL; offline pack downloaded for the reserved parcel
- [ ] Phone B (beneficiary): passkey enrolled for the demo family (do this before judging)
- [ ] Browser: logged in as Oversight; role switcher ready with Collector and Public
- [ ] Backup: screen recording of every beat in case the network fails

### Beats

| # | Screen | Show | Say (one line) |
|---|---|---|---|
| 1 | National dashboard | Three red breach alerts; gap tile | "Every statutory deadline, live, for every project." |
| 2 | Click worst alert → project `MH-PSX` timeline | "Declaration lapses in 34 days — s.19, notification deemed rescinded"; estimated interest liability | "Not 'task overdue' — the legal consequence and its cost." |
| 3 | Collector: new project pre-scrutiny / corridor intersection | s.10 irrigated multi-crop and s.41 scheduled-area flags fire; cross-project overlap warning | "The law checks the map before anyone drafts a notice." |
| 4 | Phone A, airplane mode ON | Walk & Mark 4 corners with photos → submit → airplane OFF → Sync | "Works in a village with no signal." |
| 5 | Portal parcel view | Parcel appears; click a corner → its photo opens; verify → chain badge turns ✓ | "Every corner has evidence. Every approval has proof." |
| 6 | Family money view + Phone B | Disbursed, not acknowledged → fingerprint on Phone B → row flips to acknowledged; national gap updates | "Disbursed is what the office says. Acknowledged is what the family says." |
| 7 | Role switcher Collector → Public | Hold reason visible → disappears; public page shows "payment in process" | "Privacy enforced in the database, not the screen." |
| 8 | Rule pack viewer | Same engine: `larr-2013-maharashtra` vs `nh-act-1956`; stages and clocks differ | "Section 24 exists because the law already changed once. We change configuration, not code." |
| + | Q&A reserve | `pnpm demo:tamper` → Mismatch; legit correction → v2 anchored | "Corrections are provable. Silent edits are detectable." |

---

## 35. BUILD PLAN

Phases are ordered by dependency. Each ends with a demoable result. Map them to your calendar.

### Phase 0 — Foundations

Monorepo, Docker, env, DB roles, drizzle schema for **all** `[MVP]` tables, raw SQL (functions, triggers, RLS, views), ClockService, auth + posts + role switcher, audit interceptor + hash chain, outbox + relay, rule pack schema + loader + golden test, CI.

**Done:** `pnpm db:reset && pnpm dev` works for everyone; `pnpm rules:check` passes; a DISTRICT user cannot read another district's project.

### Phase 1 — The spine

Module A intake + alignment + pre-scrutiny; workflow engine + generic action endpoint + action panel UI; deadlines + deadline-scan; Module B intersection + parcel map + colour-by + chainage strip; national + collector dashboards (skeleton KPIs); seed v1 (projects, parcels, stages, clocks).

**Done:** beats 1, 2 and 3 work on seeded data.

### Phase 2 — Field

Field PWA: offline pack, Walk & Mark, camera, JIR, pillars, s.12 notice, Dexie queue, sync; plausibility checks; verification screen; corrections; PMTiles basemap; tunnel setup.

**Done:** beats 4 and 5 (without chain badge) work on a real phone.

### Phase 3 — Money & acknowledgement

Escrow gates; award upload + OCR review + checks + signing; entitlements; disbursement + mock payment; holds + Authority deposit; WebAuthn enrolment + acknowledgement + fallbacks + dispute; interest estimate; possession gate + Panchnama; family money view; passbook.

**Done:** beat 6 works end to end on two phones.

### Phase 4 — Trust

Contract + tests + deploy; payload builders; anchor job; verify endpoint + badges; attestation on every upload; tamper script; seed anchoring via batch.

**Done:** beat 5 shows ✓ anchored; tamper shows Mismatch.

### Phase 5 — Statutory depth

Module C (hearings + validity + nullify, expert group A/B/C + override, CPR, SIA census); Module D (consent register → display → certify → awareness hearing → collection → tally → terminate); s.11 publish + transfer freeze; objections + AI triage; Module E (R&R census, scheme, sites, milestones); s.21 claims; Modules H and I dashboards on seeded data.

**Done:** consent meter, hearing void/repeat, and terminal outcomes demonstrable.

### Phase 6 — Intelligence & polish

Risk scoring + bottlenecks; AI assistant (mock + real); MIS exports; public portal complete; i18n (en/hi/mr); redaction audit; accessibility pass; beat 7 and 8; Playwright demo test; screen-recorded backup.

**Done:** full 7-minute demo runs twice in a row without intervention after `pnpm demo:reset`.

---

## 36. TEAM WORKSTREAMS

Final sprint (1–3 Oct 2026, submission 4 Oct). Four developers, one Claude Code account, each in a separate chat with
their brief from `prompts/team/`. Split by **path ownership** so sessions rarely touch the same files. Chaitanya leads,
merges and owns this file. Full task lists, owned paths and checkpoints: `prompts/team/0*.md`.

| Person | Branch | Brief | Scope |
|---|---|---|---|
| **Chaitanya** (lead) | `atulit` | `01-chaitanya.md` | UX4G foundation + app shell, national/state/district/collector dashboards, project workspace, proposals, intake + rule-pack restyle, integration, `CLAUDE.md` |
| **Atulit** | `atulit` | `02-atulit.md` | Basemap + boundary data, `/gis` 3-pane map, national map, parcel 360°, land registry, field-officer workspace `/field-office`, field PWA + money screens restyle |
| **Madhav** | `madhav` | `03-madhav.md` | Landing + login (role first), citizen accounts, grievance module, citizen dashboard, public portal restyle, hi/mr, AI layer UI (Ask drawer, AI suggestion accept, risk explanation, objection triage) |
| **Ishan** | `ishan` | `04-ishan.md` | Free deployment (Vercel portal + one VM for API/DB/Redis/MinIO/chain), trust center, public verify page + QR, anchoring coverage, tamper demo |

Earlier WS1–WS5 split (Phases 0–3) is superseded by the table above for this sprint.

### Working agreements (for humans and Claude Code)

1. **Contracts first.** Phase 0 freezes the DB schema and shared zod schemas for all `[MVP]` tables so streams build in parallel. Schema changes after that go through WS1 review.
2. One branch per task: `feat/<ws>-<thing>`. Small PRs. Another stream reviews. **Final sprint exception:** Chaitanya and Atulit commit to `atulit`; Madhav and Ishan work on `madhav` / `ishan` and open PRs into `atulit`; `atulit` merges into `main` at release.
3. Before a Claude Code session, tell it which workstream and module you are on. It must not edit another stream's paths without saying so in the PR description.
4. Shared files (`packages/shared`, `CLAUDE.md`, migrations) change only via PR with WS1 approval.
5. Every PR: tests for new rules/money/geo/redaction logic; `pnpm lint && pnpm typecheck && pnpm test` green; no statutory literals.
6. Demo data is sacred: if you change seed hooks (§33.6), update §34 in the same PR.

---

## 37. PS REQUIREMENT TRACEABILITY

| PS requirement | Where |
|---|---|
| Role-based access control | §11.3, §11.4, §29 |
| Automated alerts and notifications | §28, §31 (deadline-scan) |
| API integration with government systems | §30 adapters, §15.1 cadastral |
| Customisable dashboards | §24 |
| Analytical reports | §24.4 MIS |
| Predictive analytics | §24.4 risk scoring |
| End-to-end digital workflow | §12, §14–§23 |
| Online submission, verification, approval, tracking | §14, §13 generic actions |
| GIS geo-tagging & spatial visualisation | §15, §16 |
| National dashboard — 8 parameters | §24.1, `v_project_kpis` |
| Integration with land records, cadastral maps, portals | §30, §33.2 |
| Mobile-responsive field data collection & verification | §16, §15.3 |
| Secure document repository, version control, audit history | §26, §11.6 |
| Customisable MIS & executive dashboards | §24 |
| Transparency | §25 public portal, §19 passbook |
| Accountability | §26.2 attestation, §27 trust layer, G19–G21 |
| Scalability & future legislative change | §12 rule packs |
| Multilingual | §9 i18n |

---

## 38. KNOWN LIMITATIONS & [VERIFY] REGISTER

Say these yourself before a judge does.

### Engineering limitations (true, and honest)

| Limitation | What we do instead |
|---|---|
| A PWA cannot read Android's mock-location flag | Server plausibility checks (§15.6); native wrapper is a later path |
| WebAuthn uses the **device owner's** biometric — one officer tablet cannot serve many families | Ceremony runs on the beneficiary's own phone; OTP and officer-attested fallbacks |
| Geolocation, camera and WebAuthn need HTTPS on phones | Tunnel for the demo; proper TLS in production |
| OSM tile servers forbid bulk offline caching | Regional PMTiles extract |
| No live government integrations | Adapters with visible MOCK labels |
| Statutory day-counting conventions | Isolated in `computeDueAt()` |

### [VERIFY] — confirm before stating publicly

| Item | Status |
|---|---|
| Legal day-counting convention for "within N months/days" | Engine uses end-of-day IST, calendar arithmetic |
| s.30(3) — period for the 12% additional amount | Only presence is checked |
| s.38 — a 60-day possession notice (process doc claim) | Not in our Act reference |
| s.40 — urgency possession after 30 days (process doc claim) | Not in our Act reference |
| s.80 — simple interest, 365-day basis | Assumed for the estimate |
| s.3(1)(e)(iv) — Central Government as appropriate Government for inter-state projects | From process doc |
| Whether Fourth Schedule acquisitions carry RFCTLARR compensation/R&R by later order | Not established by the 2013 text |
| Consent failure bars re-application for the same parcel (process doc claim) | Not in our Act reference |
| NH Act 1956 stage structure, sections and durations in `nh-act-1956` pack | Illustrative |
| Maharashtra rural multiplication factor bands | Placeholders in pack |
| Khed Shivapur (Pune) / Shirwal (Satara) district mapping | Confirm with LGD |
| Maharashtra survey / Gat number format | Confirm with a 7/12 sample |
| OSM admin-level mapping for Indian villages | Confirm before extracting boundaries |
| Product name spelling: **BhoomiSetu** vs **BhumiSetu** (both appear on the slide) | Pick one everywhere |

---

## 39. APPENDIX

### 39.1 Project categories (s.2(1)) and sub-categories

| Code | Category | Sub-categories |
|---|---|---|
| `STRATEGIC_DEFENCE` | Strategic & Defence | Military bases, airfields, naval ports, ammunition dumps · border fencing, forward posts, strategic roads · defence manufacturing, nuclear test/research sites |
| `TRANSPORT` | Transport & Connectivity | Linear corridors (highways, expressways, bypasses, railway tracks, freight corridors) · mass rapid transit (metro, monorail, high-speed rail) · nodes & terminals (airports, ports, bus terminals, logistics parks) |
| `ENERGY_UTILITIES` | Energy & Utilities | Generation (solar, hydro, thermal, nuclear) · transmission (substations, HV lines) · energy transport (oil, gas, slurry pipelines, coal mining rights) |
| `WATER_AGRICULTURE` | Water Management & Agriculture | Reservoirs, canals, check dams · water treatment, sewage, flood embankments |
| `INDUSTRIAL` | Industrial & Commercial Zones | Industrial corridors · NIMZs and SEZs · tech parks, IT hubs, state industrial estates |
| `URBAN_HOUSING` | Urban Planning & Housing | Slum rehabilitation, affordable housing · planned expansions, townships · rehabilitation colonies |
| `PUBLIC_SERVICES` | Public Services & Infrastructure | Hospitals, medical colleges, universities, research institutes · waste management, parks, administrative buildings |
| `PPP_CORPORATE` | Sector-Specific PPP & Corporate | Government-controlled PPP (70% consent) · private company with public utility (80% consent) |

### 39.2 Document types (`DocType`)

```
DPR_SUMMARY, ADMIN_FINANCIAL_SANCTION, FUNDING_CLEARANCE, REQUISITION_APPLICATION,
LAND_SCHEDULE_MATRIX, ALIGNMENT_OVERLAY_MAP, MIN_LAND_JUSTIFICATION, ORDER_OF_ACCEPTANCE,
ESCROW_DEMAND_NOTE, ESCROW_DEPOSIT_RECEIPT, FINANCIAL_SUFFICIENCY_CERTIFICATE,
S4_SIA_NOTIFICATION, SIA_AGENCY_MOU_TOR, SIA_CENSUS_EXPORT, CPR_INVENTORY_REPORT,
SIA_REPORT_DRAFT, SIA_REPORT_FINAL, SIMP_DRAFT, SIMP_FINAL,
HEARING_NOTICE, LOCAL_LANGUAGE_SUMMARY, HEARING_RECORDING, ATTENDANCE_REGISTER, HEARING_MINUTES,
PUBLIC_HEARING_RESPONSE_MATRIX,
EXPERT_GROUP_GAZETTE_ORDER, COI_DECLARATION, EXPERT_RECOMMENDATION_REPORT, DISSENT_NOTE,
GOVERNMENT_OVERRIDE_ORDER,
CONSENT_REGISTER_DRAFT, CONSENT_REGISTER_CERTIFIED, CONSENT_FORM, DLSA_OBSERVER_CERTIFICATE,
CERTIFICATE_OF_CONSENT_PROCUREMENT, CONSENT_TERMINATION_ORDER,
S11_NOTIFICATION, GAZETTE_COPY, NEWSPAPER_CLIPPING, AFFIXATION_CERTIFICATE, TRANSFER_FREEZE_ORDER,
S12_NOTICE_OF_ENTRY, JOINT_INSPECTION_REPORT, OBJECTION_WRITTEN, S15_HEARING_NOTICE,
LAO_INQUIRY_REPORT, GOVERNMENT_ORDER_ON_OBJECTIONS, DENOTIFICATION_ORDER,
RNR_CENSUS_EXPORT, RNR_SCHEME_DRAFT, RNR_SCHEME_APPROVED, RNR_COMMISSIONER_ORDER,
RESETTLEMENT_COLONY_LAYOUT, COMMISSIONING_CERTIFICATE, RNR_PASSBOOK,
S19_DECLARATION, S21_NOTICE, CLAIM_PETITION, TITLE_DOCUMENT,
VALUATION_REPORT_PWD, VALUATION_REPORT_FOREST, VALUATION_REPORT_HORTICULTURE, VALUATION_REPORT_IRRIGATION,
CIRCLE_RATE_SCHEDULE, SALE_DEEDS_REGISTER,
AWARD_LAND, AWARD_RNR, S37_NOTICE,
INDEMNITY_BOND, PAYMENT_ACCEPTANCE_FORM, TREASURY_PAYMENT_ADVICE,
VACATION_CERTIFICATE, S38_POSSESSION_NOTICE, POSSESSION_PANCHNAMA, CERTIFICATE_OF_POSSESSION,
HANDOVER_CERTIFICATE, MUTATION_EXTRACT,
S64_REFERENCE_APPLICATION, AUTHORITY_ORDER, APPEAL_ORDER,
SEVERANCE_CLAIM, SEVERANCE_INSPECTION_REPORT, UTILISATION_INSPECTION_CERTIFICATE,
REVERSION_DEED, VALUE_SHARING_SHEET, MONITORING_AUDIT_REPORT, ASSET_HANDOVER_CERTIFICATE,
FIELD_PHOTO, PILLAR_PHOTO, OTHER
```

### 39.3 Third Schedule amenity codes (resettlement area milestones)

```
ROADS_ALL_WEATHER_LINK, DRAINAGE_SANITATION, SAFE_DRINKING_WATER, CATTLE_DRINKING_WATER,
GRAZING_LAND, FAIR_PRICE_SHOP, PANCHAYAT_GHAR, POST_OFFICE_SAVINGS, SEED_FERTILIZER_STORAGE,
BASIC_IRRIGATION, TRANSPORT_LINK, BURIAL_CREMATION_GROUND, INDIVIDUAL_TOILETS,
ELECTRIC_CONNECTIONS, ANGANWADI, SCHOOL_RTE, SUB_HEALTH_CENTRE_2KM, PRIMARY_HEALTH_CENTRE,
CHILDREN_PLAYGROUND, COMMUNITY_CENTRE_PER_100, WORSHIP_CHOWPAL_PER_50,
TRIBAL_INSTITUTION_LAND, FOREST_RIGHTS_CPR_ACCESS, SECURITY_ARRANGEMENTS, VETERINARY_CENTRE
```

Twenty-five codes. Applicability per site is set by the Administrator ("as appropriate").

### 39.4 Statutory reference (the numbers the golden test checks)

| Rule | Value | Section |
|---|---|---|
| Private company consent | 80% | 2 |
| PPP consent | 70% | 2 |
| SIA completion | 6 months | 4 |
| Expert Group recommendation | 2 months | 7 |
| SIA lapse without s.11 | 12 months from appraisal | 14 |
| Objection window | 60 days | 15 |
| Declaration after s.11 | 12 months, else deemed rescinded | 19 |
| s.21 notice appearance | ≥ 30 days, ≤ 6 months | 21 |
| Award after declaration | 12 months, else lapse | 25 |
| Rural multiplication factor | 1.00 – 2.00 | First Schedule |
| Urban multiplication factor | 1.00 | First Schedule |
| Solatium | 100% | 30 |
| Additional amount | 12% p.a. for the period in s.30(3) | 30 |
| Compensation before possession | 3 months | 38 |
| Monetary R&R | 6 months | 38 |
| Infrastructure R&R | 18 months | 38 |
| R&R before submergence | 6 months prior | 38 |
| Multiple displacement | additional compensation equal to that determined | 39 |
| Urgency — tender before possession | 80% | 40 |
| Urgency — additional compensation | 75% | 40 |
| SC/ST first instalment | ≥ one-third | 41 |
| SC/ST relocated outside district | +25% R&R monetary + ₹50,000 | 42 |
| R&R Committee | ≥ 100 acres | 45 |
| Private purchase value sharing | 40% (purchases on/after 5 Sept 2011) | 46 |
| Authority reference disposal | 6 months; award copy in 15 days | 51–74 |
| Reference window | 6 weeks if present, 6 months otherwise | 64 |
| High Court appeal | 60 days + up to 60 more | 74 |
| Interest on unpaid compensation | 9% p.a.; 15% p.a. after one year | 80 |
| False information | up to 6 months and/or ₹1 lakh | 84 |
| Contravention on compensation / R&R | 6 months – 3 years and/or fine | 85 |
| Temporary occupation | ≤ 3 years | 81 |
| Return of unutilised land | 5 years | 101 |
| Appreciated value sharing | 40% on first transfer without development | 102 |
| Second Schedule | Urban house ≥ 50 m²; opt-out ≥ ₹1.5 L; ₹5 L or annuity ≥ ₹2,000/month × 20 yrs; subsistence ₹3,000/month × 1 yr; transport ₹50,000; cattle shed ≥ ₹25,000; artisan ≥ ₹25,000; resettlement allowance ₹50,000; SC/ST from Scheduled Area +₹50,000 | Second Schedule |

**Never use:** 1.25× multiplier · 24 m² urban housing · "Third Schedule" for annuities/jobs · Cantonments Act 2006 or SEZ Act 2005 as Fourth Schedule enactments. These errors exist in our secondary research documents.

### 39.5 Fourth Schedule enactments (s.105) — thirteen

Ancient Monuments and Archaeological Sites and Remains Act 1958 · Atomic Energy Act 1962 · Damodar Valley Corporation Act 1948 · Indian Tramways Act 1886 · Land Acquisition (Mines) Act 1885 · Metro Railways (Construction of Works) Act 1978 · National Highways Act 1956 · Petroleum and Minerals Pipelines Act 1962 · Requisitioning and Acquisition of Immovable Property Act 1952 · Resettlement of Displaced Persons (Land Acquisition) Act 1948 · Coal Bearing Areas Acquisition and Development Act 1957 · Electricity Act 2003 · Railways Act 1989

### 39.6 Diagrams (in `docs/diagrams/`)

| File | Shows |
|---|---|
| `01-architecture.mermaid` | Six layers; DB as system of record; chain as side anchor; security cross-cutting |
| `02-operational-workflow.mermaid` | Ten phases with rejection paths, constraint checks, terminal outcomes |
| `03-er-diagram.mermaid` | Earlier data model — **§10 supersedes it** |
| `stakeholder-pipeline.svg` | Nine stages with stakeholders; rule and monitoring rails |
| `acquisition-flow.svg` | Operational flow with acknowledgement and trust rail |

---

*End of CLAUDE.md. Keep it true: when the build and this file disagree, fix one of them in the same PR.*
