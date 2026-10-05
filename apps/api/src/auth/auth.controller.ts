import { Throttle } from '@nestjs/throttler';
import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ROLES } from '@bhoomisetu/shared';
import { z } from 'zod';
import { AuditEntity } from '../common/audit/audit.interceptor';
import type { AuthUser } from '../common/auth-user';
import { ProblemException } from '../common/errors/problem';
import { CurrentUser, Public } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import type { SessionView } from './auth.service';
import { AuthService } from './auth.service';
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from './cookies';

const LoginBody = z.object({
  email: z.email(),
  password: z.string().min(1),
  /** Optional: sign straight into a specific post. */
  postId: z.uuid().optional(),
  /** Optional "Login as" role (§25): signs into the user's post with this role, refused if they hold none. */
  role: z.enum(ROLES).optional(),
});

const SwitchPostBody = z.object({ postId: z.uuid() });

const refreshCookie = (req: Request) => (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];

/**
 * The portal uses the httpOnly cookies. The field app keeps `accessToken` in memory as a Bearer
 * token and refreshes through the same cookie (§13). The refresh token never appears in a body.
 */
function respond(res: Response, view: SessionView) {
  setSessionCookies(res, view.session);
  return {
    accessToken: view.session.accessToken,
    expiresIn: view.session.expiresIn,
    user: view.user,
    activePost: view.activePost,
    posts: view.posts,
  };
}

@Controller('auth')
@AuditEntity('user')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 10 } }) // §29: auth 10/min/IP
  @HttpCode(200)
  async login(
    @Body(new ZodPipe(LoginBody)) body: z.infer<typeof LoginBody>,
    @Res({ passthrough: true }) res: Response,
  ) {
    return respond(res, await this.auth.login(body.email, body.password, body.postId, body.role));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = refreshCookie(req);
    if (!token) throw new ProblemException(401, 'REFRESH_INVALID', 'Sign in again.');
    return respond(res, await this.auth.refresh(token));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(refreshCookie(req), req.user ?? null);
    clearSessionCookies(res);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @Post('switch-post')
  @HttpCode(200)
  async switchPost(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(SwitchPostBody)) body: z.infer<typeof SwitchPostBody>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return respond(res, await this.auth.switchPost(user, body.postId, refreshCookie(req)));
  }
}
