# Prompt 01 — Portal: National + Collector dashboards (demo beat 1)

## Context
`apps/portal` currently has only a login form (`apps/portal/app/login/`) and a bare session/post-switcher page
(`apps/portal/app/session/page.tsx`) — ~230 lines total, no dashboards. The API's `dashboards` module is already
built and serving real data from the seeded dataset (11 projects, 3 breaching deadlines by design per §33.6).
This is the opening screen of the 7-minute demo (§34 beat 1: "Every statutory deadline, live, for every project.").

## What to build
1. `apps/portal/app/(dashboards)/national/page.tsx` (§24.1) — KPI tiles for the 8 PS parameters (area notified,
   area acquired, compensation assessed/paid/acknowledged, affected/displaced families, R&R completion %,
   possession %, timeline adherence %), fetched from `GET /dashboards/national`. The "gap tile"
   (disbursed vs acknowledged vs unconfirmed, in ₹) is the money-critical single most important stat on this page —
   use `formatCrore`/`formatLakh` from `packages/shared` (§9 Money conventions), never format paise by hand.
2. Breach-alerts panel — top deadlines breached or due soon with consequence text, section, days remaining, from
   `GET /deadlines board`-style endpoint (`v_deadline_board` per §10.4) — confirm the exact route in
   `apps/api/src/dashboards/dashboards.controller.ts` before wiring.
3. Map — project footprints coloured by risk (`GET /analytics/risk?scope=`), click → project. Use Leaflet +
   react-leaflet per §4 tech stack, `preferCanvas: true`, protomaps-leaflet with `TILES_PMTILES_URL` for the
   basemap (already in `.env`). Don't reach for Google/Mapbox tiles — §16.5 explicitly forbids bulk OSM tile caching
   and the stack is pinned to PMTiles.
4. State table — sortable by any KPI (`GET /dashboards/state/:code` per-state rollups).
5. `apps/portal/app/(dashboards)/collector/page.tsx` (§24.2) — own-district deadline board with countdown,
   consequence, assigned post, action button; estimated interest liability accruing (display only, label
   "Estimated interest liability (s.80)" per G2 — never imply it's owed); consent meters; pending verifications;
   returned files; unacknowledged disbursements. Source: `GET /dashboards/collector`.
6. Live updates — subscribe to the SSE stream (`GET /stream`, already built) for `kpi.updated` events and refresh
   the relevant tiles without a full reload.
7. Respect RLS/redaction transparently — do not add client-side filtering logic to hide fields; the API already
   redacts per viewer (§11.4, G13). Just render whatever the API returns.
8. Show the `DEMO DATA` badge (already used in the field app shell — match that same badge pattern) when
   `demoMode` is true from the API health/session response.

## Data fetching
Use TanStack Query per §4/§9 — no ad-hoc `useEffect` + `fetch` for anything beyond the simplest health check. Server
state belongs in TanStack Query; no new global client state library.

## Done when
Logging in as an Oversight/National-level seeded user and opening `/national` shows the 8 KPI tiles, the gap tile
with real ₹ figures, exactly 3 breach alerts (per §33.6 seed guarantee), and a coloured project map — matching
demo beat 1. The Collector view for the Pune post shows only Pune-scoped data.
