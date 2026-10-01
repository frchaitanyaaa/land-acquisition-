# 02 — Atulit · branch `atulit`

You own everything map- and field-related, plus restyling the money screens you built. Read
`00-shared-context.md` first. Load the `ux4g-design` skill before UI work (theme already decided). Start A1 right now —
it needs no UI. Start UI tasks after Chaitanya pushes C1 (1 Oct 23:00); until then build data, API and map logic.

## You own (others do not edit these)
- `apps/portal/components/gis/**` (new) — move here: `base-map, parcel-map, project-map, alignment-map,
  chainage-strip, flags-panel, parcel-detail, parcel-colors` (update imports; tell Chaitanya once moved)
- `apps/portal/app/(dashboards)/gis/**` (new), `(dashboards)/field-office/**` (new),
  `(dashboards)/project/[id]/parcels/**`, `(dashboards)/project/[id]/award/**`, `(dashboards)/project/[id]/families/**`,
  `(dashboards)/families/**`, `(dashboards)/project-parcels/**`, `components/money-state.tsx`, `components/qr-code.tsx`
- `apps/portal/lib/{parcels-api,money-api,award-api}.ts`
- `apps/field/**`, `apps/api/src/{gis,field,award,disbursement}/**`, `packages/geo/**`
- `data/{tiles,boundaries,constraints}/**`, `scripts/**`

## A1 — Basemap + boundary data · **start now, done by 2 Oct 09:00** (no UI needed)
1. Basemap file:
   - Install the `pmtiles` CLI (go-pmtiles release binary for Linux amd64).
   - `scripts/extract-tiles.sh`: `pmtiles extract https://build.protomaps.com/<latest-date>.pmtiles
     apps/portal/public/tiles/demo-region.pmtiles --bbox=73.75,18.04,74.07,18.45 --maxzoom=15` (Pune–Satara corridor + ~10 km).
   - Write the output straight to `apps/portal/public/tiles/demo-region.pmtiles` (served by `next dev`, `next start`
     and Vercel with no extra step) and point `scripts/demo-tunnel.mjs` at that path. Commit it if < 50 MB, else use
     Git LFS and tell Ishan (Vercel must pull LFS files).
   - Done when `/tiles/demo-region.pmtiles` returns 200 and the map shows streets offline.
2. Map layers API — new `GET /api/v1/gis/layers?bbox=minLng,minLat,maxLng,maxLat&layers=villages,districts,constraints`
   in `apps/api/src/gis` (RLS-scoped, GeoJSON FeatureCollection per layer, geometry simplified by zoom via
   `ST_SimplifyPreserveTopology`, 7 decimals). Villages already have synthetic rectangle boundaries
   (`packages/db/src/scripts/seed/v1.ts:73`); constraint layers are seeded. Draw villages as dashed outlines with a
   "synthetic boundary" note in the legend.
3. State/district outlines for the national map: add `data/boundaries/states-demo.geojson` and
   `districts-demo.geojson` for the 5 seeded states and their districts (simplified OSM extract if quick; otherwise
   synthetic polygons marked `data_source: SYNTHETIC_DEMO`). Serve via the same layers endpoint (`layers=states`).
4. Add an API e2e test for `/gis/layers` (scope: a Pune district post gets no Nagpur villages).

## A2 — GIS page (3 panes) + national map · 2 Oct, by 14:00
Route `/gis` (all projects in scope) and the project Parcels tab use the same component `components/gis/gis-workspace.tsx`:
1. **Left pane — filters** (UX4G Dropdown/Input/Checkbox): project, search (survey no., owner name — server side),
   district, taluk, village, land class, parcel status, payment state, risk level, "Flagged only"; Reset.
