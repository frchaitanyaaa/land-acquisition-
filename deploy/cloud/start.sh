#!/bin/sh
# Entry point for the all-in-one cloud image (deploy/cloud/Dockerfile): Render free web service, or a Hugging Face
# Docker Space. Serves the portal on $PORT (Render sets it; 7860 otherwise).
#
#   sh deploy/cloud/start.sh prepare   — at image build: create Postgres, migrate and seed the demo (slow part)
#   sh deploy/cloud/start.sh           — at every start: Postgres + chain node + contract + API + portal
#
# Storage is not persistent on these hosts, so every start begins from the seeded data baked into the image and
# re-anchors it on a fresh chain in the background (the API's anchor job; the landing page shows the count).
# Render free is 512 MB / 0.1 CPU: seeding at boot took ~6 min there, hence `prepare`. Long-running processes
# are started directly with node — a `pnpm exec` / turbo wrapper stays resident at ~110 MB each.
set -eu
cd "$(dirname "$0")/../.."
RUN=$HOME/run
mkdir -p "$RUN"
log() { echo "[start] $*"; }

# --- environment -------------------------------------------------------------------------------------------
PORT=${PORT:-7860}
HOST=${RENDER_EXTERNAL_HOSTNAME:-${SPACE_HOST:-localhost:$PORT}}
cp -n .env.example .env
rand() { head -c 32 /dev/urandom | base64 | tr -d '\n'; }
# The seed encrypts synthetic phone numbers (§11.5), so the PII key is made once at build and kept with the data.
[ -s "$RUN/pii.key" ] || rand > "$RUN/pii.key"
export NODE_ENV=production DEMO_MODE=true DEMO_NOW=${DEMO_NOW:-2026-12-10T10:00:00+05:30} SEED=26016
export API_PORT=3001 PORTAL_URL="https://$HOST" FIELD_URL="https://$HOST" PUBLIC_BASE_URL="https://$HOST"
export WEBAUTHN_RP_ID="${HOST%%:*}" WEBAUTHN_ORIGIN="https://$HOST"
export JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET:-$(rand)} JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET:-$(rand)}
export PII_ENCRYPTION_KEY="$(cat "$RUN/pii.key")"
export OUTBOX_RELAY=inline STORAGE_PROVIDER=local STORAGE_LOCAL_DIR="$RUN/storage"
export DATABASE_URL=postgres://app_user:app_pass@127.0.0.1:5432/bhoomisetu
export DATABASE_WORKER_URL=postgres://app_worker:worker_pass@127.0.0.1:5432/bhoomisetu
export DATABASE_OWNER_URL=postgres://owner:owner_pass@127.0.0.1:5432/bhoomisetu
export CHAIN_RPC_URL=http://127.0.0.1:8545

# --- Postgres + PostGIS ------------------------------------------------------------------------------------
export PGDATA=$RUN/pgdata
# The data is rebuilt from the image on every start, so durability is worth nothing: fsync off, small buffers.
PG_OPTS="-c listen_addresses=127.0.0.1 -k $RUN -c shared_buffers=32MB -c max_connections=40 -c work_mem=4MB"
PG_OPTS="$PG_OPTS -c maintenance_work_mem=32MB -c fsync=off -c synchronous_commit=off -c full_page_writes=off"
pg_start() { pg_ctl -D "$PGDATA" -l "$RUN/postgres.log" -o "$PG_OPTS" -w start >/dev/null; }

if [ "${1:-}" = prepare ]; then
  log "initialising Postgres"
  initdb -D "$PGDATA" -U postgres --auth=trust >/dev/null
  pg_start
  psql -h 127.0.0.1 -U postgres -d postgres -q -v db_name=bhoomisetu -v owner_pass=owner_pass \
    -v app_pass=app_pass -v worker_pass=worker_pass -f docker/postgres/roles.sql
  log "loading the demo dataset"
  (cd packages/db && ./node_modules/.bin/tsx src/scripts/reset.ts)
  pg_ctl -D "$PGDATA" -m fast -w stop >/dev/null
  log "prepared"
  exit 0
fi

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  log "no prepared data in the image — preparing now (slow)"
  sh deploy/cloud/start.sh prepare
fi
log "starting Postgres"
pg_start

# --- chain node (jobs run in-process: OUTBOX_RELAY=inline, so no Redis) ----------------------------------------
(cd packages/chain && nohup ./node_modules/.bin/hardhat node --hostname 127.0.0.1 > "$RUN/hardhat.log" 2>&1 &)
# No curl in the image: small Node probes instead.
http_ok() { node -e "fetch(process.argv[1]).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" "$1"; }
rpc_ok() {
  node -e "fetch(process.argv[1],{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',method:'eth_chainId',id:1})}).then(r=>r.json()).then(j=>process.exit(j.result?0:1)).catch(()=>process.exit(1))" "$1"
}
for _ in $(seq 1 120); do rpc_ok "$CHAIN_RPC_URL" && break; sleep 1; done
log "deploying the anchor contract"
(cd packages/chain && ./node_modules/.bin/hardhat run scripts/deploy.cjs --network localhost)
set -a; . ./.env.local; set +a

# --- API + portal ------------------------------------------------------------------------------------------
# The portal binds the port straight away (the host's health check); the API comes up beside it.
# Heap caps: under a burst each Node process collects garbage sooner instead of growing until the whole container
# passes 512 MB and the host kills it (a restart is ~3 min down and resets the demo). Measured locally, 50 users
# for 40 s: API + portal peaked ~100 MB lower than uncapped, with no errors other than the rate limiter's 429s.
# Override with NODE_HEAP_MB.
HEAP_MB=${NODE_HEAP_MB:-160}
NODE_MEM="--max-old-space-size=$HEAP_MB --max-semi-space-size=4"
log "starting API on :3001"
nohup node $NODE_MEM apps/api/dist/main.js > "$RUN/api.log" 2>&1 &
log "starting portal on :$PORT (https://$HOST)"
cd apps/portal
export NODE_OPTIONS="$NODE_MEM"
exec ./node_modules/.bin/next start --port "$PORT" --hostname 0.0.0.0
