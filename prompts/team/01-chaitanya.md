# 01 — Chaitanya (lead) · branch `atulit`

You are building the design foundation everyone else depends on, the national → state → district → project
dashboards, and the project workspace. You also merge everyone's work and own `CLAUDE.md`.
Read `00-shared-context.md` first. Load the `ux4g-design` skill before writing UI (theme is already decided).

## You own (others do not edit these)
- `apps/portal/app/layout.tsx`, `apps/portal/app/globals.css`, `apps/portal/package.json` (deps), `apps/portal/next.config.ts`
- `apps/portal/components/shell/**` (new; replaces `components/officer-shell.tsx` and `components/role-switcher.tsx`)
- `apps/portal/components/ui/**` (new: shared UX4G recipes)
- `apps/portal/app/(dashboards)/layout.tsx`, `(dashboards)/page.tsx`
- `apps/portal/app/(dashboards)/{national,state,district,collector,rule-packs,proposals}/**`
- `apps/portal/app/(dashboards)/project/[id]/{layout.tsx,page.tsx,project-header.tsx,timeline/**}`
- `apps/portal/components/{stat-tile,gap-tile,breach-alerts,state-table,deadline-countdown,action-panel,status,attestation-modal}.tsx`
- `apps/portal/lib/{dashboards-api,project-api,intake-api,api,query-provider,use-live-updates,format}.ts`
- `apps/portal/app/(dashboards)/projects/new/**` (intake wizard restyle)
- `apps/api/src/dashboards/**`, `CLAUDE.md`

## C1 — UX4G foundation + app shell · **due 1 Oct 23:00** (everyone's UI waits on this)
1. `pnpm --filter @bhoomisetu/portal add ux4g-web-components`. In `app/layout.tsx` import
   `ux4g-web-components/styles.css` once; load the runtime once from a small client component
   (`components/shell/ux4g-runtime.tsx` doing `import('ux4g-web-components/design-system')` in `useEffect`).
   Set `<html lang data-theme>`.
2. `globals.css`: paste the theme token block from `00-shared-context.md` (+ a `:root[data-theme="dark"]` block with
   the same hues adjusted for dark). Remove `@import "tailwindcss"` preflight so it does not fight the UX4G reset;
   keep Tailwind utilities only until each page is converted.
3. Build `components/shell/`:
   - `TopBar.tsx` — tricolour strip (4 px) on top; brand "BhoomiSetu" + line "Ministry of Rural Development ·
     Prototype for SIH 26016"; **project switcher** Dropdown (`GET /projects`, sets `?project=` and remembers last
     choice in localStorage); **Live** dot (green when `/stream` SSE connected, grey otherwise); language switch
     EN / हिं / मरा; **bell** with unread Badge opening a Popover list from `GET /notifications` (filters All / Unread /
     Deadlines / Documents, mark read `POST /notifications/:id/read`, empty state); dark-mode toggle; user chip
     (name + active post designation + jurisdiction) with menu: switch post (`POST /auth/switch-post`), logout.
   - `Sidebar.tsx` — collapsible groups, each item has an icon, label and one-line description, count Badge where
     useful. Groups and items (hide items the active role cannot use):
     - **Overview**: National dashboard `/national` (national/state roles), State dashboard `/state/[code]`,
       District dashboard `/district/[code]`, Collector desk `/collector` (COLLECTOR, LAO), Proposals `/proposals`.
     - **Land**: GIS map `/gis`, Land parcels (project parcels tab), Field office `/field-office`
       (TEHSILDAR, DILR, FIELD_OFFICER), Field app `/field`.
     - **Acquisition**: Project workspace, Award, Families & money, Possession, Objections, Grievances `/grievances`.
     - **Monitoring**: Deadlines & alerts, Analytics (risk + bottlenecks), Reports (MIS), Rule packs `/rule-packs`.
     - **Trust**: Trust center `/trust` (Ishan), Audit log.
     - **Quick actions** at the bottom: Register new project (`/projects/new`), **Ask AI** (opens Madhav's
       `AskDrawer` — leave a slot `components/shell/ask-slot.tsx` exporting `null` until his component lands).
   - `PageHeader.tsx` (Breadcrumb + title + subtitle + right-side actions), `NavyHero.tsx` (dark navy hero banner with
     eyebrow tag, title, subtitle, scope chip, right-side controls, optional progress bar), `Footer.tsx` (UX4G footer:
     "Prototype · synthetic demo data · SIH 26016", links), Accessibility Bar (text size, contrast).
   - Keep the DEMO DATA badge in the top bar.
4. Replace `OfficerShell` usage in `(dashboards)/layout.tsx`, `login/layout.tsx`, `session/layout.tsx` with the new shell
   (login gets a minimal variant without the sidebar; Madhav restyles the login page itself).
5. Write `components/ui/README.md` with copy-paste recipes using only UX4G classes: navy hero, KPI card (icon, label,
   big number, unit, coloured sub-metric), status → Tag colour map (SAFE/DUE_SOON/BREACHED, payment states,
   ParcelStatus), data table + filter bar + pagination, empty state, section card with header. Export small wrappers
   in `components/ui/` (`KpiCard`, `StatusTag`, `SectionCard`, `EmptyState`, `MockBadge`, `AdvisoryBadge`) so every
   teammate imports the same thing.
6. **Done when**: every existing page renders inside the new shell; light + dark pass AA contrast; 360 px width has a
   collapsible sidebar; push to `atulit` and post "C1 landed" to the team.

