# NLAMS — National Land Acquisition & Management System

SIH problem statement **26016**, Ministry of Rural Development.
Submission: **30 September 2026**. Team of 5.

**Read this entire file before writing any code.** Every Claude Code session in this repo
reads it. It exists so five people do not invent five different conventions.

---

## 1. What we are building

One land parcel's journey from project proposal to possession to closure, with the
statutory deadlines of the RFCTLARR Act 2013 running as live clocks, visible to each
stakeholder at their own level of access, on a map.

Four things are ours and must work end to end:

1. **Money disbursed vs money actually acknowledged by the family** — the gap is the headline number
2. **Statutory deadline engine** — not "task overdue" but "this notification lapses in 34 days"
3. **Field GPS boundary capture** — officer walks the corners, photo at each one
4. **Rule-packs** — statute and state variation as versioned config, not code

Everything else (dashboards, RBAC, alerts, documents, reports) is required by the problem
statement and expected of every team.

---

## 2. Hard rules — do not violate these

These were decided deliberately. If code contradicts one, the code is wrong.

| Rule | Why |
|---|---|
| **The system RECORDS compensation. It never CALCULATES the award.** | The award is a legal act by the Collector under ss.23, 27, 31. We may fetch and display circle rates and sale deeds; a named officer enters or confirms every figure. |
| **AI never validates, approves or rejects anything.** | AI suggests; a human accepts each field. Hash the record the officer approved, never what the AI read. |
| **No Aadhaar, no real banking, no live cadastral import.** | Stub them behind adapters with a visible MOCK badge. Claiming access we do not have is the risk. |
| **Blockchain is OFF the critical path.** | Postgres is the system of record. Anchoring runs in a background queue and never blocks a request or a page. If the chain is down, the app works and the proof shows as pending. |
| **Biometrics are never stored.** | WebAuthn matches on-device. We store a credential ID and a timestamp. Nothing else. |
| **Restricted fields are stripped in the API, not the frontend.** | Otherwise the data still sits in the browser's network tab. |

---

## 3. Repo layout

```
nlams/
├── CLAUDE.md              ← this file
├── docker-compose.yml     ← postgres + postgis
├── prisma/
│   └── schema.prisma      ← FROZEN. See §5.
├── api/                   ← Node + Express + Prisma
│   └── src/
│       ├── modules/       ← one folder per module (a/, b/, c/ …)
│       ├── middleware/    ← auth, jurisdiction scope, audit, redaction
│       └── lib/
├── web/                   ← React + Vite + Tailwind
│   └── src/
│       ├── modules/       ← one folder per module
│       ├── field/         ← the PWA routes (offline capture)
│       └── components/
├── ai/                    ← FastAPI, one service, delay risk scoring
├── rulepacks/             ← versioned JSON
└── seed/                  ← seed generator
```

No monorepo tooling. Each of `api/`, `web/`, `ai/` has its own `package.json` /
`requirements.txt`. Turborepo and Nx are a day of yak-shaving we do not have.

**Stack:** Node + Express + Prisma · React + Vite + Tailwind + MapLibre · PostgreSQL +
PostGIS · FastAPI for the one AI service · Hardhat local node for anchoring (optional,
background only).

---

## 4. Who owns what

Stay inside your own `modules/<letter>/` folders. If you need something from another
module, call its API — do not reach into its tables.

| Owner | Modules | Domain |
|---|---|---|
| **Chaitanya** | 0 (rule-packs), J (executive dashboard) | Foundation, schema, seed, RBAC, integration, anchoring, demo |
| **Ishan** | A (intake, scrutiny, routing), D (consent, s.11 notification, objections) | Legal workflow, front half |
| **Madhav** | B (GIS, parcels, constraints), Field PWA | Everything spatial |
| **Atulit** | C (SIA), E (R&R scheme, entitlements, passbook), I (annuity audit) | People and entitlements |
| **Jagtap** | F (award recording), G (disbursement, acknowledgement, possession), H (LARR cases) | Money and disputes |

**Depth targets.** Every module gets a real screen with real data. Depth varies:

- **Deep** (full click-through, create/edit/approve/reject): B, D, F→G, J
- **Working** (main path only): A, C, E, Field PWA
- **Visible** (read-only over seeded data): H, I

---

## 5. Schema rules

**The schema is frozen.** Changes go through Chaitanya only, announced to everyone.
Do not run `prisma migrate` with your own edits.

**PostGIS + Prisma.** Prisma cannot query geometry columns. They are declared as
`Unsupported("geometry(...)")`. All spatial work goes through `$queryRaw`:

```ts
// area in square metres — NEVER ST_Area on raw 4326, that returns square degrees
await prisma.$queryRaw`
  SELECT ST_Area(boundary::geography) AS area_sqm FROM "LandParcel" WHERE id = ${id}
`;
```

**Canonical geometry hashing.** One function, used everywhere. Different serialisations of
the same polygon produce different hashes and cause false tamper alerts:

```sql
encode(digest(
  ST_AsBinary(ST_Normalize(ST_ReducePrecision(geom, 0.000001))), 'sha256'
), 'hex')
```

