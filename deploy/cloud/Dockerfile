# BhoomiSetu — whole stack in one container: Render free web service (512 MB), or a Hugging Face Docker Space.
# Postgres/PostGIS + Hardhat chain node + NestJS API + Next.js portal (field app served at /field).
# Built in CI (.github/workflows/deploy-cloud.yml) with the repo root as context; Dockerfile.dockerignore applies.
# Storage is not persistent on either host: every start rebuilds the deterministic demo (SEED=26016, DEMO_NOW)
# and anchors it on a fresh chain (deploy/cloud/start.sh). Jobs run in-process (OUTBOX_RELAY=inline): no Redis.
#
# Alpine (musl) on purpose: the prebuilt native modules (argon2, Next SWC, Hardhat EDR) ship musl builds, and the
# Debian PostGIS images are too old for their glibc builds — so nothing has to be compiled and no apt is needed.
FROM node:24-alpine AS node

FROM postgis/postgis:16-3.4-alpine
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack \
 && node --version \
 && adduser -D -u 1000 user

# Run as uid 1000 (Spaces require it; Postgres refuses root); everything it writes lives under its home.
USER 1000
ENV HOME=/home/user PNPM_HOME=/home/user/.pnpm PATH=/home/user/.pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /home/user/app

COPY --chown=1000 . .
# .env must exist before the build: pages pre-rendered by Next read DEMO_MODE etc. at build time.
RUN cp .env.example .env \
 && mkdir -p /home/user/.pnpm \
 && corepack enable --install-directory /home/user/.pnpm \
 && pnpm install --frozen-lockfile \
 && pnpm --filter @bhoomisetu/chain exec hardhat compile \
 && pnpm --filter @bhoomisetu/field build:portal \
 && pnpm build
# Seed the demo into Postgres now, so a cold start only boots services (Render free: 0.1 CPU).
RUN sh deploy/cloud/start.sh prepare

EXPOSE 7860
CMD ["sh", "deploy/cloud/start.sh"]
