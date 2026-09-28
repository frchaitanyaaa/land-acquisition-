# Prompt 05 — Portal: Money/acknowledgement views, public portal, passbook, rule pack viewer (demo beats 6–8)

## Context
Modules F/G/H/I (award/OCR review, entitlements, disbursement, WebAuthn enrol/ack, possession gate, legal cases,
compliance) and the public-facing endpoints (`apps/api/src/public`, over `public_*` views per G22) are already
built server-side. Nothing in the portal or a public route currently shows a family's money, lets anyone review an
OCR-extracted award, drives possession, or renders the rule-pack diff. This prompt covers the remaining demo beats
(6, 7, 8) plus the public portal (§25) and passbook, which the money views depend on for the acknowledgement loop
to be demoable end-to-end.

## What to build

### Award review + signing (§20, feeds beat 6)
1. `apps/portal/app/(dashboards)/project/[id]/award/page.tsx` — upload the award PDF (reuse the attestation upload
   component from prompt 02), then the **OCR review screen** (§20 "the most important screen in this module"):
   PDF on the left with highlighted bbox per suggested field, suggested fields greyed on the right, **Accept**
   per field (or edit) — never a bulk auto-accept. Show `runChecks` results (`GET /awards/:id/checks`) inline:
   solatium ≠100% flagged, SC/ST ⅓ flagged, factor-range flagged, below-minimum heads flagged — as warnings next to
   the relevant field, not a separate disconnected list.
2. Valuation-inputs panel (§20) — display-only officer-entered benchmarks and department valuation reports; make
   it visually obvious this panel computes nothing (no "suggested total," no highlighting of a "best" value) per
   G1 — the LAO enters final figures elsewhere.
3. Sign action — goes through the same generic action-panel component built in prompt 02, not a bespoke button.

### Family money + acknowledgement loop (§21, the lead innovation, beat 6)
4. `apps/portal/app/(dashboards)/families/[id]/money/page.tsx` — `GET /families/:id/money`
   (`v_family_money` + interest estimate), showing per-head status (assessed/sanctioned/disbursed/acknowledged),
   the estimated s.80 interest labeled exactly "Estimated interest liability (s.80)" (G2), and the enrolment/ack
   QR-link generation buttons (`POST /persons/:id/webauthn/enrol-link`, `POST /disbursements/:id/ack-link`) that
   render a QR code on screen for the beneficiary's own phone to scan — never attempt the WebAuthn ceremony from
   the officer's session (§21.2 explicitly forbids this).
5. Hold/dispute visibility — hold reason only renders for viewers whose level is in `FIELD_VISIBILITY`'s allowed
   list for `disbursement.holdReason` (§11.4) — since the API already redacts this server-side, just render
   whatever key is present in the response; don't add a second client-side permission check that could drift from
   the server's redaction map.
6. Possession screen — `GET /project-parcels/:id/possession-gate` rendered as a checklist (which conditions pass/
   fail per §12.6), `POST /project-parcels/:id/possession` disabled until the gate passes, with the exact failure
   reasons shown when it doesn't.

### Role switcher + public portal (§25, beat 7)
7. Add a role/post switcher to the portal shell (if prompt 01–04 didn't already need one) using
   `POST /auth/switch-post` — needed to demonstrate the Collector → Public contrast live.
8. `apps/portal/app/(public)/` route group — separate layout, no auth: village+survey-number search
   (`public_parcel_status`), published notices (`public_notices`), the passbook page (`GET /public/passbook/:token`),
   the acknowledgement page (`GET /public/ack/:token` + WebAuthn/OTP/dispute flows — this is what the beneficiary's
   phone actually opens, so it must work standalone without the officer's session), and "file an objection" during
   an open window. Footer provenance note exactly as specified in §25. en/hi/mr switcher using next-intl.

### Rule pack viewer (§12, beat 8)
9. `apps/portal/app/(dashboards)/rule-packs/page.tsx` — render a resolved pack (stages, clocks, consent
   thresholds, checks) from whatever read endpoint already exposes `packages/rules`' resolved pack data, and a
   side-by-side or toggled comparison between `larr-2013-maharashtra@1.0.0` and `nh-act-1956@1.0.0` showing
   different stage codes/clocks for the same engine. Render the pack's `verify[]` array prominently wherever
   present (§12.4 — "The pack viewer must render `verify[]` prominently so nobody presents placeholder values as
   law") — this is a hard requirement, not a nice-to-have.

### Passbook (§19)
10. `GET /families/:id/passbook` (officer-facing) and `GET /public/passbook/:token` (beneficiary-facing, single-use
    session token / QR) — heads, amounts, status per head with acknowledgement state, due dates, site allotment,
    contact info. Never render hold reasons on the public passbook (§19 explicit).

## Shared components to reuse, not rebuild
Action panel (prompt 02), `<BaseMap>` (prompt 03), `<ChainBadge>` (prompt 03), attestation upload modal (prompt 02).

## Done when
The seeded "disbursed, not acknowledged" demo family (§33.6) shows correctly on the money view; scanning its
ack-link QR on a second device and completing the WebAuthn/OTP flow flips the row to acknowledged and the national
gap tile updates; switching from Collector to Public role hides the hold reason and shows only "payment in
process"; the rule-pack viewer visibly shows different stages for the Maharashtra pack vs the NH Act pack with
`verify[]` warnings rendered — matching demo beats 6, 7, and 8.
