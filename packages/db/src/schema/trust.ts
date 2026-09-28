import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { id, stamps, timestamptz } from './_columns';
import { chainStatusEnum, docTypeEnum, notificationSeverityEnum, ocrStatusEnum } from './enums';
import { posts, users } from './org';
import { projects } from './projects';

// Documents, trust & audit (§10.3).

export const documents = pgTable(
  'documents',
  {
    id: id(),
    /**
     * Not in §10.3: added so RLS can scope documents (a polymorphic entity_id has no path to a
     * project). Set it at upload from the owning entity; null only for non-project documents.
     */
    projectId: uuid().references(() => projects.id),
    entityType: text().notNull(),
    entityId: uuid().notNull(),
    docType: docTypeEnum().notNull(),
    title: text().notNull(),
    language: text(),
    version: integer().notNull().default(1),
    supersedesId: uuid().references((): AnyPgColumn => documents.id),
    objectKey: text().notNull(),
    mime: text().notNull(),
    sizeBytes: bigint({ mode: 'number' }).notNull(),
    sha256: text().notNull(),
    uploadedByUserId: uuid()
      .notNull()
      .references(() => users.id),
    uploadedByPostId: uuid()
      .notNull()
      .references(() => posts.id),
    uploadedAt: timestamptz().notNull(),
    ...stamps,
  },
  (t) => [index().on(t.entityType, t.entityId), index().on(t.projectId)],
);

/** Per-document officer attestation (G21). Append-only. */
export const attestations = pgTable('attestations', {
  id: id(),
  documentId: uuid()
    .notNull()
    .unique()
    .references(() => documents.id),
  userId: uuid()
    .notNull()
    .references(() => users.id),
  postId: uuid()
    .notNull()
    .references(() => posts.id),
  designationSnapshot: text().notNull(),
  jurisdictionSnapshot: text().notNull(),
  /** e.g. ATTEST_V1 */
  declarationVersion: text().notNull(),
  documentSha256: text().notNull(),
  ip: inet(),
  userAgent: text(),
  attestedAt: timestamptz().notNull(),
  ...stamps,
});

/** OCR assists; only `accepted` (human-accepted values) may flow into entitlements (G3). */
export const ocrExtractions = pgTable('ocr_extractions', {
  id: id(),
  documentId: uuid()
    .notNull()
    .references(() => documents.id),
  engine: text().notNull(),
  /** [{key, value, confidence, page, bbox}] */
  fields: jsonb()
    .notNull()
    .default(sql`'[]'`),
  status: ocrStatusEnum().notNull().default('pending'),
  reviewedByPostId: uuid().references(() => posts.id),
  /** [{key, value, acceptedAt}] */
  accepted: jsonb()
    .notNull()
    .default(sql`'[]'`),
  ...stamps,
});

/**
 * Anchors of human-approved records (G4). Only status / tx columns may change after insert
 * (trg_append_only). Written by the anchor job; app_user may only read.
 */
export const chainEvents = pgTable(
  'chain_events',
  {
    id: id(),
    entityType: text().notNull(),
    entityId: uuid().notNull(),
    entityVersion: integer().notNull().default(1),
    eventType: text().notNull(),
    canonicalPayload: jsonb().notNull(),
    /** 0x-prefixed sha256 */
    dataHash: text().notNull(),
    status: chainStatusEnum().notNull().default('QUEUED'),
    txHash: text(),
    blockNumber: bigint({ mode: 'number' }),
    anchoredAt: timestamptz(),
    attempts: integer().notNull().default(0),
    lastError: text(),
    ...stamps,
  },
  (t) => [unique().on(t.entityType, t.entityId, t.entityVersion)],
);

/**
 * Append-only, hash-chained (§11.6). prev_hash / hash are set by trg_audit_chain — the defaults
 * only satisfy NOT NULL until the trigger runs. app_user may INSERT only.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    at: timestamptz()
      .notNull()
      .default(sql`app_now()`),
    actorUserId: uuid(),
    actorPostId: uuid(),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: uuid(),
    before: jsonb(),
    after: jsonb(),
    ip: inet(),
    requestId: text(),
    prevHash: text().notNull().default(''),
    hash: text().notNull().default(''),
    ...stamps,
  },
  (t) => [index().on(t.entityType, t.entityId)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    recipientPostId: uuid()
      .notNull()
      .references(() => posts.id),
    recipientUserId: uuid().references(() => users.id),
    trigger: text().notNull(),
    severity: notificationSeverityEnum().notNull().default('info'),
    escalationLevel: integer().notNull().default(0),
    entityType: text(),
    entityId: uuid(),
    title: text().notNull(),
    body: text(),
    deepLink: text(),
    /** {inApp: true, email: 'sent', sms: 'mock'} */
    channels: jsonb()
      .notNull()
      .default(sql`'{}'`),
    readAt: timestamptz(),
    ...stamps,
  },
  (t) => [index().on(t.recipientPostId, t.readAt)],
);

/**
 * Idempotency-Key replay store (§13): required on field sync and payment endpoints. A repeated key
 * from the same user returns the stored response instead of acting twice.
 */
export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => users.id),
  route: text().notNull(),
  requestSha256: text().notNull(),
  response: jsonb().notNull(),
  ...stamps,
});

/** Mock SMS adapter outbox (§30), visible at /dev/sms in DEMO_MODE. Never real phone numbers. */
export const devOutboxSms = pgTable('dev_outbox_sms', {
  id: id(),
  toMasked: text().notNull(),
  template: text().notNull(),
  body: text().notNull(),
  ...stamps,
});
