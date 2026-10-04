#!/bin/sh
# Entry point for the Hugging Face Space (deploy/hf/Dockerfile). Boots the whole stack and serves the portal on
# :7860. Runs on every start: storage is not persistent, so the demo is rebuilt from the seed each time.
set -eu
cd "$(dirname "$0")/../.."
APP=$PWD
RUN=$HOME/run
mkdir -p "$RUN"
log() { echo "[start] $*"; }

# --- environment -------------------------------------------------------------------------------------------
HOST=${SPACE_HOST:-localhost:7860}
cp -n .env.example .env
rand() { head -c 32 /dev/urandom | base64 | tr -d '\n'; }
export NODE_ENV=production DEMO_MODE=true DEMO_NOW=${DEMO_NOW:-2026-12-10T10:00:00+05:30} SEED=26016
export API_PORT=3001 PORTAL_URL="https://$HOST" FIELD_URL="https://$HOST" PUBLIC_BASE_URL="https://$HOST"
export WEBAUTHN_RP_ID="${HOST%%:*}" WEBAUTHN_ORIGIN="https://$HOST"
export JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET:-$(rand)} JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET:-$(rand)}
export PII_ENCRYPTION_KEY=${PII_ENCRYPTION_KEY:-$(head -c 32 /dev/urandom | base64)}
export OUTBOX_RELAY=inline STORAGE_PROVIDER=local STORAGE_LOCAL_DIR="$RUN/storage"
export DATABASE_URL=postgres://app_user:app_pass@127.0.0.1:5432/bhoomisetu
export DATABASE_WORKER_URL=postgres://app_worker:worker_pass@127.0.0.1:5432/bhoomisetu
export DATABASE_OWNER_URL=postgres://owner:owner_pass@127.0.0.1:5432/bhoomisetu
export CHAIN_RPC_URL=http://127.0.0.1:8545

# --- Postgres + PostGIS ------------------------------------------------------------------------------------
export PGDATA=$RUN/pgdata
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  log "initialising Postgres"
  initdb -D "$PGDATA" -U postgres --auth=trust >/dev/null
fi
pg_ctl -D "$PGDATA" -l "$RUN/postgres.log" -o "-c listen_addresses=127.0.0.1 -k $RUN" -w start
if ! psql -h 127.0.0.1 -U postgres -tAc "select 1 from pg_roles where rolname='owner'" | grep -q 1; then
  psql -h 127.0.0.1 -U postgres -d postgres -q -v db_name=bhoomisetu -v owner_pass=owner_pass \
    -v app_pass=app_pass -v worker_pass=worker_pass -f docker/postgres/roles.sql
fi

# --- chain node (jobs run in-process: OUTBOX_RELAY=inline, so no Redis) ----------------------------------------
(cd packages/chain && nohup pnpm exec hardhat node --hostname 127.0.0.1 > "$RUN/hardhat.log" 2>&1 &)
# No curl in the image: small Node probes instead.
http_ok() { node -e "fetch(process.argv[1]).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" "$1"; }
rpc_ok() {
  node -e "fetch(process.argv[1],{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',method:'eth_chainId',id:1})}).then(r=>r.json()).then(j=>process.exit(j.result?0:1)).catch(()=>process.exit(1))" "$1"
}
for _ in $(seq 1 60); do rpc_ok "$CHAIN_RPC_URL" && break; sleep 1; done

# --- data + contract ---------------------------------------------------------------------------------------
log "loading the demo dataset"
pnpm db:reset
log "deploying the anchor contract"
pnpm chain:deploy
set -a; . ./.env.local; set +a

# --- API + portal ------------------------------------------------------------------------------------------
log "starting API on :3001"
nohup node apps/api/dist/main.js > "$RUN/api.log" 2>&1 &
for _ in $(seq 1 90); do http_ok http://127.0.0.1:3001/api/v1/health && break; sleep 1; done
log "starting portal on :7860 (https://$HOST)"
cd apps/portal
exec pnpm exec next start --port 7860 --hostname 0.0.0.0
