import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { env } from '../config/env';
import { EventHandlers, type DomainEventJob } from './event-handlers.service';
import { DOMAIN_EVENTS_QUEUE } from './outbox-relay.service';

/** BullMQ consumer of the domain-events queue (OUTBOX_RELAY=on). Concurrency 1 keeps events ordered. */
@Injectable()
export class EventWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('EventWorker');
  private worker: Worker | null = null;

  constructor(private readonly handlers: EventHandlers) {}

  onModuleInit() {
    if (env().OUTBOX_RELAY !== 'on') return;
    const u = new URL(env().REDIS_URL);
    this.worker = new Worker(
      DOMAIN_EVENTS_QUEUE,
      async (job) => this.handlers.handle({ ...(job.data as Omit<DomainEventJob, 'type'>), type: job.name }),
      {
        connection: {
          host: u.hostname,
          port: Number(u.port || 6379),
          password: u.password || undefined,
          db: Number(u.pathname.slice(1) || 0),
          maxRetriesPerRequest: null,
        },
        concurrency: 1,
      },
    );
    this.worker.on('failed', (job, err) => this.logger.warn(`${job?.name ?? '?'} failed: ${err.message}`));
    this.worker.on('error', (err) => this.logger.warn(`worker: ${err.message}`));
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
