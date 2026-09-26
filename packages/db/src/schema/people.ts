import { boolean, index, integer, jsonb, numeric, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { bytea, id, stamps, timestamptz } from './_columns';
import { villages } from './admin';
import {
  affectedTypeEnum,
  dataSourceEnum,
  interestTypeEnum,
  socialCategoryEnum,
  verificationStatusEnum,
} from './enums';
import { landParcels } from './land';
import { posts } from './org';
import { projects } from './projects';
import { resettlementSites } from './rnr';
import { documents } from './trust';

// People & families (§10.3). A person is not an owner: rights are parcel_interests with a type,
// which is how tenants, sharecroppers and labourers exist (s.3). Only synthetic people (G18).

export const persons = pgTable(
  'persons',
  {
    id: id(),
    fullName: text().notNull(),
    fullNameLocal: text(),
    guardianName: text(),
    gender: text(),
    socialCategory: socialCategoryEnum().notNull(),
    villageCode: text()
      .notNull()
      .references(() => villages.code),
    /** e.g. 98XXXXXX21 — for display. */
    phoneMasked: text(),
    /** AES-256-GCM: iv || ciphertext || tag (§11.5). */
    phoneEnc: bytea(),
    /** e.g. XXXX4821 */
    bankRefMasked: text(),
    bankRefEnc: bytea(),
    isDeceased: boolean().notNull().default(false),
    dataSource: dataSourceEnum().notNull(),
    ...stamps,
  },
  (t) => [index().on(t.villageCode)],
);

export const parcelInterests = pgTable(
  'parcel_interests',
  {
    id: id(),
    parcelId: uuid()
      .notNull()
      .references(() => landParcels.id),
    personId: uuid()
      .notNull()
      .references(() => persons.id),
    interestType: interestTypeEnum().notNull(),
    shareFraction: numeric({ precision: 7, scale: 6 }),
    evidenceDocumentId: uuid().references(() => documents.id),
    verificationStatus: verificationStatusEnum().notNull().default('pending'),
    verifiedByPostId: uuid().references(() => posts.id),
    ...stamps,
  },
  (t) => [index().on(t.parcelId), index().on(t.personId)],
);

export const affectedFamilies = pgTable(
  'affected_families',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id),
    headPersonId: uuid()
      .notNull()
      .references(() => persons.id),
    affectedType: affectedTypeEnum().notNull(),
    isDisplaced: boolean().notNull().default(false),
    /** s.39 */
    isMultipleDisplacement: boolean().notNull().default(false),
    familySize: integer(),
    isScSt: boolean().notNull().default(false),
    isFemaleHeaded: boolean().notNull().default(false),
    isDestitute: boolean().notNull().default(false),
    hasDisability: boolean().notNull().default(false),
    relocatedOutsideDistrict: boolean().notNull().default(false),
    authorisedRecipientPersonId: uuid()
      .notNull()
      .references(() => persons.id),
    jointRecipientPersonId: uuid().references(() => persons.id),
    resettlementSiteId: uuid().references(() => resettlementSites.id),
    dataSource: dataSourceEnum().notNull(),
    ...stamps,
  },
  (t) => [unique().on(t.projectId, t.headPersonId)],
);

export const familyMembers = pgTable('family_members', {
  id: id(),
  affectedFamilyId: uuid()
    .notNull()
    .references(() => affectedFamilies.id),
  personId: uuid()
    .notNull()
    .references(() => persons.id),
  relation: text().notNull(),
  ...stamps,
});

/** s.4 SIA census. */
export const siaCensusRecords = pgTable('sia_census_records', {
  id: id(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id),
  villageCode: text()
    .notNull()
    .references(() => villages.code),
  householdRef: text().notNull(),
  affectedFamilyId: uuid().references(() => affectedFamilies.id),
  payload: jsonb().notNull(),
  enumeratorPostId: uuid().references(() => posts.id),
  capturedAt: timestamptz().notNull(),
  ...stamps,
});

/** s.16 R&R census — SEPARATE from the SIA census. */
export const rnrCensusRecords = pgTable('rnr_census_records', {
  id: id(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id),
  affectedFamilyId: uuid()
    .notNull()
    .references(() => affectedFamilies.id),
  categorisation: affectedTypeEnum().notNull(),
  vulnerability: jsonb(),
  administratorPostId: uuid().references(() => posts.id),
  capturedAt: timestamptz().notNull(),
  ...stamps,
});
