import {
  attestations,
  documents,
  hearings,
  projectParcels,
  projects,
  stageChecklist,
  stageInstances,
  stageTransitions,
  type Tx,
} from '@bhoomisetu/db';
import {
  applicableStages,
  availableActions,
  checkGuards,
  findStage,
  planTransition,
  requiredChecklist,
  type GuardContext,
  type Pack,
  type ProjectFacts,
  type Stage,
  type StageState,
} from '@bhoomisetu/rules';
import type { TransitionAction } from '@bhoomisetu/shared';
import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth-user';
import { ClockService } from '../common/clock/clock.service';
import { DbService } from '../common/db/db.service';
import { ProblemException } from '../common/errors/problem';
import { writeOutbox } from '../common/outbox/outbox';
import { RulesService } from '../rules/rules.service';
import { DeadlinesService } from './deadlines.service';
import { resolveGate } from './gates';
import type { StageActionBody } from './workflow.dto';

type ProjectRow = typeof projects.$inferSelect;
type InstanceRow = typeof stageInstances.$inferSelect;

const ENDED = new Set(['APPROVED', 'TERMINATED', 'NULLIFIED', 'SKIPPED']);

/**
 * The workflow engine's persistence (G12). Every stage state change in the system goes through
 * `act`: guards from the pinned pack → plan → one transaction writing stage instances, the
 * transition, project status, outbox events, deadline starts/satisfactions and the audit row.
 */
