# Manual test checklist (run before you submit the link)

Run on the Render link (`deploy/README.md` §A — open it a few minutes early so it is awake) or on your laptop after §B steps 1–3; do the phone part on **mobile data**, at that public URL (Render link or tunnel URL).
Password for every account: `bhoomisetu-demo`. Tick each box; anything that fails, note the page and what you saw.

## 1. Landing and sign-in
- [ ] `/` shows the navy hero, **"Chain node live"**, a non-zero **Records anchored** count and a block number
- [ ] Hero with 3 tiles, six innovation cards and the "One account per screen" panel with 8 accounts; fits a phone screen
- [ ] Each "Sign in →" lands on a different screen: National · State (/state/27) · Collector desk · District (/district/…) · Field office · Proposals · role switcher; "Open field app" opens /field
- [ ] "Sign in →" on **National dashboard** opens `/login` with email and password filled → Sign in → `/national`
- [ ] Same for **Collector, Pune** → `/collector`, and **Field office** (talathi) → `/field-office`
- [ ] `demo@` → asks you to choose a post → chosen post's screen opens
- [ ] Wrong password once → clear error message (don't try 5 times: the account locks for 15 min)

## 2. Officer screens (sign in as `oversight`)
- [ ] National: 3 red breach alerts, gap tile (disbursed vs acknowledged), map, state table
- [ ] Click the worst alert → MH-PSX timeline shows **"34 days"** and s.19 "deemed rescinded"
- [ ] `/gis`: satellite map with parcels; colour-by switch changes colours; click a parcel → record panel → 360°
- [ ] Sidebar **Ask AI** → click a suggested question → answer with a MOCK badge
- [ ] Rule packs: switch between Maharashtra and NH Act packs; VERIFY banner visible
- [ ] **Trust center** (`/trust`): node live, contract address, KPI cards, ledger table; **Check** on a row → ✓ Verified with both hashes; QR shown
- [ ] **Audit log** (`/trust/audit`) → Verify audit chain → "Chain intact"

## 2b. Pages that used to say "Soon"
- [ ] Sidebar has no faded "Soon" items; State/District dashboard, Proposals, Deadlines & alerts, Analytics, Reports (MIS) open
- [ ] Reports: CSV and PDF download; Preview shows rows
- [ ] Ask AI: "todays date" → statutory clock date; "hello" → list of what it can answer

## 2c. Move MH-PSX from S07 to S08 (do it last, then `pnpm db:reset`)
- [ ] `lao.satara` → project timeline: blocked reasons are listed; Escrow steps → demand ₹25,00,00,000 → deposit same; Upload & attest S19 declaration, Gazette copy, Newspaper clipping (any PDF)
- [ ] `collector.pune` → Escrow steps → Certify sufficiency
- [ ] `lao.satara` → SUBMIT; `collector.pune` → APPROVE (tick attestation) → stage becomes S08 Award

## 3. District and field (sign in as `collector.pune`, then `lao.satara`, then `tehsildar.haveli`)
- [ ] Collector: deadline board with countdowns and consequences
- [ ] Project → Families → open a family → money page shows ₹ amounts and chain badge on paid rows
- [ ] Award page: entitlement checks listed (solatium, SC/ST ⅓)
- [ ] LAO lands on the Satara district dashboard; Tehsildar lands on the field office queue
- [ ] Sidebar shows **Trust center**; **Audit log** is not listed for these posts

## 4. Phone (over the Render link or tunnel URL)
- [ ] Landing page readable, no sideways scrolling
- [ ] On the laptop (open it at the **public URL**, not localhost, so the QR points there), Trust center → Check a row → scan the QR with the phone → public proof page says **"Proof confirmed on the blockchain"** without login
- [ ] `/field` opens the field app; sign in as `talathi.khedshivapur`; location and camera prompts appear
- [ ] (If time) payment acknowledgement: enrol link from a family's money page → fingerprint on the phone → acknowledge → row turns acknowledged on the laptop

## 5. Citizen portal (signed out)
- [ ] `/portal/search` → type "Khed" → choose **Khed Shivapur** → Search → MH-PSX parcels listed
- [ ] Notices page lists published notices
- [ ] Grievances: file one → tracking number → Track shows "Filed"
- [ ] Officer `/grievances` (same browser) → Assign → Start work → citizen Track shows "In progress"
- [ ] Language switch en / हिन्दी / मराठी changes the portal text

## 6. Tamper demo (optional, for Q&A; do it last)
- [ ] `pnpm demo:tamper` → copy the record ID it prints → Trust center → Verify → **MISMATCH** (red)
- [ ] `pnpm db:reset` (then restart the API) to restore the clean demo data before evaluators open the link
