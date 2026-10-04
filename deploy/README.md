# Deploy BhoomiSetu for the SIH submission

Two ways, both free:

- **A. Render (recommended)** — always reachable, no laptop needed, no credit card. Updates itself every time
  `main` changes.
- **B. Laptop + Cloudflare tunnel** — for a live presentation from your own machine.

> Hugging Face Spaces was the first choice, but since autumn 2026 HF marks Docker Spaces as **Paid** (PRO). The same
> image still runs there if you have PRO: use `deploy/cloud/hf-README.md` as the Space's README.

## A. Free cloud link on Render (no card)

The whole stack (Postgres/PostGIS, blockchain node, API, portal, field app) runs in one container
(`deploy/cloud/`). GitHub Actions builds it (with the demo data already loaded) and publishes it as
`ghcr.io/frchaitanyaaa/bhoomisetu:latest`; Render runs it. The link looks like `https://bhoomisetu.onrender.com`.

**One-time setup (about 10 minutes, after the first image build of ~15 minutes):**
1. GitHub → **Actions** → **Deploy (cloud image)** → wait for the green run (it starts on every push to `main`;
   **Run workflow** starts it by hand).
2. Make the image public: GitHub profile → **Packages** → `bhoomisetu` → **Package settings** → **Change
   visibility** → **Public**.
3. Sign up at https://dashboard.render.com with **GitHub** (no card asked for the free plan).
4. **New → Web Service → Existing image** → Image URL `ghcr.io/frchaitanyaaa/bhoomisetu:latest` → Next → name
   `bhoomisetu` → instance type **Free** → **Deploy**. (Leave the port alone: the image listens on Render's `PORT`.)
5. When the log says `starting portal`, open `https://bhoomisetu.onrender.com` (Render shows the exact URL at the
   top). Submit that link.
6. Auto-update: Render → the service → **Settings → Deploy Hook** → copy the URL. GitHub → repo **Settings →
   Secrets and variables → Actions → New repository secret** → name `RENDER_DEPLOY_HOOK`, value = that URL.
   From then on every push to `main` builds a new image and Render redeploys it (~15–20 min in total).

**What to expect**
- Free instances sleep after 15 minutes without visitors; waking takes about 3 minutes. Because evaluators may open
  the link at any time, keep it awake (one always-on service uses ~744 of the 750 free hours a month):
  - **Primary:** a free uptime monitor, no card — https://uptimerobot.com (HTTP(s) monitor, interval 5 min) or
    https://cron-job.org (every 10 min) on `https://bhoomisetu-latest.onrender.com/api/v1/health`.
  - **Backup:** `.github/workflows/keep-awake.yml` pings every 10 minutes and logs health and the anchored count
    (GitHub can delay scheduled runs, so it is not enough on its own). Set the repository variable `PUBLIC_URL` if
    the Render URL changes.
- On wake-up the records are re-anchored on a fresh blockchain in the background (about 3 minutes); until then the
  landing page shows fewer anchored records and Trust → Check may say *pending*.
- Storage is not kept between restarts: each start begins from the seeded demo (MH-PSX at "34 days"). Anything an
  evaluator changes is reset at the next restart.
- Phones work (HTTPS): GPS, camera and fingerprint prompts appear.
- Limits we measured on the image (512 MB / 0.1 CPU, Render free): peak memory about 380 MB; pages take 2–3 s.

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
