import type { ProjectStatus, Role, StageStatus, TransitionAction } from '@bhoomisetu/shared';
import type { Pack, Stage, StageAction } from '../../schema/pack.schema';
import { clocksSatisfiedBy, clocksStartedBy } from './clocks';
import { evaluateCondition, type ProjectFacts } from './conditions';

// The workflow engine (CLAUDE.md §12.6). Pure: the API loads state, calls these, persists the plan.

export interface StageState {
  stageCode: string;
  attempt: number;
  status: StageStatus;
  submittedByUserId?: string | null;
  submittedByPostId?: string | null;
}

export interface Actor {
  userId: string;
  postId: string;
  role: Role;
  /** Whether the actor's post jurisdiction covers the project (RLS already scoped the read). */
  coversProject: boolean;
}

export interface GuardContext {
  project: ProjectFacts;
  /** Latest attempt of every stage that has been started. Absent = NOT_STARTED. */
  stages: StageState[];
  actor: Actor;
  /** Checklist item code → satisfied, for the stage being acted on. */
  checklist: Record<string, boolean>;
  /** Clocks whose consequence has fired (deadline BREACHED), by clock code. */
  firedClocks?: string[];
}

export interface ActionInput {
  reasonCode?: string | null;
  writtenReasons?: string | null;
  conditions?: string | null;
  targetStageCode?: string | null;
  /** The actor ticked the attestation declaration for this action. */
  attested?: boolean;
}

export interface GuardFailure {
  code: string;
  message: string;
}
export interface GuardResult {
  allowed: boolean;
  failures: GuardFailure[];
}

/** Consequences that make the stage which would have satisfied the clock legally unavailable. */
const BLOCKING_CONSEQUENCES = new Set(['SIA_LAPSED', 'DEEMED_RESCINDED', 'PROCEEDINGS_LAPSE']);

/** Actions that move a stage forward — these need the checklist and an unblocked clock. */
const FORWARD_ACTIONS: ReadonlySet<TransitionAction> = new Set([
  'SUBMIT',
  'APPROVE',
  'APPROVE_CONDITIONAL',
  'OVERRIDE',
]);
const REASONED_ACTIONS: ReadonlySet<TransitionAction> = new Set(['RETURN', 'REJECT', 'NULLIFY', 'TERMINATE']);
const CHECKER_ACTIONS: ReadonlySet<TransitionAction> = new Set([
  'APPROVE',
  'APPROVE_CONDITIONAL',
  'REJECT',
  'OVERRIDE',
  'RETURN',
]);

export function findStage(pack: Pack, stageCode: string): Stage {
  const stage = pack.stages.find((s) => s.code === stageCode);
  if (!stage) throw new Error(`${pack.code}@${pack.version} has no stage ${stageCode}`);
  return stage;
}

export function applicableStages(pack: Pack, project: ProjectFacts): Stage[] {
  return pack.stages.filter((s) => evaluateCondition(pack, s.appliesWhen, project)).sort((a, b) => a.order - b.order);
}

const latest = (stages: StageState[], code: string) => stages.find((s) => s.stageCode === code);
const statusOf = (stages: StageState[], code: string): StageStatus => latest(stages, code)?.status ?? 'NOT_STARTED';
const hasStarted = (status: StageStatus) => status !== 'NOT_STARTED';

/** Prerequisites for a stage to be open. Normally every earlier applicable stage is APPROVED (or
 *  SKIPPED). A stage that runs alongside another (`parallelWith`, e.g. consent with the SIA, s.2)
 *  needs only the stages before its partner approved and the partner started; stages between the
 *  partner and itself (the appraisal) do not hold it back. */
function orderingFailures(pack: Pack, stage: Stage, ctx: Pick<GuardContext, 'project' | 'stages'>): GuardFailure[] {
  const failures: GuardFailure[] = [];
  const applicable = applicableStages(pack, ctx.project);
  const parallel = new Set(stage.parallelWith ?? []);
  const partners = applicable.filter((s) => parallel.has(s.code));
  const cutoff = partners.length ? Math.min(...partners.map((s) => s.order)) : stage.order;
  for (const prev of applicable) {
    if (prev.order >= stage.order) break;
    const status = statusOf(ctx.stages, prev.code);
    if (prev.order >= cutoff) {
      if (parallel.has(prev.code) && !hasStarted(status)) {
        failures.push({ code: 'STAGE_ORDER', message: `${prev.name} (${prev.code}) must have started first` });
      }
      continue;
    }
    if (status === 'APPROVED' || status === 'SKIPPED') continue;
    failures.push({ code: 'STAGE_ORDER', message: `${prev.name} (${prev.code}) must be approved first` });
  }
  return failures;
}

