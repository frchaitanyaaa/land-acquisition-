import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { refreshTokens } from '@bhoomisetu/db';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull } from 'drizzle-orm';
import { ClockService } from '../common/clock/clock.service';
import { DbService } from '../common/db/db.service';
import { ProblemException } from '../common/errors/problem';
import type { AccessTokenPayload } from '../common/guards/jwt.guard';
import { env } from '../config/env';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS } from './cookies';

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * JWT access tokens (15 min) + opaque rotating refresh tokens (7 days), §29. Refresh tokens are
 * stored only as an HMAC; presenting a token that was already rotated revokes its whole family
 * (someone else has a copy). Expiries follow the real clock, not the frozen demo clock.
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly db: DbService,
    private readonly clock: ClockService,
  ) {}

  private hash(token: string): string {
    return createHmac('sha256', env().JWT_REFRESH_SECRET).update(token).digest('hex');
  }

  private access(userId: string, postId: string): string {
    const payload: AccessTokenPayload = { sub: userId, pid: postId };
    return this.jwt.sign(payload, { secret: env().JWT_ACCESS_SECRET, expiresIn: ACCESS_TTL_SECONDS });
  }

  /** Starts a new session (a new refresh family). */
  async issue(userId: string, postId: string): Promise<Session> {
    return this.store(userId, postId, randomUUID());
  }

  private async store(userId: string, postId: string, familyId: string, replacing?: string): Promise<Session> {
    const refreshToken = randomBytes(32).toString('base64url');
    const now = this.clock.realNow();
    await this.db.withScope(null, async (tx) => {
      const [row] = await tx
        .insert(refreshTokens)
        .values({
          userId,
          familyId,
          activePostId: postId,
          tokenHash: this.hash(refreshToken),
          expiresAt: new Date(now.getTime() + REFRESH_TTL_SECONDS * 1000),
        })
        .returning({ id: refreshTokens.id });
      if (replacing) {
        await tx.update(refreshTokens).set({ revokedAt: now, replacedBy: row!.id }).where(eq(refreshTokens.id, replacing));
      }
    });
    return { accessToken: this.access(userId, postId), refreshToken, expiresIn: ACCESS_TTL_SECONDS };
  }

  /**
   * Exchanges a refresh token for a new pair. `postId` switches the active post (the caller must
   * already have checked the user holds it); otherwise the session keeps its post.
   */
  async rotate(refreshToken: string, postId?: string): Promise<Session & { userId: string; postId: string }> {
    const now = this.clock.realNow();
    const [row] = await this.db.withScope(null, (tx) =>
      tx.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, this.hash(refreshToken))),
    );
    if (!row) throw new ProblemException(401, 'REFRESH_INVALID', 'Sign in again.');

    if (row.revokedAt) {
      await this.revokeFamily(row.familyId);
      throw new ProblemException(401, 'REFRESH_REUSED', 'This session was used from somewhere else and has been closed. Sign in again.');
    }
    if (row.expiresAt <= now) throw new ProblemException(401, 'REFRESH_EXPIRED', 'Your session has expired. Sign in again.');

    const activePostId = postId ?? row.activePostId;
    const session = await this.store(row.userId, activePostId, row.familyId, row.id);
    return { ...session, userId: row.userId, postId: activePostId };
  }

  /** Logout: closes every token in the presented token's family. Unknown tokens are ignored. */
  async revoke(refreshToken: string): Promise<string | null> {
    const [row] = await this.db.withScope(null, (tx) =>
      tx
        .select({ familyId: refreshTokens.familyId, userId: refreshTokens.userId })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, this.hash(refreshToken))),
    );
    if (!row) return null;
    await this.revokeFamily(row.familyId);
    return row.userId;
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.db.withScope(null, (tx) =>
      tx
        .update(refreshTokens)
        .set({ revokedAt: this.clock.realNow() })
        .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt))),
    );
  }
}
