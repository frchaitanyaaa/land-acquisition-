import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { env } from '../../config/env';
import { ProblemException } from '../errors/problem';
import { ACCESS_COOKIE } from '../../auth/cookies';
import { IS_PUBLIC } from './decorators';

export interface AccessTokenPayload {
  /** user id */
  sub: string;
  /** active post id */
  pid: string;
}

/**
 * 1 of 3. Verifies the access token — `Authorization: Bearer` (field app) or the httpOnly cookie
 * (portal) — and sets `req.auth`. Who the user is and which post they hold is PostGuard's job.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.get('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
    if (!token) throw new ProblemException(401, 'UNAUTHENTICATED', 'Sign in to continue.');

    try {
      const payload = this.jwt.verify<AccessTokenPayload>(token, { secret: env().JWT_ACCESS_SECRET });
      req.auth = { userId: payload.sub, postId: payload.pid };
      return true;
    } catch {
      throw new ProblemException(401, 'TOKEN_INVALID', 'Your session has expired. Refresh or sign in again.');
    }
  }
}
