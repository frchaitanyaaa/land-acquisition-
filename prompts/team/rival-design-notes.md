# Rival design notes — what to borrow, what never to copy

Reference for all four briefs. Two rival SIH projects were reviewed from 25 screenshots:
**BhuDrishti** (batches 1–4 and part of 5) and **LAMS** (batch 5). Each section ends with
"Ours:" — the rule for how BhoomiSetu does it. Where a rival breaks one of our golden rules
(CLAUDE.md §1), the note says so. Copy their polish, never their shortcuts.

# Batch 1 (BhuDrishti) — shell, dashboards, project workflow, landing, login

## Shell / navigation
- Persistent left sidebar grouped into collapsible sections with item counts: Overview (National dashboard,
  State-wise dashboard, All projects, Proposals & sanctions), Land, Risk & Issues, Acquisition, Monitoring,
  Citizen records; each item has a one-line description under its label; "NEW" tags.
- Quick actions block at the bottom of the sidebar: Register new project, Ask AI, AI Voice.
- Top bar: brand + tagline ("From Land Records to Land Intelligence"), "NATIONAL PLATFORM" tag,
  global PROJECT context switcher (dropdown in the header), dark-mode toggle, "● Live" indicator,
  language switcher, notification bell, user chip with name + role, logout.
- Our take: sidebar nav + global project switcher + live indicator fit our SSE; use UX4G Navbar,
  Accordion/List for sidebar, Dropdown for project switcher, Badge for counts.

## Dashboards
- Dark navy hero banner per dashboard: title, subtitle, scope chip ("ACTIVE STATE SCOPE: Maharashtra ·
  10 projects · 1080 parcels"), state selector + refresh, overall acquisition progress bar with %.
- 8 KPI cards in a 4×2 grid, each: label, icon, big number + unit, sub-line with secondary metric
  coloured by meaning (e.g. Pending DBT in red, possession parcels, delayed projects in red).
- Below: "Project statutory stage distribution" (horizontal bars per stage with counts/%) and
  "Compensation disbursement breakdown" (by status with ₹ and parcel counts).
- Our edge to keep: real statutory clocks + consequences, acknowledged-vs-disbursed gap, interest
  liability — they don't show these. Their numbers look implausible (₹9416 Cr, 2240 ha) — ours must
  stay seed-consistent.

## Project workflow page
- Dark hero: project name, code chip, status chip (PLANNING), location breadcrumb (State → District ·
  Highway), "Switch project workflow" dropdown, two progress bars (stages done, statutory tasks done),
  "Current lifecycle step 4 of 12".
- "Recommended next action" card with AI sparkle icon, PRIORITY: CRITICAL tag, one-line reason,
  "Inspect step" + "Continue task" buttons → map to our availableActions + risk score (advisory, G3).
- Horizontal scrollable stepper of all stages (done/active/pending) — UX4G Stepper / Status Pipeline.
- Stage detail: "Stage 1 of 12", task completion 4/4, progress %, list of required tasks each with
  REQUIRED tag, responsible role, description, "Completed by <user> at <time>", "Open module" link,
  "Task completed" state. → map to our stage_checklist items (document/event/gate/hearing) with
  evidence links, and maker/checker names (actor user + post, G19).

## Landing page
- Hero: "Smart India Hackathon 2026 · Ministry Decision Support" pill, big headline, subline.
- Two big cards side by side: "Officer Portal — RESTRICTED" (bulleted capabilities, Officer Login
  button) and "Public Land Information Portal — OPEN ACCESS" (search land, track acquisition,
  compensation status, notices & orders, grievances & queries; Enter Public Portal button).
- Header: Citizen login, Officer login, dark toggle, EN/हिंदी/मराठी.

## Login page
- Single login point; tabs: Officer login / Citizen login / Sign up; email, password,
  "Position — departmental role" select, "Login as Officer"; header links to public portal + landing.
- They show "Supabase Cloud Active" backend banners — avoid exposing infra on a login page.
- USER REQUEST (decided): one login point for all officers with a **"Login as" role dropdown shown
  before email + password**. The server picks the user's active post with that role and rejects the
  login if they hold none, then sets it as `activePostId` in the JWT. The dropdown lists roles only,
  never a person's posts, and a client-picked role is never trusted on its own (G13/G19). Citizens use the separate Citizen tab (citizen accounts,
  phone + OTP — see 03-madhav.md).

