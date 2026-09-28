# Backend verification — command checklist

Run in order from the repo root.

```bash
# 1. Infra (postgres, redis, minio, mailhog, chain)
pnpm infra:up

# 2. Fresh DB — migrate + seed
pnpm db:reset

# 3. Deploy the AnchorRegistry contract (skip if already deployed)
pnpm chain:deploy

# 4. Static checks
pnpm lint
pnpm typecheck

# 5. Unit tests (all packages)
pnpm test

# 6. Rule engine golden test + forbidden-literal scan
pnpm rules:check

# 7. Backend e2e suite (Supertest against the live seeded DB)
pnpm test:e2e:api

# 8. Boot the API
pnpm --filter @bhoomisetu/api dev
```

Once the API is running (step 8), in a second terminal:

```bash
curl http://localhost:3001/api/v1/health
```

Expect `{"status":"ok","db":"ok",...}` with `clock.frozen: true`.
