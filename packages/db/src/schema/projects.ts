import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, lineString, multiPolygon, paise, stamps, timestamptz } from './_columns';
import { districts, states } from './admin';
import {
  acquisitionTypeEnum,
  appropriateGovtEnum,
  dataSourceEnum,
  jurisdictionLevelEnum,
  projectCategoryEnum,
  projectStatusEnum,
} from './enums';
import { requiringBodies } from './org';

/**
 * Loaded from packages/rules/packs at API boot. A published (code, version) is immutable: if the
 * stored checksum differs from the file, boot fails (§10.3, §12.1).
 */
export const rulePacks = pgTable(
  'rule_packs',
  {
    code: text().notNull(),
    version: text().notNull(),
    title: text().notNull(),
    governingAct: text().notNull(),
    jurisdictionLevel: jurisdictionLevelEnum().notNull(),
    stateCode: text(),
    extendsCode: text(),
    extendsVersion: text(),
    effectiveFrom: date().notNull(),
    effectiveTo: date(),
    /** Fully resolved (after the extends-merge). */
    definition: jsonb().notNull(),
    /** sha256 of the RFC 8785 canonical definition. */
    checksum: text().notNull(),
    loadedAt: timestamptz()
      .notNull()
      .default(sql`app_now()`),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.code, t.version] })],
);

export const projects = pgTable(
  'projects',
  {
    id: id(),
    /** e.g. MH-PSX-2026-001 */
    code: text().notNull().unique(),
    name: text().notNull(),
    nameLocal: text(),
    category: projectCategoryEnum().notNull(),
    subCategory: text(),
    acquisitionType: acquisitionTypeEnum().notNull(),
    requiringBodyId: uuid()
      .notNull()
      .references(() => requiringBodies.id),
    nationalImportance: boolean().notNull().default(false),
    estimatedBudgetPaise: paise(),
    /** PINNED at submission, never changes (s.24). */
    rulePackCode: text(),
    rulePackVersion: text(),
    appropriateGovt: appropriateGovtEnum().notNull().default('state'),
    /** Lead state. */
    stateCode: text()
      .notNull()
      .references(() => states.code),
    isLinear: boolean().notNull().default(false),
    alignment: lineString(),
    rowWidthM: numeric({ precision: 8, scale: 2 }),
    /** Corridor buffer or area polygon. */
    footprint: multiPolygon(),
    totalAreaProposedSqm: numeric({ precision: 14, scale: 2 }),
    /** s.40 */
    isUrgency: boolean().notNull().default(false),
    /** Derived from the constraint check. */
    inScheduledArea: boolean().notNull().default(false),
    status: projectStatusEnum().notNull().default('DRAFT'),
    currentStage: text(),
    submittedAt: timestamptz(),
    dataSource: dataSourceEnum().notNull(),
    ...stamps,
  },
  (t) => [
    foreignKey({ columns: [t.rulePackCode, t.rulePackVersion], foreignColumns: [rulePacks.code, rulePacks.version] }),
    check('projects_pack_pair', sql`(${t.rulePackCode} IS NULL) = (${t.rulePackVersion} IS NULL)`),
    check('projects_pack_pinned', sql`${t.status} = 'DRAFT' OR ${t.rulePackCode} IS NOT NULL`),
    index().using('gist', t.footprint),
  ],
);

/** Multi-district and inter-state projects. */
export const projectDistricts = pgTable(
  'project_districts',
  {
    projectId: uuid()
      .notNull()
      .references(() => projects.id),
    districtCode: text()
      .notNull()
      .references(() => districts.code),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.projectId, t.districtCode] }), index().on(t.districtCode)],
);
