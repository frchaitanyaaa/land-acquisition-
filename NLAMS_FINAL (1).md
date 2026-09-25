# NLAMS — FINAL PROJECT DOCUMENT
## SIH 26016 · Real-Time National Land Acquisition & Management System

**Version:** Final · 24 September 2026
**Contains:** Part A — ready-to-use SIH PPT content (5 slides) · Part B — full master context

---
---

# PART A — SIH PRESENTATION CONTENT

Use Part A directly on the slides. Part B is the backing reference for questions.

**Rule for every slide:** no invented statistics. Every claim is either a statutory fact with a section number, or a description of what the system does. Judges ask where numbers come from.

---

## SLIDE 1 — PROPOSED SOLUTION

### The idea in one line

> **NLAMS tracks a land parcel from project proposal to possession to closure, enforced by the law's own deadlines, visible to every stakeholder, on a map, with a clock running.**

### Detailed explanation

Land acquisition in India runs across ten statutory stages under the RFCTLARR Act, 2013 — from proposal, through Social Impact Assessment, consent, notification, objections, the R&R scheme, declaration, award, disbursement, possession, and finally closure.

Today each stage is tracked separately, on paper, in state-specific formats. Nobody can see the whole chain.

NLAMS digitises the complete chain as **one connected record per parcel**:

| Layer | What it does |
|---|---|
| **Field capture** | Officer walks the parcel boundary, GPS-marks each corner, photographs each corner |
| **GIS engine** | Overlays the project corridor on cadastral maps, isolates every affected survey number, computes affected area per plot |
| **Statutory workflow** | Ten stages with real actors, real documents, and a rejection path at every step |
| **Timeline engine** | Every stage carries its statutory deadline and the legal consequence of missing it |
| **Money ledger** | Every rupee tracked by head, from assessed to disbursed to **confirmed received** |
| **Trust layer** | Human-approved records hashed and anchored to a permissioned chain |
| **Decision support** | Dashboards from national down to parcel, with delay-risk scoring |

### How it addresses the identified problem

The problem statement names five failures. Each maps to a specific mechanism:

| Problem stated in PS 26016 | How NLAMS answers it |
|---|---|
| Fragmented, state-specific systems | One engine, with statute and state rules held as versioned configuration |
| Manual documentation, duplication of effort | Single parcel record; OCR-assisted award entry; national duplicate-footprint check at intake |
| Delays in approvals | Statutory deadline engine with escalation to the responsible officer, then district, then state |
| Limited transparency | Public parcel tracker with no login; per-family R&R passbook; append-only audit trail |
| No real-time information on progress, compensation, possession, R&R | Live dashboards on exactly the parameters the PS lists, down to survey number |

### Innovation and uniqueness

Five, ranked by how rare they are:

**1. Payment acknowledgement loop — the disbursed-versus-received gap**

Every system today holds one fact: *"₹5 lakh was disbursed."* That fact comes from the office. NLAMS holds two independent facts:

- Money left the treasury — recorded by the system
- The family confirmed receipt — recorded by the family, on a device, matched locally

```
₹4.2 crore disbursed  ·  ₹3.1 crore acknowledged  ·  ₹1.1 crore UNCONFIRMED
```

A clerk can tick "paid" in a register. A clerk cannot produce a signed confirmation from a device a family enrolled in person. **The gap is the finding.**

This digitises an existing practice — the Act's own process already uses thumb impressions on consent forms, and disbursement camps already perform biometric authentication.

**2. Statutory timeline engine — deadlines with real legal consequences**

Not "task overdue." The Act attaches hard outcomes:

- No declaration within 12 months of the s.11 notification → notification **deemed rescinded** (s.19)
- No award within 12 months of declaration → proceedings **lapse** (s.25)
- Possession before payment → blocked (s.38)
- Compensation unpaid after possession → **9% interest, rising to 15% after a year** (s.80)

The screen reads *"This notification lapses in 34 days"* — and the rupee cost of delay is computed live.

**3. Rule-packs — the system survives the law changing**

Statute and state variation live in versioned configuration, not code. A project declares its governing law and state; the stages, deadlines, thresholds and entitlement heads load from a pack.

**Section 24 of the Act exists because land acquisition law has already changed once mid-process** — thousands of cases were running under the 1894 Act at commencement. A national system must run old cases under old rules and new cases under new rules simultaneously. Packs are versioned, and **a case keeps the version it started under**.

**4. Field GIS that works where cadastral data does not exist**

Cadastral maps are digitised in some states, partly in others, and exposed by API in almost none. NLAMS does not assume they exist. Where they do, we import. Where they do not, the officer walks the boundary and the system builds the record — with a photograph taken standing at every corner.

The system stores **both** the recorded cadastral area and the field-measured area, and flags the difference. That difference is itself a signal: encroachment, an outdated record, or an informal sub-division.

**5. Accountability by design**

- Every document carries a named officer's attestation, quoting the penalty under **s.84**
- Why a family was not paid is restricted to district level and above — it can reveal a title dispute, a death, or a family quarrel
- Roles attach to **posts**, not people, so an award declared in March still shows who held the post in March
- Maker and checker must differ, as the Act itself requires (ss.16–18)

---

## SLIDE 2 — TECHNICAL APPROACH

### Technologies

| Layer | Choice | Why |
|---|---|---|
| Frontend | React / Next.js, Tailwind | Standard, fast to build, mobile-responsive |
| Field app | Offline-first PWA | Works without network; GPS needs no signal |
| Backend | Node.js / NestJS, REST | One language across the team |
| Database | **PostgreSQL + PostGIS** | Relational and spatial in one store; no separate GIS server |
| Mapping | Leaflet / OpenLayers | Serves GeoJSON straight from PostGIS |
| Blockchain | EVM-compatible permissioned — Hyperledger Besu direction, Hardhat for development, Solidity, ethers.js | Multiple independent authorities write to one record |
| Biometric | **WebAuthn** (device-local) | No licensing; fingerprint never leaves the device |
| AI | LLM assistant over authorised data + feature-based delay scoring | Advisory only |
| Security | RBAC, field-level authorisation, TLS, encryption at rest, append-only audit log | Government cybersecurity compliance |

### System architecture — six layers

```
LAYER 1  DATA COLLECTION    Field PWA (GPS, geo-tagged photos) · Integration Gateway
                            (LGD/NAPIX · Bhuvan · State RoR · Cadastral — adapters)
              ↓
LAYER 2  PROCESSING         GIS Engine · Workflow Engine · Statutory Timeline Engine
                            · Document Management (OCR assist)
              ↓
         OPERATIONAL DB     PostgreSQL + PostGIS  ← system of record
              ↓                    ↓ hash                ↑ verification badge
LAYER 3  TRUST                     Blockchain Anchoring (side path, not in the way)
              ↓
LAYER 4  MONITORING         Case Tracking · Alert Engine · Stakeholder Notifications
              ↓
LAYER 5  INTELLIGENCE       AI Assistant · Bottleneck Analysis · Delay Risk Scoring
              ↓
         VISIBILITY FILTER  field-level redaction by role
              ↓
LAYER 6  OUTPUT             National · State/District · Project MIS · Public Portal

SECURITY runs across all six layers.  MODULE 0 (rule-packs) runs beneath all six.
```

**Key architectural decision:** the blockchain sits **beside** the data path, not inside it. If the chain is slow or unavailable, nothing stops — the record is saved and serving, and only the proof shows as pending.

### Methodology — ten modules on ten statutory stages

| Module | Stage | Covers | MVP |
|---|---|---|---|
| **0** | — | Rule-packs: statute + state as versioned config | Deep |
| **A** | 1 | Proposal intake, automated pre-scrutiny, routing to CALA/Collector | **Deep** |
| **B** | 1.2, 5.2 | GIS overlay, field parcel capture, constraint screening | **Deep** |
| **C** | 2, 3 | SIA, socio-economic census, public hearing, Expert Group | Thin |
| **D** | 4, 5 | Consent procurement, s.11 notification, objections | **Deep** |
| **E** | 6 | R&R scheme, entitlements, R&R passbook, colony readiness | Thin |
| **F** | 7, 8 | s.19 declaration, escrow gate, s.21 claims, award recording | Thin |
| **G** | 9 | Disbursement, **acknowledgement**, s.77 escrow, possession, Panchnama | **Deep** |
| **H** | 10 | LARR Authority references, enhanced compensation | Dashboard |
| **I** | 10 | Annuity audit, residual land, s.101 reversion, s.102 value sharing | Dashboard |
| **J** | — | Executive dashboards, analytics, compliance audit trail | Dashboard |

### Implementation process

1. **Rule-pack layer first** — stages, actors, deadlines and thresholds as data, so no statutory rule is hard-coded
2. **Seed data generator on day one** — real village boundaries from OSM and LGD; synthetic parcels generated by Voronoi tessellation inside them; fixed random seed so every demo run is identical
3. **Workflow state machine** — ten stages, each with an approval path, a rejection path carrying a reason code and target stage, and three terminal outcomes
4. **Spatial layer** — parcel geometry in PostGIS; area computed in a metric projection; canonical geometry hashing at fixed precision so the same polygon always produces the same hash
5. **Field PWA** — walk-to-corner capture, per-vertex photo, offline queue, two timestamps (device and server)
6. **Money ledger** — entitlement heads → sanction → disbursement → acknowledgement, with interest liability computed from elapsed time
7. **Trust layer** — hash the human-approved record, anchor the event, support versioned corrections
8. **Dashboards and redaction** — one API, field-level visibility by role

### Integration strategy — the adapter pattern

Government systems that require licensing or authorisation are reached through adapters. The interface is real and published; the provider behind it is swapped in production.

| Where | Production provider | Now |
|---|---|---|
| Module B | State Bhu-Naksha / RoR | Synthetic parcels, labelled |
| Module D | UIDAI e-KYC | Mock returns verified |
| Module G | PFMS / bank DBT | Simulated transfer status |

*"This call returns from our mock adapter. In production it points at the state's own service. Nothing above this line changes."*

### Diagrams to include on the slide

