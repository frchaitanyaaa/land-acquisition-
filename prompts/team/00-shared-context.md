# 00 — Shared context (every teammate pastes this first)

> **How to use**: open a new Claude Code chat on your own branch, then paste:
> "Read `prompts/team/00-shared-context.md`, then `prompts/team/<your file>.md`, then `CLAUDE.md` §1.
> Do the tasks in my file in order. Stop and ask me only when a decision is not covered."

## Deadline — fixed
- **Code freeze: 3 Oct 2026, 18:00 IST.** Integration until 22:00. Final deploy by 23:59.
- **4 Oct**: final prototype submitted to SIH from the deployed URL.
- Nothing gets added after freeze. Anything not done by its checkpoint is cut, not delayed.

| When (IST) | Checkpoint |
|---|---|
| 1 Oct 23:00 | Chaitanya pushes the UX4G foundation + app shell (C1) to `atulit`. All UI work builds on it. Backend and data tasks start right away and do not wait. |
| 2 Oct 14:00 | Everyone pushes. Madhav and Ishan open PRs into `atulit`. Chaitanya merges. |
| 2 Oct 23:00 | Every "must" item code-complete. Staging deploy live. |
| 3 Oct 18:00 | Feature freeze. |
| 3 Oct 18:00–22:00 | Full 7-minute demo (CLAUDE.md §34) on the deployed URL, twice; fix what breaks. |
| 3 Oct 23:59 | Final deploy; `atulit` merged into `main`; screen recording of every demo beat. |

## Team, branches, ownership
| Person | Branch | Brief | Area |
|---|---|---|---|
| Chaitanya (lead) | `atulit` | `01-chaitanya.md` | design system + shell, national/state/district/collector dashboards, project workspace, merges |
| Atulit | `atulit` | `02-atulit.md` | GIS maps, field officer portal, field phone app, money screens |
| Madhav | `madhav` (he creates it from `atulit`) | `03-madhav.md` | landing, login, citizen accounts, grievances, public portal, AI layer UI |
| Ishan | `ishan` (he creates it from `atulit`) | `04-ishan.md` | free deployment, trust/blockchain UI |

Rules:
1. Work only inside the paths your brief says you own. If you must touch another person's file, keep the change
   minimal, say so in the commit/PR description, and tell that person.
2. Chaitanya and Atulit push to `atulit` directly in small commits; `git pull --rebase origin atulit` before each push.
3. Madhav and Ishan: create your branch yourself the first time (`git checkout -b <name> origin/atulit && git push -u origin <name>`),
   then `git merge origin/atulit` into it at every checkpoint and open a PR into `atulit`.
   Chaitanya merges.
4. Only Madhav adds a database migration this sprint (`packages/db/drizzle/0005_*`). Anyone else needing a schema
   change asks Madhav to add it.
5. Before every push: `pnpm lint && pnpm typecheck && pnpm test && pnpm rules:check`
   (+ `pnpm test:db` if you changed SQL). Do not push red.
6. Commit messages: Conventional Commits (`feat(gis): …`, `fix(portal): …`).

## Where the project stands (as of 1 Oct)
- **Backend is largely complete**: all modules A–J, rule engine, workflow, deadlines, GIS, field sync, money,
  WebAuthn acknowledgement, notifications + SSE, AI assistant (whitelisted read-only tools), blockchain anchoring,
  OCR and STT jobs, MIS reports. 188 unit tests, 20 DB tests and the API e2e suite pass.
- **Portal works but looks generic**: plain Tailwind pages (national, collector, project timeline/parcels/award/
  families, possession, rule packs, new proposal wizard, public pages, ack/enrol/passbook). This sprint replaces
  the look with UX4G and adds the missing screens.
- **Fixed in the analysis chat** (already on `atulit`):
  - root layout + home page that commit `7fe1600` overwrote (Missing `<html>`/`<body>`, unstyled public page,
    `/api/v1/public/ack/undefined`);
  - `pnpm infra:up` now waits until Postgres is healthy (`db:reset` used to connect too early);
  - Postgres JIT disabled by migration `packages/db/sql/00_settings.sql`: national dashboard 6.5 s → 0.18 s;
  - RLS test derives expectations from seed fixtures; Postgres on port 5432 again.
- **Known gaps you will fix**: no basemap file (`demo-region.pmtiles` 404 → grey maps), no boundary layers,
  national map does not zoom to projects, no landing/role login, no citizen accounts or grievances, AI features
  invisible in the UI, no field-officer web workspace, no trust/blockchain page.

