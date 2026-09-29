import { districts, postAssignments, posts, requiringBodies, states, users } from '@bhoomisetu/db';
import { Injectable } from '@nestjs/common';
import { and, asc, eq, gt, isNull, lte, or } from 'drizzle-orm';
import type { AuthUser, PostInfo } from '../common/auth-user';
import { DbService } from '../common/db/db.service';

const postColumns = {
  id: posts.id,
  designation: posts.designation,
  role: posts.role,
  level: posts.jurisdictionLevel,
  stateCode: posts.stateCode,
  districtCode: posts.districtCode,
  projectId: posts.projectId,
  requiringBodyId: posts.requiringBodyId,
};

/** Users, posts and dated post assignments (§10.3 Organisation & identity). */
@Injectable()
export class OrgService {
  constructor(private readonly db: DbService) {}

  /** The active posts `userId` holds at `now`, ordered by designation. */
  postsHeld(userId: string, now: Date): Promise<PostInfo[]> {
    return this.db.withScope(null, (tx) =>
      tx
        .select(postColumns)
        .from(postAssignments)
        .innerJoin(posts, eq(posts.id, postAssignments.postId))
        .where(
          and(
            eq(postAssignments.userId, userId),
            lte(postAssignments.validFrom, now),
            or(isNull(postAssignments.validTo), gt(postAssignments.validTo, now)),
            eq(posts.isActive, true),
          ),
        )
        .orderBy(asc(posts.designation)),
    );
  }

  /** The user acting through `postId`, or null if the user is inactive or no longer holds it. */
  async loadAuthUser(userId: string, postId: string, now: Date): Promise<AuthUser | null> {
    const [user] = await this.db.withScope(null, (tx) =>
      tx
        .select({ id: users.id, fullName: users.fullName, email: users.email, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, userId)),
    );
    if (!user?.isActive) return null;
    const post = (await this.postsHeld(userId, now)).find((p) => p.id === postId);
    return post ? { id: user.id, fullName: user.fullName, email: user.email, post } : null;
  }

  /** Every post with whoever holds it at `now`. */
  async listPosts(now: Date) {
    const rows = await this.db.withScope(null, (tx) =>
      tx
        .select({ ...postColumns, isActive: posts.isActive, holderId: users.id, holderName: users.fullName })
        .from(posts)
        .leftJoin(
          postAssignments,
          and(
            eq(postAssignments.postId, posts.id),
            lte(postAssignments.validFrom, now),
            or(isNull(postAssignments.validTo), gt(postAssignments.validTo, now)),
          ),
        )
        .leftJoin(users, eq(users.id, postAssignments.userId))
        .orderBy(asc(posts.designation), asc(users.fullName)),
    );

    const byPost = new Map<string, PostInfo & { isActive: boolean; holders: Array<{ id: string; fullName: string }> }>();
    for (const { holderId, holderName, ...post } of rows) {
      const entry = byPost.get(post.id) ?? { ...post, holders: [] };
      if (holderId && holderName) entry.holders.push({ id: holderId, fullName: holderName });
      byPost.set(post.id, entry);
    }
    return [...byPost.values()];
  }

  /** Reference data for the intake form's pickers (§14) — no RLS scope, just lookup tables. */
  listRequiringBodies() {
    return this.db.withScope(null, (tx) =>
      tx
        .select({ id: requiringBodies.id, name: requiringBodies.name, shortCode: requiringBodies.shortCode, type: requiringBodies.type })
        .from(requiringBodies)
        .orderBy(asc(requiringBodies.name)),
    );
  }

  listStates() {
    return this.db.withScope(null, (tx) =>
      tx.select({ code: states.code, name: states.name }).from(states).orderBy(asc(states.name)),
    );
  }

  listDistricts() {
    return this.db.withScope(null, (tx) =>
      tx
        .select({ code: districts.code, name: districts.name, stateCode: districts.stateCode, stateName: states.name })
        .from(districts)
        .innerJoin(states, eq(states.code, districts.stateCode))
        .orderBy(asc(states.name), asc(districts.name)),
    );
  }
}