Three Mermaid sources are prepared: **system architecture** (six layers), **operational workflow** (ten phases with rejection paths), **entity relationship** (data model). Render before use.

---

## SLIDE 3 — FEASIBILITY AND VIABILITY

### Feasibility

**Technically feasible now.** Every core component uses mature, freely available technology:

- PostGIS performs corridor-to-parcel intersection and area computation as standard operations
- WebAuthn is a W3C standard supported by current browsers — no licence, no certified hardware
- Offline PWAs with background sync are a solved pattern
- A permissioned EVM chain runs locally for development

**Administratively feasible.** The system does not ask officials to change how they work. It mirrors the statutory process exactly as the Act defines it — the same officers, the same documents, the same approvals — and removes the paper transit between them.

**Legally grounded.** No invented process. Every stage, deadline and threshold is traced to a section of the Act.

### Potential challenges and risks

| # | Risk | Severity |
|---|---|---|
| 1 | **Cadastral data is not digitised or not accessible** in most states | High |
| 2 | **Aadhaar e-KYC and DBT require licensing** we cannot obtain | High |
| 3 | **GPS accuracy** — ±5 to 15 m error means a walked boundary can differ from the record | High |
| 4 | **Geo-tagged photos can be faked** — EXIF is editable, mock-location apps exist | Medium |
| 5 | **Blockchain latency** could stall the interface | Medium |
| 6 | **Legitimate boundary corrections** could be misread as tampering | Medium |
| 7 | **The law changes** — amendments, state variations, sector-specific acts | Medium |
| 8 | **Data sensitivity** — reasons for non-payment can expose private disputes | Medium |
| 9 | **Field connectivity** is unreliable at acquisition sites | Medium |
| 10 | **Adoption** across states with different formats and languages | Medium |

### Strategies to overcome them

| # | Strategy |
|---|---|
| 1 | **Do not assume cadastral data exists.** Field GPS capture is a first-class input, not a fallback. Where a state has digitised maps we import them through an adapter; where it does not, the officer walks the boundary. The missing data is the problem statement's own diagnosis — our design answers it rather than depending on it. |
| 2 | **Adapter pattern with visible mocks.** The interface is built and published; the provider is a configuration change. We label the mock in the UI rather than claiming access we do not have. |
| 3 | **Store both areas and flag the gap.** Recorded cadastral area and field-measured area are kept separately, never overwritten. Hold-to-average sampling, per-point accuracy display, and a warning above 20 m. The difference becomes a governance signal instead of a hidden error. |
| 4 | **Layered photo defences.** In-app camera only, no gallery picker; server-side GPS at capture; accuracy radius recorded; mock-location flag captured; photo location checked against the polygon; hash computed on device. We state openly that this reduces fraud rather than eliminating it — a human verifier reviews the evidence, and every step is anchored. |
| 5 | **Chain off the critical path.** PostGIS is the system of record. The UI never waits for a transaction — it queues and shows status. Chain unavailable means proof pending, not service down. |
| 6 | **Versioned correction workflow.** A change requires a reason and an approver, and creates a new anchored version with visible lineage. Tampering is then defined precisely: a database row that silently differs from its last anchor. |
| 7 | **Rule-packs, versioned, with cases pinned to their version.** An amendment creates a new pack version with an effective date; cases already in flight keep the version they started under — because legally they must. |
| 8 | **Three-layer access control** — role, jurisdiction, and field-level visibility — enforced in the API, not the frontend. Reasons for non-payment are visible from district level upward only. |
| 9 | **Offline-first field app.** Map tiles and cadastral layers are bundled when the officer is assigned. Submissions queue locally and sync on reconnect. GPS needs no network. |
| 10 | **Configuration, not customisation.** New state, new rule-pack — no code fork. Multilingual UI strings and local-language statutory summaries, as the Act itself requires for publication. |

### Viability

- **No licensing dependency** in the core product — every dependency that needs authorisation sits behind an adapter
- **Nationwide scaling is a configuration exercise**, not a rebuild
- **Runs on government cloud** (NIC MeghRaj) with standard open-source components
- **Extends to sector-specific acts** — National Highways Act, Railways Act, Electricity Act — through additional rule-packs rather than parallel systems

---

## SLIDE 4 — IMPACT AND BENEFITS

### Target audiences and what changes for each

| Audience | What changes |
|---|---|
| **Affected families** | Can see their own case without a login. Know what is assessed, what is paid, what is overdue, and who to contact. Their receipt of money is recorded by them, not only by the office. |
| **Field and revenue officials** | Boundary capture on a phone that works offline. No manual area calculation. No re-entering the same record. |
| **District Collector / LAO** | One screen showing what breaches a statutory deadline on their watch — and what each delay costs in interest. |
| **R&R Administrator and Commissioner** | Family-level view of which entitlements are complete and which families are not yet made whole. |
| **Requiring bodies** | Know exactly where a project is stuck, with whom, and for how long. |
| **State and Central Ministries** | District-wise and state-wise progress on the exact parameters the PS names, with drill-down to survey number. |
| **Policy makers** | Bottleneck analysis grounded in real transition data — which stage returns files most often, and why. |

### Social impact

- **Money reaches the person it was awarded to.** The disbursed-versus-acknowledged gap makes unconfirmed payments visible instead of invisible.
- **The weakest claimants become visible.** The data model represents tenants, sharecroppers, agricultural labourers and forest dwellers as affected families in their own right, as s.3 requires — not only registered land owners. Vulnerability flags cover SC/ST, female-headed households, destitute persons and persons with disabilities.
- **Transparency is structural, not promised.** The Act already requires publication at multiple stages (ss.6, 11, 18, 19). The public portal makes that publication actually reachable.
- **Displacement follows rehabilitation, not the other way round.** Possession is gated on payment and R&R completion (s.38), enforced by the system rather than by goodwill.
- **Privacy is protected by design.** The reason a family has not been paid stays restricted, because it can expose a title dispute, a death, or a family conflict.

### Economic impact

- **Avoided interest liability.** Unpaid compensation accrues 9% per year after possession, rising to 15% after one year (s.80). The system computes accruing liability live, turning a hidden cost into a managed one.
- **Avoided lapse and restart.** A missed declaration deadline rescinds the notification (s.19); a missed award deadline lapses the proceedings (s.25). Each lapse means restarting a multi-month statutory process. Deadline alerts prevent the restart.
- **Faster hand-offs.** Proposal transit between requiring body, state and district moves from physical file movement to instant routing.
- **Escrow discipline.** Awards are checked against escrow held, so commitments cannot exceed funds deposited.
- **Reduced litigation exposure.** Procedural defects — inadequate notice, missing local-language summaries, unrecorded hearings — are the common grounds for a hearing being declared void. The system enforces these conditions before a stage can close.
- **Unutilised land returns to productive use.** The five-year reversion clock (s.101) is tracked automatically instead of being forgotten.

### Environmental impact

- **Constraint screening before notification.** Project corridors are checked against protected forest boundaries, eco-sensitive zones, water bodies and scheduled areas — before legal notices are drafted, when an alignment can still be shifted cheaply.
- **Food security safeguards enforced.** Irrigated multi-cropped land triggers the s.10 last-resort requirement and the obligation to develop equivalent culturable wasteland.
- **Minimum-land discipline.** The Act requires that only the bare-minimum extent be acquired (ss.4, 8). Partial-acquisition tracking shows exactly how much of each plot is taken and how much remains.
- **Paper eliminated** across a process that today moves physical files between offices for months.

### Governance impact

- **Named accountability on every document** — an officer's attestation, with the s.84 penalty shown at the moment of upload
- **Nothing can be silently edited** — corrections are versioned, approved and anchored; unapproved divergence is detectable
- **Institutional memory survives transfers** — roles attach to posts, so history remains readable after officers move
- **Audit-ready by default** — compliance reporting for monitoring committees (ss.48–50) is generated, not compiled by hand

---

## SLIDE 5 — RESEARCH AND REFERENCES

### Research conducted

**1. Statutory analysis.** Full reading of the Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act, 2013 (Act No. 30 of 2013) — 114 sections and four Schedules. Extracted every deadline, threshold, percentage and entitlement amount, and mapped each to the system stage it governs.

**2. Process mapping.** Mapped the complete ten-stage administrative process from proposal to closure, including for each sub-stage: the officials and departments involved, the methodology practised, the documents produced, and the submission-approval-rejection workflow.

**3. Stakeholder analysis.** Identified permanent system users (six role groups) separately from case participants — external or temporary actors such as the Independent SIA Agency, the multi-disciplinary Expert Group, and DLSA neutral observers, who sign specific artefacts but do not need dashboards.

**4. Failure-mode analysis.** Catalogued where the statutory process breaks: hearings declared void for procedural defects, files returned for specific defects at every sub-stage, and three points where an acquisition terminates permanently.

**5. Data availability study.** Assessed which Indian government data sources expose usable APIs and which do not, leading directly to the adapter architecture and to field GPS capture as a first-class input.

**6. Cross-document verification.** Cross-checked all statutory figures across sources and resolved conflicts against the Act text. Several secondary figures in circulation are incorrect — for example the rural multiplication factor is **1.00 to 2.00** under the First Schedule, not 1.25 to 2.

### Primary sources

| Source | Use |
|---|---|
| **RFCTLARR Act, 2013** (Act No. 30 of 2013) — Ministry of Law and Justice | Authoritative for every section, deadline, percentage and entitlement |
| **SIH Problem Statement 26016** — Ministry of Rural Development | Authoritative for requirements and scope |
| Land acquisition process documentation — ten statutory stages with officials, documents and approval workflows | Process and actor mapping |

### Key statutory provisions relied upon

