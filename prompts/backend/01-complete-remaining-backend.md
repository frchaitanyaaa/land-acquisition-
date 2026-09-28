# Prompt — Complete the remaining backend gaps against CLAUDE.md

## Context
`apps/api` (auth/RLS, ClockService, audit hash-chain, outbox, rule engine, Modules A–J, trust layer, documents,
notifications, AI assistant) is ~90% built and runs cleanly against the seeded demo dataset. The gaps below are the
concrete, verified shortfalls against the CLAUDE.md spec — everything else in §5/§12–§31 is already implemented.
Read the cited CLAUDE.md sections and the cited existing files fully before writing any code; match existing
conventions (job registration style, adapter interface shape, test file naming) rather than inventing new ones.

Do all five in one pass, in the order below — later items depend on earlier ones being stable (the e2e suite in
item 4 should exercise the OCR and annuity changes from items 2–3; item 5's translations should cover whatever
reason codes items 1–4 don't add).

## 1. STT pipeline for hearing audio → objection tickets (§17, §30, §31)
`apps/api/src/adapters` has no `stt/` folder and `apps/api/src/jobs` has no `stt` job, despite §17 specifying that
hearing audio is transcribed and split into `objections` tickets with AI-suggested `ground`/`category` (G3: AI
writes only to `ai_suggested_*`, never authoritative columns).

- Add `apps/api/src/adapters/stt/stt.adapter.ts`: interface, `MockSttAdapter` (returns a fixed, committed demo
  transcript — add `data/demo-docs/hearing-audio-transcript.json` if missing, `data_source: SYNTHETIC_DEMO`), and a
  `RealSttAdapter` stub throwing `NotImplementedException`. Select via `STT_PROVIDER`. Mock results carry
  `provider: 'MOCK'` (G7). Register in `adapters.module.ts`.
- Add `apps/api/src/jobs/stt.service.ts`: `stt` BullMQ queue, concurrency 1, triggered by `POST /hearings/:id/audio`
  upload (already listed as an endpoint in §17 — check whether it exists as a stub and wire it, or add it if
  missing). Store the transcript against the hearing per the existing `hearings` schema in `packages/db/src/schema`
  (do not add new columns without checking what's already there).
- Add a service method that splits the transcript into segments, creates one `objections` row per segment
  (`channel: 'hearing_audio'`, `transcript_document_id` set), and reuses the existing AI triage already built for
  Module D objections (find it under `apps/api/src/consent` or `apps/api/src/notice` — do not duplicate triage
  logic) to pre-fill `ai_suggested_ground`/`ai_suggested_category`.

## 2. Decouple award OCR from the request path into a real background job (§26.3, §31)
OCR currently runs inline inside `apps/api/src/award/award.service.ts` (confirmed the only file referencing OCR
logic) instead of as the `ocr` BullMQ queue (concurrency 2) §31 specifies.

- Read `award.service.ts` fully to find the exact `pdf-parse` → `tesseract.js` fallback → field-extractor logic and
  what it writes into `ocr_extractions`.
- Move it into `apps/api/src/jobs/ocr.service.ts`, following the same processor-registration pattern already used
  by `payment-status.service.ts` or `mv-refresh.service.ts`.
- `POST /projects/:id/awards` should store the document (existing `apps/api/src/documents` pipeline), enqueue the
  `ocr` job, and return immediately with `ocr_extractions.status = pending` — never block the HTTP response on
  OCR completion. On failure, retry with backoff matching `apps/api/src/jobs/anchor.service.ts`'s convention.
- Verify `GET /ocr-extractions/:id` still correctly reports status/progress, and that
  `POST /ocr-extractions/:id/review` is unchanged — it must still only create `entitlements` from human-accepted
  fields (G3).

## 3. Add the missing daily `annuity-scan` job (§31, §23, §28)
`apps/api/src/compliance/compliance.service.ts` has annuity read-side logic but no scheduled job flips
`annuity_schedules.status` to `missed`, and `ANNUITY_MISSED` never fires automatically.

- Read `compliance.service.ts` fully to see what already exists vs. what's missing.
- Add `apps/api/src/jobs/annuity-scan.service.ts`: scheduled daily (match `deadline-scan.service.ts`'s
  registration pattern), finds `annuity_schedules` rows with `status='scheduled'` and `due_on < ClockService.now()`
  (Asia/Kolkata, per G17 — never `new Date()`, per G16) with no successful linked disbursement, sets
  `status='missed'`, and triggers `ANNUITY_MISSED` to the Administrator R&R post (§28) via whatever notify
  mechanism `deadline-scan.service.ts` already uses.
- Must be idempotent (§31) — running twice in a day must not double-notify; dedupe per `annuity_schedules.id` the
  same way `deadline-scan.service.ts` dedupes on `(trigger, entity, level)` (§28).
- Register in `jobs.module.ts`.

## 4. API e2e (Supertest) happy-path suite (§32.5)
No end-to-end suite currently drives the real HTTP API through a full statutory workflow — only narrow unit tests
exist under `apps/api/test/`. Build `apps/api/test/e2e/` covering, against a real test Postgres and real
`/auth/login` (not a bypass), so RLS and guards are genuinely exercised:

- Full GOVERNMENT project S01 → S10 via the generic `POST /projects/:id/stages/:code/actions` endpoint (§13).
- RETURN with a valid §12.7 reason code (and confirm the guard blocks a missing one), then resubmit and approve.
- Hearing NULLIFY (invalid hearing per §17's validity rules) → new attempt → valid completion.
- PPP consent: one run crossing 70% (APPROVE), one run below 70% at close (`TERMINATE`/`THRESHOLD_NOT_MET`).
- Award upload → OCR review (accept fields) → sign (maker-checker) → disburse (mock payment) → acknowledge
  (WebAuthn test helpers or OTP fallback, whichever is easier to drive headlessly) → possession, asserting the
  gate (§12.6) only passes once payment + acknowledgement + R&R conditions are satisfied.

Wire into `pnpm test:e2e` (check `package.json` for the existing script name before adding a new one) and into
`.github/workflows/ci.yml`, gated the same way the existing `db` job's Postgres/Redis services are set up.

## 5. Reason-code i18n labels + PDF export for MIS reports (§12.7, §24.4)
- `packages/shared/i18n/reason-codes.{en,hi,mr}.json` do not exist. Extract every `reasonCodes` value across every
  stage action in `packages/rules/packs/*.json` (do not hand-retype §12.7's table — read it from the packs so
  labels can never drift from what the engine accepts) and add one label per code per locale, marking hi/mr entries
  with the existing `needs_native_review` convention (grep how it's applied elsewhere, e.g. `declarations.ts`).
  Add a completeness test (every reasonCode has a label in all three files) wired into `pnpm rules:check` or
  `pnpm test`.
- Read `apps/api/src/dashboards/dashboards.controller.ts` and its service fully to check whether
  `GET /reports/:type?format=pdf` is implemented for all five report types in §24.4 (project progress, compensation
  register, R&R status, deadline compliance, district comparison). Implement whatever's missing, reusing the same
  query/aggregation the CSV path already uses, reusing an existing PDF-capable dependency if one is already in
  `package.json` before adding a new one. PDF export must respect the same RLS/redaction scoping as CSV (G13) — no
  additional data leakage relative to the CSV export of the same report.

## Deliverables checklist
- [ ] STT adapter + `stt` job + hearing-audio → objection-ticket pipeline working end-to-end on the mock transcript
- [ ] OCR runs as an async `ocr` job; award upload returns immediately; review/sign flow unchanged
- [ ] `annuity-scan` daily job flips missed instalments and notifies exactly once each
- [ ] `apps/api/test/e2e/` suite covers all §32.5 scenarios, wired into `pnpm test:e2e` and CI
- [ ] `reason-codes.{en,hi,mr}.json` complete with a drift-detection test; MIS `format=pdf` implemented for all 5 report types
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm rules:check` all green
