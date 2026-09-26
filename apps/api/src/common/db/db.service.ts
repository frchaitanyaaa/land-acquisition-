import { createDb, createPool, runScoped, type Db, type Tx } from '@bhoomisetu/db';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { env } from '../../config/env';
import { scopeOf, type AuthUser } from '../auth-user';
import { ClockService } from '../clock/clock.service';
import { requestContext } from '../context/request-context';

/**
 * Database access for request handlers. Connects as app_user, so RLS always applies (G13).
 *
 * Every query runs inside withScope(user, fn): one transaction that first sets the caller's
 * jurisdiction and ClockService's now as session settings. Never filter by district in a
 * controller — the policies already did, and a hand-written filter is one forgotten line away
 * from a cross-district leak.
 */
@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool = createPool(env().DATABASE_URL, { max: 10 });
  private readonly db: Db = createDb(this.pool);

  constructor(private readonly clock: ClockService) {}

  /**
   * Runs `fn` in a transaction scoped to `user` (null = public, sees no scoped rows).
   * Nested calls inside the same request reuse the open transaction.
   */
  async withScope<T>(user: AuthUser | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
    const ctx = requestContext.get();
    if (ctx?.tx) return fn(ctx.tx);

    return runScoped(this.db, scopeOf(user), this.clock.now(), async (tx) => {
      if (!ctx) return fn(tx);
      ctx.tx = tx;
      try {
        return await fn(tx);
      } finally {
        ctx.tx = null;
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
