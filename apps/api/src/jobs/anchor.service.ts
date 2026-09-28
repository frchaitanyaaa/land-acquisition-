import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ChainService } from '../chain/chain.service';
import { ClockService } from '../common/clock/clock.service';
import { WorkerDbService } from '../common/db/worker-db.service';
import { StreamHub } from '../notifications/stream-hub';
import { EventHandlers } from './event-handlers.service';

const TICK_MS = 3_000;

/** anchor (§27.3): single relayer (concurrency 1), off the request path (G5). */
@Injectable()
export class AnchorJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Anchor');
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly worker: WorkerDbService,
    private readonly chain: ChainService,
    private readonly clock: ClockService,
    private readonly handlers: EventHandlers,
    private readonly hub: StreamHub,
  ) {}

  onModuleInit() {
    this.handlers.setAnchorHook((tx, e) => this.chain.enqueue(tx, e));
    if (!this.chain.configured()) {
      this.logger.warn('CHAIN_ANCHOR_CONTRACT not set — records will queue as "proof pending" until pnpm chain:deploy');
      return;
    }
    void this.worker
      .transaction(this.clock.now(), (tx) => this.chain.backfill(tx))
      .then((n) => n && this.logger.log(`queued ${n} existing record(s) for anchoring`))
      .catch((e: Error) => this.logger.warn(`backfill failed: ${e.message}`));
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      const n = await this.worker.transaction(this.clock.now(), (tx) => this.chain.anchorPending(tx, 100));
      if (n) this.hub.broadcast({ type: 'chain.anchored', at: this.clock.now(), data: { count: n } });
    } catch (e) {
      this.logger.warn((e as Error).message);
    } finally {
      this.busy = false;
    }
  }
}
