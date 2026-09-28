# Prompt 02 — Portal: Project header, stage timeline, generic action panel (demo beat 2)

## Context
The workflow engine and its generic action endpoint (§13) are fully built server-side:
`POST /projects/:projectId/stages/:stageCode/actions` and `GET /projects/:projectId/stages/:stageCode/actions`
(the latter returns available actions with guard results, specifically so the UI can show disabled buttons with
the failure reason — §13). Nothing in the portal currently renders a project, its stages, or lets anyone act on
one. This is demo beat 2: clicking the worst breach alert opens `MH-PSX`'s timeline and shows "Declaration lapses
in 34 days — s.19, notification deemed rescinded" with estimated interest liability.

## What to build
1. `apps/portal/app/(dashboards)/project/[id]/layout.tsx` — the shared project header (§14 "Project header"):
   code, name, pack badge (e.g. `larr-2013-maharashtra@1.0.0`), status, current stage, next deadline countdown.
   Source: `GET /projects/:id` (summary + current stage + KPIs) and `GET /projects/:id/deadlines`.
2. `apps/portal/app/(dashboards)/project/[id]/timeline/page.tsx` (§14 "screens") — stage instances +
   transitions from `GET /projects/:id/timeline`, rendered as a vertical/horizontal stepper through the 10
   statutory stages (or the pack's actual stage list — don't hardcode S01–S10, read `applicableStages` for this
   project's pinned rule pack, since `nh-act-1956` uses different stage codes per §12.5).
3. **Action panel** — the single most important reusable component in the whole portal, since §13 says "do not add
   bespoke 'approve X' endpoints" and every module reuses this one panel:
   - Call `GET .../actions` to list available actions with guard results.
   - Render each as a button; disabled buttons show the specific guard failure message (from `failures[].message`)
     on hover/tooltip — never just grey it out silently.
   - On click, open a form matching the action's shape (§13 request body): `reasonCode` (required for
     RETURN/REJECT/NULLIFY/TERMINATE, populated from the pack's reason codes for this stage — see
     `packages/rules/packs/*.json`, cross-reference §12.7's per-stage lists), `remarks`, `targetStageCode` (RETURN
     only), `writtenReasons` (OVERRIDE only, mandatory per s.8(2)/G-rule), `documentIds`, `conditions`
     (APPROVE_CONDITIONAL only).
   - POST to `.../actions`; on `422 problem+json` with `GUARD_FAILED`, surface `failures[]` inline, don't just
     show a generic error toast.
   - On success, refresh the timeline and the action panel (guards may have changed).
4. Deadline countdown component — reusable, used in the header and dashboards: relative countdown ("34 days
   left") plus the consequence text and section, from `packages/shared` date formatters (§9 Time conventions,
   `dd MMM yyyy` display, luxon-based, never hand-roll date math in a component).
5. Document upload + attestation modal (§26.2) — needed wherever a checklist item requires a document. Render the
   exact `ATTEST_V1` declaration text from `packages/shared/src/declarations.ts` (already built server-side —
   import the shared source of truth, don't re-type the legal text in the frontend).

## Data fetching
TanStack Query, with the action-panel's `GET .../actions` query invalidated after every mutation on that stage.

## Done when
Opening the demo corridor project (`MH-PSX-2026-001`) shows its real current stage (S07, per §33.6), a working
action panel whose available/disabled buttons match what `GET .../actions` returns, and the `DECLARATION` clock
countdown reading 34 days with its `DEEMED_RESCINDED` consequence text visible — matching demo beat 2 exactly.
