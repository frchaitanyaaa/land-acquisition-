import { sql } from 'drizzle-orm';
import { bigserial, boolean, check, index, integer, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { id, stamps, timestamptz } from './_columns';
import { villages } from './admin';
import {
  checklistItemTypeEnum,
  deadlineStatusEnum,
  expertOutcomeEnum,
  hearingStatusEnum,
  hearingTypeEnum,
  stageStatusEnum,
  transitionActionEnum,
} from './enums';
import { posts, users } from './org';
import { projects } from './projects';
import { documents } from './trust';

// Workflow (§10.3). Stage and clock codes are text: packs define them (G12 — state changes go
// through the workflow engine, never a direct UPDATE from a controller).

export const stageInstances = pgTable(
  'stage_instances',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id),
    stageCode: text().notNull(),
    attempt: integer().notNull().default(1),
    status: stageStatusEnum().notNull().default('NOT_STARTED'),
    startedAt: timestamptz(),
    submittedAt: timestamptz(),
    completedAt: timestamptz(),
    assignedPostId: uuid().references(() => posts.id),
    submittedByUserId: uuid().references(() => users.id),
    submittedByPostId: uuid().references(() => posts.id),
    /** e.g. expert group outcome, conditions */
    outcome: jsonb(),
    ...stamps,
  },
  (t) => [unique().on(t.projectId, t.stageCode, t.attempt)],
);

/** Append-only (trg_append_only). */
export const stageTransitions = pgTable(
  'stage_transitions',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id),
    stageInstanceId: uuid()
      .notNull()
      .references(() => stageInstances.id),
    fromStatus: stageStatusEnum(),
    toStatus: stageStatusEnum().notNull(),
    action: transitionActionEnum().notNull(),
    /** For RETURN to another stage. */
    targetStageCode: text(),
    /** From the pack's reasonCodes. */
    reasonCode: text(),
    remarks: text(),
    actorUserId: uuid()
      .notNull()
      .references(() => users.id),
    actorPostId: uuid()
      .notNull()
      .references(() => posts.id),
    at: timestamptz().notNull(),
    documentIds: uuid()
      .array()
      .notNull()
      .default(sql`'{}'`),
    ...stamps,
  },
  (t) => [index().on(t.projectId, t.at)],
);

export const stageChecklist = pgTable(
  'stage_checklist',
  {
    id: id(),
    stageInstanceId: uuid()
      .notNull()
      .references(() => stageInstances.id),
    itemCode: text().notNull(),
    itemType: checklistItemTypeEnum().notNull(),
    satisfied: boolean().notNull().default(false),
    satisfiedAt: timestamptz(),
    refId: uuid(),
    ...stamps,
  },
  (t) => [unique().on(t.stageInstanceId, t.itemCode)],
);

export const expertRecommendations = pgTable('expert_recommendations', {
  id: id(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id),
  outcome: expertOutcomeEnum().notNull(),
  conditions: text(),
  /** [{name, seat, coiDeclarationDocId}] */
  members: jsonb().notNull(),
  chairperson: text(),
  dissentNotes: jsonb(),
  reportDocumentId: uuid().references(() => documents.id),
  signedAt: timestamptz(),
  ...stamps,
});

export const governmentOverrides = pgTable(
  'government_overrides',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id),
    expertRecommendationId: uuid()
      .notNull()
      .references(() => expertRecommendations.id),
    /** s.8(2): mandatory. */
    writtenReasons: text().notNull(),
    orderDocumentId: uuid().references(() => documents.id),
    decidedByPostId: uuid()
      .notNull()
      .references(() => posts.id),
    decidedAt: timestamptz().notNull(),
    ...stamps,
  },
  (t) => [check('overrides_reasons_present', sql`length(trim(${t.writtenReasons})) > 0`)],
);

export const hearings = pgTable('hearings', {
  id: id(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id),
  type: hearingTypeEnum().notNull(),
  attempt: integer().notNull().default(1),
  scheduledAt: timestamptz().notNull(),
  venue: text(),
  villageCode: text().references(() => villages.code),
  noticePublishedAt: timestamptz(),
  noticeDocumentId: uuid().references(() => documents.id),
  localLanguageSummaryDocumentId: uuid().references(() => documents.id),
  recordingDocumentId: uuid().references(() => documents.id),
  attendanceDocumentId: uuid().references(() => documents.id),
  quorumMet: boolean(),
  /** Public Hearing Response Matrix. */
  responseMatrixDocumentId: uuid().references(() => documents.id),
  status: hearingStatusEnum().notNull().default('SCHEDULED'),
  voidReasonCode: text(),
  voidedByPostId: uuid().references(() => posts.id),
  ...stamps,
});

/**
 * Written in the same transaction as the change it announces (writeOutbox). The relay job
 * publishes unprocessed rows; consumers are idempotent. app_user may INSERT only.
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    type: text().notNull(),
    aggregateType: text().notNull(),
    aggregateId: uuid().notNull(),
    payload: jsonb().notNull(),
    processedAt: timestamptz(),
    attempts: integer().notNull().default(0),
    lastError: text(),
    ...stamps,
  },
  (t) => [
    index('outbox_events_unprocessed_idx')
      .on(t.id)
      .where(sql`${t.processedAt} IS NULL`),
  ],
);

/** A statutory deadline instance (§10.3 Deadlines). `status` is recomputed by deadline-scan. */
export const statutoryDeadlines = pgTable(
  'statutory_deadlines',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id),
    clockCode: text().notNull(),
    section: text().notNull(),
    /** The pack clock's subject: PROJECT | STAGE | ENTITLEMENT | PROJECT_PARCEL | HEARING | AFFECTED_FAMILY */
    subjectType: text().notNull(),
    subjectId: uuid().notNull(),
    rulePackCode: text().notNull(),
    rulePackVersion: text().notNull(),
    startEvent: text().notNull(),
    startedAt: timestamptz().notNull(),
    dueAt: timestamptz().notNull(),
    consequence: text().notNull(),
    status: deadlineStatusEnum().notNull().default('NOT_STARTED'),
    satisfiedAt: timestamptz(),
    breachedAt: timestamptz(),
    /** e.g. {presentAtAward: true} */
    conditionInputs: jsonb(),
    ...stamps,
  },
  (t) => [index().on(t.status, t.dueAt), index().on(t.projectId)],
);