/** Applicable stages not yet started whose prerequisites are met. */
export function startableStages(pack: Pack, ctx: Pick<GuardContext, 'project' | 'stages'>): Stage[] {
  return applicableStages(pack, ctx.project).filter(
    (s) => !hasStarted(statusOf(ctx.stages, s.code)) && orderingFailures(pack, s, ctx).length === 0,
  );
}

function allowedFrom(stage: Stage, action: TransitionAction): StageStatus[] {
  switch (action) {
    case 'SUBMIT':
      return ['NOT_STARTED', 'IN_PROGRESS', 'RETURNED'];
    case 'APPROVE':
    case 'APPROVE_CONDITIONAL':
      // A stage with no SUBMIT step (e.g. continuous post-acquisition) is approved directly.
      return stage.actions.SUBMIT ? ['SUBMITTED'] : ['IN_PROGRESS'];
    case 'REJECT':
    case 'OVERRIDE':
    case 'RETURN':
      return ['SUBMITTED'];
    case 'NULLIFY':
    case 'TERMINATE':
      return ['IN_PROGRESS', 'SUBMITTED', 'RETURNED'];
    case 'SKIP':
      return ['NOT_STARTED'];
  }
}

export function requiredChecklist(pack: Pack, stage: Stage, project: ProjectFacts) {
  return stage.checklist.filter(
    (i) => i.required || (i.requiredWhen && evaluateCondition(pack, i.requiredWhen, project)),
  );
}

function reasonCodesFor(pack: Pack, stage: Stage, def: StageAction): string[] {
  return def.reasonCodes ?? pack.reasonCodes[stage.code] ?? [];
}

/** Clocks that, once breached, block forward movement of this stage. */
export function blockingClocks(pack: Pack, stage: Stage): string[] {
  const emitted = new Set(Object.values(stage.actions).flatMap((a) => a.emits ?? []));
  return pack.clocks
    .filter((c) => c.endsOn && emitted.has(c.endsOn) && BLOCKING_CONSEQUENCES.has(c.consequence))
    .map((c) => c.code);
}