| Area | Sections |
|---|---|
| Public purpose and consent thresholds | s.2 |
| Definitions — affected family, person interested | s.3 |
| Social Impact Assessment, public hearing, publication | ss.4–6 |
| Expert Group appraisal and government examination | ss.7–8 |
| Food security — multi-cropped irrigated land | s.10 |
| Preliminary notification, survey entry, objections | ss.11–15 |
| R&R scheme, review, approval | ss.16–18 |
| Declaration and notices | ss.19–21 |
| Award, market value, solatium | ss.23, 26–31 |
| Possession, payment timelines | s.38 |
| Urgency | s.40 |
| Scheduled Areas, SC/ST safeguards | ss.41–42 |
| Administrator and Commissioner for R&R | ss.43–44 |
| Monitoring committees | ss.48–50 |
| LARR Authority, reference, appeal | ss.51–74 |
| Apportionment and payment, deposit with Authority | ss.75–80 |
| Offences and penalties | ss.84–90 |
| Partial acquisition, return of unutilised land, value sharing | ss.94, 101–102 |
| Sector-specific acts, state variation, beneficial option | ss.105, 107–108 |
| First to Fourth Schedules | Compensation, R&R entitlements, amenities, exempted enactments |

### Data sources for the prototype

| Source | Provider | Use |
|---|---|---|
| **Local Government Directory (LGD)** | Ministry of Panchayati Raj | Authentic state, district, block and village codes and names |
| **Bhuvan** | ISRO / NRSC | Base imagery and permitted geospatial services |
| **data.gov.in** | Open Government Data Platform India | District-level land use and agricultural statistics |
| **OpenStreetMap** (Geofabrik India extract) | OSM contributors, ODbL licence | Administrative boundaries, roads, canals, water bodies |

**Declaration on data:** no real citizen data is used. Parcel geometry inside real village boundaries is synthetically generated; all personal details, survey numbers, bank references and family records are synthetic. Every generated record is marked `data_source: synthetic_demo` and the interface displays a **DEMO DATA** badge.

### Technical references

| Reference | Use |
|---|---|
| **PostGIS** spatial extension for PostgreSQL | Geometry storage, intersection, metric-projection area computation |
| **W3C Web Authentication (WebAuthn)** | Device-local biometric confirmation with no biometric data leaving the device |
| **Hyperledger Besu** / Solidity / Hardhat | Permissioned EVM chain for anchoring |
| **Leaflet / OpenLayers** | Interactive web mapping |
| **Progressive Web App** standards — service workers, IndexedDB, Geolocation API | Offline field capture |

*Verify all links immediately before submission.*

### Scope note

This work is based on the 2013 Act as contained in the referenced text. Where a provision may depend on later amendments, rules, State notifications or judicial interpretation, that is treated as requiring separate verification and is not asserted as settled.

---
---

# PART B — MASTER CONTEXT

Full reference behind the slides. Paste into any new chat as context.

---

# B0. HOW TO USE THIS

Records **what we decided and why**. Technical implementation — schema, APIs, code structure — is a separate document.

## Source priority

| Rank | Source | Authoritative for | Never use for |
|---|---|---|---|
| 1 | **PS 26016** | What must exist | — |
| 2 | **RFCTLARR Act 2013** | Every number, deadline, percentage, section | — |
| 3 | **Land Acquisition Process doc** | Who does what, documents, rejection routes | Numbers |
| 4 | **Blueprint (Modules A–J)** | How the build is packaged | Numbers, chapter citations |
| 5 | **This file** | Our product and architecture decisions | — |

**The rule that prevents most mistakes:** any number, percentage, deadline or section reference comes from the Act.

## Labels

**[TEAM]** a call the team made, overrides everything · **[ADOPTED]** a recommendation the team accepted · **[VERIFY]** not established by our sources

---

# B1. PROJECT IDENTITY

- **Problem ID:** SIH 26016 · **Ministry:** Rural Development · **Category:** Software
- **Title:** Real-Time National Land Acquisition & Management System for End-to-End Digital Monitoring and Decision Support
- **Product:** NLAMS
- **Sub-theme:** AI, GIS & Data Analytics for Public Administration and Infrastructure Management
- **Demo scenario:** Pune-Satara Expressway Expansion — 50 km, ~150 hectares, Pune district, Maharashtra. Villages Khed Shivapur and Shirwal. Mahabhulekh cadastral layer.

**Ministry lens.** Rural Development. SIA, consent and R&R are the entire reason the 2013 Act exists. A pitch aimed only at administrators misses this audience.

---

# B2. THE THESIS

> **A land parcel's journey from project proposal to possession to closure, enforced by statute, visible to every stakeholder, on a map, with a clock running.**

---

# B3. NOVELTY RANKING [ADOPTED]

| # | Novelty | Why this order |
|---|---|---|
| 1 | Payment acknowledgement loop | Rare; matters directly to a farmer |
| 2 | Statutory timeline engine | Turns "delay alert" into "this notification lapses in 34 days" |
| 3 | Blockchain trust layer | Proves 1 and 2, so it feels necessary rather than decorative |
| 4 | GIS field verification | The honest answer to missing cadastral data |
| 5 | AI administrative intelligence | Useful, advisory, not what wins the room |

**Prepared answer — "why not just a signed append-only log?"**

> Several independent bodies — centre, state, district, requiring body — write to the same case file, and none should be able to quietly edit another's entry. A permissioned chain gives shared history with no single administrator who can rewrite it.

Do **not** claim nothing like this exists anywhere.

---

# B4. MODULE AND STAGE MAP

| Module | Stage | Covers | MVP depth |
|---|---|---|---|
| **0** | — | Rule-packs (cross-cutting, runs beneath A–J) | Deep |
| **A** | 1 | Proposal intake, pre-scrutiny, routing | **Deep** |
| **B** | 1.2, 5.2 | GIS overlay, field capture, constraint screening | **Deep** |
| **C** | 2, 3 | SIA, census, public hearing, Expert Group | Thin |
| **D** | 4, 5 | Consent, s.11 notification, objections | **Deep** |
| **E** | 6 | R&R scheme, entitlements, passbook, colony readiness | Thin |
| **F** | 7, 8 | Declaration, escrow gate, s.21 claims, award recording | Thin |
| **G** | 9 | Disbursement, acknowledgement, s.77 escrow, possession | **Deep** |
| **H** | 10 | LARR Authority references, enhanced compensation | Dashboard |
| **I** | 10 | Annuity audit, residual land, s.101, s.102 | Dashboard |
| **J** | — | Dashboards, analytics, audit trail (cross-cutting) | Dashboard |

Build A, B, D, G properly. Everything else thin or dashboard-over-seeded-data.

## Module A intake specification

Structured digital form capturing: **project type · national importance · estimated budget · total land required · target districts and villages**. Accepted alignment files: **CAD, KML, KMZ, GeoJSON, Shapefile**.

Automated pre-scrutiny checks: mandatory fields present (statutory approvals, DPR summary, funding clearance); **duplicate survey numbers and overlapping project footprints against a national spatial registry** — a national-level check distinct from per-parcel overlap validation.

Routing by geo-coordinates to **State Government, District Collector and CALA** (Competent Authority for Land Acquisition — the sector-act designation, which ties to rule-packs). Alerts by SMS and email.

## Named parcel statuses

`Proposed` → `Verification Pending` → `Verified` → `Consent Acquired & Notified` → `Cleared for Award & R&R` → `Awarded` → `Ready for Possession` → `Acquired & Possessed` → `Legal Dispute Settled` → `Closed`

Plus `Disputed` and `Delayed` as flags, and `Denotified` / `Terminated` as terminal states.

Associated dossier artefacts: **Legal Clearance Dossier** (end of Module D), **Lifetime Compliance Dossier** (Module I archival).

---

# B5. STATUTORY TIMELINE ENGINE [ADOPTED]

| Rule | Limit | Consequence |
|---|---|---|
| SIA completion (s.4) | 6 months | Study incomplete |
| Expert Group recommendation (s.7) | 2 months | — |
| s.11 notification after SIA appraisal (s.14) | 12 months | SIA report lapses; fresh study required |
| Objection window (s.15) | 60 days | Window closes |
| Declaration after s.11 (s.19) | 12 months | Notification **deemed rescinded** |
| Award after declaration (s.25) | 12 months | Proceedings **lapse** |
| Compensation before possession (s.38) | 3 months | Possession blocked |
| Monetary R&R (s.38) | 6 months | Possession blocked |
| Infrastructure R&R (s.38) | 18 months | Possession blocked |
| R&R before submergence (s.38) | 6 months prior | Breach |
| Unpaid compensation after possession (s.80) | — | 9% p.a., rising to 15% after one year |
| Unutilised land (s.101) | 5 years | Return to owner or Land Bank |

**Conditional clock:** the s.37 notice starts the reference window — **6 weeks if present** at award pronouncement, **6 months if absent**.

---

# B6. RULE-PACKS — MODULE 0 [ADOPTED]

**Statute and state variation are data. The engine stays the same.** Not a module in the A–J sequence — a layer beneath all of them, alongside Security and Audit.

| Module | What it asks the layer |
|---|---|
| A | Which statute governs? Which stages apply at all? |
| B | Which constraint layers, at what thresholds? (s.10 limits are State-notified) |
| C | Is SIA required, or exempt under s.9 urgency? |
| D | Is consent needed — 70%, 80%, or none? |
| E | Which Second Schedule heads and amounts? States may legislate higher (s.107) |
| F | Which market-value factors? Rural multiplier range is a State notification |
| G | Which payment deadlines? |
| All | What is the deadline here, and what happens if missed? |

## Why this is not hypothetical

**Section 24 exists because the law changed mid-process.** Thousands of acquisitions were running under the 1894 Act at commencement; s.24 sets out which continue, which lapse, which restart.

> "Land acquisition law has already changed once mid-process, and Section 24 is the evidence. A national system must run old cases under old rules and new cases under new rules, at the same time."

**The rule that makes it credible:** packs are versioned, and **a case keeps the version it started under**. An amendment creates a new version with an effective date; cases in flight are not retroactively rewritten, because legally they cannot be.

## What to build

Three packs plus a read-only viewer — not an authoring UI.

1. `larr-2013-base` · 2. `larr-2013-maharashtra` · 3. `nh-act-1956`

One admin screen listing packs, versions, effective dates and which projects use each. That screen turns a JSON file into a visible feature.

## Demo

