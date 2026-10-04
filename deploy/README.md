# Deploy BhoomiSetu for the SIH submission

Two ways, both free:

- **A. Hugging Face Space (recommended)** — always reachable, no laptop needed, no credit card. Updates itself
  every time `main` changes.
- **B. Laptop + Cloudflare tunnel** — for a live presentation from your own machine.

## A. Free cloud link on Hugging Face Spaces (no card)

The whole stack (Postgres/PostGIS, blockchain node, API, portal, field app) runs in one container
(`deploy/hf/`). The link looks like `https://<your-hf-username>-bhoomisetu.hf.space`.

**One-time setup (about 15 minutes, then 15–20 minutes of first build):**
1. Sign up at https://huggingface.co/join (email only).
2. Create the Space: https://huggingface.co/new-space → name `bhoomisetu` → SDK **Docker** → template
   **Blank** → hardware **CPU basic (free)** → visibility **Public** → Create.
3. Create a token: https://huggingface.co/settings/tokens → **Create new token** → type **Write** → copy it.
4. On GitHub, open the repo → **Settings → Secrets and variables → Actions**:
   - tab **Secrets** → **New repository secret** → name `HF_TOKEN`, value = the token.
   - tab **Variables** → **New repository variable** → name `HF_SPACE`, value = `<your-hf-username>/bhoomisetu`.
5. GitHub → **Actions** → **Deploy to Hugging Face Space** → **Run workflow** (branch `main`).
6. Open the Space page; the **Logs** tab shows the build. When it says *Running*, open the direct link
   `https://<your-hf-username>-bhoomisetu.hf.space` (use this link, not the framed huggingface.co page —
   sign-in needs it). Submit that link.

**After that:** every push to `main` redeploys automatically (GitHub Action → Space rebuild, ~10–15 min).

**What to expect**
- The Space sleeps after about two days without visitors. The next visitor wakes it; the first page then takes
  1–2 minutes while the database, blockchain node and demo data start.
- Storage is not kept between restarts: each start loads the demo data fresh (MH-PSX at "34 days") and anchors
  every record on a fresh chain. Anything an evaluator changes is reset at the next restart.
- Phones work (HTTPS): GPS, camera and fingerprint prompts appear.

## B. Laptop + Cloudflare tunnel (presentations)

The whole stack (Postgres/PostGIS, Redis, MinIO, Hardhat chain node, NestJS API, Next.js portal, field PWA)
runs on one laptop in **production mode**, and a Cloudflare tunnel gives it a public **HTTPS** URL.
HTTPS matters: phones need it for GPS, camera and fingerprint (WebAuthn).

**The laptop must stay on, awake and online for as long as evaluators may open the link.**

## 0. One-time install (Arch Linux)
```bash
sudo pacman -S --needed docker docker-compose docker-buildx cloudflared   # or: yay -S cloudflared-bin
sudo systemctl enable --now docker
# Node 24 + pnpm (if not already): fnm install && fnm use && corepack enable
```

## 1. Get the release
```bash
git fetch origin && git checkout main && git pull
cp -n .env.example .env
```
Do **not** `export` the variables from `.env` into your shell (no `set -a; . ./.env`). Building the portal with
`NODE_ENV=development` in the shell breaks `next build` (`_global-error` prerender error). The API and portal read
`.env` themselves.

## 2. Build and start (from the repo root)
```bash
pnpm install --frozen-lockfile
pnpm infra:up                                   # waits until Postgres/Redis are healthy
pnpm db:reset                                   # migrate + seed the demo data (11 projects)
pnpm chain:deploy                               # anchor contract → .env.local
pnpm --filter @bhoomisetu/field build:portal    # field app served by the portal at /field
pnpm build                                      # API + portal + packages, production build
```
Open three terminal tabs:
```bash
# tab 1 — API on :3001
node apps/api/dist/main.js

# tab 2 — portal on :3000 (production server)
cd apps/portal && pnpm exec next start --port 3000

# tab 3 — public HTTPS URL; keeps the laptop from sleeping while it runs
systemd-inhibit --what=sleep:idle --why="SIH demo" pnpm demo:tunnel -- --no-build
```
Tab 3 prints a URL like `https://something-random.trycloudflare.com` and three lines.

## 3. Point the app at the public URL
Put the three printed lines into `.env` (replace the existing values):
```bash
PUBLIC_BASE_URL=https://something-random.trycloudflare.com
WEBAUTHN_RP_ID=something-random.trycloudflare.com
WEBAUTHN_ORIGIN=https://something-random.trycloudflare.com
```
Then restart **tab 1** (Ctrl+C, `node apps/api/dist/main.js`). The portal does not need a restart.

## 4. Check before you submit (on your phone, mobile data — not your Wi-Fi)
1. `https://…/` → landing page loads with the DEMO DATA badge.
2. Officer sign in → `oversight@bhoomisetu.local` / `bhoomisetu-demo` → National dashboard shows 3 breaches.
3. `/gis` → map with parcels; `/project/<MH-PSX>/timeline` → "34 days left · s.19".
4. `/portal/search` → type "Khed" → Khed Shivapur appears.
5. `/portal/grievance` → file → tracking number → `/portal/track` shows it.
6. Sidebar **Ask AI** → ask "Which deadlines breach in the next 30 days?" → answer with MOCK badge.
7. `/field` opens the field app (phone camera/GPS prompts appear).
8. Landing page shows "Chain node live" and a non-zero "Records anchored"; `/trust` → Check any row → ✓ Verified;
   its QR opens the public `/verify/...` page on the phone without login.
9. Signed in as `oversight`: `/trust/audit` → Verify audit chain → "Chain intact".

Submit that URL. **If the laptop restarts or tab 3 stops, the URL changes** — start tab 3 again, update the three
`.env` lines, restart tab 1, and update the submitted link if the form allows.

## 5. If something breaks
| Symptom | Fix |
|---|---|
| `db:reset` fails with "Connection terminated" | Run `pnpm infra:up` again (it waits for health), then `pnpm db:reset` |
| Portal build fails at `_global-error` | You exported `.env` into the shell. Open a new terminal and run `pnpm build` again |
| Pages load but data is missing | Tab 1 (API) is not running, or Postgres is down: `docker compose ps` |
| Chain badges say "Proof pending" | Chain node not up: `docker compose up -d chain && pnpm chain:deploy`, restart tab 1. After a chain restart the API re-anchors every record by itself within about a minute |
| Fingerprint/acknowledgement fails on the phone | The three WebAuthn lines in `.env` don't match the current tunnel URL; fix and restart tab 1 |
| Port 5432/6379 already in use | `sudo systemctl stop postgresql redis` |

## What is mocked in this release (say it before a judge does)
Payments, identity, cadastral data, SMS and the language model are mock adapters (MOCK badges). Citizen sign-in and
grievances on `/portal` are a browser-only mock of the intended flow. All personal data is synthetic.
