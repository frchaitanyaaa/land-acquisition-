import type { Scope } from '@bhoomisetu/db';
import type { JurisdictionLevel, Role } from '@bhoomisetu/shared';

/** A post the user holds right now (G19: roles attach to posts, not people). */
export interface PostInfo {
  id: string;
  designation: string;
  role: Role;
  level: JurisdictionLevel;
  stateCode: string | null;
  districtCode: string | null;
  projectId: string | null;
  requiringBodyId: string | null;
}

/** Set on `req.user` by PostGuard for every authenticated request. */
export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  /** The active post. Every action is recorded against both the user and this post. */
  post: PostInfo;
}

/** The RLS scope for a user's active post. `null` (no login) sees no scoped rows. */
export function scopeOf(user: AuthUser | null): Scope {
  if (!user) {
    return {
      userId: null,
      postId: null,
      level: null,
      stateCode: null,
      districtCode: null,
      projectIds: [],
      requiringBodyId: null,
    };
  }
  const { post } = user;
  return {
    userId: user.id,
    postId: post.id,
    level: post.level,
    stateCode: post.stateCode,
    districtCode: post.districtCode,
    projectIds: post.projectId ? [post.projectId] : [],
    requiringBodyId: post.requiringBodyId,
  };
}
