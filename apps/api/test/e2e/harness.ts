import 'reflect-metadata';
import { createDb, createPool, loadRootEnv, type Db } from '@bhoomisetu/db';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { Pool } from 'pg';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { AppModule } from '../../src/app.module';
import { requestContextMiddleware } from '../../src/common/context/request-context';

loadRootEnv();

let appPromise: Promise<INestApplication> | null = null;

/** One Nest app instance for the whole e2e run (fileParallelism: false — see vitest.e2e.config.mts). */
export async function bootApp(): Promise<INestApplication> {
  appPromise ??= (async () => {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    app.use(cookieParser());
    app.use(requestContextMiddleware);
    app.setGlobalPrefix('api/v1');
    await app.init();
    return app;
  })();
  return appPromise;
}

export async function closeApp(): Promise<void> {
  if (!appPromise) return;
  const app = await appPromise;
  await app.close();
  appPromise = null;
}

export function api(app: INestApplication) {
  return request(app.getHttpServer());
}

export interface Session {
  accessToken: string;
  postId: string;
}

const sessions = new Map<string, Session>();

/** Logs in once per email (cached) — keeps well under the 10/min/IP auth throttle (§29). */
export async function loginAs(app: INestApplication, email: string, postId?: string): Promise<Session> {
  const key = `${email}:${postId ?? ''}`;
  const cached = sessions.get(key);
  if (cached) return cached;
  const res = await api(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'bhoomisetu-demo', postId })
    .expect(200);
  const session: Session = { accessToken: res.body.accessToken, postId: res.body.activePost.id };
  sessions.set(key, session);
  return session;
}

export function auth(session: Session) {
  return { Authorization: `Bearer ${session.accessToken}` };
}

/**
 * Direct DB access for reading fixtures the HTTP API has no lookup-by-code endpoint for, e.g. "the
 * seeded project with this code". Uses app_worker (BYPASSRLS, §11.3) — every scoped table FORCES
 * RLS, so even the owner role sees zero rows without app.* session settings; jobs read this way
 * too. Never used to bypass a guard for a mutation — only to read fixture IDs for HTTP calls.
 */
let pool: Pool | null = null;
let db: Db | null = null;
export function testDb(): Db {
  if (db) return db;
  pool = createPool(requireEnv('DATABASE_WORKER_URL'), { max: 2 });
  db = createDb(pool);
  return db;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export { sql };
