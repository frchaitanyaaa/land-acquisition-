import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { api, bootApp, closeApp, closeDb } from './harness';

// §25 "Login as": the officer picks a role first; the server signs into their post with that role and
// refuses the login if they hold none (the role list never shows a person's posts).
describe('login with a chosen role', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await bootApp();
  }, 60_000);
  afterAll(async () => {
    await closeApp();
    await closeDb();
  });

  const login = (email: string, role?: string) =>
    api(app).post('/api/v1/auth/login').send({ email, password: 'bhoomisetu-demo', role });

  it('activates the post with that role (multi-post account)', async () => {
    const res = await login('demo@bhoomisetu.local', 'LAO').expect(200);
    expect(res.body.activePost.role).toBe('LAO');
  });

  it('refuses a role the account does not hold', async () => {
    const res = await login('collector.pune@bhoomisetu.local', 'LAO').expect(403);
    expect(res.body.code).toBe('ROLE_NOT_HELD');
  });

  it('rejects an unknown role value', async () => {
    await login('collector.pune@bhoomisetu.local', 'KING').expect(400);
  });
});
