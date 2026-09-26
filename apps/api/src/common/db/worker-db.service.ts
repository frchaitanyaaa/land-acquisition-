import { createDb, createPool, type Db, type Tx } from '@bhoomisetu/db';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { env } from '../../config/env';

/**
 * app_worker connection: BYPASSRLS. For background jobs and boot-time tasks ONLY — never inject
 * this into a controller or a request-path service (§11.3). test/worker-pool.test.ts enforces
 * which directories may import it.
 */
@Injectable()
export class WorkerDbService implements OnModuleDestroy {
  private readonly pool = createPool(env().DATABASE_WORKER_URL, { max: 4 });
  readonly db: Db = createDb(this.pool);

  /** A transaction whose app_now() is `now` (pass ClockService.now()). */
  transaction<T>(now: Date, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.now', ${now.toISOString()}, true)`);
      return fn(tx);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
