import { integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { id, multiPolygon, stamps, timestamptz } from './_columns';
import { amenityStatusEnum, rnrSchemeStatusEnum } from './enums';
import { accessTokens } from './money';
import { posts } from './org';
import { affectedFamilies } from './people';
import { projects } from './projects';
import { documents } from './trust';

// R&R (§10.3, MVP thin).

/** Versioned (trg_versions_rnr_schemes → rnr_schemes_versions). */
export const rnrSchemes = pgTable('rnr_schemes', {
  id: id(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id),
  version: integer().notNull().default(1),
  status: rnrSchemeStatusEnum().notNull().default('draft'),
  draftDocumentId: uuid().references(() => documents.id),
  approvedByPostId: uuid().references(() => posts.id),
  approvedAt: timestamptz(),
  gazetteDocumentId: uuid().references(() => documents.id),
  ...stamps,
});

export const resettlementSites = pgTable('resettlement_sites', {
  id: id(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id),
  name: text().notNull(),
  geom: multiPolygon(),
  capacityFamilies: integer(),
  layoutDocumentId: uuid().references(() => documents.id),
  commissioningCertificateDocumentId: uuid().references(() => documents.id),
  ...stamps,
});

/** Third Schedule amenity codes (AMENITY_CODES in packages/shared). */
export const amenityMilestones = pgTable(
  'amenity_milestones',
  {
    id: id(),
    siteId: uuid()
      .notNull()
      .references(() => resettlementSites.id),
    amenityCode: text().notNull(),
    status: amenityStatusEnum().notNull().default('planned'),
    completedAt: timestamptz(),
    evidenceDocumentId: uuid().references(() => documents.id),
    ...stamps,
  },
  (t) => [unique().on(t.siteId, t.amenityCode)],
);

/** Rendered from entitlements; never shows hold reasons. */
export const rnrPassbooks = pgTable('rnr_passbooks', {
  id: id(),
  affectedFamilyId: uuid()
    .notNull()
    .references(() => affectedFamilies.id),
  version: integer().notNull().default(1),
  payloadSha256: text().notNull(),
  issuedAt: timestamptz().notNull(),
  publicTokenId: uuid().references(() => accessTokens.id),
  ...stamps,
});
