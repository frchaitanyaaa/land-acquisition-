import type { Role } from '@bhoomisetu/shared';
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ProblemException } from '../errors/problem';
import { IS_PUBLIC, ROLES } from './decorators';

/**
 * 3 of 3. Enforces @Roles(...) on platform endpoints. Jurisdiction is not checked here — RLS does
 * that in the database — and workflow permissions come from the rule pack, not decorators.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (!roles?.length) return true;

    const role = context.switchToHttp().getRequest<Request>().user?.post.role;
    if (!role || !roles.includes(role)) {
      throw new ProblemException(403, 'ROLE_NOT_PERMITTED', `This needs one of these roles: ${roles.join(', ')}.`, {
        requiredRoles: roles,
      });
    }
    return true;
  }
}
