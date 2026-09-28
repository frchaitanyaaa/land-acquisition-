import { statutoryDeadlines, type Tx } from '@bhoomisetu/db';
import { clockStatus, daysRemaining, type Pack } from '@bhoomisetu/rules';
import type { DeadlineStatus } from '@bhoomisetu/shared';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { ClockService } from '../common/clock/clock.service';
import { WorkerDbService } from '../common/db/worker-db.service';
import { writeOutbox } from '../common/outbox/outbox';
import { env } from '../config/env';
import { notify, postsByLevel, responsiblePosts } from '../notifications/notify';
import { RulesService } from '../rules/rules.service';

const SCAN_EVERY_MS = 15 * 60_000;
const FIRST_SCAN_MS = 5_000;
const OPEN: DeadlineStatus[] = ['NOT_STARTED', 'SAFE', 'DUE_SOON', 'BREACHED'];

type Row = typeof statutoryDeadlines.$inferSelect;

/**
 * deadline-scan (§31, §28): recomputes every open deadline at ClockService.now(). A deadline that
 * becomes BREACHED gets `breached_at` once and a DEADLINE_BREACHED outbox event; notifications go to
 * the responsible post and escalate along the pack's ladder (day 0 post → day 7 district → day 21
 * state). Guards never wait for this scan — they evaluate due dates live.
 */
@Injectable()
export class DeadlineScan implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('DeadlineScan');
  private timer: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;

  constructor(
    private readonly worker: WorkerDbService,
    private readonly rules: RulesService,
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

  /** The role that owns a deadline: the stage that would satisfy it, or the LAO for money clocks. */
  private ownerRoles(pack: Pack, d: Row): string[] {
    const clock = pack.clocks.find((c) => c.code === d.clockCode);
    if (d.subjectType === 'ENTITLEMENT' || d.subjectType === 'AFFECTED_FAMILY') return ['LAO'];
    if (d.subjectType === 'PROJECT_PARCEL') return ['COLLECTOR'];
    const stage = pack.stages.find((s) =>
      Object.values(s.actions).some((a) => clock?.endsOn && a.emits?.includes(clock.endsOn)),
    );
    const role = stage?.actions.SUBMIT?.roles[0] ?? stage?.ownerRole;
    return role ? [role] : ['COLLECTOR'];
  }

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
        if (status !== d.status) {
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
        if (status === 'DUE_SOON') await this.dueSoon(tx, pack, d, now);
        if (status === 'BREACHED') await this.escalate(tx, pack, { ...d, breachedAt: d.breachedAt ?? now }, now);
      }
      if (changed) this.logger.log(`${changed} deadline status change(s)`);
      return changed;
    });
  }

  private label(pack: Pack, d: Row) {
    const c = pack.clocks.find((x) => x.code === d.clockCode);
    return { label: c?.label ?? d.clockCode, text: c?.consequenceText ?? d.consequence };
  }

  private async code(tx: Tx, projectId: string) {
    const r = (await tx.execute(sql`SELECT code FROM projects WHERE id = ${projectId}`)) as unknown as {
      rows: Array<{ code: string }>;
    };
    return r.rows[0]?.code ?? '';
  }

  private async dueSoon(tx: Tx, pack: Pack, d: Row, now: Date) {
    const perEntity = d.subjectType === 'PROJECT' || d.subjectType === 'STAGE';
    const { label, text } = this.label(pack, d);
    const days = daysRemaining(d.dueAt, now, env().STATUTORY_TZ);
    for (const id of await responsiblePosts(tx, d.projectId, this.ownerRoles(pack, d))) {
      await notify(tx, {
        recipientPostId: id,
        trigger: perEntity ? 'DEADLINE_DUE_SOON' : `DEADLINE_DUE_SOON:${d.clockCode}`,
        severity: 'warn',
        entityType: perEntity ? 'statutory_deadline' : 'project',
        entityId: perEntity ? d.id : d.projectId,
        title: `${await this.code(tx, d.projectId)}: ${label} (s.${d.section}) due in ${days} days`,
        body: text,
        deepLink: `/projects/${d.projectId}`,
        email: true,
      });
    }
  }

  private async escalate(tx: Tx, pack: Pack, d: Row & { breachedAt: Date }, now: Date) {
    const days = Math.floor((now.getTime() - d.breachedAt.getTime()) / 86_400_000);
    const perEntity = d.subjectType === 'PROJECT' || d.subjectType === 'STAGE';
    const { label, text } = this.label(pack, d);
    const code = await this.code(tx, d.projectId);
    for (const [i, after] of pack.escalation.afterBreachDays.entries()) {
      if (days < after) continue;
      const level = pack.escalation.levels[i] ?? 'STATE';
      const recipients =
        level === 'POST'
          ? await responsiblePosts(tx, d.projectId, this.ownerRoles(pack, d))
          : level === 'DISTRICT'
            ? await postsByLevel(tx, d.projectId, 'DISTRICT', 'COLLECTOR')
            : await postsByLevel(tx, d.projectId, 'STATE', 'STATE_REVENUE');
      for (const id of recipients) {
        await notify(tx, {
          recipientPostId: id,
          trigger: i === 0 ? (perEntity ? 'DEADLINE_BREACHED' : `DEADLINE_BREACHED:${d.clockCode}`) : 'ESCALATED',
          severity: 'critical',
          escalationLevel: i,
          entityType: perEntity ? 'statutory_deadline' : 'project',
          entityId: perEntity ? d.id : d.projectId,
          title: `${code}: ${label} (s.${d.section}) breached${i ? ` — escalated to ${level.toLowerCase()} level` : ''}`,
          body: text,
          deepLink: `/projects/${d.projectId}`,
          email: true,
          sms: i === 0,
        });
      }
    }
  }
}
