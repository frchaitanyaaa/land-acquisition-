import type { Role } from '@bhoomisetu/shared';
import type { AuthUser } from './auth-user';
import { ProblemException } from './errors/problem';

/** Service-level role check for non-workflow actions (workflow roles come from the pack). */
export function requireRole(user: AuthUser, roles: readonly Role[], what: string): void {
  if (user.post.role === 'SUPER_ADMIN' || roles.includes(user.post.role)) return;
  throw new ProblemException(403, 'ROLE_NOT_PERMITTED', `${what} needs one of: ${roles.join(', ')}.`, {
    requiredRoles: roles,
  });
}
