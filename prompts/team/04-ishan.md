# 04 — Ishan · branch `ishan` (you create it)

> **First time only — create your own branch** (it does not exist on GitHub yet):
> ```bash
> git clone https://github.com/frchaitanyaaa/land-acquisition-.git bhoomisetu && cd bhoomisetu
> git checkout -b ishan origin/atulit
> git push -u origin ishan
> ```
> After that, every checkpoint: `git fetch origin && git merge origin/atulit`, then push and open a PR `ishan → atulit`.

You own **deployment** (priority 1: without it nothing gets submitted) and the **trust layer UI** on top of the
blockchain code that already works. Read `00-shared-context.md` first. Load the `ux4g-design` skill before UI work.
Start I1 right now.

## You own (others do not edit these)
- `deploy/**` (new), `apps/api/Dockerfile` (new), `.dockerignore` (new), `vercel.json` (new, repo root)
- The `/api` rewrite destination in `apps/portal/next.config.ts` (one line: read `API_ORIGIN`; tell Chaitanya)
- `packages/chain/**`, `apps/api/src/chain/**`, `apps/api/src/jobs/anchor*`, new `apps/api/src/jobs/chain-audit*`
- `apps/portal/components/trust/**` (new; move `components/chain-badge.tsx` here and update imports),
  `apps/portal/lib/chain-api.ts`, `apps/portal/app/(dashboards)/trust/**` (new), `apps/portal/app/(public)/verify/**` (new)

## What already works (do not rebuild)
`AnchorRegistry.sol` + Hardhat tests (`pnpm test:contracts`), deploy script (`pnpm chain:deploy` → `.env.local`),
canonical payload builders `apps/api/src/chain/payloads.ts` (no PII), anchor job (single relayer, retries, batch
backlog, backfill of seeded records), `GET /chain/verify/:entityType/:entityId?version=`, `GET /chain/status`,
`pnpm demo:tamper`, `GET /audit/verify` (audit hash chain), portal `ChainBadge`.

## I1 — Free deployment · **start now; staging live by 2 Oct 14:00**
Target: **portal on Vercel (Hobby, free)** + **everything else on one free VM** with Docker. Vercel forwards `/api/*`
to the VM, so the browser sees one origin (cookies, WebAuthn and SSE keep working).
1. VM (pick the first that works in < 30 min):
   - **Azure for Students** (no credit card, uses a college email): Ubuntu 24.04, size B2s (2 vCPU, 4 GB), open
     ports 22, 80, 443 only.
   - **Oracle Cloud Always Free** (needs a card for verification): Ampere A1 2 OCPU / 12 GB, Ubuntu 24.04. ARM: use
     image `imresamu/postgis:16-3.4` instead of `postgis/postgis:16-3.4` (no arm64 build).
   - Install Docker + compose plugin; add a 2 GB swap file.
2. Free HTTPS name: DuckDNS subdomain (e.g. `bhoomisetu-api.duckdns.org`) → VM public IP.
3. `apps/api/Dockerfile` (multi-stage, `node:24-slim`, `corepack enable`, `pnpm install --frozen-lockfile`, build
   `packages/*` + api, run `node apps/api/dist/main.js`) and `.dockerignore`.
4. `deploy/docker-compose.prod.yml`: `postgres` (PostGIS, volume, init scripts from `docker/postgres/`), `redis`,
   `minio` + `minio-init`, `chain` (existing `packages/chain/Dockerfile`), `api` (image above; env from
   `deploy/.env.prod`; depends on healthy postgres/redis), `caddy` (ports 80/443). No ports except Caddy exposed.
5. `deploy/Caddyfile`: `bhoomisetu-api.duckdns.org { reverse_proxy api:3001 }` with `flush_interval -1` so SSE streams.
6. `deploy/.env.prod.example` (committed, no secrets) and `deploy/.env.prod` (on the VM only): `NODE_ENV=production`,
   strong `JWT_*_SECRET` and `PII_ENCRYPTION_KEY`, `DEMO_MODE=true`, `DEMO_NOW=2026-12-10T10:00:00+05:30`,
   `PUBLIC_BASE_URL`, `WEBAUTHN_RP_ID=<project>.vercel.app`, `WEBAUTHN_ORIGIN=https://<project>.vercel.app`,
   `PORTAL_URL` same, `OUTBOX_RELAY=on`, `LLM_PROVIDER=mock`, all adapters `mock`, `CHAIN_RPC_URL=http://chain:8545`.
7. `deploy/deploy.sh`: `git pull && docker compose -f deploy/docker-compose.prod.yml up -d --build --wait` then
   one-time `pnpm db:reset` + `pnpm chain:deploy` executed inside the api container (document both).
