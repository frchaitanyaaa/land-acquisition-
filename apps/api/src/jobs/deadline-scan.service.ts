import { statutoryDeadlines } from '@bhoomisetu/db';
import { clockStatus } from '@bhoomisetu/rules';
import type { DeadlineStatus } from '@bhoomisetu/shared';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { ClockService } from '../common/clock/clock.service';
import { WorkerDbService } from '../common/db/worker-db.service';
import { writeOutbox } from '../common/outbox/outbox';
import { RulesService } from '../rules/rules.service';

const SCAN_EVERY_MS = 15 * 60_000;
const OPEN: DeadlineStatus[] = ['NOT_STARTED', 'SAFE', 'DUE_SOON', 'BREACHED'];

/**
 * deadline-scan (§31): recomputes every open deadline's status at ClockService.now(). A deadline
 * that becomes BREACHED gets `breached_at` once and a DEADLINE_BREACHED outbox event (consumed by
 * notify / escalation), so the consequence "fires" exactly once. Guards do not wait for this scan —
 * they evaluate due dates live — so the scan only drives notifications and dashboards.
 */
@Injectable()
export class DeadlineScan implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('DeadlineScan');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly worker: WorkerDbService,
    private readonly rules: RulesService,
    private readonly clock: ClockService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.scan().catch((e: Error) => this.logger.warn(e.message)), SCAN_EVERY_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Returns how many deadlines changed status. */
  async scan(): Promise<number> {
    const now = this.clock.now();
    return this.worker.transaction(now, async (tx) => {
      const rows = await tx.select().from(statutoryDeadlines).where(inArray(statutoryDeadlines.status, OPEN));
      let changed = 0;
      for (const d of rows) {
        const pack = this.rules.get(d.rulePackCode, d.rulePackVersion);
        if (!pack) continue;
        const clock = pack.clocks.find((c) => c.code === d.clockCode);
        const status = clockStatus(clock, d.dueAt, now, pack.thresholds.deadlineDueSoonDays);
        if (status === d.status) continue;
        const firstBreach = status === 'BREACHED' && !d.breachedAt;
        await tx
          .update(statutoryDeadlines)
          .set({
            status,
            ...(firstBreach ? { breachedAt: now } : {}),
            ...(status === 'SATISFIED' ? { satisfiedAt: d.dueAt } : {}),
          })
          .where(eq(statutoryDeadlines.id, d.id));
        if (firstBreach) {
          await writeOutbox(tx, {
            type: 'DEADLINE_BREACHED',
            aggregateType: 'statutory_deadline',
            aggregateId: d.id,
            payload: {
              projectId: d.projectId,
              clockCode: d.clockCode,
              section: d.section,
              consequence: d.consequence,
              dueAt: d.dueAt,
            },
          });
        }
        changed++;
      }
      if (changed) this.logger.log(`${changed} deadline status change(s)`);
      return changed;
    });
  }
}
