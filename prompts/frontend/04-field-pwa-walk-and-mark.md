# Prompt 04 — Field PWA: login, assignments, offline pack, Walk & Mark, sync (demo beats 4–5)

## Context
`apps/field/src/App.tsx` is currently only a "Phase 0 shell" (its own code comment) — an online/offline indicator
and a health-check ping, nothing else. §16 specifies the full field PWA. The server side is already built and
confirmed working: `apps/api/src/field` has assignments, offline-pack, sha256-checked photo upload, ordered
idempotent sync ops, and server-side plausibility checks (`packages/geo/src/plausibility.ts`, already tested).
This is the riskiest, highest-value piece of the whole remaining build — beats 4 and 5 of the demo depend entirely
on it, and it's the only client surface touching camera/GPS/offline storage. Build it in the sub-order below;
each sub-step should be independently demoable before moving to the next.

## Hard constraints (§16.1 — do not skip)
- Requires HTTPS on a real phone (geolocation/camera/WebAuthn need a secure context); `localhost` only works on a
  laptop. Development on a phone requires `pnpm demo:tunnel` — build and test assuming this, don't assume
  `localhost` will ever work on-device.
- **In-app camera only** — `getUserMedia` + canvas capture. No `<input type="file">`, no gallery picker. Photos
  have no EXIF; location comes from the geolocation API at capture instant, not photo metadata.
- Offline-first — everything captured goes to IndexedDB (Dexie) first, uploaded later. Never assume network is
  present mid-capture.
- Do not bulk-cache OSM tiles (§16.5) — the basemap is the PMTiles file at `TILES_PMTILES_URL`, rendered with
  `protomaps-leaflet`, cached via Workbox range requests. Satellite imagery is portal-only, never here.

## Build order

### 1. Login + assignments (§16.2 screens 1–2)
- Login form → `POST /auth/login`, cache access token in memory + refresh via httpOnly cookie/refresh flow (match
  whatever the portal's login already does in `apps/portal/app/login/login-form.tsx` — same auth contract, don't
  invent a second one).
- Assignments list — `GET /field/assignments`, each with a "Download offline pack" button.

### 2. Offline pack + Dexie schema (§16.2 screen 3, §16.3)
- `GET /field/assignments/:id/offline-pack` → cache assignment, project footprint, village boundaries, existing
  parcel geometries, JIR item types, reason codes into Dexie tables exactly as named in §16.3:
  `assignments, offlinePacks, surveys, vertices, photos (Blob + sha256), jirItems, pillars, outbox`.
- Set up `vite-plugin-pwa` (Workbox) to cache the PMTiles basemap file for offline use per §16.5.

### 3. Walk & Mark (§16.2 screen 4 — the core screen, demo beat 4)
- Map: footprint, existing parcels, live position dot + accuracy circle (Leaflet + react-leaflet, same
  `preferCanvas: true` convention as the portal maps).
- Accuracy badge: green ≤10m, amber ≤`gpsAccuracyWarnM`, red above — these thresholds come from the resolved rule
  pack (`packages/rules`, already exposes `thresholds.gpsAccuracyWarnM`/`gpsAccuracyRejectM`) — fetch them, never
  hardcode (G8 applies to the client reading these values too, even though the literal-scan CI check is
  server/packages-only per §32.3).
- "Mark Point": hold-to-average for 5s — collect fixes via `watchPosition({enableHighAccuracy:true, maximumAge:0})`,
  weight by `1/accuracy²`, then open the in-app camera, capture a photo, save the vertex with its photo into Dexie.
- Undo last point; running polygon; live area estimate via `@turf/turf` (label it "estimate" in the UI — §4 says
  client geometry is for live feedback only, server is authoritative); self-intersection warning via turf `kinks`.
- "Close polygon" once ≥3 points captured.
- Record the walked track continuously (`track` geometry) while this screen is open.

### 4. s.12 notice, JIR, pillars, review, submit (§16.2 screens 5–8)
- s.12 notice: date served + photo of the notice, saved to Dexie.
- Joint Inspection: add JIR items (type from the cached offline-pack's item types, description, quantity, unit,
  photo); boundary pillars (number + photo).
- Review: summary screen showing locally-computed flags (accuracy, too-few-points, kinks) before submit.
- Submit: queue the whole survey into the `outbox` table for sync.

### 5. Sync (§16.2 screen 9, §16.4)
- `Sync now` button is mandatory (§16.4 — iOS Safari has no Background Sync, don't rely on it as the only path,
  though Background Sync can be attempted where supported).
- Photos upload first via `POST /field/photos` (multipart, with sha256/lat/lng/accuracy/capturedAt) — the server
  recomputes sha256 and rejects mismatches, so surface that rejection clearly in the UI rather than retry-looping.
- Then `POST /field/sync` with `{ ops: [...] }` in order: `CREATE_SURVEY, ADD_VERTEX, ADD_JIR_ITEM, ADD_PILLAR,
  SUBMIT_SURVEY`, each carrying its own `idempotencyKey` (already required server-side per §13 — the field sync
  endpoint specifically requires it).
- Sync status screen: queued / uploading / synced / rejected (with the server's reason).

## Done when
On a real phone over `pnpm demo:tunnel`, in airplane mode: log in (while still online, beforehand), mark 4 corners
with photos, add 2 JIR items, submit. Turn airplane mode off, press Sync. The parcel appears on the portal's
parcel map (prompt 03) with vertex photos within seconds, and the accuracy/plausibility flags computed server-side
match what was shown locally — matching demo beats 4 and 5.