8. Vercel: import the GitHub repo, **Root Directory** `apps/portal`, framework Next.js, install command
   `cd ../.. && pnpm install --frozen-lockfile`, build command
   `cd ../.. && pnpm --filter @bhoomisetu/field build:portal && pnpm --filter @bhoomisetu/portal build`
   (ensure `public/tiles/demo-region.pmtiles` from Atulit is included). Env: `API_ORIGIN=https://bhoomisetu-api.duckdns.org`,
   `DEMO_MODE=true`. Change the rewrite in `next.config.ts` to `${process.env.API_ORIGIN ?? 'http://localhost:3001'}`.
   Production branch: `atulit` until 3 Oct night, then `main`.
9. If SSE drops through Vercel's proxy, the portal must still work: confirm `use-live-updates.ts` reconnects
   (EventSource does) and dashboards also refetch every 60 s.
10. `deploy/README.md`: the runbook (create VM, DNS, env, first deploy, redeploy, reseed, view logs, backup plan).
11. **Backup** ready by 3 Oct 18:00: one laptop running `pnpm dev` + `pnpm demo:tunnel` (Cloudflare quick tunnel);
    steps in `deploy/README.md`.
**Done when**: `https://<project>.vercel.app` loads, login as `oversight@bhoomisetu.local` works, national dashboard
shows 3 breaches, a WebAuthn acknowledgement works from a phone on that URL.

## I2 — Trust Center · 2 Oct, 14:00 → 20:00
`/trust` in the officer shell (all officer roles read-only; SUPER_ADMIN sees retry):
1. Navy hero "Trust center — every approved record, provable", chips: chain mode (Hardhat local / Simulated),
   network + contract address (shortened), relayer address, last block.
2. KPI cards: anchored, queued, submitted, failed, mismatches found (from `GET /chain/status`; extend it if fields
   are missing).
3. Recent anchors Table: event type, entity (type + link), version, data hash (short, copy), tx hash, block, time,
   status Tag; filters by event type and status; failed rows show last error + "Retry" (SUPER_ADMIN; add
   `POST /chain/events/:id/retry`).
4. "Verify any record" Card: entity type Dropdown + ID (+ version) → `GET /chain/verify/...` → VERIFIED / MISMATCH /
   PENDING / NOT_ANCHORED with explanation and both hashes side by side.
5. Audit log Tab: paged `audit_log` (add `GET /audit/log?cursor=` if missing): time, actor user + post, action,
   entity, readable before/after diff (changed keys only), hash + prev_hash short; "Verify audit chain" button →
   `GET /audit/verify` showing OK or the first broken link. No PII.

## I3 — Public verification + QR · 2 Oct, 20:00 → 23:00
1. Public page `/verify/[type]/[id]` (no login): record kind, public reference, version, anchored hash, block,
   anchored time, status (VERIFIED / MISMATCH / PENDING / NOT_ANCHORED), plain-language explanation, link to the
   chain explorer-less raw values. Backed by a new `GET /public/verify/:type/:id` that reads only what is safe (G22):
   no names, phones, amounts unless already public for that type.
2. `components/trust/proof-qr.tsx` (uses existing `components/qr-code.tsx`): QR + short URL; used on the passbook,
   the acknowledgement success screen (tell Madhav), and the parcel 360° QR tab (tell Atulit).

## I4 — Coverage + tamper demo + resilience · 3 Oct, before 13:00
1. Coverage table in `deploy/TRUST.md`: each CLAUDE.md §27.2 event → which code anchors it → test. Add any missing
   anchor hook and one API e2e test per event type (approve → anchored → VERIFIED).
2. `chain-audit` job (every 30 min + on demand from /trust): re-verify recently anchored records, raise a
   `CHAIN_MISMATCH` notification once per record (dedupe key), `ANCHOR_FAILED` for FAILED rows.
3. Tamper demo script `deploy/demo-tamper.md` + button on /trust for SUPER_ADMIN in DEMO_MODE: (a) legit correction on
   the reserved parcel → v2 anchored → VERIFIED; (b) `pnpm demo:tamper` → parcel shows ✗ MISMATCH and a notification.
4. **Fallback** if the chain container is unstable on the VM: `CHAIN_MODE=simulated` env — anchor job writes a
   deterministic pseudo tx hash/block and marks events `ANCHORED (simulated)`; every badge and the /trust hero show
   "Simulated chain" in amber. Default stays real Hardhat. Never show simulated as real.

## I5 — Release · 3 Oct 18:00 → 23:59
Redeploy after each integration merge; run the full demo on the live URL with the team; final deploy from `main`;
record a backup screen video of every demo beat; write the submission URLs + demo logins into `deploy/README.md`.

## Checks before every push
`pnpm lint && pnpm typecheck && pnpm test && pnpm rules:check && pnpm test:contracts` (+ `pnpm test:e2e:api` when you
touch API); never commit secrets (`deploy/.env.prod` in `.gitignore`); no PII in chain payloads or public pages.
