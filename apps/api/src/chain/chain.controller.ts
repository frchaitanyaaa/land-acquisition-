import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { ChainService } from './chain.service';

const VersionQuery = z.object({ version: z.coerce.number().int().min(1).optional() });
const EventsQuery = z.object({
  status: z.enum(['QUEUED', 'SUBMITTED', 'ANCHORED', 'FAILED']).optional(),
  eventType: z.string().max(64).optional(),
  entityType: z.string().max(64).optional(),
  cursor: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});
export type EventsFilter = z.infer<typeof EventsQuery>;

@Controller('chain')
export class ChainController {
  constructor(private readonly chain: ChainService) {}

  @Get('verify/:entityType/:entityId')
  verify(
    @CurrentUser() user: AuthUser,
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @Query(new ZodPipe(VersionQuery)) q: z.infer<typeof VersionQuery>,
  ) {
    return this.chain.verify(user, entityType, entityId, q.version);
  }

  /** Trust center: the anchoring ledger, newest first. Hashes and statuses only — no payload. */
  @Get('events')
  events(@CurrentUser() user: AuthUser, @Query(new ZodPipe(EventsQuery)) q: EventsFilter) {
    return this.chain.events(user, q);
  }

  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    return this.chain.status(user);
  }
}