---

## 6. API conventions

```
GET    /api/v1/<module>/<resource>
POST   /api/v1/<module>/<resource>
PATCH  /api/v1/<module>/<resource>/:id
```

Every response:

```json
{ "data": ..., "meta": { "redacted": ["hold_reason"] } }
```

Every error:

```json
{ "error": { "code": "STAGE_NOT_ALLOWED", "message": "...", "detail": {} } }
```

**Three middlewares run on every request, in this order:**

1. `auth` — sets `req.user`
2. `jurisdictionScope` — injects the row filter. Never write `WHERE district_code = ...`
   by hand in a controller; one forgotten line is a cross-district data leak.
3. `redact` — strips restricted fields per role before serialising

**Restricted fields** (visible from District level upward only):

```
Disbursement.holdReason
Person.bankAccountRef
Objection.decidedByUserId
```

---

## 7. Statutory numbers — use these, nothing else

Our own process and blueprint PDFs contain wrong figures. These come from the Act.
**Never take a number from any other document.**

| Rule | Value | Section |
|---|---|---|
| Private company prior consent | **80%** | s.2 |
| PPP prior consent | **70%** | s.2 |
| Government project consent | **none — exempt** | s.2 |
| SIA completion | 6 months | s.4 |
| Expert Group recommendation | 2 months | s.7 |
| s.11 notification after SIA appraisal | 12 months, else SIA **lapses** | s.14 |
| Objection window | 60 days | s.15 |
| Declaration after s.11 | 12 months, else notification **deemed rescinded** | s.19 |
| Award after declaration | 12 months, else proceedings **lapse** | s.25 |
| Rural multiplication factor | **1.00 to 2.00** (NOT 1.25) | First Schedule |
| Urban multiplication factor | 1.00 | First Schedule |
| Solatium | **100%** | s.30 |
| Additional amount | 12% per annum | s.30(3) |
| Compensation before possession | 3 months | s.38 |
| Monetary R&R entitlements | 6 months | s.38 |
| Infrastructure R&R entitlements | 18 months | s.38 |
| R&R before irrigation/hydel submergence | 6 months prior | s.38 |
| Urgency: advance tendered | 80% | s.40 |
| Urgency: additional compensation | 75% | s.40 |
| SC/ST first instalment | at least one-third | s.41 |
| R&R Committee threshold | 100 acres or more | s.45 |
| Interest on unpaid after possession | 9% p.a., then **15%** after one year | s.80 |
| Unutilised land return | 5 years | s.101 |
| Appreciated value sharing | 40% | s.102 |
| Reference to Authority | 6 weeks if present at award, 6 months if not | s.64 |

**Second Schedule amounts:** subsistence ₹3,000/month for 1 year · transport ₹50,000
one-time · resettlement allowance ₹50,000 · cattle shed / petty shop minimum ₹25,000 ·
artisan grant minimum ₹25,000 · annuity not less than ₹2,000/month for 20 years, or
₹5 lakh one-time · SC/ST displaced from Scheduled Areas additional ₹50,000 · urban
constructed house **not less than 50 sq m** plinth area.

**Second Schedule = entitlements. Third Schedule = resettlement-area infrastructure.**
Do not mix them up — our blueprint PDF does.

---

## 8. What is mocked, and how to say so

| Adapter | Production | Now |
|---|---|---|
| `/integrations/cadastral` | State Bhu-Naksha / RoR | Synthetic parcels |
| `/integrations/identity` | UIDAI e-KYC | Returns `{ verified: true, provider: "MOCK" }` |
| `/integrations/payment` | PFMS / bank DBT | Simulated transfer status |

Every mocked call renders a visible **MOCK** badge in the UI. Do not hide it.

---

## 9. Seed data

Fixed random seed. `npm run seed` must produce an identical database every time, and
`npm run seed:reset` must restore it mid-demo.

The data is shaped so the features have something to show: about 20% of cases already
late, 3–4 actually breaching a deadline, families paid in full / part paid / **disbursed but
not acknowledged** / held with the Authority, both rural and urban parcels, and at least
one Scheduled Area project.

Every generated parcel carries `dataSource: "synthetic_demo"` and the UI shows a
**DEMO DATA** badge. We say this out loud before anyone asks.

---

## 10. The demo path — do not break these eight clicks

Anything outside this path gets fixed last, or not at all.

1. National map, three red breach alerts
2. Click the worst — timeline shows *"declaration lapses in 34 days"*
3. Collector draws a boundary — s.10 and s.41 constraints fire
4. Field officer on a phone: airplane mode, walk the boundary, back online, syncs
5. Portal: parcel appears shaded; click a corner, the photo taken there opens
6. A family's money view — disbursed vs acknowledged, gap visible
7. Role switcher, Collector → Public, and `holdReason` disappears
8. Rule-packs: same engine, an NH Act project, different rules

---

## 11. Git

Branch per slice: `feat/<module-letter>-<thing>`. Merge to main **every evening**.
Nobody works directly on main. If a merge conflicts on the schema, stop and talk to
Chaitanya — do not resolve it yourself.
