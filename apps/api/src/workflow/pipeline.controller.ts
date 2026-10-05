import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { WorkflowService } from './workflow.service';

const PipelineQuery = z.object({ state: z.string().min(1).max(20).optional() });

/** GET /pipeline — every project in scope, stage by stage (§24.3). National and state posts only. */
@Controller('pipeline')
export class PipelineController {
  constructor(private readonly workflow: WorkflowService) {}

  @Get()
  pipeline(@CurrentUser() user: AuthUser, @Query(new ZodPipe(PipelineQuery)) q: z.infer<typeof PipelineQuery>) {
    return this.workflow.pipeline(user, q.state);
  }
}
