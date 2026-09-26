import { boolean, date, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { id, paise, point, stamps, timestamptz } from './_columns';
import {
  legalCaseStatusEnum,
  legalCaseTypeEnum,
  monitoringCommitteeEnum,
  mutationDirectionEnum,
  reversionEnum,
  severanceDecisionEnum,
  utilisationStatusEnum,
} from './enums';
import { landParcels, projectParcels } from './land';
import { posts } from './org';
import { persons } from './people';
import { projects } from './projects';
import { documents } from './trust';

// Possession, legal, long-term compliance (§10.3, MVP thin / LATER).

export const possessionEvents = pgTable('possession_events', {
  id: id(),
  projectParcelId: uuid()
    .notNull()
    .unique()
    .references(() => projectParcels.id),
  vacationCertificateDocumentId: uuid().references(() => documents.id),
  noticeDocumentId: uuid().references(() => documents.id),
  panchnamaDocumentId: uuid().references(() => documents.id),
  possessionCertificateDocumentId: uuid().references(() => documents.id),
  handoverDocumentId: uuid().references(() => documents.id),
  witnesses: jsonb(),
  point: point(),
  takenAt: timestamptz().notNull(),
  takenByPostId: uuid()
    .notNull()
    .references(() => posts.id),
  ...stamps,
});

export const mutations = pgTable('mutations', {
  id: id(),
  parcelId: uuid()
    .notNull()
    .references(() => landParcels.id),
  direction: mutationDirectionEnum().notNull(),
  fromHolder: text(),
  toHolder: text(),
  extractDocumentId: uuid().references(() => documents.id),
  recordedAt: timestamptz().notNull(),
  ...stamps,
});

/** RESTRICTED as a whole (§11.4 legalCase.*). */
export const legalCases = pgTable('legal_cases', {
  id: id(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id),
  parcelId: uuid().references(() => landParcels.id),
  personId: uuid().references(() => persons.id),
  caseType: legalCaseTypeEnum().notNull(),
  caseNo: text(),
  filedAt: timestamptz().notNull(),
  status: legalCaseStatusEnum().notNull().default('filed'),
  nextHearingAt: timestamptz(),
  /** Entered from the order, not computed. */
  differentialLiabilityPaise: paise(),
  orderDocumentId: uuid().references(() => documents.id),
  ...stamps,
});

export const legalCaseEvents = pgTable('legal_case_events', {
  id: id(),
  caseId: uuid()
    .notNull()
    .references(() => legalCases.id),
  eventType: text().notNull(),
  at: timestamptz().notNull(),
  notes: text(),
  documentId: uuid().references(() => documents.id),
  ...stamps,
});

/** s.94 */
export const severanceClaims = pgTable('severance_claims', {
  id: id(),
  projectParcelId: uuid()
    .notNull()
    .references(() => projectParcels.id),
  filedAt: timestamptz().notNull(),
  inspectionDocumentId: uuid().references(() => documents.id),
  decision: severanceDecisionEnum().notNull().default('pending'),
  decidedAt: timestamptz(),
  ...stamps,
});

/** s.101 */
export const utilisationAudits = pgTable('utilisation_audits', {
  id: id(),
  projectParcelId: uuid()
    .notNull()
    .references(() => projectParcels.id),
  dueAt: timestamptz().notNull(),
  status: utilisationStatusEnum().notNull().default('pending'),
  finding: text(),
  reversion: reversionEnum(),
  ...stamps,
});

/** s.102 */
export const valueSharingEvents = pgTable('value_sharing_events', {
  id: id(),
  projectParcelId: uuid()
    .notNull()
    .references(() => projectParcels.id),
  transferDate: date().notNull(),
  considerationPaise: paise().notNull(),
  /** ENTERED by officer. */
  appreciatedValuePaise: paise().notNull(),
  /** Displayed derived value; an officer confirms it (G2). */
  sharePaise: paise(),
  confirmedByPostId: uuid().references(() => posts.id),
  distributed: boolean().notNull().default(false),
  ...stamps,
});

/** ss.48–50 */
export const monitoringAudits = pgTable('monitoring_audits', {
  id: id(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id),
  committee: monitoringCommitteeEnum().notNull(),
  period: text().notNull(),
  reportDocumentId: uuid().references(() => documents.id),
  findings: jsonb(),
  ...stamps,
});