export function checkGuards(
  pack: Pack,
  stageCode: string,
  action: TransitionAction,
  input: ActionInput,
  ctx: GuardContext,
): GuardResult {
  const stage = findStage(pack, stageCode);
  const def = stage.actions[action];
  const failures: GuardFailure[] = [];
  const fail = (code: string, message: string) => failures.push({ code, message });

  if (!def)
    return {
      allowed: false,
      failures: [{ code: 'ACTION_NOT_DEFINED', message: `${action} is not available on ${stage.code}` }],
    };

  if (!applicableStages(pack, ctx.project).some((s) => s.code === stage.code)) {
    fail('STAGE_NOT_APPLICABLE', `${stage.name} does not apply to this project`);
  }

  // 8. Project status. S01 is acted on while the project is still SUBMITTED.
  const first = applicableStages(pack, ctx.project)[0];
  const okStatus: ProjectStatus[] = stage.code === first?.code ? ['SUBMITTED', 'ACTIVE'] : ['ACTIVE'];
  if (!okStatus.includes(ctx.project.status)) fail('PROJECT_NOT_ACTIVE', `Project is ${ctx.project.status}`);

  // 1. Role, 2. jurisdiction.
  if (!def.roles.includes(ctx.actor.role)) {
    fail('ROLE_NOT_ALLOWED', `${action} on ${stage.code} needs one of: ${def.roles.join(', ')}`);
  }
  if (!ctx.actor.coversProject) fail('OUT_OF_JURISDICTION', 'Your post does not cover this project');

  // Stage status.
  const current = latest(ctx.stages, stage.code);
  const status = current?.status ?? 'NOT_STARTED';
  if (!allowedFrom(stage, action).includes(status))
    fail('INVALID_STAGE_STATUS', `${action} is not possible while the stage is ${status}`);

  // 3. Maker-checker (G20).
  if (def.makerChecker && CHECKER_ACTIONS.has(action) && current) {
    if (current.submittedByUserId && current.submittedByUserId === ctx.actor.userId) {
      fail('MAKER_CHECKER', 'The officer who submitted cannot also decide');
    }
    if (current.submittedByPostId && current.submittedByPostId === ctx.actor.postId) {
      fail('MAKER_CHECKER', 'The post that submitted cannot also decide');
    }
  }

  // 4. Checklist.
  if (FORWARD_ACTIONS.has(action)) {
    for (const item of requiredChecklist(pack, stage, ctx.project)) {
      if (!ctx.checklist[item.code]) fail('CHECKLIST_INCOMPLETE', `Checklist item ${item.code} is not satisfied`);
    }
  }

  // 5. Reason codes, 6. written reasons, conditions, attestation.
  if (REASONED_ACTIONS.has(action)) {
    const allowed = reasonCodesFor(pack, stage, def);
    if (!input.reasonCode) fail('REASON_REQUIRED', `${action} needs a reason code`);
    else if (!allowed.includes(input.reasonCode))
      fail('REASON_NOT_ALLOWED', `${input.reasonCode} is not a valid reason for ${action} on ${stage.code}`);
  }
  if (def.requiresWrittenReasons && !input.writtenReasons?.trim()) {
    fail('WRITTEN_REASONS_REQUIRED', `${action} requires written reasons`);
  }
  if (action === 'APPROVE_CONDITIONAL' && !input.conditions?.trim()) {
    fail('CONDITIONS_REQUIRED', 'A conditional approval must record its conditions');
  }
  if (def.requiresAttestation && !input.attested) fail('ATTESTATION_REQUIRED', `${action} requires your attestation`);

  // RETURN to another stage: only an earlier applicable one.
  if (action === 'RETURN' && input.targetStageCode && input.targetStageCode !== stage.code) {
    const target = applicableStages(pack, ctx.project).find((s) => s.code === input.targetStageCode);
    if (!target || target.order >= stage.order)
      fail('INVALID_RETURN_TARGET', `Cannot return to ${input.targetStageCode}`);
  }

  // 7. Ordering (only matters for a stage being opened or moved forward).
  if (FORWARD_ACTIONS.has(action) || action === 'SKIP') failures.push(...orderingFailures(pack, stage, ctx));

  // 9. A fired lapse / rescission consequence blocks forward movement.
  if (FORWARD_ACTIONS.has(action)) {
    const fired = new Set(ctx.firedClocks ?? []);
    for (const code of blockingClocks(pack, stage)) {
      if (fired.has(code)) {
        const clock = pack.clocks.find((c) => c.code === code);
        fail('CLOCK_CONSEQUENCE', clock?.consequenceText ?? `Clock ${code} has lapsed`);
      }
    }
  }

  return { allowed: failures.length === 0, failures };
}

export interface ActionOption {
  action: TransitionAction;
  allowed: boolean;
  failures: GuardFailure[];
  reasonCodes: string[];
  requiresWrittenReasons: boolean;
  requiresAttestation: boolean;
  makerChecker: boolean;
  /** Roles the pack allows to take this action (for "who can act" hints; the guards still decide). */
  roles: Role[];
}

/** Every action defined on the stage, with guard results evaluated for inputs the UI will supply
 *  (reason code, written reasons, attestation are assumed present so the button reflects state). */
export function availableActions(pack: Pack, stageCode: string, ctx: GuardContext): ActionOption[] {
  const stage = findStage(pack, stageCode);
  return (Object.entries(stage.actions) as [TransitionAction, StageAction][]).map(([action, def]) => {
    const reasonCodes = REASONED_ACTIONS.has(action) ? reasonCodesFor(pack, stage, def) : [];
    const assumed: ActionInput = {
      reasonCode: reasonCodes[0] ?? null,
      writtenReasons: 'x',
      conditions: 'x',
      attested: true,
    };
    const { allowed, failures } = checkGuards(pack, stageCode, action, assumed, ctx);
    return {
      action,
      allowed,
      failures,
      reasonCodes,
      requiresWrittenReasons: !!def.requiresWrittenReasons,
      requiresAttestation: !!def.requiresAttestation,
      makerChecker: !!def.makerChecker,
      roles: [...def.roles],
    };
  });
}

export interface StageChange {
  stageCode: string;
  attempt: number;
  status: StageStatus;
  /** true = insert a new stage instance, false = update the existing one. */
  isNew: boolean;
}

