import type { Tx } from '@bhoomisetu/db';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ClockService } from '../common/clock/clock.service';
import { WorkerDbService } from '../common/db/worker-db.service';
import { notify, responsiblePosts } from '../notifications/notify';

const SCAN_EVERY_MS = 24 * 60 * 60_000;
const FIRST_SCAN_MS = 10_000;

async function q<T>(tx: Tx, query: ReturnType<typeof sql>): Promise<T[]> {
  return ((await tx.execute(query)) as unknown as { rows: T[] }).rows;
}

interface MissedRow {
  id: string;
  entitlement_id: string;
  instalment_no: number;
  due_on: string;
  amount_paise: string;
  project_id: string;
}

/**
 * annuity-scan (§31, §23): daily — marks an `annuity_schedules` row `missed` once its `due_on`
 * (Asia/Kolkata calendar date, per G17) is behind ClockService.now() with no linked successful
 * disbursement, and notifies the Administrator R&R (§28 ANNUITY_MISSED). Idempotent: `notify()`
 * dedupes on (recipient, trigger, entity, level), so a rescan never double-notifies the same
 * instalment, and the update only ever moves scheduled → missed (never touched again after).
 */
@Injectable()
export class AnnuityScan implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('AnnuityScan');
  private timer: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;

  constructor(
    private readonly worker: WorkerDbService,
    private readonly clock: ClockService,
  ) {}

  onModuleInit(): void {
    const run = () => void this.scan().catch((e: Error) => this.logger.warn(e.message));
    this.first = setTimeout(run, FIRST_SCAN_MS);
    this.timer = setInterval(run, SCAN_EVERY_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.first) clearTimeout(this.first);
  }

  async scan(): Promise<number> {
    const now = this.clock.now();
    return this.worker.transaction(now, async (tx) => {
      const missed = await q<MissedRow>(
        tx,
        sql`SELECT s.id, s.entitlement_id, s.instalment_no, s.due_on::text, s.amount_paise::text, af.project_id
            FROM annuity_schedules s
            JOIN entitlements e ON e.id = s.entitlement_id
            JOIN affected_families af ON af.id = e.affected_family_id
            WHERE s.status = 'scheduled' AND s.due_on < (app_now() AT TIME ZONE 'Asia/Kolkata')::date
              AND s.disbursement_id IS NULL
            FOR UPDATE OF s SKIP LOCKED
            LIMIT 500`,
      );
      let n = 0;
      for (const m of missed) {
        await tx.execute(sql`UPDATE annuity_schedules SET status = 'missed' WHERE id = ${m.id}`);
        for (const postId of await responsiblePosts(tx, m.project_id, ['RNR_ADMINISTRATOR'])) {
          await notify(tx, {
            recipientPostId: postId,
            trigger: 'ANNUITY_MISSED',
            severity: 'warn',
            entityType: 'annuity_schedule',
            entityId: m.id,
            title: `Annuity instalment #${m.instalment_no} missed (due ${m.due_on})`,
            deepLink: `/families`,
          });
        }
        n++;
      }
      return n;
    });
  }
}
