import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { AuthUser } from '../common/auth-user';
import { AuditEntity } from '../common/audit/audit.interceptor';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { StageActionBody, StageCodeParam } from './workflow.dto';
import { WorkflowService } from './workflow.service';

/**
 * The generic stage action endpoint drives the whole workflow (§13). Do not add bespoke
 * "approve X" endpoints — roles, maker-checker, checklist and reasons all come from the pack.
 */
@Controller('projects/:projectId')
@AuditEntity('stage_instance')
export class WorkflowController {
  constructor(private readonly workflow: WorkflowService) {}

  @Get('stages/:stageCode/actions')
  actions(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('stageCode', new ZodPipe(StageCodeParam)) stageCode: string,
  ) {
    return this.workflow.actions(user, projectId, stageCode);
  }

  @Post('stages/:stageCode/actions')
  @HttpCode(200)
  act(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('stageCode', new ZodPipe(StageCodeParam)) stageCode: string,
    @Body(new ZodPipe(StageActionBody)) body: StageActionBody,
  ) {
    return this.workflow.act(user, projectId, stageCode, body);
  }

  @Get('timeline')
  timeline(@CurrentUser() user: AuthUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.workflow.timeline(user, projectId);
  }

  @Get('deadlines')
  deadlines(@CurrentUser() user: AuthUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.workflow.projectDeadlines(user, projectId);
  }
}