@Injectable()
export class WorkflowService {
  constructor(
    private readonly db: DbService,
    private readonly rules: RulesService,
    private readonly deadlines: DeadlinesService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  // ---------------------------------------------------------------- loading

  private async loadProject(tx: Tx, projectId: string): Promise<{ project: ProjectRow; pack: Pack }> {
    // RLS: a project outside the caller's jurisdiction is simply not found.
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId));
    if (!project) throw new ProblemException(404, 'PROJECT_NOT_FOUND', 'No such project in your jurisdiction.');
    if (!project.rulePackCode || !project.rulePackVersion) {
      throw new ProblemException(
        409,
        'PROJECT_NOT_SUBMITTED',
        'The project has no pinned rule pack yet — submit it first.',
      );
    }
    const pack = this.rules.get(project.rulePackCode, project.rulePackVersion);
    if (!pack) {
      throw new ProblemException(
        500,
        'PACK_MISSING',
        `Pinned pack ${project.rulePackCode}@${project.rulePackVersion} is not loaded.`,
      );
    }
    return { project, pack };
  }

  private async facts(tx: Tx, project: ProjectRow): Promise<ProjectFacts> {
    const [area] = await tx
      .select({ sqm: sql<string | null>`sum(${projectParcels.affectedAreaSqm})` })
      .from(projectParcels)
      .where(eq(projectParcels.projectId, project.id));
    return {
      acquisitionType: project.acquisitionType,
      isUrgency: project.isUrgency,
      inScheduledArea: project.inScheduledArea,
      affectedAreaSqm: area?.sqm ? Number(area.sqm) : 0,
      status: project.status,
    };
  }

  /** Latest attempt of every started stage. */
  private async latestInstances(tx: Tx, projectId: string): Promise<Map<string, InstanceRow>> {
    const rows = await tx
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.projectId, projectId))
      .orderBy(asc(stageInstances.stageCode), desc(stageInstances.attempt));
    const latest = new Map<string, InstanceRow>();
    for (const r of rows) if (!latest.has(r.stageCode)) latest.set(r.stageCode, r);
    return latest;
  }

  private toState(r: InstanceRow): StageState {
    return {
      stageCode: r.stageCode,
      attempt: r.attempt,
      status: r.status,
      submittedByUserId: r.submittedByUserId,
      submittedByPostId: r.submittedByPostId,
    };
  }

  /**
   * Checklist satisfaction, derived from evidence rather than a tick-box:
   *   document → an attested document of that type on the project (G21)
   *   hearing  → a hearing of that type with status VALID
   *   event / gate → the stage_checklist row its owning module sets on the current attempt
   */
  private async checklist(tx: Tx, projectId: string, stage: Stage, instance: InstanceRow | undefined) {
    const docTypes = stage.checklist.flatMap((i) => (i.type === 'document' && i.docType ? [i.docType] : []));
    const hearingTypes = stage.checklist.flatMap((i) => (i.type === 'hearing' && i.hearingType ? [i.hearingType] : []));

    const attestedDocs = docTypes.length
      ? await tx
          .selectDistinct({ docType: documents.docType })
          .from(documents)
          .innerJoin(attestations, eq(attestations.documentId, documents.id))
          .where(and(eq(documents.projectId, projectId), inArray(documents.docType, docTypes)))
      : [];
    const validHearings = hearingTypes.length
      ? await tx
          .selectDistinct({ type: hearings.type })
          .from(hearings)
          .where(
            and(eq(hearings.projectId, projectId), inArray(hearings.type, hearingTypes), eq(hearings.status, 'VALID')),
          )
      : [];
    const rows = instance
      ? await tx.select().from(stageChecklist).where(eq(stageChecklist.stageInstanceId, instance.id))
      : [];

    const docs = new Set<string>(attestedDocs.map((d) => d.docType));
    const heard = new Set<string>(validHearings.map((h) => h.type));
    const ticked = new Set(rows.filter((r) => r.satisfied).map((r) => r.itemCode));

    const out: Record<string, boolean> = {};
    for (const i of stage.checklist) {
      if (i.type === 'document') out[i.code] = !!i.docType && docs.has(i.docType);
      else if (i.type === 'hearing') out[i.code] = !!i.hearingType && heard.has(i.hearingType);
      else out[i.code] = (await resolveGate(tx, projectId, i.code)) ?? ticked.has(i.code);
    }
    return out;
  }

  private async context(tx: Tx, user: AuthUser, projectId: string, stageCode: string) {
    const { project, pack } = await this.loadProject(tx, projectId);
    let stage: Stage;
    try {
      stage = findStage(pack, stageCode);
    } catch {
      throw new ProblemException(404, 'STAGE_NOT_FOUND', `${pack.code}@${pack.version} has no stage ${stageCode}.`);
    }
    const instances = await this.latestInstances(tx, projectId);
    const instance = instances.get(stageCode);
    const ctx: GuardContext = {
      project: await this.facts(tx, project),
      stages: [...instances.values()].map((r) => this.toState(r)),
      // The project row was visible through RLS, so the post's jurisdiction covers it (guard 2).
      actor: { userId: user.id, postId: user.post.id, role: user.post.role, coversProject: true },
      checklist: await this.checklist(tx, projectId, stage, instance),
      firedClocks: await this.deadlines.firedClocks(tx, projectId),
    };
    return { project, pack, stage, instance, instances, ctx };
  }

  // ---------------------------------------------------------------- reads

  /** GET …/stages/:stageCode/actions — every action with its guard result, for the action panel. */
  async actions(user: AuthUser, projectId: string, stageCode: string) {
    return this.db.withScope(user, async (tx) => {
      const { pack, stage, instance, ctx } = await this.context(tx, user, projectId, stageCode);
      return {
        stageCode,
        stageName: stage.name,
        sections: stage.sections,
        status: instance?.status ?? 'NOT_STARTED',
        attempt: instance?.attempt ?? null,
        checklist: requiredChecklist(pack, stage, ctx.project).map((i) => ({
          ...i,
          satisfied: !!ctx.checklist[i.code],
        })),
        actions: availableActions(pack, stageCode, ctx),
      };
    });
  }

  /** GET /projects/:id/timeline — applicable stages with every attempt and transition. */
  async timeline(user: AuthUser, projectId: string) {
    return this.db.withScope(user, async (tx) => {
      const { project, pack } = await this.loadProject(tx, projectId);
      const facts = await this.facts(tx, project);
      const instances = await tx
        .select()
        .from(stageInstances)
        .where(eq(stageInstances.projectId, projectId))
        .orderBy(asc(stageInstances.stageCode), asc(stageInstances.attempt));
      const transitions = await tx
        .select()
        .from(stageTransitions)
        .where(eq(stageTransitions.projectId, projectId))
        .orderBy(asc(stageTransitions.at));
      return {
        project: {
          id: project.id,
          code: project.code,
          name: project.name,
          status: project.status,
          currentStage: project.currentStage,
          rulePack: `${pack.code}@${pack.version}`,
        },
        stages: applicableStages(pack, facts).map((s) => ({
          code: s.code,
          name: s.name,
          order: s.order,
          sections: s.sections,
          ownerRole: s.ownerRole,
          attempts: instances
            .filter((i) => i.stageCode === s.code)
            .map((i) => ({ ...i, transitions: transitions.filter((t) => t.stageInstanceId === i.id) })),
        })),
        deadlines: await this.deadlines.listForProject(tx, pack, projectId),
      };
    });
  }

  /**
   * Projects pipeline (§24.3): every project in the caller's scope with its applicable stages and where it stands,
   * in one call. Read-only and for higher authorities only — national and state posts; RLS still limits the rows.
   */
  async pipeline(user: AuthUser, stateCode?: string) {
    if (user.post.level !== 'NATIONAL' && user.post.level !== 'STATE')
      throw new ProblemException(
        403,
        'PIPELINE_HIGHER_AUTHORITY_ONLY',
        'The projects pipeline is for national and state posts. Open a project from your own dashboard instead.',
      );
    return this.db.withScope(user, async (tx) => {
      const rows_ = await tx.select().from(projects).orderBy(asc(projects.code));
      const scoped = rows_.filter((p) => p.rulePackCode && p.rulePackVersion && (!stateCode || p.stateCode === stateCode));
      const ids = scoped.map((p) => p.id);
      if (!ids.length) return { asOf: this.clock.now().toISOString(), projects: [] };
      const instances = await tx
        .select()
        .from(stageInstances)
        .where(inArray(stageInstances.projectId, ids))
        .orderBy(asc(stageInstances.attempt));
      const deadlineRows = (
        await tx.execute<{
          project_id: string;
          label: string | null;
          section: string;
          due_at: string;
          days_remaining: number;
          live_status: 'SAFE' | 'DUE_SOON' | 'BREACHED';
          consequence_text: string | null;
        }>(
          sql`SELECT project_id, label, section, due_at, days_remaining, live_status, consequence_text
              FROM v_deadline_board WHERE project_id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
              ORDER BY (live_status = 'BREACHED') DESC, due_at`,
        )
      ).rows;
      const statusOf = (s: string | undefined) =>
        s === 'APPROVED'
          ? 'done'
          : s === 'IN_PROGRESS' || s === 'SUBMITTED'
            ? 'active'
            : s === 'RETURNED'
              ? 'returned'
              : s === 'SKIPPED'
                ? 'skipped'
                : s === 'TERMINATED' || s === 'NULLIFIED'
                  ? 'stopped'
                  : 'not_started';
      const out = [];
      for (const project of scoped) {
        const pack = this.rules.get(project.rulePackCode!, project.rulePackVersion!); // filtered above
        if (!pack) continue;
        const facts = await this.facts(tx, project);
        const stages = applicableStages(pack, facts).map((st) => {
          const attempts = instances.filter((i) => i.projectId === project.id && i.stageCode === st.code);
          const latest = attempts[attempts.length - 1];
          return {
            code: st.code,
            name: st.name,
            sections: st.sections,
            status: statusOf(latest?.status),
            attempts: attempts.length,
            startedAt: latest?.startedAt ?? null,
            completedAt: latest?.completedAt ?? null,
          };
        });
        const deadlines = deadlineRows.filter((d) => d.project_id === project.id);
        out.push({
          id: project.id,
          code: project.code,
          name: project.name,
          stateCode: project.stateCode,
          status: project.status,
          currentStage: project.currentStage,
          rulePack: `${pack.code}@${pack.version}`,
          stages,
          done: stages.filter((s) => s.status === 'done' || s.status === 'skipped').length,
          risk: deadlines.some((d) => d.live_status === 'BREACHED')
            ? 'BREACHED'
            : deadlines.some((d) => d.live_status === 'DUE_SOON')
              ? 'DUE_SOON'
              : 'SAFE',
          nextDeadline: deadlines[0] ?? null,
        });
      }
      return { asOf: this.clock.now().toISOString(), projects: out };
    });
  }

  async projectDeadlines(user: AuthUser, projectId: string) {
    return this.db.withScope(user, async (tx) => {
      const { pack } = await this.loadProject(tx, projectId);
      return this.deadlines.listForProject(tx, pack, projectId);
    });
  }

  // ---------------------------------------------------------------- the one write path

  async act(user: AuthUser, projectId: string, stageCode: string, body: StageActionBody) {
    return this.db.withScope(user, async (tx) => {
      const { project, pack, instance, ctx } = await this.context(tx, user, projectId, stageCode);
      const action: TransitionAction = body.action;
      const input = {
        reasonCode: body.reasonCode,
        writtenReasons: body.writtenReasons,
        conditions: body.conditions,
        targetStageCode: body.targetStageCode,
        attested: body.attest,
      };

      const guard = checkGuards(pack, stageCode, action, input, ctx);
      if (!guard.allowed) {
        throw new ProblemException(422, 'GUARD_FAILED', `${action} on ${stageCode} is not allowed.`, {
          failures: guard.failures,
        });
      }
      await this.assertDocuments(tx, projectId, body.documentIds);

      const now = this.clock.now();
      const plan = planTransition(pack, stageCode, action, input, ctx);
      const [acted, ...opened] = plan.changes;
      if (!acted) throw new Error('planTransition returned no change for the acted stage');

      // 1. The acted stage instance.
      const outcome =
        action === 'APPROVE_CONDITIONAL'
          ? { conditions: body.conditions }
          : action === 'OVERRIDE'
            ? { writtenReasons: body.writtenReasons }
            : undefined;
      const fields = {
        status: acted.status,
        ...(action === 'SUBMIT'
          ? { submittedAt: now, submittedByUserId: user.id, submittedByPostId: user.post.id }
          : {}),
        ...(ENDED.has(acted.status) ? { completedAt: now } : {}),
        ...(outcome ? { outcome } : {}),
      };
      const [actedRow] = acted.isNew
        ? await tx
            .insert(stageInstances)
            .values({ projectId, stageCode, attempt: acted.attempt, startedAt: now, ...fields })
            .returning()
        : await tx
            .update(stageInstances)
            .set(fields)
            .where(
              and(
                eq(stageInstances.projectId, projectId),
                eq(stageInstances.stageCode, stageCode),
                eq(stageInstances.attempt, acted.attempt),
              ),
            )
            .returning();
      if (!actedRow)
        throw new ProblemException(409, 'STAGE_CHANGED', 'The stage changed while you were acting — reload.');

      // 2. Stages the plan opens (next stage, parallel stage, new attempt, return target).
      for (const c of opened) {
        await tx
          .insert(stageInstances)
          .values({ projectId, stageCode: c.stageCode, attempt: c.attempt, status: c.status, startedAt: now });
      }

      // 3. The append-only transition record.
      const [transition] = await tx
        .insert(stageTransitions)
        .values({
          projectId,
          stageInstanceId: actedRow.id,
          fromStatus: plan.fromStatus,
          toStatus: plan.newStatus,
          action,
          targetStageCode: body.targetStageCode ?? null,
          reasonCode: body.reasonCode ?? null,
          remarks: body.remarks ?? null,
          actorUserId: user.id,
          actorPostId: user.post.id,
          at: now,
          documentIds: body.documentIds,
        })
        .returning();

      // 4. Project status and current stage.
      const projectPatch = {
        ...(plan.projectStatus ? { status: plan.projectStatus } : {}),
        ...(plan.currentStage ? { currentStage: plan.currentStage } : {}),
      };
      if (Object.keys(projectPatch).length)
        await tx.update(projects).set(projectPatch).where(eq(projects.id, projectId));

      // 5. Outbox events, in the same transaction (§12.8).
      for (const type of plan.events) {
        await writeOutbox(tx, {
          type,
          aggregateType: 'project',
          aggregateId: projectId,
          payload: {
            projectId,
            stageCode,
            stageInstanceId: actedRow.id,
            attempt: actedRow.attempt,
            action,
            reasonCode: body.reasonCode ?? null,
            actorUserId: user.id,
            actorPostId: user.post.id,
            at: now,
            rulePack: `${pack.code}@${pack.version}`,
          },
        });
      }

      // 6. Clocks: satisfy what the events end, then start what they begin (project/stage subjects).
      const satisfied = [];
      const started = [];
      for (const event of plan.events) {
        satisfied.push(...(await this.deadlines.satisfyForEvent(tx, { pack, projectId, event, at: now })));
        started.push(
          ...(await this.deadlines.startForEvent(tx, {
            pack,
            projectId,
            event,
            at: now,
            subject: { type: 'PROJECT', id: projectId },
          })),
          ...(await this.deadlines.startForEvent(tx, {
            pack,
            projectId,
            event,
            at: now,
            subject: { type: 'STAGE', id: actedRow.id },
          })),
        );
      }

      // 7. Audit (G15), with before/after.
      await this.audit.record({
        action: `STAGE_${action}`,
        entityType: 'stage_instance',
        entityId: actedRow.id,
        before: instance ?? null,
        after: { stageInstance: actedRow, projectStatus: plan.projectStatus ?? project.status, opened },
      });

      return {
        stageInstance: actedRow,
        transition,
        projectStatus: plan.projectStatus ?? project.status,
        currentStage: plan.currentStage ?? project.currentStage,
        openedStages: opened,
        eventsEmitted: plan.events,
        clocks: {
          started: started.map((d) => ({ clockCode: d.clockCode, dueAt: d.dueAt, consequence: d.consequence })),
          satisfied: satisfied.map((d) => d.clockCode),
        },
      };
    });
  }

  private async assertDocuments(tx: Tx, projectId: string, ids: string[]) {
    if (!ids.length) return;
    const found = await tx
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.projectId, projectId), inArray(documents.id, ids)));
    if (found.length !== new Set(ids).size) {
      throw new ProblemException(422, 'DOCUMENT_NOT_FOUND', 'Every supporting document must belong to this project.');
    }
  }
}