```
Pune Ring Road (PPP)          →  Stage 4 present, threshold 70%, declaration 12 months
Pune-Satara NH (Govt, NH Act) →  Stage 4 absent — exempt, different notification chain
```

Then change one number in a pack and watch the deadline shift.

## Statutory basis

s.107 (States may legislate higher) · s.108 (person may opt for the more beneficial) · s.105 (Fourth Schedule enactments run their own chains) · PS scalability row

## State acts available as pack examples

Gujarat RFCTLARR (Gujarat Amendment) Act 2016 · Maharashtra MRTP Act 1966 and Maharashtra Industrial Development Act 1961 · Tamil Nadu Highways Act 2001, TN Acquisition of Land for Industrial Purposes Act 1997, TN Acquisition of Land for Harijan Welfare Schemes Act 1978 · Karnataka Industrial Areas Development Act 1966 and Karnataka Urban Development Authority Act 1987 · UP Urban Planning and Development Act 1973 and UP Expressways Industrial Development Act · Telangana and Andhra Pradesh RFCTLARR Amendment Acts (2017/2018) · Rajasthan Urban Improvement Act 1959 · West Bengal Land Requisition and Acquisition Act

---

# B7. COMPENSATION — RECORD, DO NOT CALCULATE [TEAM]

**We do not build a compensation calculator. We track assessment, disbursement and settlement.**

The PS says compensation **assessed** and disbursed. Assessment is a legal act by the Collector under ss.23, 27 and 31. If our number differs from the Collector's, we have created a question nobody wants.

The award is our **input** — entered by an officer, or read by OCR and confirmed field by field.

## Money by head, per family

Land compensation (First Schedule) · Solatium · 12% additional amount · each R&R entitlement as its own line (Second Schedule) · SC/ST additional amounts

**Status per line:** assessed → sanctioned → disbursed → acknowledged

Plus two real-world states:

- **Under protest** — s.77: accepting otherwise than under protest affects the right to apply under s.64. The Form of Payment Acceptance records which.
- **Deposited with the Authority** — refusal, legal incapacity, title dispute or apportionment dispute (s.77). On a normal dashboard this looks like "unpaid". It is not.

Supporting artefacts at disbursement: **Indemnity Bond**, verification form, treasury payment advice, DBT transaction log.

## Validation, not computation

| Check | Basis |
|---|---|
| Solatium entered is not 100% of compensation | s.30 |
| SC/ST family received less than one-third as first instalment | s.41 |
| Possession recorded but compensation unpaid past 3 months | s.38 |
| Monetary R&R pending past 6 months | s.38 |
| Infrastructure R&R pending past 18 months | s.38 |
| Urgency case where 80% not tendered before possession | s.40 |
| Irrigation/hydel, R&R incomplete 6 months before submergence | s.38 |

## The one number we compute

**Interest liability under s.80** — 9% per year after possession, rising to 15% after one year. Depends on elapsed time; only the system knows the dates. Not an award — the cost of delay in rupees.

## Assist-and-confirm for valuation inputs

The system **fetches and displays** the three s.26 benchmarks — circle rate / ready reckoner, average sale price of similar land over the preceding three years, and the consented amount where applicable — plus PWD, Forest, Horticulture and Minor Irrigation asset valuations. **The LAO enters or confirms each figure.** Nothing is final until a named officer signs. The **District Collectorate Valuation Committee** reviews baseline rates.

Land categorisation brackets: irrigated multi-cropped · unirrigated agricultural · non-agricultural commercial · residential frontage.

## Consequence

The **award entry screen is the weakest point.** Bad data in means everything downstream is wrong. This is why OCR-assisted entry is core and validation matters more, not less.

Keep traceability: click any payment line and see its section or schedule head, its deadline, and whether it was met.

---

# B8. PAYMENT ACKNOWLEDGEMENT — LEAD NOVELTY [TEAM]

An **acknowledgement of receipt**, not a payment method and not an identity check. Money moves through the bank account as s.77 expects. The biometric answers one question: *did the person actually get it?*

## Why it is the strongest idea

```
Money left the treasury     — recorded by the system
Family confirmed receipt    — recorded by the family

₹4.2 crore disbursed · ₹3.1 crore acknowledged · ₹1.1 crore UNCONFIRMED
```

A clerk can tick "paid". A clerk cannot produce a signed confirmation from a device a family enrolled in person.

## Device biometric (WebAuthn), not Aadhaar

| | Aadhaar biometric | WebAuthn |
|---|---|---|
| Matching happens | UIDAI servers | On the device |
| Proves | Identity against a national record | Same person as enrolment, present now |
| Fingerprint leaves device | Yes, encrypted | Never |
| Licensing | AUA/KUA + ASA + certified device | None |
| Buildable now | No | Yes |

## Rules we will not break

- **Never store a raw fingerprint or template.** Database holds a device key ID and timestamp only.
- **Always provide a fallback** — OTP, or officer attestation with a witness, geo-tagged photograph and recorded reason. State this limitation ourselves.
- **Enrolment happens face to face**, recorded as its own event, anchored. This is the honest weak point of device biometric and this is the fix.
- **Define the authorised recipient.** The Second Schedule allows land or house in joint names of wife and husband.

## Grounded in existing practice

- **Stage 9.1:** public disbursement camps at Tehsil and Panchayat offices already perform title verification and **biometric authentication**. This is the closest existing practice to what we digitise.
- **Stage 4.3:** consent forms are already *"signed or thumb-printed"*.

We are digitising an existing practice, not inventing one.

## Production story

> "Today it uses device biometric, which needs no licensing. In production this slot takes an Aadhaar AUA/KUA adapter — same event, same record, different provider."

New chain event: `COMPENSATION_ACKNOWLEDGED`

---

# B9. AI POSITION — ADVISORY ONLY [TEAM]

**AI never validates ownership or possession documents automatically.** These are legal facts; a machine does not decide them.

## OCR is a typing assistant

- Reads the award or notification PDF and fills form fields
- Every field is a **suggestion**, greyed, showing where it came from
- The officer clicks to accept each one. Nothing saves until a human accepts.
- Where OCR and the record disagree it says only "these do not match". It never picks a winner.

**Critical rule:** hash the record the **officer approved**, not what the AI read. If asked "what if the AI was wrong?" the answer is clean — the AI never wrote anything to the record.

## AI features we keep

| Feature | What it does |
|---|---|
| Delay risk scoring | Ranks cases likely to breach a deadline, with reasons shown |
| Objection triage | Sorts objections into statutory grounds, handles local languages, routes automatically |
| Document extraction assist | Pulls survey number, area, amounts; flags mismatches |
| Speech-to-text for oral objections | Gram Sabha audio and video captured, transcribed, converted into structured grievance tickets linked to specific parcels |
| Natural-language query | Questions over authorised data; bottleneck and delay analysis |

## Objection categories

**Act's grounds (s.15):** area and suitability of the land · justification offered for public purpose · findings of the SIA report

**Process doc's operational categories:** A — challenge to public purpose or necessity · B — request for alignment shift to save homes, places of worship or multi-cropped land · C — errors in survey numbers or total land area

These framings differ slightly. Use the Act's grounds as the statutory classification and the operational categories as routing tags.

## Also advisory, not automatic

Livelihood disruption scoring in Module C feeds entitlements. It must be a suggestion with human sign-off.

**Terminology:** *AI Decision Support* or *Administrative Intelligence*. Never "AI approves" or "AI verifies".

---

# B10. ACCESS, PRIVACY AND STAKEHOLDERS

## Three layers, not one [ADOPTED]

| Layer | Question | Example |
|---|---|---|
| **Role** | What actions can you perform? | A Collector can declare an award; a field officer cannot |
| **Jurisdiction** | Which rows can you see? | One district, one state, one project, or your own case |
| **Field visibility** | Which columns can you see? | Payment hold reason hidden below district level |

Scope is enforced in **one place**, at the data layer.

## Restricted fields [TEAM]

| Who | What they see about unpaid money |
|---|---|
| Public / citizen | Own case only. "Payment in process." No reason. |
| Field officer | Assigned parcels. Task-level reason only. |
| District (Collector) | Full reason and detail, for their district |
| State | District-wise totals with drill-down |
| Central / Super Admin | Everything, all states |

Redaction happens in the API, not the frontend.

## Six dashboards, not nine [ADOPTED]

| Group | Covers | Can do |
|---|---|---|
| Initiator | Land Requiring Body, Project Implementing Agency | Submit proposal, deposit cost, track own project |
| Field | Field and Revenue Officials | Survey, GPS capture, upload, submit for verification |
| Processing | District Administration, Land Acquiring Authority | Scrutiny, prepare notifications, route files |
| **Deciding** | District Collector | Approve, declare (s.19), award (s.23), possession (s.38) |
| R&R | Administrator (s.43), Commissioner (s.44) | R&R scheme, entitlements, resettlement area |
| Oversight | State, Central Ministries, Policy Makers | Read, monitor, escalate. **No case-level actions.** |

Each answers **one** question first:

| Dashboard | The one question |
|---|---|
| Requiring Body | Where is my project stuck, and what is the delay costing? |
| Field Officer | What is assigned to me today? (a task list, not a dashboard) |
| District Administration | What crosses my desk this week? |
| **Collector** | **What breaches a statutory deadline on my watch?** |
| R&R Authority | Which families are not yet made whole? |
| Oversight | Which districts are failing, and why? |
| Public | What is happening to my land? |

## Case participants — a third category [ADOPTED]

Not permanent users. Attached to a specific case; sign or submit a specific artefact; no dashboard.

Independent SIA Agency · State SIA Unit / Directorate · Multi-disciplinary Expert Group (7 members) · District Legal Services Authority neutral observers · District Inspector of Land Records · Tehsildars · Patwaris / Talathis / Village Accountants · Village Revenue Officers · PWD engineers · Forest and Horticulture departments · Minor Irrigation / Ground Water department · Department of Social Justice and Empowerment / Tribal Welfare · State Pollution Control Board · District Treasury Officer · Lead District Bank · Sub-Registrar · Directorate of Printing and Stationery · State Police · Department of Information and Public Relations · District Collectorate Valuation Committee · Project-Level Monitoring Committee · Revenue Inspector / Circle Officer · National and State Monitoring Committees for R&R (ss.48–50)