2. **Centre — map** (`BaseMap` upgraded):
   - Default basemap **Esri World Imagery** `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
     with attribution "Tiles © Esri — Esri, Maxar, Earthstar Geographics, GIS User Community"; toggle to the offline
     PMTiles map.
   - Layers panel (UX4G Switch list): Parcels, Corridor, Alignment, Village boundaries, Constraint layers (s.10
     irrigated, s.41 scheduled area, forest, water, eco-sensitive), Survey labels (only from zoom 15).
   - Colour layer Dropdown: Stage / Payment / Deadline risk (existing `colorBy` API).
   - Render all parcels as **one** `L.geoJSON` layer (not one React component per parcel); canvas renderer.
   - Legend card bottom-left with counts per class; selected parcel outlined; `fitBounds` to the project or to the
     filtered set; fullscreen button; start/end markers on linear projects.
   - Hover tooltip: survey no., village, area (`formatArea`), status.
3. **Right pane — record panel** (opens on click): survey no., village/taluk/district, status Tag + flags, area
   recorded vs field vs affected (+ % and chainage), interests (masked names/phones as returned), payment state,
   anchor badge, "Open 360° view" (A3), "Verify" / "Request correction" for permitted roles.
4. Keep the chainage strip above the map for linear projects; clicking a bin filters the map and list.
5. `components/gis/national-map.tsx` for Chaitanya **by 2 Oct 12:00**: state outlines shaded by breached-deadline
   count (choropleth), project markers at `centroid` coloured by risk with tooltip (code, name, stage), click →
   `/project/[id]`, `fitBounds` to all projects, satellite/PMTiles toggle.
**Done when**: MH-PSX parcels show on satellite with corridor, village outlines and s.10/s.41 constraint polygons; the
legend counts match the list; filters change map and list together; national map frames India's 5 seeded states.

## A3 — Parcel 360° + land registry · 2 Oct, by 23:00
1. `components/gis/parcel-360.tsx` as a UX4G Drawer (right, wide) opened from map, registry and record panel.
   Header: "Survey 214/3 — Khed Shivapur", parcel ID, Tags (status, payment, risk score (advisory)), project link.
   Action buttons: View on map, Documents, Legal, Compensation, Risk factors. Tabs:
   - **Overview**: identification, areas, land class, transfer freeze date, verification status + verifier (user + post).
   - **Interests**: persons with interest type, share, verification status (masked PII as returned).
   - **Risk factors**: score/100, top factors with points and the evidence rows (`GET /analytics/risk?projectId=`),
     labelled "Risk score (advisory) — heuristic, not a legal finding".
   - **Documents**: versions (supersedes chain), attestation (who, declaration version), download, anchor badge.
   - **Legal**: cases on the parcel; stay blocks possession.
   - **Payment**: entitlements, disbursements, acknowledgement method; MOCK badge on payment refs.
   - **Families**: affected families on the parcel → `/families/[id]/money`.
   - **Field photos & GPS**: vertex list with accuracy, captured vs synced time, photo thumbnails, walked track.
   - **QR**: QR to Ishan's public page `/verify/parcel/<id>` (he ships it 2 Oct evening; render the QR now).
2. Land registry tab (`/project/[id]/parcels` list view and `/gis` list toggle): UX4G Table — parcel ID (mono),
   survey no. (bold), village/taluk, affected area (`formatArea`), land class, status, payment Tag, risk Tag
   "MEDIUM — 48/100", locate-on-map icon, "View 360°". Filter bar = same filters as A2. Cursor pagination
   (`?cursor=&limit=`; add to the parcels endpoint if missing). KPI strip above: total parcels, area, high risk,
   payments pending, legal stays.

## A4 — Field officer GIS workspace · 3 Oct, by 13:00
Route `/field-office` for TEHSILDAR, DILR, FIELD_OFFICER (and LAO read-only):
1. New API in `apps/api/src/field`: `GET /field/surveys?status=submitted|verified|returned&projectId=` (list with
   parcel, surveyor user + post, submitted time, plausibility flags, vertex count), `GET /field/surveys/:id` (vertices,
   photos, track, JIR items, pillars, s.12 notice), `POST /field/surveys/:id/return {reason}`.
2. UI: left = work queue (Tabs: To verify, Returned, Verified) with flag Tags; centre = map of the selected survey
   (walked polygon vs recorded parcel, vertices numbered and coloured by accuracy, photo pins, track line);
   right = verification panel: per-vertex accuracy + photo, plausibility results (IMPLAUSIBLE_SPEED, CLOCK_SKEW,
   PHOTO_FAR, OUTSIDE_ASSIGNMENT, SUSPICIOUS_FIX), recorded vs field area + diff %, s.12 notice, JIR items.
   Buttons: **Approve** (`POST /parcels/:id/verify`; override reason textarea becomes required when any flag
   exists), **Return to surveyor**, **Request correction** (`POST /parcels/:id/corrections`); a different post decides
   corrections (`POST /parcel-corrections/:id/decide`) in a "Corrections to decide" tab with v1 → v2 geometry diff.
3. "Assignments" map tab: assigned parcels per field officer; "Open field app" button → `/field`.
**Done when**: a survey synced from the phone appears in "To verify", a flagged one cannot be approved without an
override reason, approval turns the parcel VERIFIED and its anchor badge appears.

## A5 — Field app + money screens restyle · 3 Oct, before 18:00
1. `apps/field`: add `ux4g-web-components`; import CSS once in `src/main.tsx`; cache it in the service worker
   (`src/sw.ts` precache). Restyle Login, Assignments, Walk & Mark (large touch targets ≥ 48 px, accuracy Badge
   green/amber/red), Notice, Inspection, Review, Sync status with UX4G. Offline flow must still work (airplane mode test).
2. Portal money screens (`/project/[id]/award`, `/project/[id]/families`, `/families/[id]/money`,
   `/families/[id]/passbook`, `/project-parcels/[id]/possession`): UX4G layout with navy hero + KPI cards
   (assessed, sanctioned, disbursed, **acknowledged**, unconfirmed, held, deposited) and tables; **MOCK** Badge next to
   every payment reference, identity check and OTP; hold reason only where the API returns it; possession gate shows
   each failing condition as an Alert row.

## Checks before every push
`pnpm lint && pnpm typecheck && pnpm test && pnpm rules:check` (+ `pnpm test:db` if SQL changed); field app offline
test after A5; maps tested with the API down (graceful empty state) and with no internet (PMTiles fallback).
