import { users } from '@bhoomisetu/db';
import type { Role } from '@bhoomisetu/shared';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import argon2 from 'argon2';
import { eq, sql } from 'drizzle-orm';
import type { AuthUser, PostInfo } from '../common/auth-user';
import { AuditService } from '../common/audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { DbService } from '../common/db/db.service';
import { ProblemException } from '../common/errors/problem';
import { OrgService } from '../org/org.service';
import { TokensService, type Session } from './tokens.service';

export interface SessionView {
  session: Session;
  user: { id: string; fullName: string; email: string };
  activePost: PostInfo;
  posts: PostInfo[];
}

@Injectable()
export class AuthService implements OnModuleInit {
  /** Verified against when the email is unknown, so response time does not reveal which emails exist. */
  private dummyHash = '';

  constructor(
    private readonly db: DbService,
    private readonly org: OrgService,
    private readonly tokens: TokensService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash('not-a-real-password', { type: argon2.argon2id });
  }

  async login(email: string, password: string, postId?: string, role?: Role): Promise<SessionView> {
    const result = await this.db.withScope(null, (tx) =>
      tx.execute<{ user_id: string; password_hash: string; is_active: boolean }>(sql`SELECT * FROM auth_credentials(${email})`),
    );
    const cred = result.rows[0];
    const ok = await argon2.verify(cred?.password_hash ?? this.dummyHash, password);
    if (!cred || !ok || !cred.is_active) {
      throw new ProblemException(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    const now = this.clock.now();
    const posts = await this.org.postsHeld(cred.user_id, now);
    // "Login as" (§25): the role picks the post; the dropdown never lists a person's posts.
    const activePost = postId
      ? posts.find((p) => p.id === postId)
      : role
        ? posts.find((p) => p.role === role)
        : posts[0];
    if (!activePost) {
      if (role && !postId)
        throw new ProblemException(403, 'ROLE_NOT_HELD', 'This account does not hold a post with the selected role.');
      throw new ProblemException(403, 'NO_ACTIVE_POST', postId ? 'You do not hold that post.' : 'You hold no active post.');
    }

    const session = await this.tokens.issue(cred.user_id, activePost.id);
    const user = await this.db.withScope(null, async (tx) => {
      await tx.update(users).set({ lastLoginAt: now }).where(eq(users.id, cred.user_id));
      const [u] = await tx.select({ id: users.id, fullName: users.fullName, email: users.email }).from(users).where(eq(users.id, cred.user_id));
      return u!;
    });
    await this.audit.record({
      action: 'AUTH_LOGIN',
      entityType: 'user',
      entityId: user.id,
      actorUserId: user.id,
      actorPostId: activePost.id,
    });
    return { session, user, activePost, posts };
  }

  async refresh(refreshToken: string): Promise<SessionView> {
    const rotated = await this.tokens.rotate(refreshToken);
    const view = await this.view(rotated.userId, rotated.postId);
    if (!view) throw new ProblemException(401, 'POST_NOT_HELD', 'You no longer hold this post. Sign in again.');
    return { ...view, session: rotated };
  }

  async logout(refreshToken: string | undefined, user: AuthUser | null): Promise<void> {
    const userId = refreshToken ? await this.tokens.revoke(refreshToken) : null;
    await this.audit.record({
      action: 'AUTH_LOGOUT',
      entityType: 'user',
      entityId: userId ?? user?.id ?? null,
      actorUserId: userId ?? user?.id ?? null,
    });
  }

  /** Changes the active post. Access follows the new post immediately (RLS, redaction, roles). */
  async switchPost(user: AuthUser, postId: string, refreshToken: string | undefined): Promise<SessionView> {
    const posts = await this.org.postsHeld(user.id, this.clock.now());
    const target = posts.find((p) => p.id === postId);
    if (!target) throw new ProblemException(403, 'POST_NOT_HELD', 'You do not hold that post.');

    const session = refreshToken ? await this.tokens.rotate(refreshToken, postId) : await this.tokens.issue(user.id, postId);
    await this.audit.record({
      action: 'AUTH_SWITCH_POST',
      entityType: 'user',
      entityId: user.id,
      before: { postId: user.post.id },
      after: { postId },
      actorPostId: postId,
    });
    return { session, user: { id: user.id, fullName: user.fullName, email: user.email }, activePost: target, posts };
  }

  async me(user: AuthUser): Promise<Omit<SessionView, 'session'>> {
    const posts = await this.org.postsHeld(user.id, this.clock.now());
    return { user: { id: user.id, fullName: user.fullName, email: user.email }, activePost: user.post, posts };
  }

  private async view(userId: string, postId: string): Promise<Omit<SessionView, 'session'> | null> {
    const user = await this.org.loadAuthUser(userId, postId, this.clock.now());
    return user ? this.me(user) : null;
  }
}