## Affected families — data subject, not stakeholder [ADOPTED]

The PS names Policy Makers in the Scope of Study stakeholder table; Affected Families appear in the monitoring parameters. **Do not claim otherwise.**

But the PS requires the solution to "significantly enhance transparency" and to report the number of affected and displaced families. The Act requires publication at several stages (ss.6, 11, 18, 19) and gives the affected person rights to object (s.15) and seek reference (s.64).

So: **a Public Transparency Portal as an output, not a stakeholder dashboard**, working **without a login** — survey number lookup, non-sensitive fields only.

## Two features that make it look real [ADOPTED]

- **Roles attach to posts, not people.** "Collector, Pune" is the post; a user is assigned for a date range. An award declared in March still shows who held the post in March.
- **Maker and checker must differ.** The Act separates them — Administrator prepares the R&R scheme, Commissioner approves it (ss.16–18).

---

# B11. ATTESTATION, NOT DISCLAIMER [ADOPTED]

The tick box **assigns responsibility to a named officer** rather than removing it from the platform.

**Why the disclaimer framing was dropped.** Website terms work because a company and a consumer are two separate parties. Here the portal **is** the appropriate Government. A department cannot tell a farmer whose land is being taken that its own system bears no responsibility for its own records. It also reads as *we know our data may be wrong*.

## What we build

> ☐ I, **[Officer name, designation, jurisdiction]**, certify that this document is authentic, that it is true and correct to the best of my knowledge, and that I am authorised to submit it for this project.
>
> *Furnishing false information or a false document is punishable under section 84 of the Act with imprisonment up to six months, or fine up to one lakh rupees, or both.*

## What each tick records

User ID, designation, jurisdiction code · document ID and hash · **the version of the declaration wording agreed to** · timestamp, device, IP · anchored to chain

**Per document, not a one-time global agreement.** The attestation is **shown to the verifier**.

## Where a genuine disclaimer belongs

On the public portal, as provenance:

> This portal displays information as recorded by the concerned authority. For the authoritative record, contact the office of the Collector. Data shown as of [timestamp].

---

# B12. FIELD GIS — WALK TO THE CORNER [TEAM]

The officer physically walks to each corner and the phone's GPS gives the point. **The camera is evidence, not the measuring instrument.**

## Why not live-camera AR

ARCore and ARKit are native APIs; mobile browsers do not support them reliably · accuracy holds within ~5–10 m and degrades fast · needs textured, visible, flat ground · the corner must be visible from where the officer stands, and often is not.

Walk-to-corner is more accurate at field distances, runs in a browser, and degrades gracefully.

## What "Mark Point" records

Each tap creates a **vertex row**, not just a polygon point:

- Latitude, longitude, GPS accuracy in metres
- **A photograph taken standing at that corner**
- Capture method: `gps_walked` or `map_drawn`
- Two timestamps: `captured_at` (device) and `synced_at` (server)
- Whether hold-to-average was used

**The payoff:** on the portal, click any vertex marker and the photograph taken at that corner opens.

## Two areas, always both

| Field | Source |
|---|---|
| Recorded area | Cadastral or Record of Rights |
| Field-measured area | Computed from the walked polygon |
| Difference | Flagged above a threshold |

Phone GPS is accurate to ~5–15 m. The difference is a **signal** — encroachment, an outdated record, an informal sub-division. Label the walked polygon "field-indicated boundary."

`boundary_source`: `cadastral_import` · `field_drawn` · `survey_reference_only`

Display area in **hectares, square metres and acres** — traditional units are what revenue records use.

## Plot level and partial acquisition [TEAM]

A project does not "have" land. It **intersects plots**.

```
Parcel 214/3
  Total area           : 2.37 Ha
  Affected area        : 0.92 Ha  (39%)
  Remaining with owner : 1.45 Ha
```

**s.94** protects an owner where only part of a house, manufactory or building is taken. If the remaining parcel is severed or unviable, the Collector may order acquisition of the whole; if the claim is rejected, severance damages may still be added under **s.28**.

## Constraint screening

**Statutory constraints:**

| Trigger | Consequence | Section |
|---|---|---|
| Multi-cropped irrigated land in the set | Last-resort justification; equivalent culturable wasteland to be developed | s.10 |
| Any parcel in a Scheduled Area | Gram Sabha consent mandatory; Development Plan required | s.41 |
| Total area 100 acres or more | R&R Committee must be constituted | s.45 |

**Spatial constraint layers** (screened before statutory drafting, so alignment can still shift cheaply):

protected forest boundaries · eco-sensitive zones · water bodies · tribal and scheduled land areas

An overlap raises a **Spatial Warning** to administrators.

## Rules agreed

- **Area in a metric projection.** Computing area on raw latitude and longitude returns square degrees and is meaningless.
- **Canonical geometry hashing.** One database function, fixed precision, one SRID, never deviated from. Include record version and rule-pack version in the hash.
- **Overlap checks at submit:** same project, different project, outside declared village boundary.
- **Offline first.** Bundle tiles and cadastral layers when the officer is assigned. Queue and sync. Anchor using server time; keep device time as claimed.
- **Photo anti-fraud.** In-app camera only, no gallery picker. Server-side GPS at capture, accuracy radius, mock-location flag. Check the photo falls inside or near the polygon. Hash on device before upload. State openly this reduces fraud rather than eliminating it.
- **Usability:** hold-to-average 5 seconds, accuracy per point, warn above 20 m, undo last point, minimum 3 points, validity check.
- **Record the walked track**, not only corners.
- **Notice under s.12.** Officers may enter and survey, but advance notice to owner or occupier is required and damage must be paid for. Fields: `notice_served_on`, `notice_document_id`.

## Two survey types

`FIELD_SURVEY.survey_type`:

1. **Parcel identification** — boundary capture, Stage 1.2 and 5.2
2. **Joint Inspection Report** — trees, crops, wells, borewells, irrigation pipes and structures per survey number, feeding asset valuation at Stage 8.2

Also at Stage 5.2: **physical concrete boundary pillars** along the perimeter. Photograph each one.

## Verification is evidence review

The verifier's screen shows photographs, GPS accuracy, mock-location flag, overlap result and the recorded-versus-measured difference. Approving despite a flag requires a recorded reason.

## The map

One map, three stories — switch what colour means:

by **stage** · by **payment** (unpaid / part paid / paid / acknowledged) · by **deadline risk** (safe / due soon / breached)

For a linear project, a **chainage strip** under the map:

```
km 0 ──────────────────────────────────────── km 24
│████████████│▓▓▓▓▓▓▓│░░░░░░░░░░░│▒▒▒▒▒▒▒▒▒▒▒▒│
   possessed    paid    awarded     objections
```

---

# B13. CADASTRAL DATA STRATEGY [ADOPTED]

## The reframe

**Missing cadastral data is not our weakness. It is the problem the PS describes** — "fragmented systems, manual documentation, and state-specific processes."

> "Our system does not assume cadastral data exists. That is exactly why field GPS capture is a first-class input, not a fallback. Where a state has digitised maps, we import them. Where it does not, the officer walks the boundary and we build the record."

## Where demo data comes from

| Source | What it gives |
|---|---|
| **OpenStreetMap / Geofabrik India extract** | Real admin boundaries to village level, roads, canals, water. Free, ODbL. |
| **LGD / NAPIX** | Real state, district, block, village codes and names |
| **Bhuvan** | Base imagery and permitted layers |
| **data.gov.in** | District-level land use and agriculture statistics |
| **Hand-traced demo village** | 40–60 real field boundaries traced in QGIS. Highest-value single hour on the project. |

Trace from **ESRI World Imagery or Bing**, not Google — Google's terms do not permit deriving data from their imagery.

## Generating the rest

Voronoi cells seeded from clustered points, clipped to the real village boundary, seeds clustered along a road or canal. Do not use a grid — grids look fake immediately. For long thin strips, split cells recursively along slightly randomised lines.

Survey numbers in the format the chosen state actually uses (e.g. `214/3` with sub-divisions).

## Shape the data

- 10–12 projects across 4–5 states, ~2,000 parcels, ~5,000 affected families
- ~20% of cases already late, 3–4 actually breaching
- Families paid in full, part paid, **disbursed but not acknowledged**, and one or two with money held with the Authority
- Rural and urban parcels, at least one Scheduled Area project
- **Fixed random seed** so the demo is identical every run, plus a reset button

An empty national dashboard has ruined more SIH demos than bad code.

## Label it

Every generated parcel carries `data_source: 'synthetic_demo'` and the UI shows a **DEMO DATA** badge. Say it out loud before anyone asks.

---

# B14. THE MOCK ADAPTER PATTERN [ADOPTED]

Build everything for real. Replace one function call with a stub. **One rule, three places.**

| Where | Production provider | Now |
|---|---|---|
| Module B | State Bhu-Naksha / RoR | Synthetic parcels |
| Module D | UIDAI e-KYC | Stub returns verified |
| Module G | PFMS / bank DBT | Simulated transfer status |

```
POST /identity/verify
  { person_id, method: "aadhaar_ekyc" }
→ { verified: true, provider: "MOCK", ref: "DEMO-8471", at: "..." }
```

Visible badge in the UI: "Identity provider: MOCK (demo)".

> "This call returns from our mock adapter. In production it points at the state's own service. Nothing above this line changes."

**Never claim live access to a restricted government system.**

---

# B15. WHERE BLOCKCHAIN SITS [ADOPTED]

**Off the critical path. PostgreSQL with PostGIS is the system of record; the chain is a side anchor.**

```
Processing → Operational DB (PostgreSQL + PostGIS) → Monitoring → Output
                     ↓ hash                ↑ verified badge
              Blockchain Trust Layer
```

*"Nothing stops. The record is saved and serving. Only the proof shows as pending."*

## What gets anchored

Only **human-approved** records — never raw field capture, never AI output:

