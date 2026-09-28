import { notifications } from '@bhoomisetu/db';
import { Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { ClockService } from '../common/clock/clock.service';
import { DbService } from '../common/db/db.service';
import { one } from '../common/db/raw';

/** A post's inbox (§28). RLS limits it to the active post (and the user's own). */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly db: DbService,
    private readonly clock: ClockService,
  ) {}

  list(user: AuthUser, unreadOnly: boolean, limit: number) {
    return this.db.withScope(user, async (tx) => ({
      unread:
        (
          await one<{ n: number }>(
            tx,
            sql`SELECT count(*)::int AS n FROM notifications WHERE read_at IS NULL AND recipient_post_id = ${user.post.id}`,
          )
        )?.n ?? 0,
      items: await tx
        .select()
        .from(notifications)
        .where(
          and(eq(notifications.recipientPostId, user.post.id), unreadOnly ? isNull(notifications.readAt) : undefined),
        )
        .orderBy(desc(notifications.createdAt))
        .limit(limit),
    }));
  }

  markRead(user: AuthUser, id: string | 'all') {
    return this.db.withScope(user, async (tx) => {
      const now = this.clock.now();
      const where =
        id === 'all'
          ? and(eq(notifications.recipientPostId, user.post.id), isNull(notifications.readAt))
          : and(eq(notifications.id, id), isNull(notifications.readAt));
      const r = await tx.update(notifications).set({ readAt: now }).where(where).returning({ id: notifications.id });
      return { marked: r.length };
    });
  }

  unreadCount(user: AuthUser) {
    return this.db.withScope(
      user,
      async (tx) =>
        (
          await one<{ n: number }>(
            tx,
            sql`SELECT count(*)::int AS n FROM notifications WHERE read_at IS NULL AND recipient_post_id = ${user.post.id}`,
          )
        )?.n ?? 0,
    );
  }
}
