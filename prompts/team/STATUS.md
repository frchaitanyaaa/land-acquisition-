# STATUS — read this first (updated 4 Oct 2026, submission day)

> Any Claude chat working on this repo: read this file before `00-shared-context.md` and the personal briefs.
> Where this file and a brief disagree, **this file wins** — the briefs describe the plan, this describes reality.

## Branches
- **`main` is the only branch to use.** It contains everything below and was verified end to end.
- `atulit` and `madhav` are merged into `main` and will be deleted. Do not commit to them.
- Workflow from now: `git checkout main && git pull` → small commit → `pnpm lint && pnpm typecheck && pnpm test` →
  `git pull` again → `git push origin main`. **Never force-push.**

## What is in `main`
| Area | State | Where |
|---|---|---|
| Backend (all modules, RLS, rule engine, workflow, deadlines, money, WebAuthn ack, notifications, AI assistant tools, anchoring) | Done, tested | `apps/api`, `packages/*` |
| UX4G app shell (top bar, sidebar, accessibility bar, footer, theme), shared UI kit | Done (Chaitanya, C1) | `components/shell/*`, `components/ui/*`, `/ui-kit` |
| National + Collector dashboards, project timeline/parcels/award/families, rule packs, intake wizard | Working, partly restyled | `app/(dashboards)/*` |
| GIS map (3-pane), national map, parcel 360°, land registry, field-officer workspace, field PWA | Done (Atulit) | `components/gis/*`, `/gis`, `/field-office`, `/field` |
| Landing page, officer login with post selection, session page | Done (Madhav) | `app/(landing)`, `app/login`, `app/session` |
| **Citizen portal `/portal`** (find my land, notices, objection, my land, grievances & help, track) — **the only public portal**; `/public` redirects here | Done (Madhav) | `app/(portal)/portal/*` |
| Ask AI assistant | Done (Madhav), sidebar quick action "Ask AI" | `app/(dashboards)/assistant` |
| **Citizen sign-in + grievances** | **MOCK, browser-only** (localStorage), labelled MOCK on every screen | `lib/mock-citizen.ts`, `/portal/login`, `/portal/grievance`, `/portal/track`, officer `/grievances` |
| Payment acknowledgement / enrol / passbook token pages | Done | `app/(public)/{ack,enrol,passbook}/[token]` |
| **Landing page for evaluators**: bold blockchain + GIS + six-USP hero with live anchoring stats, evaluator logins panel (DEMO_MODE) | Done (4 Oct) | `app/(landing)/page.tsx`, `components/landing/evaluator-logins.tsx`, `GET /public/chain-summary` |
| **Trust UI**: `/trust` Trust center (node, contract, ledger, verify any record + QR), `/trust/audit` (hash-chained audit log + verify), public `/verify/[type]/[id]` | Done (4 Oct) | `app/(dashboards)/trust/*`, `app/(public)/verify/*`, `GET /chain/events`, `GET /audit/log`, `GET /public/verify/:type/:id`, `packages/db/sql/07_public_trust.sql` |

## Dropped for this release
- Ishan's work was dropped; the Trust UI was built on 4 Oct instead (above). Without the chain node, badges show
  "Proof pending" and the landing page says the node is offline (G5). No manual "retry failed anchor" button: the
  job retries with back-off by itself.
- **Real citizen accounts and grievance backend** — replaced by the mock above.
- Sidebar items shown as "Soon": State/District dashboards, Proposals, Objections, Deadlines & alerts, Analytics,
  Reports. They are disabled rows, not broken links.

## Fixes made during the merge (4 Oct)
- `pnpm-lock.yaml` synced (fresh `pnpm install --frozen-lockfile` used to fail); API typecheck fixed (TS4053).
- UX4G CSS is loaded inside `@layer ux4g` (`app/globals.css`) — it used to wipe all Tailwind spacing.
- Postgres JIT off (`packages/db/sql/00_settings.sql`) — dashboards 6.5 s → 0.2 s.
- `/portal` got its own page frame; Madhav's pages re-pointed to the C1 `AppShell`.

## Verified on `main` before publishing
lint · typecheck · 190 unit tests · rules:check · contract tests · 20 DB/RLS tests · 22 API e2e tests · production
build · browser smoke test of every sidebar page, landing, login, `/portal/*`, `/assistant`, grievance round trip
(citizen files → officer assigns/starts → citizen sees "In progress"). No page errors.

## Known gaps (honest list)
- Portal pages mix UX4G (shell, session, grievances) and older Tailwind styling (most content pages).
- Hindi/Marathi strings need a native speaker's check.
- The mock grievance register is per browser: the citizen and officer views share data only in the same browser.
- No `data/tiles` basemap file unless Atulit committed it; satellite basemap needs internet.

## Deploying
`deploy/README.md` — laptop + Cloudflare tunnel, production mode, step by step. Chaitanya owns it.

## Demo logins (password `bhoomisetu-demo`, all `@bhoomisetu.local`)
The landing page lists all 17 with "Sign in →" buttons. Main ones: `oversight` (national) · `collector.pune` ·
`lao.satara` · `tehsildar.haveli` · `talathi.khedshivapur` (field) · `demo` (several posts) · `admin`.
Login is throttled to 10 per minute per IP and an account locks for 15 min after 5 wrong passwords (§29).

## Tamper demo
`pnpm demo:tamper` edits an anchored parcel (if one was verified) or else an anchored payment (+₹1,000) with raw SQL.
Trust center → Verify that record → MISMATCH. `pnpm db:reset` (or `demo:reset`) undoes it.
