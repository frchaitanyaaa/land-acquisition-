import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { OrgService } from '../../org/org.service';
import { ClockService } from '../clock/clock.service';
import { requestContext } from '../context/request-context';
import { ProblemException } from '../errors/problem';
import { IS_PUBLIC } from './decorators';

/**
 * 2 of 3. Loads the user and confirms they still hold the token's post today (assignments are
 * dated; a transferred officer loses the post's access the day the assignment ends — G19).
 * Sets `req.user`, which withScope turns into the RLS scope.
 */
@Injectable()
export class PostGuard implements CanActivate {
  constructor(
    private readonly org: OrgService,
    private readonly clock: ClockService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (!req.auth) throw new ProblemException(401, 'UNAUTHENTICATED', 'Sign in to continue.');

    const user = await this.org.loadAuthUser(req.auth.userId, req.auth.postId, this.clock.now());
    if (!user) {
      throw new ProblemException(401, 'POST_NOT_HELD', 'You no longer hold this post. Sign in again or switch post.');
    }
    req.user = user;
    const ctx = requestContext.get();
    if (ctx) ctx.user = user;
    return true;
  }
}
