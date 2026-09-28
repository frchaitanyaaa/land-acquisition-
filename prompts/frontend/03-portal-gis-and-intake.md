# Prompt 03 — Portal: Proposal intake wizard + GIS parcel map (demo beat 3)

## Context
Module A (intake, alignment upload, pre-scrutiny) and Module B (intersection, parcel GeoJSON with colour-by,
chainage, flags, verification, maker-checker corrections) are both fully built server-side — confirmed by the
seed script producing 1510 parcels with real intersections, flags, and colour-by data already computed. Nothing in
the portal currently uploads an alignment, shows a parcel map, or lets an officer verify a parcel. This is demo
beat 3: "The law checks the map before anyone drafts a notice" — s.10 irrigated multi-crop and s.41 scheduled-area
flags firing, plus the cross-project overlap warning.

## What to build

### Intake wizard (§14 "Screens": New proposal wizard)
1. `apps/portal/app/(dashboards)/projects/new/page.tsx` — multi-step: Details → Alignment → Documents →
   Pre-scrutiny results → Submit.
   - Details: name/name_local, category+sub-category (§39.1 — pull the full list from a shared constant, don't
     hardcode a partial list), acquisition type, requiring body, national importance, estimated budget (₹→paise
     conversion using the exact-decimal parser already built in `packages/shared`, never `parseFloat`), total land
     required, target districts/villages (LGD pickers — `GET` from whatever LGD reference endpoint/table already
     exists), linear yes/no, ROW width.
   - Alignment: file upload (`.kml`/`.kmz`/`.geojson`/`.zip` shapefile) to `POST /projects/:id/alignment`, then
     render the parsed geometry preview on a Leaflet map (protomaps-leaflet + PMTiles per §16.5/§4 — same basemap
     setup as the national dashboard's map, factor out a shared `<BaseMap>` component rather than duplicating
     Leaflet setup).
   - Documents: use the same attestation upload component built for the workflow prompt (document upload +
     `ATTEST_V1` modal) — don't rebuild it here.
   - Pre-scrutiny: `POST /projects/:id/prescrutiny` → render the checklist result, including the
     national duplicate-footprint overlap warning (list overlapping projects + overlap area) and constraint-layer
     spatial warnings (§15.5).
   - Submit: `POST /projects/:id/submit`.

### GIS parcel map (§15.7, §15)
2. `apps/portal/app/(dashboards)/project/[id]/parcels/page.tsx` — `GET /projects/:id/parcels?colorBy=stage|payment|risk`
   returning GeoJSON, rendered on the shared `<BaseMap>` with a colour-by switcher (three modes exactly as named in
   §15.7). Click a parcel → side panel with `GET /parcels/:id` (parcel + versions + vertices + photos + interests +
   chain status).
3. Chainage strip (linear projects only, §15.7) — `GET /projects/:id/chainage?binM=500`, 500 m bins coloured by
   worst status in each bin; clicking a bin filters the parcel list/map to that bin.
4. Flags panel — `GET /projects/:id/flags`, list of s.10/s.41/overlap/outside-village flags with an acknowledge
   button (`POST /flags/:id/acknowledge`).
5. Parcel verification screen (§15.3) — for a selected parcel: photos per vertex, GPS accuracy per vertex,
   plausibility flags (§15.6, already computed server-side — just render them, don't recompute), recorded-vs-field
   area, s.12 notice status. `override_reason` becomes a required field in the UI whenever any flag is present.
   `POST /parcels/:id/verify`.
6. Corrections (§15.4) — a "Request correction" action that opens `POST /parcels/:id/corrections`, and a
   maker-checker approval screen for a different-post reviewer (`POST /parcel-corrections/:id/decide`), showing the
   version lineage (v1 → v2) and each version's chain-anchor badge.

## Chain badges (§27.4)
Any parcel, award, acknowledgement, or possession record on screen should show the anchor status badge —
`✓ Anchored · block #N` / `⏳ Proof pending` / `✗ Mismatch — record differs from anchored version` — sourced from
`GET /chain/verify/:entityType/:entityId?version=`. Build this as one shared `<ChainBadge>` component now since
prompts 04–05 will reuse it on award/disbursement/possession screens.

## Done when
Uploading a KML for a test alignment shows it on the map with an overlap warning against a seeded project;
opening the demo corridor's parcel map shows ~200 intersected parcels colour-coded, with s.10/s.41 flags visible
on the correct parcels and the chainage strip working; verifying a parcel with a flag present blocks submission
until `override_reason` is filled — matching demo beat 3 (and most of beat 5 once chain badges are wired).
