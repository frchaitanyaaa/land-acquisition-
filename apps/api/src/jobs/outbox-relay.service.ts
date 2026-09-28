import { outboxEvents } from '@bhoomisetu/db';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { asc, eq, isNull } from 'drizzle-orm';
import { ClockService } from '../common/clock/clock.service';
import { WorkerDbService } from '../common/db/worker-db.service';
import { env } from '../config/env';
import { EventHandlers } from './event-handlers.service';

export const DOMAIN_EVENTS_QUEUE = 'domain-events';

const BATCH = 100;
const TICK_MS = 1_000;
const PUBLISH_TIMEOUT_MS = 3_000;

function redisConnection(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password || undefined,
    db: Number(u.pathname.slice(1) || 0),
    // Fail fast when Redis is down instead of queueing commands in memory forever.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  };
}

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms)),
  ]);

/**
 * Stub relay (§31 outbox-relay): moves unprocessed outbox_events to the BullMQ `domain-events`
 * queue, in id order, one batch per second. The job id is the outbox id, so a row relayed twice
 * (crash between publish and mark) is still one job. Consumers (anchor, deadline-scan, notify,
 * mv-refresh) arrive with their phases.
 *
 * Redis being down never blocks a request: events simply wait in Postgres (G5).
 */
@Injectable()
export class OutboxRelay implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('OutboxRelay');
  private queue: Queue | null = null;
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  private lastError = '';

  constructor(
    private readonly worker: WorkerDbService,
    private readonly clock: ClockService,
    private readonly handlers: EventHandlers,
  ) {}

  onModuleInit(): void {
    if (env().OUTBOX_RELAY === 'off') {
      this.logger.warn('OUTBOX_RELAY=off — outbox events will stay in Postgres');
      return;
    }
    if (env().OUTBOX_RELAY === 'inline') {
      this.logger.warn('OUTBOX_RELAY=inline — consumers run in-process (no Redis)');
      this.timer = setInterval(() => void this.tickInline(), TICK_MS);
      return;
    }
    this.queue = new Queue(DOMAIN_EVENTS_QUEUE, { connection: redisConnection(env().REDIS_URL) });
    this.queue.on('error', (e) => this.warnOnce(`redis: ${e.message}`));
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.queue?.close();
  }

  private async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.relayBatch();
    } catch (e) {
      this.warnOnce(`relay failed: ${(e as Error).message}`);
    } finally {
      this.busy = false;
    }
  }

  private async tickInline(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.relayInline();
    } catch (e) {
      this.warnOnce(`inline relay failed: ${(e as Error).message}`);
    } finally {
      this.busy = false;
    }
  }

  /** Inline mode: hands each event to the in-process consumers, in id order, then marks it processed. */
  async relayInline(): Promise<number> {
    const batch = await this.worker.transaction(this.clock.now(), (tx) =>
      tx.select().from(outboxEvents).where(isNull(outboxEvents.processedAt)).orderBy(asc(outboxEvents.id)).limit(BATCH),
    );
    let n = 0;
    for (const row of batch) {
      try {
        await this.handlers.handle({
          outboxId: row.id,
          type: row.type,
          aggregateType: row.aggregateType,
          aggregateId: row.aggregateId,
          payload: row.payload as Record<string, unknown>,
        });
        await this.worker.transaction(this.clock.now(), (tx) =>
          tx
            .update(outboxEvents)
            .set({ processedAt: this.clock.now(), attempts: row.attempts + 1, lastError: null })
            .where(eq(outboxEvents.id, row.id)),
        );
        n++;
      } catch (e) {
        await this.worker.transaction(this.clock.now(), (tx) =>
          tx
            .update(outboxEvents)
            .set({ attempts: row.attempts + 1, lastError: (e as Error).message })
            .where(eq(outboxEvents.id, row.id)),
        );
        this.warnOnce(`consumer failed on ${row.type}#${row.id}: ${(e as Error).message}`);
        break;
      }
    }
    return n;
  }

  /** Publishes up to one batch. Returns how many rows were published. */
  async relayBatch(): Promise<number> {
    const queue = this.queue;
    if (!queue) return 0;

    return this.worker.transaction(this.clock.now(), async (tx) => {
      const rows = await tx
        .select()
        .from(outboxEvents)
        .where(isNull(outboxEvents.processedAt))
        .orderBy(asc(outboxEvents.id))
        .limit(BATCH)
        .for('update', { skipLocked: true });

      let published = 0;
      for (const row of rows) {
        try {
          await withTimeout(
            queue.add(
              row.type,
              {
                outboxId: row.id,
                aggregateType: row.aggregateType,
                aggregateId: row.aggregateId,
                payload: row.payload,
              },
              { jobId: `outbox-${row.id}`, removeOnComplete: 1000, removeOnFail: 5000 },
            ),
            PUBLISH_TIMEOUT_MS,
          );
          await tx
            .update(outboxEvents)
            .set({ processedAt: this.clock.now(), attempts: row.attempts + 1, lastError: null })
            .where(eq(outboxEvents.id, row.id));
          published++;
        } catch (e) {
          // Stop at the first failure so events stay in order; the row is retried next tick.
          await tx
            .update(outboxEvents)
            .set({ attempts: row.attempts + 1, lastError: (e as Error).message })
            .where(eq(outboxEvents.id, row.id));
          this.warnOnce(`publish failed: ${(e as Error).message}`);
          break;
        }
      }
      if (published) this.lastError = '';
      return published;
    });
  }

  private warnOnce(message: string): void {
    if (message === this.lastError) return;
    this.lastError = message;
    this.logger.warn(message);
  }
}