## Tone
- Polished, card-based, generous whitespace, icon per KPI, coloured semantic sub-metrics, dark hero
  banners. Ours must reach this polish with UX4G + navy/saffron tokens, no State Emblem.

# Batch 2 (BhuDrishti, 5 screenshots) — GIS map, land parcels, proposals

## GIS map page (Land → GIS Map, "Live" tag)
- Breadcrumb: Back to project workspace · Projects › <project> › Open GIS map; corridor label top-right
  ("Pune → Mumbai (100 m corridor)").
- Dark navy toolbar card above the map: project dropdown, BASE layer switch (Satellite (Esri)),
  COLOR LAYER dropdown ("1. Land acquisition status", others), search box (survey #, parcel ID),
  toggle chips: Labels / Corridor / Alignment, selected-parcel chip (e.g. "Survey #109/2B (High risk)"),
  refresh, fullscreen.
- Map: satellite basemap (Esri World Imagery, attribution shown), corridor buffer drawn as a band,
  alignment line, survey-number labels as dark pills with coloured status dot, Start/End markers
  ("Start: Pune" A, "End: Mumbai"); auto-fit to corridor.
- Floating legend card bottom-left with counts per class (Low 22 / Medium 7 / High 4 / Critical 2,
  Selected land, Total 35).
- Click parcel → right-side detail drawer over the map: parcel ID, "Survey #133/2B", risk chip
  "15/100 (Low risk)", area in ha, key-value list (village & district, land owner, acquisition status,
  payment status chip, legal status, suitability score, GIS spatial source "BhuNaksha cadastral"),
  then a risk score card (LOW RISK 17/100).
- Our version (decided): the officer portal opens on Esri satellite (online, attribution shown) with a
  toggle to the offline PMTiles map; the field phone app uses PMTiles only; colour layers = our colorBy (stage/payment/risk) + constraint layers (s.10/s.41,
  forest, water) + village boundaries; labels only at high zoom; drawer = UX4G Drawer (right);
  NEVER claim BhuNaksha/real cadastral source — label MOCK cadastral adapter (G7). Our parcels are
  real polygons (theirs look like a buffered line) — show polygons, chainage, partial % affected,
  chain-anchor badge, vertex photos.
- Sidebar Land group: Land parcels, GIS map, Multi-factor land suitability, Alternative land
  comparison, Field survey.

## Land parcels registry page
- Dark hero: "Land Parcels · CADASTRAL REGISTRY" tag, selected-project chip, location, total; Refresh.
- 5 KPI tiles inside hero: total parcels, land area (ha), high risk (score ≥ 60), payments pending
  (DBT pending), legal issues (petitions/stays) — tinted per meaning.
- Filter bar: search, project, risk, acquisition status, payment status, legal status, village,
  Clear filters.
- Table: land ID (mono), survey no (bold), village/taluka (two lines), area ha (blue), land type,
  acquisition status, payment status chip, risk chip "MEDIUM — 48/100", locate-on-map icon, View details;
  pagination "Showing 1 to 1 of 1", Previous/Next.
- Ours: UX4G Table + Tag + Pagination + Dropdown filters; server-side cursor pagination (§9);
  area via formatArea (ha · acre · guntha); risk = our transparent score with top factors.

## Proposals & sanctions page
- Dark hero "Acquisition proposals & clarification workflow" + prominent saffron/yellow
  "Submit new proposal" CTA.
- Tabs with counts: All (4), My proposals, Under review (2), Clarification required (1),
  Approved & created (1); search + state filter.
- Proposal cards grid: PROP id, status tag (Under review / Clarification required / Approved),
  title, requiring body, location, land requirement (ha), estimated cost (₹ Cr), type, "By <name>",
  "Details & actions".
- Ours: maps to S01 (DRAFT/SUBMITTED, RETURN with reason codes = "clarification"), generic action
  endpoint; saffron = our secondary token for the primary CTA accent.

# Batch 3 (BhuDrishti, 5 screenshots) — documents/OCR, record verification, 360° parcel view

## Acquisition sidebar group
- Acquisition cases (statutory milestones, hearings), Compensation & payments (DBT, awards, escrow),
  Objections & disputes (petitions, court stays, grievances), Documents & versions ("vControl" tag:
  repository, version timeline, OCR), R&R support.

## Documents: two tabs — "Document repository & version control" and "Statutory OCR extraction &
## cadastral verification"; breadcrumb Operations → Documents → Document → Version history
- Dark hero "Statutory document intelligence & cadastral verification" + saffron "Extract & Verify" CTA.
- "1-click verification" sample-document cards: doc type title, short description, survey no, area,
  result chip "Clean match (0.00 ha)" (green) or "Discrepancy: +0.30 ha" (red).
- Upload card: accepted types/size, category dropdown (7/12 extract …), file row with type/size/date,
  Replace / Remove.
- Review view: scanned document preview left (7/12 fields: village, survey/gat, hissa, title holder,
  tenure, area highlighted, pot kharaba, assessment, mutation no, linked parcel ID, stamp),
  "OCR confidence 94% HIGH · engine name" footer; right pane: "Extract & verify" → query records
  for the extracted survey no, or "Select parcel manually" dropdown.
- Ours: exactly our §26.3 + §20 OCR review (PDF left w/ bbox highlight, per-field Accept, mismatch
  warnings, never auto-resolve) — extend from awards to 7/12 / s.11 docs; area discrepancy vs
  recorded/field area = our AREA_MISMATCH. Show version timeline (supersedes_id) + attestation (G21)
  + chain badge per version. Synthetic demo docs only (G18); label MOCK where adapter-based.

## "Verify land records" (verification engine)
- Hero with source chip ("Source: Mahabhumi & BhuNaksha (official)") — WE MUST NOT claim this (G7);
  ours: "Source: mock cadastral adapter (MOCK)".
- Survey pills to switch parcel; heading "Survey #101/2B — village", owner + tenure;
  match score 78% + "AREA MISMATCH" tag.
- Record checklist rows with icon + label + help "?" + right-aligned result: RoR match (verified),
  ground survey area vs sale deed (area difference, red), mutation entry, sub-registrar title,
  court stays & encumbrances.
- Footer: "Officer review: digital approval required before proceeding to compensation" +
  "Request physical re-survey" (outline danger) + "Approve land record" (primary).
- Ours: = §15.3 parcel verification (override_reason required when flags present) + §15.4
  correction request (maker-checker); approve → PARCEL_VERIFIED → anchor.

## 360° land record details (modal over map/registry)
- Title "360° land record details — Survey #133/2B", land ID, village; chips risk / acq status /
  payment; project link.
- Action pills: View on map, Check documents, View legal case, Review compensation,
  View AI risk analysis (highlighted).
- Tabs: Overview, Landowners (n), Risk analysis (score), Documents (n), Legal cases (n),
  Payment & valuation, Affected families (n), Field photos & GPS, QR code.
- Overview: land identification key-values; verification checklist; "Workflow payment task —
  pending" with "Complete payment task" CTA; AI risk prediction strip (score, why risky, recommended
  action, "View detailed analysis").
