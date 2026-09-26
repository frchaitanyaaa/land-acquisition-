import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { id, stamps, timestamptz } from './_columns';
import { districts, states } from './admin';
import { jurisdictionLevelEnum, requiringBodyTypeEnum, roleEnum } from './enums';
import { projects } from './projects';

// Organisation & identity (§10.3). Roles attach to POSTS, not people (G19): a user holds posts
// through dated assignments, so history survives officer transfers.

export const requiringBodies = pgTable('requiring_bodies', {
  id: id(),
  name: text().notNull(),
  shortCode: text().notNull().unique(),
  type: requiringBodyTypeEnum().notNull(),
  ...stamps,
});

/**
 * app_user can read every column EXCEPT password_hash (column-level grant). Always select the
 * columns you need — `db.select().from(users)` fails with "permission denied" by design.
 * Login reads the hash only through the auth_credentials() function.
 */
export const users = pgTable('users', {
  id: id(),
  fullName: text().notNull(),
  email: text().notNull().unique(),
  phoneMasked: text(),
  passwordHash: text().notNull(),
  isActive: boolean().notNull().default(true),
  lastLoginAt: timestamptz(),
  ...stamps,
});

/** A designation + jurisdiction, e.g. "Collector, Pune". */
export const posts = pgTable(
  'posts',
  {
    id: id(),
    designation: text().notNull(),
    role: roleEnum().notNull(),
    jurisdictionLevel: jurisdictionLevelEnum().notNull(),
    stateCode: text().references(() => states.code),
    districtCode: text().references(() => districts.code),
    projectId: uuid().references(() => projects.id),
    requiringBodyId: uuid().references(() => requiringBodies.id),
    isActive: boolean().notNull().default(true),
    ...stamps,
  },
  (t) => [
    check(
      'posts_scope_complete',
      sql`${t.jurisdictionLevel} = 'NATIONAL'
        OR (${t.jurisdictionLevel} = 'STATE' AND ${t.stateCode} IS NOT NULL)
        OR (${t.jurisdictionLevel} = 'DISTRICT' AND ${t.districtCode} IS NOT NULL)
        OR (${t.jurisdictionLevel} = 'PROJECT' AND (${t.projectId} IS NOT NULL OR ${t.requiringBodyId} IS NOT NULL))`,
    ),
  ],
);

export const postAssignments = pgTable(
  'post_assignments',
  {
    id: id(),
    postId: uuid()
      .notNull()
      .references(() => posts.id),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    validFrom: timestamptz().notNull(),
    validTo: timestamptz(),
    ...stamps,
  },
  (t) => [index().on(t.userId), index().on(t.postId)],
);

/**
 * Rotating refresh tokens. `familyId` groups a login's rotation chain so reuse of a spent token
 * revokes the whole family (§29). `activePostId` carries the post choice across refreshes.
 */
export const refreshTokens = pgTable('refresh_tokens', {
  id: id(),
  userId: uuid()
    .notNull()
    .references(() => users.id),
  familyId: uuid().notNull(),
  activePostId: uuid()
    .notNull()
    .references(() => posts.id),
  tokenHash: text().notNull().unique(),
  expiresAt: timestamptz().notNull(),
  revokedAt: timestamptz(),
  replacedBy: uuid(),
  ...stamps,
});
