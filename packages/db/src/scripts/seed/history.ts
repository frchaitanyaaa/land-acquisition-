import {
  applicableStages,
  clockDuration,
  clockStatus,
  findClock,
  planTransition,
  startClock,
  startForDueOn,
  type Pack,
  type ProjectFacts,
  type StageState,
} from '@bhoomisetu/rules';
import type { ProjectFixture } from './fixtures';

const DAY_MS = 86_400_000;

export interface SeedStage {
  stageCode: string;
  attempt: number;
  status: StageState['status'];
  startedAt: Date;
  completedAt: Date | null;
}

export interface SeedDeadline {
  clockCode: string;
  section: string;
  subjectType: 'PROJECT' | 'STAGE';
  /** Stage code for STAGE subjects; resolved to the instance id by the caller. */
  subjectStage: string | null;
  startEvent: string;
  startedAt: Date;
  dueAt: Date;
  consequence: string;
  status: ReturnType<typeof clockStatus>;
  satisfiedAt: Date | null;
}

/**
 * Replays a project's approval history through the engine (§33.1: state machines are seeded
 * through the same logic as the API, not by hand-written rows). Pure — returns rows to insert.
 */
export function replayHistory(pack: Pack, p: ProjectFixture, now: Date) {
  const daysAgo = (n: number) => new Date(now.getTime() - n * DAY_MS);
  const facts: ProjectFacts = {
    acquisitionType: p.acquisitionType,
    isUrgency: p.isUrgency ?? false,
    inScheduledArea: p.inScheduledArea ?? false,
    affectedAreaSqm: 0,
    status: 'SUBMITTED',
  };

  const stages = new Map<string, SeedStage>();
  const first = applicableStages(pack, facts)[0];
  if (!first) throw new Error(`${p.code}: no applicable stages`);
  stages.set(first.code, {
    stageCode: first.code,
    attempt: 1,
    status: 'IN_PROGRESS',
    startedAt: daysAgo(p.submittedDaysAgo),
    completedAt: null,
  });
  const deadlines: SeedDeadline[] = [];

  for (const h of p.history) {
    const at =
      'daysAgo' in h
        ? daysAgo(h.daysAgo)
        : startForDueOn(
            new Date(now.getTime() + h.clockDueInDays.days * DAY_MS),
            clockDuration(findClock(pack, h.clockDueInDays.clock)),
          );
    const current = stages.get(h.stage);
    if (current?.status !== 'IN_PROGRESS')
      throw new Error(`${p.code}: ${h.stage} is not open when the history approves it`);

    const plan = planTransition(
      pack,
      h.stage,
      'APPROVE',
      {},
      {
        project: facts,
        stages: [...stages.values()].map((s) => ({ stageCode: s.stageCode, attempt: s.attempt, status: s.status })),
      },
    );
    stages.set(h.stage, { ...current, status: 'APPROVED', completedAt: at });
    for (const c of plan.changes.slice(1)) {
      stages.set(c.stageCode, {
        stageCode: c.stageCode,
        attempt: c.attempt,
        status: c.status,
        startedAt: at,
        completedAt: null,
      });
    }
    if (plan.projectStatus) facts.status = plan.projectStatus;

    for (const event of plan.events) {
      for (const d of deadlines) {
        const clock = findClock(pack, d.clockCode);
        if (clock.endsOn === event && !d.satisfiedAt && at.getTime() <= d.dueAt.getTime()) d.satisfiedAt = at;
      }
      for (const clock of pack.clocks.filter(
        (c) => c.startsOn === event && (c.subject === 'PROJECT' || c.subject === 'STAGE'),
      )) {
        const started = startClock(pack, clock.code, at);
        if (!started) continue;
        deadlines.push({
          clockCode: clock.code,
          section: clock.section,
          subjectType: clock.subject as 'PROJECT' | 'STAGE',
          subjectStage: clock.subject === 'STAGE' ? h.stage : null,
          startEvent: event,
          startedAt: at,
          dueAt: started.dueAt,
          consequence: clock.consequence,
          status: 'SAFE',
          satisfiedAt: null,
        });
      }
    }
  }

  const open = stages.get(p.currentStage);
  if (open?.status !== 'IN_PROGRESS') throw new Error(`${p.code}: history does not leave ${p.currentStage} open`);

  for (const d of deadlines) {
    d.status = clockStatus(
      findClock(pack, d.clockCode),
      d.dueAt,
      now,
      pack.thresholds.deadlineDueSoonDays,
      d.satisfiedAt,
    );
    if (d.status === 'SATISFIED' && !d.satisfiedAt) d.satisfiedAt = d.dueAt; // an elapsed window
  }
  return { stages: [...stages.values()], deadlines, projectStatus: facts.status };
}