`PARCEL_VERIFIED` · `APPROVAL_RECORDED` · `AWARD_DECLARED` · `COMPENSATION_DISBURSED` · `COMPENSATION_ACKNOWLEDGED` · `POSSESSION_CONFIRMED`

## Corrections are not tampering

Boundaries legitimately change — a survey error, a sub-division, partial acquisition under s.94.

```
Change requested → reason recorded → approver signs off
→ new version created → v2 anchored
Chain shows lineage:  v1 → v2 (who, why, when)
```

- **Approved versioned change** = normal, provable
- **Database row silently differs from last anchor** = tampering

## Demo-day rule

Local node, pre-funded accounts, and the UI never freezes waiting for a transaction — queue it and show status.

---

# B16. STATUTORY WORKFLOW — TEN STAGES

| Stage | Name | Sections |
|---|---|---|
| 1 | Pre-Proposal & Identification | — |
| 2 | Social Impact Assessment & Public Hearing | 4–6 |
| 3 | Expert Group Appraisal | 7–8 |
| 4 | Consent Procurement (PPP & private only) | 2 |
| 5 | Preliminary Notification & Objections | 11–15 |
| 6 | R&R Scheme Formulation & Approval | 16–18 |
| 7 | Final Declaration & Public Notice | 19–21 |
| 8 | Valuation & Compensation Award | 23, 26–30 *(detail adds s.31)* |
| 9 | Disbursement, R&R & Possession | 37–38, 77, 80 |
| 10 | Post-Acquisition, Appeals & Land Return | **48**, 51–74, 64, 94, 101–102 |

## Stage 1 detail

**1.1 Feasibility.** DPR, demand projection, spatial scanning, **alternative alignment analysis (3–4 route options)**, drone and topographical mapping, geotechnical soil testing, cost-benefit assessment.

**1.2 Parcel identification.** Cadastral overlay on village revenue maps (Nakshas), survey number extraction, title and classification verification, **drafting the Land Schedule Matrix** (plot numbers, total size, required acquisition area, registered owners). RoR extracts: **7/12, Khatauni, Jamabandi**.

**1.3 Requisition and acceptance.** Formal requisition package, Collector's scrutiny, **Order of Acceptance**, appointment of the LAO, registration in the state land acquisition register, and **deposit of initial funds for SIA and administrative charges** — a financial gate distinct from the Stage 7 escrow.

## Two separate censuses

The Act requires two distinct exercises. Do not merge them:

1. **SIA household baseline census** (s.4, Stage 2.2) — 100% of affected families, plus a **Common Property Resources inventory** (wells, grazing grounds, places of worship, schools, clinics)
2. **R&R survey and census** (s.16, Stage 6.1) — conducted by the Administrator for R&R, with statutory categorisation and vulnerability identification

## Rejection paths at every sub-stage [ADOPTED]

Every sub-stage ends with "If Approved" and "If Rejected / Sent Back", and the rejection names **a specific destination and reason**.

Every transition carries a rejection edge with a **reason code** and **target stage**. This produces the bottleneck analysis the PS asks for: *every file that came back, from where, why, and how long it sat.*

## Expert Group — three outcomes, not two

| Outcome | Meaning |
|---|---|
| **A — Unconditional** | Serves public purpose, minimal land, social costs manageable |
| **B — Conditional** | Proceed **only if** specific land boundaries are reduced or additional R&R provisions are added to the SIMP |
| **C — Rejection** | Does not serve public purpose, or social costs drastically outweigh benefits |

Members sign; any dissenting member authors a **minority note**. Constitution requires **conflict-of-interest declarations** from all seven nominees and a Chairperson appointed from among them, by Gazette notification.

If C is recommended: the process halts. Under **s.8(2)** the Government may overrule, but **must record detailed reasons in writing**.

## Three terminal outcomes

| Stage | Outcome |
|---|---|
| Expert Group (3) | Rejection recommended → halts, subject to s.8(2) override with written reasons |
| Consent (4) | Below threshold → acquisition **automatically fails**; Collector issues termination order |
| Objections (5.4) | Government may **denotify** → permanently terminated |

Terminal states: `TERMINATED` · `DENOTIFIED` · `ABANDONED`, plus an **override record** holding the s.8(2) reasons.

## Completed stages can be un-completed

Three hearings can be declared **null and void** and ordered fresh — SIA public hearing, Gram Sabha consent meeting, R&R public hearing. Grounds are procedural.

Checkable validity conditions: notice period ≥ 3 weeks · local-language summary published · audio-video recording attached · attendance register present · quorum met.

A **Public Hearing Response Matrix** records how each objection raised was addressed.

## Consent sub-process (Stage 4)

1. **Consent register** — draft list of eligible titleholders and land-dependent families, displayed 15 days for claims and corrections, heirs of deceased owners updated, then certified as the Master Consent Register
2. **Awareness meeting** — special Gram Sabha or Municipal Ward session, 3-week advance notice, announcement including village broadcast (*Mundadi*), local-language booklets disclosing total land, compensation computation and R&R entitlements, audio-video recorded
3. **Collection** — statutory consent forms signed or thumb-printed, identity verified, **DLSA neutral observers certify non-coercion**, tabulation against the certified register

**Exemption:** purely government-owned and government-executed public works — national highways, state railways, public defence installations — are exempt from Stage 4 and move directly to Stage 5.

## Sequencing note

Consent (Stage 4) precedes the s.11 Preliminary Notification (Stage 5). Under s.2 the consent process is carried out **along with the SIA study**.

## Possession is gated on payment

```
Compensation Approval → Disbursement → Beneficiary Acknowledgement → Possession
```

Under **s.38**, possession follows payment. Possession cannot be taken until full compensation **and** R&R entitlements are provided.

At possession: **60-day notice** [VERIFY] · on-site **Possession Panchnama** with independent witnesses and geo-tagged photographs · **Certificate of Possession** · **Handing-Over / Taking-Over Certificate** · **revenue mutation** into the Requiring Body's name (Form 6 / 7-12 / Jamabandi), deleting former owner entries.

A **Vacation Certificate** per parcel confirms structures, standing crops and trees are cleared before possession.

## Escrow — two financial gates

| Gate | Stage | What |
|---|---|---|
| Initial | 1.3 | Deposit for SIA and administrative charges |
| Full | 7.1 | Full estimated cost — compensation, solatium, interest, R&R — into a Collectorate escrow account, with a **Financial Sufficiency Certificate** before the s.19 declaration publishes |

Stage 8.3 then checks that total awards do not exceed escrow held. Dashboard tile: **escrow held vs committed awards vs shortfall**.

Failure to issue the declaration within 12 months of the preliminary notification causes the proceedings to lapse under **s.19(7)**.

## Claims under s.21

Distinct from objections. Public notice posted **on or near the land**, plus individual notices served on recorded landowners, **tenants, mortgagees** and R&R beneficiaries. Window: not less than 30 days (the Act also sets an outer limit of six months).

**Master Claims Register** in three categories: land valuation claims · structure and standing asset claims · R&R entitlement claims.

## Land transfer freeze

On publication of the s.11 notification, an administrative directive goes to **Sub-Registrars** freezing fresh sale, lease, mortgage and land-classification change on the listed survey numbers.

## R&R scheme detail (Stage 6)

- **Categorisation:** landowners losing property · families whose primary livelihood depends on the land (tenants, sharecroppers, farm labourers) · displaced families losing residential homesteads
- **Vulnerability identification:** SC/ST families, **female-headed households, destitute individuals, persons with disabilities**
- **Resettlement site design:** colony layouts, roads, drainage, water supply, electrification, with a **Resettlement Colony Architectural Layout** and a line-item R&R cost budget
- **Entitlement choice disputes** — lump-sum cash versus job or annuity — are resolved at the R&R public hearing under s.16(5)
- **Displacement blocked** until resettlement colony readiness reaches 100%, evidenced by a **Completion and Commissioning Certificate**
- **Digital R&R Passbook** per family — see B17

## Post-acquisition (Stage 10)

- **10.1 References** (ss.64–74) — LARR Authority trial, enhanced award with statutory interest, differential payout, case closure
- **10.2 Long-term audit** (ss.48–50) — **National and State Monitoring Committees**, annual field visits and social audits, annuity and pension disbursement tracking, **civic asset handover** of schools, health centres and water systems to Panchayats and ULBs
- **10.3 Severance** (s.94) — claim filing, LAO field viability inspection, order for total acquisition if severed; if rejected, severance damages may still be added under s.28
- **10.4 Utilisation** (ss.101–102) — five-year usage audit, reversion to original owners or the **State Land Bank**, **Land Bank custody transfer** where owners cannot be located, and 40% appreciated-value sharing on a first transfer without development

## Notifications: targeted, then escalating

The task goes to the responsible officer first, escalating to district then state only when a deadline is breached.

## Inter-state projects

Where a project spans more than one State, the **Central Government becomes the appropriate Government** [VERIFY: s.3(1)(e)(iv)], issuing unified notifications across state boundaries, while **execution — surveys, compensation payouts, title transfers — stays with each State's District Collectors and Revenue Officers**.

For multi-state water and river-linking projects, Parliament creates dedicated statutory bodies (Damodar Valley Corporation Act 1948; Ken-Betwa Link Project Authority) coordinating across state borders.

Our jurisdiction model needs a project whose governing jurisdiction is national while execution rows sit across districts in several states.

## Project categories (s.2(1))

