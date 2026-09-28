import { sql } from 'drizzle-orm';
import { bigint, boolean, check, date, index, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { bytea, id, paise, point, stamps, timestamptz } from './_columns';
import {
  acceptanceTypeEnum,
  accessTokenPurposeEnum,
  ackMethodEnum,
  annuityStatusEnum,
  awardStatusEnum,
  awardTypeEnum,
  entitlementSourceEnum,
  entitlementStatusEnum,
  escrowGateEnum,
  escrowStatusEnum,
  escrowTxnKindEnum,
  paymentInstrumentEnum,
  paymentStatusEnum,
  scheduleRefEnum,
} from './enums';
import { posts } from './org';
import { affectedFamilies, persons } from './people';
import { projects } from './projects';
import { documents, ocrExtractions } from './trust';

// Money (§10.3). Every amount is integer paise (G9). Award figures are ENTERED by an officer and
// validated — the system never computes an award (G1).

export const escrowAccounts = pgTable(
  'escrow_accounts',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id),
    gate: escrowGateEnum().notNull(),
    demandAmountPaise: paise().notNull(),
    demandDocumentId: uuid().references(() => documents.id),
    depositedAmountPaise: paise()
      .notNull()
      .default(sql`0`),
    sufficiencyCertifiedAt: timestamptz(),
    certifiedByPostId: uuid().references(() => posts.id),
    status: escrowStatusEnum().notNull().default('demanded'),
    ...stamps,
  },
  (t) => [unique().on(t.projectId, t.gate)],
);

export const escrowTransactions = pgTable('escrow_transactions', {
  id: id(),
  escrowAccountId: uuid()
    .notNull()
    .references(() => escrowAccounts.id),
  kind: escrowTxnKindEnum().notNull(),
  amountPaise: paise().notNull(),
  reference: text(),
  at: timestamptz().notNull(),
  ...stamps,
});

/** Versioned (trg_versions_awards → awards_versions). */
export const awards = pgTable(
  'awards',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id),
    awardType: awardTypeEnum().notNull(),
    awardNo: text().notNull(),
    pronouncedAt: timestamptz(),
    collectorPostId: uuid().references(() => posts.id),
    laoPostId: uuid().references(() => posts.id),
    documentId: uuid().references(() => documents.id),
    ocrExtractionId: uuid().references(() => ocrExtractions.id),
    status: awardStatusEnum().notNull().default('draft'),
    version: integer().notNull().default(1),
    ...stamps,
  },
  (t) => [unique().on(t.projectId, t.awardNo)],
);

/** Versioned (trg_versions_entitlements → entitlements_versions). */
export const entitlements = pgTable(
  'entitlements',
  {
    id: id(),
    affectedFamilyId: uuid()
      .notNull()
      .references(() => affectedFamilies.id),
    awardId: uuid()
      .notNull()
      .references(() => awards.id),
    scheduleRef: scheduleRefEnum().notNull(),
    /** From the pack's entitlementHeads. */
    headCode: text().notNull(),
    /** ENTERED, never computed (G1). */
    amountAwardedPaise: paise().notNull(),
    source: entitlementSourceEnum().notNull(),
    dueBy: timestamptz(),
    status: entitlementStatusEnum().notNull().default('ASSESSED'),
    version: integer().notNull().default(1),
    ...stamps,
  },
  (t) => [
    check('entitlements_amount_nonnegative', sql`${t.amountAwardedPaise} >= 0`),
    index().on(t.affectedFamilyId),
    index().on(t.awardId),
  ],
);

export const disbursements = pgTable(
  'disbursements',
  {
    id: id(),
    entitlementId: uuid()
      .notNull()
      .references(() => entitlements.id),
    amountPaise: paise().notNull(),
    instrument: paymentInstrumentEnum().notNull(),
    initiatedAt: timestamptz().notNull(),
    paidOn: date(),
    paymentStatus: paymentStatusEnum().notNull().default('INITIATED'),
    adapterRef: text(),
    /** 'MOCK' in MVP (G7). */
    adapterProvider: text(),
    isFirstInstalment: boolean().notNull().default(false),
    acceptanceType: acceptanceTypeEnum(),
    indemnityBondDocumentId: uuid().references(() => documents.id),
    /** RESTRICTED (§11.4 disbursement.holdReason). */
    holdReason: text(),
    holdReasonCode: text(),
    ...stamps,
  },
  (t) => [check('disbursements_amount_positive', sql`${t.amountPaise} > 0`), index().on(t.entitlementId)],
);

export const acknowledgements = pgTable('acknowledgements', {
  id: id(),
  disbursementId: uuid()
    .notNull()
    .unique()
    .references(() => disbursements.id),
  method: ackMethodEnum().notNull(),
  webauthnCredentialId: text(),
  assertionSha256: text(),
  otpRef: text(),
  witnessPostId: uuid().references(() => posts.id),
  fallbackReason: text(),
  photoDocumentId: uuid().references(() => documents.id),
  point: point(),
  confirmedAt: timestamptz().notNull(),
  ...stamps,
});

/** Public key, id and counter only — never a biometric (G6). */
export const webauthnCredentials = pgTable('webauthn_credentials', {
  id: id(),
  personId: uuid()
    .notNull()
    .references(() => persons.id),
  credentialId: text().notNull().unique(),
  publicKey: bytea().notNull(),
  counter: bigint({ mode: 'number' }).notNull().default(0),
  transports: text().array(),
  deviceLabel: text(),
  enrolledAt: timestamptz().notNull(),
  /** Enrolment is witnessed. */
  enrolledWitnessPostId: uuid().references(() => posts.id),
  enrolmentPoint: point(),
  revokedAt: timestamptz(),
  ...stamps,
});

/** Single-use magic links for enrol / acknowledge / passbook. */
export const accessTokens = pgTable('access_tokens', {
  id: id(),
  purpose: accessTokenPurposeEnum().notNull(),
  personId: uuid()
    .notNull()
    .references(() => persons.id),
  subjectId: uuid(),
  /** The officer post that issued the link (the enrolment witness, §21.2). */
  issuedByPostId: uuid().references(() => posts.id),
  tokenHash: text().notNull().unique(),
  expiresAt: timestamptz().notNull(),
  usedAt: timestamptz(),
  ...stamps,
});

export const annuitySchedules = pgTable(
  'annuity_schedules',
  {
    id: id(),
    entitlementId: uuid()
      .notNull()
      .references(() => entitlements.id),
    instalmentNo: integer().notNull(),
    dueOn: date().notNull(),
    amountPaise: paise().notNull(),
    status: annuityStatusEnum().notNull().default('scheduled'),
    disbursementId: uuid().references(() => disbursements.id),
    ...stamps,
  },
  (t) => [unique().on(t.entitlementId, t.instalmentNo)],
);
