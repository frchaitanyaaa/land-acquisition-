# Test report — 4 Oct 2026 (submission day)

Run against `main` in production mode: `next build` + `next start`, API from `dist/`, Postgres/PostGIS with the
seeded demo dataset (`DEMO_NOW=2026-12-10T10:00:00+05:30`), Hardhat chain node with `AnchorRegistry` deployed and
anchoring live. Browser checks use Playwright/Chromium at 1366×900 (and 390×844 for phone layout).

## 1. Automated gates

| Gate | Result |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm test` (unit, all packages) | ✅ |
| `pnpm rules:check` (golden statutory test + forbidden-literal scan) | ✅ |
| API e2e (`pnpm test:e2e:api`, fresh `db:reset`, CI settings) | ✅ 27/27 (5 new: trust center, public chain summary) |
| Portal production build | ✅ |

Note: e2e needs a freshly reset database and must not share Redis with a running API (that API's workers take
the test's OCR/annuity jobs). CI does both correctly.

## 2. Page crawl (every sidebar page, every harmless button)

16 roles, 216 page visits, each page opened and every non-destructive button/tab/select inside `<main>` clicked.
A page fails on any uncaught page error, console error or HTTP ≥ 500.

| Finding | Fix |
|---|---|
| `/national`, `/gis`, `/project/:id/parcels`: console `Bad response code: 404` for `/tiles/demo-region.pmtiles` when the satellite basemap is unreachable and the map falls back to the offline basemap, which isn't installed | `BaseMap` checks once whether the PMTiles file exists; if not, it skips that layer and shows "Offline basemap not installed — map layers only" |
| Landing page Copy buttons threw when the browser denied clipboard access | Errors caught; the text stays visible to copy by hand |
| Most roles landed on `/session` after sign-in | LAO → collector desk; Tehsildar/DILR/field officer → field office; other posts → GIS map |

After fixes: all pages load with no page errors.

## 3. Operations (targeted flows)

| Flow | Result |
|---|---|
| Landing: all 17 evaluator accounts → "Sign in →" → login prefilled → correct home screen | ✅ (`demo` gets the post chooser) |
| National dashboard: breach alerts, gap tile, alert → project timeline | ✅ |
| MH-PSX timeline: "34 days" s.19 countdown, action panel with guard reasons | ✅ |
| Collector dashboard, GIS map + colour-by, parcels, award, families, family money page | ✅ |
| Rule packs (VERIFY banner), intake wizard step 1 (13 fields) | ✅ |
| Field office queue (Tehsildar), field app `/field` loads | ✅ |
| Session post switch (`demo`) | ✅ |
| Ask AI: suggested question and typed question, answers carry MOCK badge | ✅ |
| Trust center: node live, ledger paging/filters, Check → ✓ Verified, QR → public page | ✅ |
| Audit log: Verify audit chain → "Chain intact"; Collector sees "Oversight posts only" and no sidebar link | ✅ |
| Public `/verify/:type/:id` (signed out, phone width): "Proof confirmed on the blockchain"; unknown ID → "No blockchain proof" | ✅ |
| `pnpm demo:tamper` → Verify shows MISMATCH; reverting the edit → VERIFIED | ✅ |
| Citizen portal: search Khed Shivapur → parcels; notices; objection page | ✅ |
| Grievance (MOCK): file → tracking number → `/portal/track` shows "Filed" | ✅ |
| Login rate limit: 11th login within a minute from one IP is refused (§29, by design) | ✅ expected |

Backend operations (workflow transitions, maker-checker, RETURN reason codes, hearings nullify/repeat, PPP consent
tally, award OCR review → entitlements, annuity scan, GIS scope) are covered by the API e2e suite above.

## 3b. Second round (afternoon, after Chaitanya's review)

| Issue reported | Fix | Verified |
|---|---|---|
| Several login cards led to the same screen (two "State view") | One list of 8 accounts (`lib/demo-accounts.ts`), each role lands on its own screen | All 8 sign-ins land on 8 different paths |
| Landing page overloaded | Hero with 3 tiles, six one-line innovations, login sheet, one footer line | Desktop + phone screenshots, no overflow |
| 7 faded "Soon" sidebar items | State/District dashboards, Proposals, Objections, Deadlines & alerts, Analytics, Reports built on existing APIs | Crawl: 80 visits, 4 roles, 0 problems |
| Ask AI answered "todays date" with the KPI overview | Date → statutory clock; unrelated → what it can answer; overview only when asked | 3 new e2e tests (API e2e now 30/30) |
| Stage status could not be updated | Action panel shows blocked reasons + who acts; checklist rows: Upload & attest, escrow steps, Decide objections | Browser: MH-PSX S07 → S08 via LAO + Collector |

## 4. Known gaps (not fixed today)

- Officer screens are English only. The हिं / मरा switch in the officer top bar sets the language for the public
  token pages (acknowledgement, enrolment, passbook); `/portal` has its own language switcher (en/hi/mr).
- No offline basemap file (`data/tiles/demo-region.pmtiles`) is committed; the map needs internet for satellite.
- Not exercised in the browser today (needs a phone or a mocked camera): WebAuthn fingerprint acknowledgement,
  field Walk & Mark with GPS. Their API paths are covered by e2e; run them by hand (MANUAL-TEST-CHECKLIST.md §4).
- Seed anchors cover payments, acknowledgements, possession and awards. Parcel verification and stage approvals
  are anchored when an officer performs them during the demo.
- An account locks for 15 minutes after 5 wrong passwords (§29). An evaluator mistyping can lock a shared demo
  account; the landing page "Sign in →" buttons prefill the password to avoid this.