- Risk tab: composite risk card (score/100, label, one-line meaning, "data-driven assessment based
  on …"), "Why is this land low risk?" factor list, each factor: name, severity tag, +N pts,
  description, EVIDENCE box with the underlying data.
- Ours: build parcel 360° as UX4G Modal/Drawer with UX4G Tab; risk = our transparent weighted score
  (§24.4, weights in packages/rules/src/risk.ts) with top factors + evidence from our data — label
  "advisory / heuristic", never "AI prediction" as fact; recommended action is a suggestion, the
  action itself goes through the workflow engine (G3/G12). QR code tab → Ishan's public verify page
  (chain proof). Field photos & GPS → our vertex photos + accuracy. Hide hold reasons per redaction.

# Batch 4 (BhuDrishti, 5 screenshots) — citizen directory, monitoring, payments, s.101, notifications

## Monitoring sidebar group
- AI delay prediction (timeline forecasts, schedule risk), Post-acquisition land utilization (idle vs
  utilised), Alerts (unified notifications + statutory escalation), System health (services, sync,
  API), Audit logs (tamper-evident). Citizen records as separate entry.
- Ours: AI delay prediction = our delay-risk score + bottlenecks (heuristic, labelled advisory);
  System health = /health + chain status + outbox/job queue + MOCK adapter list; Audit logs =
  audit_log hash chain + GET /audit/verify (Ishan's Trust Center can host it).

## Citizen records directory
- Hero + 4 stat cards (registered citizens, with grievances "s.15 objections filed", claimants,
  latest registration); search by name/email/phone/ID; tabs All / Grievance filers / Claimants;
  table: name + ID, contact (email/phone), jurisdiction, grievances, applications, registration date,
  "Dossier ›".
- Their data is visibly test junk ("Speed Test", "test_profile_…") — ours must be clean synthetic
  data with DEMO DATA badge.
- Ours: persons/affected families directory under RLS; phone/bank MASKED per FIELD_VISIBILITY (§11.4),
  never show raw PII; dossier = family 360° (interests, entitlements, acknowledgements, grievances,
  objections, passbook link).

## Monitoring & alerts (project)
- Hero "Monitoring & alerts · LIVE", scope project dropdown, "Updated just now"; tabs Unified overview /
  Part A live monitoring / Part B alerts & actions.
- "Live monitoring & project health" KPI row: project progress % (Needs attention tag + bar), land
  acquired ha / total + parcels, high-risk parcels, pending compensation ₹ + cases, tasks & stays.
- "Earth observation & satellite corridor monitoring" (claims ISRO Bhoonidhi feed, NDVI, clearing %,
  encroachment watch, satellite pass logs with GSD) — WE MUST NOT claim live ISRO/NRSC data (G7).
  If we ever show this: mock adapter, MOCK badge, [LATER]. Not in our scope now.

## Compensation & payments
- Summary: total approved compensation, disbursed via direct transfer, pending SLAO disbursement.
- Table: record ID, parcel ID (link), landowner, market value, total payable, payment mode
  "PFMS / DBT", status chip.
- They imply real PFMS/DBT and "includes market value + 100% solatium" (i.e. computed award) —
  violates our G1/G7. Ours: entered award amounts only, payment adapter labelled MOCK, and our
  differentiator column: ACKNOWLEDGED by family (WebAuthn/OTP/officer-attested) vs merely disbursed;
  hold reasons redacted by role.

## Payments, family support & land use (tabs)
- Tabs: Unused land check (s.101), Payments to landowners (n), Family support (R&R) (n),
  Land handover (n).
- s.101 "Land use audit": total possessed ha, under active construction ha (% utilised), unused
  acquired land ha (purple), rule explainer line, "Flagged unused land parcels" table (land ID,
  location, area, possession date, idle duration, reason for delay, action required); empty state.
- Ours: UTILISATION clock (P5Y from POSSESSION_TAKEN) + utilisation_audits + reversion workflow;
  show days remaining on the 5-year clock (our statutory-clock edge), not just "idle".

## Notification center (bell)
- Popover: title + total count, user + role line; filter pills All / Unread / Proposals / Documents /
  Tasks & alerts; priority dropdown; empty state with icon; footer "Real-time enabled" + Refresh feed.
- Ours: notifications table + SSE; filters by trigger/severity; escalation level shown; deep links;
  UX4G Popover + Empty State + Badge (unread count).

# Batch 5 — LAMS portal, BhuDrishti AI assistant, BhuDrishti audit log

## LAMS (second rival) — dark green sidebar, NIC look
- Dark sidebar "LAMS PORTAL · Govt. of India · SIH 2026"; **menu differs per role** (Finance officer:
  GIS & land parcels, Approved projects, R&R settlement, Document repository, Project status; Project agency:
  Acquisition window, Projects directory, …). User chip at the bottom of the sidebar.
- Top bar: breadcrumb, global search ("Survey no., project code, khata no."), State selector,
  regional-language toggle ("Translate (ಕನ್ನಡ)"), a gateway chip "NIC-Bhoomi Gateway" (claims a real
  integration — we never do, G7), role chip, logout.
- Approved projects: 3-column cards (name, project ID, agency, district, taluk, required land, affected
  landowners, LAO status, financial status) + full-width "View project" button. Their data has junk
  names ("uioio", "Report demo") — ours stays clean synthetic.
- **GIS & land parcels — best GIS reference**: three panes —
  left "Cadastral filters" (project, search survey/hissa/owner/ULPIN, state, district, taluk, revenue
  village, land type, acquisition status, Reset) | centre satellite map with real parcel polygons,
  basemap switch (Satellite / OpenStreetMap), "Survey no. labels" toggle, hover tooltip card
  (survey no, village, extent), legend card with an honest note ("internal hissa boundaries not
  digitised") | right record panel "Cadastral record & land title": survey no, village/taluk/district,
  acquisition status chip + "Update status", sub-divisions & ownership, identifiers (cadastral ID,
  ULPIN, extent, classification, taluk, district, khata no., soil), compensation & rehabilitation
  (assessed amount, payment status, possession).
- Ours: copy the 3-pane layout for `/gis` (Atulit). Our record panel adds chainage, % affected, flags,
  vertex photos, anchor badge. Source label = "mock cadastral adapter (MOCK)".
- Login: uses the real State Emblem — **we do not** (decided). Borrow the layout: split screen, left
  muted map background with headline "Secure access to …", "Authorised access" eyebrow with a saffron
  rule, trust line; right white card: email, password with show toggle, Sign in, "or continue with —
  Login with Government SSO". Ours: SSO shown disabled with "production only", plus our "Login as"
  dropdown and a Citizen tab.

## BhuDrishti AI assistant (modal)
- "AI Assistant — Ask BhuDrishti", scope chip (project), role chip, engine line, greeting with a
  "100% confidence" chip, suggested-question chips (summarise project, high-risk parcels, why delayed,
  pending compensation, legal disputes, what is 7/12, active alerts, route), input + Send. Also an
  "AI Voice" entry in the sidebar.
- Ours (Madhav, `components/ai/AskDrawer.tsx`): same feel, but honest — scope is the caller's own RLS
  scope; every answer shows "Sources: tool calls" with the numbers it used; **no confidence number**;
  suggested chips map to our 7 whitelisted tools (`get_kpis`, `list_breaching_deadlines`,
  `stage_bottlenecks`, `disbursement_gap`, `district_ranking`, `project_summary`, `explain_deadline`);
  "Mock mode" badge when `LLM_PROVIDER=mock`. AI never writes data (G3). Voice is out of scope.

## BhuDrishti audit log
- Hero "Activity & security history · Audit log" with chip "Tamper-proof & verified (SHA-256)"; entries:
  audit ID, action, target type + ID, timestamp, actor + role, truncated verification hash, raw
  "updated state" JSON.
- Ours (Ishan, `/trust`): our `audit_log` really is a hash chain (prev_hash → hash). Show actor user +
  post (G19), a readable before/after diff instead of a raw JSON dump, no PII, and a "Verify chain"
  button calling `GET /audit/verify` that reports the first broken link. Approved records also show
  their on-chain anchor status.
