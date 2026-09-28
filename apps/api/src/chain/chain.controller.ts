import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { ChainService } from './chain.service';

const VersionQuery = z.object({ version: z.coerce.number().int().min(1).optional() });

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

  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    return this.chain.status(user);
  }
}
