import { statutoryDeadlines, type Tx } from '@bhoomisetu/db';
import { clockStatus, daysRemaining, startClock, type ConditionInputs, type Pack } from '@bhoomisetu/rules';
import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, notInArray } from 'drizzle-orm';
import { ClockService } from '../common/clock/clock.service';
import { env } from '../config/env';

const CLOSED = ['SATISFIED', 'WAIVED', 'VOIDED'] as const;

export interface ClockSubject {
  type: string;
  id: string;
}

/**
 * Statutory deadline instances (§10.3 Deadlines, §12.6). Every due date comes from the pinned pack
 * through the engine's computeDueAt — never from arithmetic here (G8, G17).
 */
@Injectable()
export class DeadlinesService {
  constructor(private readonly clock: ClockService) {}

  /**
   * Starts every clock of `subject.type` that `event` starts. Clocks for other subjects (an
   * entitlement, a family, a project parcel) are started by the module that owns that subject,
   * calling this with its own subject.
   */
  async startForEvent(
    tx: Tx,
    args: { pack: Pack; projectId: string; event: string; at: Date; subject: ClockSubject; inputs?: ConditionInputs },
  ) {
    const { pack, projectId, event, at, subject, inputs = {} } = args;
    const started = [];
    for (const clock of pack.clocks.filter((c) => c.startsOn === event && c.subject === subject.type)) {
      const s = startClock(pack, clock.code, at, inputs, env().STATUTORY_TZ);
      if (!s) continue;
      const [row] = await tx
        .insert(statutoryDeadlines)
        .values({
          projectId,
          clockCode: clock.code,
          section: clock.section,
          subjectType: subject.type,
          subjectId: subject.id,
          rulePackCode: pack.code,
          rulePackVersion: pack.version,
          startEvent: event,
          startedAt: at,
          dueAt: s.dueAt,
          consequence: clock.consequence,
          status: clockStatus(clock, s.dueAt, this.clock.now(), pack.thresholds.deadlineDueSoonDays),
          conditionInputs: inputs,
        })
        .returning();
      started.push(row!);
    }
    return started;
  }

  /** Marks open deadlines that `event` ends as SATISFIED. Optionally only for one subject. */
  async satisfyForEvent(tx: Tx, args: { pack: Pack; projectId: string; event: string; at: Date; subjectId?: string }) {
    const codes = args.pack.clocks.filter((c) => c.endsOn === args.event).map((c) => c.code);
    if (!codes.length) return [];
    return tx
      .update(statutoryDeadlines)
      .set({ status: 'SATISFIED', satisfiedAt: args.at })
      .where(
        and(
          eq(statutoryDeadlines.projectId, args.projectId),
          inArray(statutoryDeadlines.clockCode, codes),
          notInArray(statutoryDeadlines.status, [...CLOSED]),
          args.subjectId ? eq(statutoryDeadlines.subjectId, args.subjectId) : undefined,
        ),
      )
      .returning();
  }

  /** Open and closed deadlines for a project, with live status and days remaining. */
  async listForProject(tx: Tx, pack: Pack, projectId: string) {
    const rows = await tx
      .select()
      .from(statutoryDeadlines)
      .where(eq(statutoryDeadlines.projectId, projectId))
      .orderBy(asc(statutoryDeadlines.dueAt));
    const now = this.clock.now();
    return rows.map((d) => {
      const clock = pack.clocks.find((c) => c.code === d.clockCode);
      const open = !(CLOSED as readonly string[]).includes(d.status);
      const status = open ? clockStatus(clock, d.dueAt, now, pack.thresholds.deadlineDueSoonDays) : d.status;
      return {
        ...d,
        status,
        daysRemaining: status !== 'SATISFIED' && open ? daysRemaining(d.dueAt, now, env().STATUTORY_TZ) : null,
        label: clock?.label ?? d.clockCode,
        consequenceText: clock?.consequenceText ?? null,
      };
    });
  }

  /** Clock codes whose deadline has passed unsatisfied — the engine's guard 9 input. */
  async firedClocks(tx: Tx, projectId: string): Promise<string[]> {
    const now = this.clock.now();
    const rows = await tx
      .select({ clockCode: statutoryDeadlines.clockCode, dueAt: statutoryDeadlines.dueAt })
      .from(statutoryDeadlines)
      .where(and(eq(statutoryDeadlines.projectId, projectId), notInArray(statutoryDeadlines.status, [...CLOSED])));
    return rows.filter((r) => r.dueAt.getTime() < now.getTime()).map((r) => r.clockCode);
  }
}