## Run it (Arch Linux, from the repo root)
```bash
git pull
cp -n .env.example .env          # DB URLs use port 5432
pnpm i
pnpm infra:up                    # waits for healthy Postgres/Redis
pnpm db:reset                    # migrate + seed (11 projects, 1510 parcels, exactly 3 breaches)
pnpm chain:deploy
pnpm --filter @bhoomisetu/field build:portal
pnpm dev                         # api :3001 · portal :3000 · field :5173
```
- Open **http://localhost:3000** (not the 172.x LAN address).
- The first visit to each page is slow in `pnpm dev` (compiling). For demos use
  `pnpm --filter @bhoomisetu/portal build && pnpm --filter @bhoomisetu/portal start`.
- Logins — password `bhoomisetu-demo`, all `@bhoomisetu.local`: `oversight` (national), `collector.pune`,
  `collector.satara`, `lao.satara`, `treasury.satara`, `rnr.satara`, `tehsildar.haveli`, `dilr.pune`,
  `talathi.khedshivapur` (field), `pd.nhai` (requiring body), `sia.man`, `dlsa.nagpur`, `legal.mh`, `admin`,
  `demo` (holds many posts).

## Decisions — final, do not re-open
| Topic | Decision |
|---|---|
| UI system | **UX4G only.** Package `ux4g-web-components` 3.x. CSS + runtime imported **once** at the root (portal: `apps/portal/app/layout.tsx`; field: `apps/field/src/main.tsx`). Tailwind is removed screen by screen as each screen is restyled; whoever converts the last Tailwind screen removes the dependency. |
| Theme | Navy primary + saffron secondary. Tokens below go in one `:root` block in `apps/portal/app/globals.css` (Chaitanya owns it) plus a `:root[data-theme="dark"]` block. Saffron only for accent CTAs and highlights. **Never white text on saffron.** |
| Identity | Header text "Ministry of Rural Development · Prototype for SIH 26016" + a thin tricolour strip. **No State Emblem image anywhere** (legally restricted). Product name: **BhoomiSetu**. |
| Officer login | One login page. **"Login as" role dropdown** first (Collector, LAO, Field officer, …), then email + password. The server picks the user's active post with that role and rejects the login if they hold none (`POST /auth/login` already validates `postId`; Madhav adds `role`). A user with several posts of that role switches later via the post chip. The dropdown lists roles, never a person's posts, so nothing leaks before sign-in. |
| Citizens | Citizen accounts: phone + password, phone verified by OTP (mock SMS). An account is linked to a `persons` row only after OTP match + officer confirmation. Citizens read only their own records through definer functions (G22). |
| Basemap | Officer portal opens on **Esri World Imagery satellite** (online, attribution visible) with a toggle to the offline PMTiles map. Field phone app uses **PMTiles only**. |
| Blockchain | Real anchoring already works — keep it; build its UI only. No Besu. If the chain node cannot run on the server, the API uses a clearly labelled "Simulated chain" mode. Never present simulated as real. |
| Deployment | Cost ₹0: portal on Vercel Hobby; API + Postgres/PostGIS + Redis + MinIO + Hardhat in Docker on one free VM with Caddy HTTPS; Vercel rewrites `/api/*` to the VM. Backup: laptop + Cloudflare tunnel. Owner: Ishan. |
| Risk score | Called **"Risk score (advisory)"**, shows its top factors and evidence. Never "AI prediction", never a confidence %. |

### Theme tokens (proposal — Chaitanya verifies contrast in C1 and may adjust shades, not hues)
```css
:root {
  /* navy — primary */
  --ux4g-color-primary-50:#eef2fb !important;  --ux4g-color-primary-100:#d6e0f5 !important;
  --ux4g-color-primary-200:#adc0eb !important; --ux4g-color-primary-300:#7f9bdc !important;
  --ux4g-color-primary-400:#4f72c8 !important; --ux4g-color-primary-500:#2c51ad !important;
  --ux4g-color-primary-600:#1f3c8f !important; --ux4g-color-primary-700:#182f72 !important;
  --ux4g-color-primary-800:#13245a !important; --ux4g-color-primary-900:#0e1a43 !important;
  --ux4g-color-primary-950:#08102b !important;
  /* saffron — secondary */
  --ux4g-color-secondary-50:#fff6ec !important;  --ux4g-color-secondary-100:#ffe9cf !important;
  --ux4g-color-secondary-200:#ffd29e !important; --ux4g-color-secondary-300:#ffb866 !important;
  --ux4g-color-secondary-400:#ff9933 !important; --ux4g-color-secondary-500:#f07f0f !important;
  --ux4g-color-secondary-600:#c96507 !important; --ux4g-color-secondary-700:#9c4d06 !important;
  --ux4g-color-secondary-800:#733805 !important; --ux4g-color-secondary-900:#4d2603 !important;
  --ux4g-color-secondary-950:#2b1501 !important;
}
```
Tricolour strip colours (decorative only): saffron `#FF9933`, white `#FFFFFF`, green `#138808`, navy `#000080`.