export interface TransitionPlan {
  fromStatus: StageStatus;
  newStatus: StageStatus;
  /** Every stage instance to write, the acted-on stage first. */
  changes: StageChange[];
  projectStatus?: ProjectStatus;
  currentStage?: string;
  events: string[];
  clocksToStart: string[];
  clocksToSatisfy: string[];
}

const LIFECYCLE_EVENT: Partial<Record<TransitionAction, string>> = {
  SUBMIT: 'STAGE_SUBMITTED',
  APPROVE: 'STAGE_APPROVED',
  APPROVE_CONDITIONAL: 'STAGE_APPROVED',
  OVERRIDE: 'STAGE_APPROVED',
  RETURN: 'STAGE_RETURNED',
  NULLIFY: 'STAGE_NULLIFIED',
};

const NEW_STATUS: Record<TransitionAction, StageStatus> = {
  SUBMIT: 'SUBMITTED',
  APPROVE: 'APPROVED',
  APPROVE_CONDITIONAL: 'APPROVED',
  OVERRIDE: 'APPROVED',
  RETURN: 'RETURNED',
  REJECT: 'TERMINATED',
  NULLIFY: 'NULLIFIED',
  TERMINATE: 'TERMINATED',
  SKIP: 'SKIPPED',
};

/** Plans the transition. Call checkGuards first — this assumes the guards passed. */
export function planTransition(
  pack: Pack,
  stageCode: string,
  action: TransitionAction,
  input: ActionInput,
  ctx: Pick<GuardContext, 'project' | 'stages'>,
): TransitionPlan {
  const stage = findStage(pack, stageCode);
  const def = stage.actions[action];
  if (!def) throw new Error(`${action} is not defined on ${stageCode}`);

  const current = latest(ctx.stages, stageCode);
  const fromStatus = current?.status ?? 'NOT_STARTED';
  const attempt = current?.attempt ?? 1;
  const newStatus = NEW_STATUS[action];
  const changes: StageChange[] = [{ stageCode, attempt, status: newStatus, isNew: !current }];
  const events: string[] = [];
  const life = LIFECYCLE_EVENT[action];
  if (life) events.push(life);
  events.push(...(def.emits ?? []));

  let projectStatus: ProjectStatus | undefined;
  let currentStage: string | undefined;

  if (def.to === 'TERMINAL') {
    projectStatus = def.terminalStatus;
    if (projectStatus !== 'CLOSED') events.push('PROJECT_TERMINATED');
  } else if (action === 'NULLIFY') {
    // The attempt is void; the stage restarts as a fresh attempt.
    changes.push({ stageCode, attempt: attempt + 1, status: 'IN_PROGRESS', isNew: true });
  } else if (action === 'RETURN' && input.targetStageCode && input.targetStageCode !== stageCode) {
    const target = latest(ctx.stages, input.targetStageCode);
    changes.push({
      stageCode: input.targetStageCode,
      attempt: (target?.attempt ?? 0) + 1,
      status: 'IN_PROGRESS',
      isNew: true,
    });
    currentStage = input.targetStageCode;
  } else if (newStatus === 'APPROVED' || newStatus === 'SKIPPED') {
    // Open every stage that becomes startable, to a fixpoint: opening S02 also opens S04,
    // which runs alongside it (s.2).
    const after = ctx.stages.filter((s) => s.stageCode !== stageCode).concat({ stageCode, attempt, status: newStatus });
    for (let next = startableStages(pack, { project: ctx.project, stages: after }); next.length;) {
      for (const s of next) {
        after.push({ stageCode: s.code, attempt: 1, status: 'IN_PROGRESS' });
        changes.push({ stageCode: s.code, attempt: 1, status: 'IN_PROGRESS', isNew: true });
        currentStage ??= s.code;
      }
      next = startableStages(pack, { project: ctx.project, stages: after });
    }
    if (ctx.project.status === 'SUBMITTED') projectStatus = 'ACTIVE';
  }

  const pure = (codes: string[]) => [...new Set(codes)];
  return {
    fromStatus,
    newStatus,
    changes,
    projectStatus,
    currentStage,
    events,
    clocksToStart: pure(events.flatMap((e) => clocksStartedBy(pack, e).map((c) => c.code))),
    clocksToSatisfy: pure(events.flatMap((e) => clocksSatisfiedBy(pack, e).map((c) => c.code))),
  };
}
