import { Controller, Get, HttpCode, Param, Post, Query, Sse, type MessageEvent } from '@nestjs/common';
import { filter, interval, map, merge, switchMap, from, type Observable } from 'rxjs';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { NotificationsService } from './notifications.service';
import { StreamHub } from './stream-hub';

const ListQuery = z.object({
  unread: z.enum(['true', 'false']).default('false'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
const POLL_MS = 5_000;

@Controller()
export class NotificationsController {
  constructor(
    private readonly svc: NotificationsService,
    private readonly hub: StreamHub,
  ) {}

  @Get('notifications')
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(ListQuery)) q: z.infer<typeof ListQuery>) {
    return this.svc.list(user, q.unread === 'true', q.limit);
  }

  @Post('notifications/:id/read')
  @HttpCode(200)
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.markRead(user, id === 'all' ? 'all' : id);
  }

  /** SSE (§24.1, §28): kpi.updated broadcasts + the post's unread count, polled every 5 s. */
  @Sse('stream')
  stream(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    let last = -1;
    const unread = interval(POLL_MS).pipe(
      switchMap(() => from(this.svc.unreadCount(user))),
      filter((n) => n !== last),
      map((n) => {
        last = n;
        return { type: 'notification.count', data: { unread: n } } as MessageEvent;
      }),
    );
    const hub = this.hub
      .events()
      .pipe(map((e) => ({ type: e.type, data: { at: e.at, ...(e.data ? { data: e.data } : {}) } }) as MessageEvent));
    return merge(unread, hub);
  }
}