## UX4G — how everyone uses it
- **Load the `ux4g-design` skill before any UI work.** Its preflight asks for the theme: it is already decided
  (above) — tell your chat "theme decided in 00-shared-context.md, use those tokens".
- Read `node_modules/ux4g-web-components/README.md` (2,600 lines, full class reference) before writing a component.
  Never invent a class or token name.
- Use UX4G classes for every component and utility. Custom CSS only for app-specific layout UX4G lacks; keep it
  in the component's own CSS module with a comment saying why.
- Components we use: Navbar, Breadcrumb, Accordion + List (sidebar), Card, Tag, Badge, Button, Icon Button,
  Dropdown, Input, Checkbox, Radio, Switch, OTP, File Upload, Table, Pagination, Tab, Drawer, Modal, Popover,
  Tooltip, Alert, Stepper, Status Pipeline, Journey Timeline, SLA Progress Indicator, Progress Indicator,
  Empty State, Spinner, Footer, Accessibility Bar.
- Chaitanya publishes `apps/portal/components/ui/README.md` in C1 with the exact class recipes for: navy hero
  banner, KPI card, status → tag colour map, data table, filter bar, empty state, page header. **Use those
  recipes so all four people produce the same look.**
- The UX4G CSS is ~8 MB (fonts embedded). Import it only at the root. Never import it in a component.
- Every screen: works at 360 px width, keyboard reachable, visible focus, WCAG AA contrast, light + dark.

## Golden rules that bite UI work (full list: CLAUDE.md §1)
- **G1/G2** Never compute an award. The only computed money is "Estimated interest liability (s.80)".
- **G3** AI output only in `ai_suggested_*`; an officer clicks Accept to copy it. Show it as a suggestion.
- **G7** Every value from a mock adapter (payment, identity, cadastral, SMS, LLM, STT) shows a **MOCK** badge.
  Never write "Mahabhumi", "BhuNaksha", "PFMS", "NIC", "ISRO" as live sources.
- **G9/G10** Money from the API is paise as strings → `formatINR` / `formatCrore` / `formatLakh` from
  `packages/shared/src/money.ts`. Area → `formatArea` from `packages/geo/src/units.ts` (ha · acre · guntha).
- **G12** Every state change goes through `POST /projects/:id/stages/:code/actions` or the module endpoint —
  no client-side status edits.
- **G13** Never hide data in the frontend for security; the API already redacts per viewer. Render what it returns.
- **G16** No `new Date()` for business logic; dates come from the API. Display with the `packages/shared` formatters.
- **G18** Synthetic data only; DEMO DATA badge stays in every shell.
- **G19** Show actor user **and** post wherever an action is shown.
- **G22** Public and citizen pages read only through `public_*` views / definer functions.

## Data and tools you can rely on
- Dashboard APIs: `GET /dashboards/{national,collector}`, `/dashboards/state/:code`, `/dashboards/district/:code`,
  `/dashboards/project/:id`, `/deadlines/board`, `/analytics/risk`, `/analytics/bottlenecks`, `/reports/:type`.
- Workflow: `GET|POST /projects/:id/stages/:code/actions`, `GET /projects/:id/timeline`, `/deadlines`.
- GIS: `GET /projects/:id/parcels?colorBy=stage|payment|risk` (GeoJSON), `/chainage`, `/flags`, `GET /parcels/:id`,
  `POST /parcels/:id/verify`, `/corrections`, `POST /parcel-corrections/:id/decide`.
- Field: `GET /field/assignments`, `/field/assignments/:id/offline-pack`, `POST /field/sync`, `/field/photos`.
- AI: `POST /assistant/query {question}` (tool-calling only, under caller's scope).
- Chain: `GET /chain/verify/:entityType/:entityId?version=`, `GET /chain/status`; audit: `GET /audit/verify`.
- Live updates: `GET /stream` (SSE: `kpi.updated`, `notification.created`, `chain.anchored`).
- Notifications: `GET /notifications`, `POST /notifications/:id/read`.
- OpenAPI at http://localhost:3001/api/docs.

## Design reference
- `prompts/team/rival-design-notes.md` — 25 rival screenshots analysed. Match their polish (navy hero banners,
  icon KPI cards with coloured sub-metrics, left sidebar with grouped sections, 3-pane GIS, 360° parcel view,
  role-specific menus). Our edge, which every screen must show: live statutory clocks with legal consequences,
  disbursed vs **acknowledged** money, proof badges, honest MOCK labels.