| Category | Sub-categories |
|---|---|
| **1 Strategic & Defence** | Military bases, airfields, naval ports, ammunition dumps · border fencing, forward posts, strategic roads · defence manufacturing, nuclear test and research sites |
| **2 Transport & Connectivity** | Linear corridors (highways, expressways, bypasses, railway tracks, freight corridors) · mass rapid transit (metro, monorail, high-speed rail) · nodes and terminals (airports, ports, bus terminals, logistics parks) |
| **3 Energy & Utilities** | Generation (solar parks, hydro dams, thermal, nuclear) · transmission (substations, high-voltage lines) · energy transport (oil, gas, slurry pipelines, coal mining rights) |
| **4 Water Management & Agriculture** | Storage and delivery (reservoirs, canals, check dams) · public utilities (water treatment, sewage, flood embankments) |
| **5 Industrial & Commercial Zones** | Industrial corridors · NIMZs and SEZs · technology parks, IT hubs, state industrial estates |
| **6 Urban Planning & Housing** | Slum rehabilitation and affordable housing · planned expansions and township layouts · rehabilitation colonies for displaced persons or disaster victims |
| **7 Public Services & Infrastructure** | Hospitals, medical colleges, universities, research institutes · waste management, parks, administrative buildings |
| **8 Sector-Specific PPP & Corporate** | Government-controlled PPP (70% consent) · private company projects with clear public utility (80% consent) |

---

# B17. DATA MODEL [ADOPTED]

## The problem we found

The original model ran `PROJECT → LAND_PARCEL → OWNERSHIP → COMPENSATION`. Only an owner can receive anything.

But **s.3** defines *affected family* far wider — agricultural labourers, tenants, share-croppers, livelihood-dependent persons, Scheduled Tribes and forest dwellers losing recognised rights, families dependent on forests or water bodies. Many own nothing and still receive R&R.

The PS requires us to report *"number of affected and displaced families"* and *"R&R progress."* With the original schema neither number can be produced.

## Core entities

| Entity | Purpose |
|---|---|
| `PERSON` | A party, with no assumption about rights |
| `PARCEL_INTEREST` | Person ↔ parcel. `interest_type`: owner, tenant, sharecropper, labourer, forest_right_holder, easement, mortgagee |
| `AFFECTED_FAMILY` | Person ↔ project. `affected_type`, `is_displaced`, `is_multiple_displacement` (s.39), and **vulnerability flags**: `is_sc_st`, `is_female_headed`, `is_destitute`, `has_disability` |
| `ENTITLEMENT` | One row per head, First and Second Schedule |
| `RNR_PASSBOOK` | Per-family signed record of entitlements, allotments, annuity milestones — citizen-accessible |
| `DISBURSEMENT` | Payments against an entitlement, restricted `hold_reason`, indemnity bond ref, acceptance type (protest / absolute) |
| `ACKNOWLEDGEMENT` | Receipt confirmation: WebAuthn, OTP or officer-attested |
| `ANNUITY_SCHEDULE` | Multi-year disbursement calendar with per-instalment status |
| `OBJECTION` | s.15 within 60 days; s.64 reference to the Authority |
| `CLAIM` | s.21 compensation claims — distinct from objections |
| `CONSENT_REGISTER` / `CONSENT_RECORD` | Certified eligible-voter list; individual consents with observer certification |
| `STATUTORY_DEADLINE` | The clock per stage, with rule reference and consequence |
| `STATUTE_RULE_PACK` | Governing act, state variation, stage definitions, entitlement heads, version, effective date |
| `STAGE_REJECTION` | Reason code and target stage for every returned file |
| `ESCROW_ACCOUNT` | `gate_type`: initial (SIA/admin) or full (acquisition). Demand note, deposits, sufficiency certificate, running balance |
| `LAND_PARCEL` | PostGIS geometry column; `land_class`; recorded area; field-measured area; affected area |
| `PARCEL_VERTEX` | Per-corner record with photo, accuracy, capture method |
| `FIELD_SURVEY` | `survey_type`: parcel_identification or joint_inspection |
| `COMMON_PROPERTY_RESOURCE` | Wells, grazing grounds, places of worship, schools, clinics affected |
| `MUTATION` | Revenue record changes, both ends of the process |
| `RESETTLEMENT_SITE` | Layout, amenity milestones, readiness percentage, commissioning certificate |
| `LEGAL_CASE` | LARR Authority reference, hearings, orders, differential liability |
| `STATE / DISTRICT / BLOCK / VILLAGE` | LGD hierarchy for roll-up |
| `POST` / `POST_ASSIGNMENT` | Roles attach to posts, not people |
| `APPROVAL` | **With `approver_user_id`** |
| `NOTIFICATION` | **With `recipient_user_id`** and `escalation_level` |
| `DOCUMENT` | Versioned, hashed, with uploader |
| `ATTESTATION` | Per-document declaration with wording version |
| `AUDIT_LOG` | Append-only, prev-hash chained |
| `BLOCKCHAIN_EVENT` | **Polymorphic** (`entity_type` + `entity_id`) |

## Named artefacts to model as document types

Land Schedule Matrix · Land Acquisition Plan / Alignment Overlay Map · CPR Inventory Report · Draft and Final SIA Report · SIMP · Public Hearing Response Matrix · Expert Group Recommendation Report and dissent notes · Master Consent Register · Certificate of Consent Procurement · s.11 Notification · s.12 Notice of Entry · Joint Inspection Report · LAO Inquiry Report · Draft and Approved R&R Scheme · Second and Third Schedule Entitlement Matrix · Resettlement Colony Layout · Financial Sufficiency Certificate · s.19 Declaration · s.21 Notice · Master Claims Register · Collector's Award · R&R Award · s.37 Notice · Indemnity Bond · Form of Payment Acceptance · Vacation Certificate · Possession Panchnama · Certificate of Possession · Handing-Over / Taking-Over Certificate · Mutation Extract · Legal Clearance Dossier · Lifetime Compliance Dossier

---

# B18. STATUTORY REFERENCE — AUTHORITATIVE NUMBERS

**Use these. Not the numbers in the process document or the blueprint.**

## Chapter map

| Chapter | Sections | Subject |
|---|---|---|
| I | 1–3 | Preliminary |
| II | 4–9 | Social Impact and Public Purpose |
| III | 10 | Food Security |
| IV | 11–30 | Notification and Acquisition |
| V | 31–42 | R&R Award |
| VI | 43–47 | Procedure and Manner of R&R |
| VII | 48–50 | National Monitoring Committee |
| VIII | 51–74 | LARR Authority |
| IX | 75–76 | Apportionment |
| X | 77–80 | Payment |
| XI | 81–83 | Temporary Occupation |
| XII | 84–90 | Offences and Penalties |
| XIII | 91–114 | Miscellaneous |

## Key figures

| Rule | Value |
|---|---|
| Private company prior consent | **80%** |
| PPP prior consent | **70%** |
| SIA completion | 6 months |
| Expert Group recommendation | 2 months |
| SIA lapse if no s.11 notification | 12 months |
| Objection window | 60 days |
| Declaration after s.11 | 12 months |
| Award after declaration | 12 months |
| s.21 notice appearance date | Not less than 30 days, not more than 6 months |
| **Rural market-value factor** | **1.00 to 2.00** |
| **Urban market-value factor** | **1.00** |
| **Solatium** | **100%** |
| Additional amount on market value | 12% per annum (s.30(3)) |
| Compensation before possession | 3 months |
| Monetary R&R entitlements | 6 months |
| Infrastructure R&R entitlements | 18 months |
| R&R before submergence | 6 months prior |
| Urgency advance compensation | 80% |
| Urgency additional compensation | 75% |
| SC/ST first instalment | At least one-third |
| R&R Committee threshold | 100 acres or more |
| Authority reference disposal | 6 months |
| Authority award copy | 15 days |
| High Court appeal | 60 days, plus up to 60 more |
| Interest on unpaid compensation | 9% p.a. |
| After one year unpaid | 15% p.a. |
| Temporary occupation | Maximum 3 years |
| Return of unutilised land | 5 years |
| Appreciated value share (s.102) | 40% |
| Private purchase sharing (s.46) | 40%, purchases on or after 5 Sept 2011 |

## Second Schedule entitlements

| Entitlement | Amount |
|---|---|
| Rural house | As per Indira Awas Yojana specifications |
| **Urban constructed house** | **Not less than 50 sq m plinth area** |
| Urban opt-out assistance | Not less than ₹1.5 lakh |
| Land for land (irrigation projects) | Minimum 1 acre in command area |
| Land for land, SC/ST | Equivalent to land acquired or 2.5 acres, whichever is lower |
| Developed land (urbanisation projects) | 20% reserved for land-owning PAFs |
| Employment / annuity choice | Job, **or ₹5 lakh one-time, or annuity not less than ₹2,000/month for 20 years** |
| Subsistence grant | **₹3,000/month for one year** |
| SC/ST displaced from Scheduled Areas | Additional ₹50,000 |
| Transportation | ₹50,000 one-time |
| Cattle shed / petty shop | Minimum ₹25,000 |
| Artisan / small trader grant | Minimum ₹25,000 |
| Resettlement allowance | ₹50,000 |
| SC/ST relocated outside district | Additional 25% R&R benefits + one-time ₹50,000 |

## Third Schedule — 25 infrastructure amenities

All-weather road link and roads within resettled villages · drainage and sanitation · assured safe drinking water · drinking water for cattle · grazing land · Fair Price Shops · Panchayat Ghars · village post office with savings facility · seed-cum-fertilizer storage · basic irrigation for allotted agricultural land · transport facilities · burial or cremation ground · individual toilet points · electric or non-conventional energy connections · Anganwadi · school under the RTE Act 2009 · **sub-health centre within 2 km** · Primary Health Centre · children's playground · **one community centre per 100 families** · **places of worship and chowpal per 50 families** · separate land for traditional tribal institutions · preservation of forest rights and common property resources · security arrangements · veterinary service centre

## Offences

- **s.84** — false information or document: imprisonment up to 6 months, fine up to ₹1 lakh, or both
- **s.85** — contravention on compensation or R&R: 6 months to 3 years, or fine, or both
- **s.89** — offences are non-cognizable

## Fourth Schedule enactments (s.105) — thirteen

Ancient Monuments and Archaeological Sites and Remains Act 1958 · Atomic Energy Act 1962 · Damodar Valley Corporation Act 1948 · Indian Tramways Act 1886 · Land Acquisition (Mines) Act 1885 · Metro Railways (Construction of Works) Act 1978 · National Highways Act 1956 · Petroleum and Minerals Pipelines Act 1962 · Requisitioning and Acquisition of Immovable Property Act 1952 · Resettlement of Displaced Persons (Land Acquisition) Act 1948 · Coal Bearing Areas Acquisition and Development Act 1957 · Electricity Act 2003 · Railways Act 1989

