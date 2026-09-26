import { boolean, date, numeric, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { id, paise, point, stamps, timestamptz } from './_columns';
import {
  claimCategoryEnum,
  claimStatusEnum,
  consentDecisionEnum,
  consentEntryStatusEnum,
  consentRegisterStatusEnum,
  consentTypeEnum,
  objectionCategoryEnum,
  objectionChannelEnum,
  objectionGroundEnum,
  objectionStatusEnum,
} from './enums';
import { landParcels } from './land';
import { posts } from './org';
import { affectedFamilies, persons } from './people';
import { projects } from './projects';
import { documents } from './trust';
import { hearings } from './workflow';

// Consent (§10.3) and objections & claims. The tally is a view (v_consent_tally); the threshold
// comes from the project's pinned rule pack, never from here.

export const consentRegisters = pgTable('consent_registers', {
  id: id(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id),
  consentType: consentTypeEnum().notNull(),
  status: consentRegisterStatusEnum().notNull().default('draft'),
  displayFrom: date(),
  displayTo: date(),
  certifiedAt: timestamptz(),
  certifiedByPostId: uuid().references(() => posts.id),
  ...stamps,
});

export const consentRegisterEntries = pgTable(
  'consent_register_entries',
  {
    id: id(),
    registerId: uuid()
      .notNull()
      .references(() => consentRegisters.id),
    personId: uuid()
      .notNull()
      .references(() => persons.id),
    affectedFamilyId: uuid().references(() => affectedFamilies.id),
    eligibilityBasis: text().notNull(),
    isHeirUpdate: boolean().notNull().default(false),
    status: consentEntryStatusEnum().notNull().default('eligible'),
    ...stamps,
  },
  (t) => [unique().on(t.registerId, t.personId)],
);

export const consentRecords = pgTable('consent_records', {
  id: id(),
  registerEntryId: uuid()
    .notNull()
    .unique()
    .references(() => consentRegisterEntries.id),
  decision: consentDecisionEnum().notNull(),
  formDocumentId: uuid().references(() => documents.id),
  collectedByPostId: uuid()
    .notNull()
    .references(() => posts.id),
  /** DLSA observer. */
  observerPostId: uuid().references(() => posts.id),
  observerCertified: boolean().notNull().default(false),
  collectedAt: timestamptz().notNull(),
  point: point(),
  identityCheckRef: text(),
  /** 'MOCK' in MVP (G7). */
  identityProvider: text(),
  ...stamps,
});

export const objections = pgTable('objections', {
  id: id(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id),
  personId: uuid().references(() => persons.id),
  parcelId: uuid().references(() => landParcels.id),
  channel: objectionChannelEnum().notNull(),
  filedAt: timestamptz().notNull(),
  language: text(),
  body: text().notNull(),
  transcriptDocumentId: uuid().references(() => documents.id),
  statutoryGround: objectionGroundEnum(),
  operationalCategory: objectionCategoryEnum(),
  /** AI output lands here only; an officer copies it into the fields above (G3). */
  aiSuggestedGround: objectionGroundEnum(),
  aiSuggestedCategory: objectionCategoryEnum(),
  aiConfidence: numeric({ precision: 4, scale: 3 }),
  status: objectionStatusEnum().notNull().default('FILED'),
  hearingId: uuid().references(() => hearings.id),
  decisionRemarks: text(),
  /** RESTRICTED (§11.4 objection.decidedBy). */
  decidedByPostId: uuid().references(() => posts.id),
  decidedAt: timestamptz(),
  ...stamps,
});

export const claims = pgTable('claims', {
  id: id(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id),
  personId: uuid()
    .notNull()
    .references(() => persons.id),
  parcelId: uuid().references(() => landParcels.id),
  category: claimCategoryEnum().notNull(),
  filedAt: timestamptz().notNull(),
  amountClaimedPaise: paise(),
  body: text().notNull(),
  status: claimStatusEnum().notNull().default('filed'),
  ...stamps,
});
