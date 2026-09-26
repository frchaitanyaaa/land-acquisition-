import type { Role } from '@bhoomisetu/shared';
import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth-user';

export const IS_PUBLIC = 'bhoomisetu:public';
export const ROLES = 'bhoomisetu:roles';

/** Skips JwtGuard, PostGuard and PermissionGuard. Public handlers see no scoped rows (RLS). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Restricts a handler to posts with one of these roles. Workflow actions do NOT use this — their
 * roles come from the rule pack (§12.6); this is for platform endpoints (admin, dashboards).
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** The authenticated user with their active post. Only valid on non-@Public handlers. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<Request>().user;
  if (!user) throw new Error('@CurrentUser() used on a handler that is not behind the auth guards');
  return user;
});