**The Cantonments Act 2006 and SEZ Act 2005 are NOT among them**, despite what the process document says.

**[VERIFY]** Whether Fourth Schedule acquisitions currently carry LARR compensation and R&R by a later order is not established by the 2013 Act PDF.

---

# B19. ERRORS IN OUR SOURCE FILES — NEVER REPEAT

## In the process document

| It says | Correct |
|---|---|
| Rural multiplier "1.25× to 2×" | **1.00 to 2.00** (the document also contradicts itself, saying 1.0–2.0 elsewhere) |
| Housing "50 sq m rural or **24 sq m urban**" | Urban constructed house **not less than 50 sq m** |
| Annuity and jobs "under the **Third** Schedule" | R&R entitlements are the **Second** Schedule |
| 12% runs "from SIA publication to award declaration" | "the statutory period specified in s.30(3)" — [VERIFY] |
| s.38 possession notice of 60 days | Not stated in the Act reference — [VERIFY] |
| Urgency possession after 30 days | "after the period provided in the section" — [VERIFY] |
| Cantonments Act 2006, SEZ Act 2005 as Fourth Schedule | Neither is in the list of 13 |
| Consent failure means "cannot re-apply for the same land parcel" | Not in the Act reference — [VERIFY] |

The document cites Scribd twice. Treat its specific numbers as needing verification.

## In the blueprint

**Wrong chapter citations in five of ten modules:**

| Module says | Actually |
|---|---|
| C: "Chapters II and III (ss.4–9)" | ss.4–9 is **Chapter II** only |
| E: "Chapters IV, V and VI (ss.16–30)" | ss.16–30 is **Chapter IV** only |
| F: "Chapters IV and V (ss.19–30)" | ss.19–30 is **Chapter IV** only |
| G: "Chapters VI and VII (ss.31–38)" | ss.31–38 is **Chapter V** |
| I: "Chapters IX and X (ss.94–101)" | ss.94 and 101 are **Chapter XIII** |

Module H's "Chapter VIII (ss.64–74)" is correct.

**Other blueprint errors:** rural multiplier "1.25x to 2x" (twice) · 12% "from the date of Section 11 notification" (conflicts with the process document) · s.21 "30-day window" (30 days is a floor, not a fixed window) · "subsistence allowances for 1 years" (typo) · "Section 31 and the Third Schedule" for pre-displacement infrastructure (s.32 covers Third Schedule amenities)

---

# B20. BLUEPRINT FIXES PENDING

| # | Conflict | Fix |
|---|---|---|
| 1 | **Module F calculates compensation** | Rewrite to assist-and-confirm. Module E's "Automated Entitlement Calculator" has the same problem. |
| 2 | **Modules D and G depend on Aadhaar** | Mark both as adapter interfaces with mocks |
| 3 | **Module B has no field capture path for parcel boundaries** (Module C does have field GPS for households) | Add two paths: cadastral import, and walk-the-boundary |
| 4 | **Module G has no acknowledgement step** | Add between DBT and possession verification |
| 5 | **Module C captures biometric identifiers during household surveys** | Remove. Photo plus recorded consent instead. Biometrics only at acknowledgement, matched on-device. |
| 6 | **Module D puts the s.11 notification before consent** | Reverse. Consent (Stage 4) precedes notification (Stage 5); under s.2 consent runs alongside the SIA. |
| 7 | **Module E reuses the SIA census as the R&R census** | Separate them. s.4 SIA study and s.16 survey and census are two statutory exercises. |
| 8 | **Module I omits s.102 appreciated-value sharing** | Add it. The process document has it at Stage 10.4. |

**Also missing from the blueprint:** rejection and termination paths · the statutory timeline engine · rule-packs · officer attestation · visibility tiers · the correction/versioning workflow · posts-not-people roles · maker-checker separation. Blockchain appears once as "Blockchain/WORM Storage" — offering two alternatives weakens the claim.

## The NH Act tension

The blueprint's demo is an **NHAI national highway**, acquired in practice under the **National Highways Act 1956** — a Fourth Schedule enactment with its own notification chain — not the full RFCTLARR Stage 1–10 sequence.

This is an opportunity, not a flaw:

> "Same engine. This project runs the National Highways Act rule-pack. Switch the pack and the same parcel runs the full RFCTLARR chain."

---

# B21. WHAT WE ARE DELIBERATELY NOT BUILDING

| Not building | Instead |
|---|---|
| Real DigiLocker, Aadhaar, PFMS, treasury, Bhu-Naksha connections | Integration Layer with stub adapters and a published contract |
| GeoServer | Serve GeoJSON straight from PostGIS |
| A compensation calculator | Record the Collector's award; validate and track it |
| AI that approves, rejects or validates documents | AI suggests; a human accepts |
| Full multilingual support | UI strings and Act summaries in 2–3 languages |
| Large-scale model training | Feature-based scoring on seeded data, explained honestly |
| A production blockchain network | Local dev chain; permissioned network as the direction |
| Full court and dispute management | Objection and reference records only |
| Production-scale R&R automation | R&R **tracking**, which the PS does require |
| Microservices | One backend unless there is a concrete reason |
| Native AR boundary mapping | Walk-to-corner GPS |

Never claim live access to a restricted government system, or that nothing like this exists anywhere, without verifying it.

---

# B22. TECHNOLOGY STACK

| Layer | Choice |
|---|---|
| Frontend | React / Next.js, Vite, Tailwind |
| Backend | Node.js / NestJS or equivalent REST backend |
| Database | **PostgreSQL + PostGIS** |
| GIS | Leaflet / OpenLayers. **No GeoServer.** |
| Blockchain | EVM-compatible permissioned. Besu (direction), Hardhat (dev), Solidity, ethers.js |
| Storage | Object storage for documents and images |
| AI | LLM assistant + authorised data retrieval layer |
| Field app | Offline-first PWA, WebAuthn for acknowledgement |
| Security | RBAC, field-level authorisation, TLS, encryption, append-only audit log |

**BPMN is not part of the architecture.** A normal state machine driven by rule-pack config. No Camunda. No microservices without a concrete reason.

---

# B23. WHICH IDEAS CAME FROM WHERE

So nobody claims a source that does not exist when questioned.

**Traceable to the Act or the PS (citable):**
statutory deadlines and consequences (ss.14, 19, 25, 38, 80) · rule-pack justification (ss.24, 105, 107, 108) · maker-checker (ss.16–18) · partial acquisition (s.94) · attestation wording (s.84) · affected-family definition (s.3) · all of B18

**Traceable to the research documents:**
the ten stages and their sub-stages · officials and departments per stage · documents produced at each stage · rejection and termination routes · consent register sub-process · Joint Inspection Report · boundary pillars · Panchnama · disbursement camps with biometric authentication · R&R passbook · project categories · state acts list · module A–J structure · constraint layers · Digital R&R Passbook · annuity audit

**Our own design decisions (no external source):**
WebAuthn as the mechanism · the disbursed-vs-acknowledged gap as a headline metric · rule-packs as a versioned layer with cases pinned to versions · walk-to-corner vertex capture with per-corner photos · recorded vs field-measured area both stored · canonical geometry hashing · the cadastral data strategy (OSM, LGD, Bhuvan, Voronoi, ESRI/Bing tracing) · attestation reframing of the tick box · field-level visibility tiers · posts-not-people roles · the six-dashboard grouping · PERSON/PARCEL_INTEREST model · blockchain off the critical path · the mock adapter pattern · the chainage strip · colour-by-dimension map switching · the demo narrative · offline airplane-mode demo, hold-to-average, mock-location detection, photo-inside-polygon check

---

# B24. OPEN QUESTIONS

- [ ] **Team size and stack strength** — still unanswered. Changes the build priority order.
- [ ] **Does the LARR Authority (ss.51–74) get a login?** Module H argues yes, thin. The *state* "deposited with Authority" must exist in the data either way.
- [ ] **Citizen portal in the MVP must-have list?** Recommend yes — read-only, no login, cheap, most human moment in the demo.
- [ ] **Fourth Schedule enactments** — verify whether they currently carry LARR compensation and R&R before saying it on stage.
- [ ] **Inter-state jurisdiction** — build it, or note it as designed-for but not demonstrated?
- [ ] **NH Act tension** — make the rule-pack the answer, or change the demo project?

**Resolved:** state is **Maharashtra**; demo project is the **Pune-Satara Expressway Expansion**, a linear corridor.

---

# B25. DEMO NARRATIVE — 7 MINUTES

The deck, the MVP and the video tell the **same story**.

1. National map, three red breach alerts
2. Click the worst — timeline shows *"declaration lapses in 34 days"*
3. Collector draws a project boundary — s.10 and s.41 constraints fire automatically
4. Field officer on a phone: walk the boundary, **airplane mode on**, capture, mode off, watch it sync
5. Back on the portal: parcel appears shaded; click a corner, the photo taken there opens
6. Open a family's money view: **disbursed vs acknowledged**, with the gap visible
7. Role switcher — Collector to Public — watch the hold reason disappear
8. Close on the rule-pack: same engine, an NH Act project, different rules

**Protect two things:** the demo must be reproducible (fixed seed, reset button, rehearsed path), and the UI must never freeze waiting for a blockchain transaction.

---

# B26. SEQUENCE FROM HERE

1. Answer the open questions in B24 — especially team size
2. **Write the seed data generator on day one**
3. Technical design — schema, API contracts, rule-pack format, task split
4. Build A, B, D, G properly; C, E, F thin; H, I, J as dashboards
5. Record the video with time to spare

## Existing artefacts

- **NLAMS Decision Log** (Claude doc) — narrative version with source attribution
- **Three Mermaid diagrams** — `01-architecture.mermaid`, `02-operational-workflow.mermaid`, `03-er-diagram.mermaid`. **Not yet render-tested.**
- **This file** — the final master document

---

*Update this file when decisions change; do not let it drift behind the build.*
