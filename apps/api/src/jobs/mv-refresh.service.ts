import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ClockService } from '../common/clock/clock.service';
import { WorkerDbService } from '../common/db/worker-db.service';
import { StreamHub } from '../notifications/stream-hub';

const EVERY_MS = 5 * 60_000;
const DEBOUNCE_MS = 10_000;

/** mv-refresh (§31): every 5 min and 10 s after money/stage events; pushes kpi.updated over SSE. */
@Injectable()
export class MvRefresh implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('MvRefresh');
  private timer: NodeJS.Timeout | null = null;
  private pending: NodeJS.Timeout | null = null;

  constructor(
    private readonly worker: WorkerDbService,
    private readonly clock: ClockService,
    private readonly hub: StreamHub,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.refresh(), EVERY_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.pending) clearTimeout(this.pending);
  }

  soon() {
    if (this.pending) return;
    this.pending = setTimeout(() => {
      this.pending = null;
      void this.refresh();
    }, DEBOUNCE_MS);
  }

  async refresh() {
    try {
      await this.worker.transaction(this.clock.now(), async (tx) => {
        for (const mv of ['mv_district_kpis', 'mv_state_kpis', 'mv_national_kpis', 'mv_interest_liability']) {
          await tx.execute(sql.raw(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${mv}`));
        }
      });
      this.hub.broadcast({ type: 'kpi.updated', at: this.clock.now() });
    } catch (e) {
      this.logger.warn(`refresh failed: ${(e as Error).message}`);
    }
  }
}