## C2 — National command centre + drill-down · 2 Oct morning (by 14:00)
Route `/national` (data `GET /dashboards/national`; types in `lib/dashboards-api.ts`):
1. `NavyHero`: "National land acquisition command centre", scope chip ("All India · 11 projects · N parcels"),
   overall acquisition progress bar (area acquired / area affected), "as of" time (from `asOf`), refresh.
2. 8 KPI cards (4 × 2): area notified, area acquired, compensation assessed, compensation paid, **acknowledged**,
   affected families, displaced families, possession %; second line on each card with a coloured secondary metric
   (e.g. "unconfirmed ₹x" in amber on the paid card, "breached deadlines 3" in red). Also R&R completion % and
   timeline adherence % as two slim cards.
3. **Gap card** (our headline): disbursed vs acknowledged vs unconfirmed (₹ via `formatCrore`), progress bar split.
4. **Statutory stage distribution**: horizontal bars, one per stage code, count of projects whose `current_stage` is
   that stage (from `projects[]`); click → filtered project list.
5. **Breach board**: top alerts (`alerts[]`) as rows with SLA Progress Indicator, consequence text, section,
   days left/overdue, project link; exactly 3 red BREACHED rows on the seed.
6. "Estimated interest liability (s.80)" card (label exactly that).
7. Map slot: `<NationalMap projects states />` from Atulit (`components/gis/national-map.tsx`, due 2 Oct 12:00);
   until then render the existing `ProjectMap` inside the card.
8. State table: sortable by every KPI; row click → `/state/[code]`.
9. New pages `/state/[code]` (`GET /dashboards/state/:code`) and `/district/[code]` (`GET /dashboards/district/:code`):
   same hero + KPI + stage distribution + breach board layout, scoped; state page lists districts → district page
   lists projects → project workspace. Breadcrumb National › State › District › Project.
10. Live refresh via `use-live-updates.ts` on `kpi.updated`.
**Done when**: oversight login sees 3 breaches, ₹ gap card, drill-down National → Maharashtra → Pune → MH-PSX works.

## C3 — Project workspace · 2 Oct afternoon (by 23:00)
`/project/[id]` layout + timeline page (data: `GET /projects/:id`, `/projects/:id/timeline`, `/projects/:id/deadlines`,
`GET /projects/:id/stages/:code/actions`, `GET /analytics/risk?projectId=<id>`):
1. Navy hero: name, code chip, status chip, pinned pack chip (`larr-2013-maharashtra@1.0.0`), location
   (state › districts), two progress bars (stages approved / applicable stages; checklist items satisfied / total),
   "Current stage n of N", next-deadline countdown with consequence and section.
2. **Recommended next action** card: the first enabled action from `GET …/actions` for the current stage, plus the
   top 3 risk factors for this project labelled **"Risk score (advisory)"**; buttons "Inspect stage" (scroll) and
   "Take action" (opens the action panel). If every action is blocked, show the guard failure messages instead.
3. Horizontal Stepper of the **pack's applicable stages** (never hard-code S01–S10; NH-Act projects differ): done /
   active / returned / not started, click to select.
4. Stage detail: "Stage n of N", checklist items as rows — REQUIRED tag, item type, owner role, evidence link
   (document → download, hearing → hearing record, event/gate → time satisfied), "Satisfied by <user> · <post> at
   <time>"; transition history with maker and checker (user + post, G19); attestation badge on documents.
5. Restyle `action-panel.tsx` with UX4G (buttons, Modal form, disabled buttons with Tooltip showing the guard failure).
6. Keep the existing tabs (Timeline, Parcels, Award, Families & money) as a UX4G Tab bar; add Objections (Madhav's page).
**Done when**: MH-PSX shows S07 active, "34 days left · s.19 · deemed rescinded", recommended action, stepper, and an
approve/return round-trip works with the guard messages visible.

## C4 — Collector desk, proposals, rule packs, AI mount · 3 Oct morning (by 13:00)
1. `/collector`: navy hero ("What breaches a statutory deadline on my watch?"), KPI cards (breached, due soon,
   interest liability, pending verifications, unacknowledged payments), deadline board with SLA indicators and action
   buttons, consent meters (Progress Indicator with threshold marker), returned files, unacknowledged disbursements table.
2. `/proposals`: projects in DRAFT / SUBMITTED / RETURNED at S01 (`GET /projects?status=`), Tab bar with counts
   (All, Under review, Returned for clarification, Accepted), proposal cards (code, name, requiring body, districts,
   land required, budget, status Tag, "Details & actions" → workspace), saffron "Submit new proposal" → `/projects/new`.
3. Restyle `/projects/new` wizard with UX4G Stepper + form fields; `/rule-packs` with UX4G Tab/Table, VERIFY Alert first.
4. Mount Madhav's `AskDrawer` in the shell slot and the "Ask AI" quick action (he hands it over by 3 Oct 12:00).

## C5 — Integration · 3 Oct 18:00 → 23:59
1. Merge Madhav's and Ishan's PRs into `atulit` (resolve conflicts; run all checks).
2. Run the 7-minute demo (CLAUDE.md §34) on the deployed URL twice with the team; fix blockers only.
3. Update `CLAUDE.md`: §4 UI = UX4G (+ theme), §16.5 satellite default in portal, §25 citizen accounts + grievances,
   §36 team table (Chaitanya, Atulit, Madhav, Ishan + branches), §34 demo script if beats changed.
4. Open and merge PR `atulit → main`. Tag `v1.0-sih`.

## Checks before every push
`pnpm lint && pnpm typecheck && pnpm test && pnpm rules:check`; open each changed page in light + dark at 1280 px and
360 px; no `new Date()` for business logic; no statutory number in portal code; money via `formatINR/formatCrore`.
