import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { Tx } from '@bhoomisetu/db';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '../auth-user';

/**
 * Per-request state that services need without threading it through every call: who is acting,
 * the open scoped transaction (so nested withScope calls share it), and whether an audit row has
 * been written yet (AuditInterceptor writes a fallback row if not).
 */
export interface RequestContext {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  user: AuthUser | null;
  tx: Tx | null;
  audited: boolean;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const requestContext = {
  get: (): RequestContext | undefined => storage.getStore(),
  run: <T>(ctx: RequestContext, fn: () => T): T => storage.run(ctx, fn),
};

const REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get('x-request-id');
  const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', requestId);
  storage.run(
    { requestId, ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null, user: null, tx: null, audited: false },
    next,
  );
}
