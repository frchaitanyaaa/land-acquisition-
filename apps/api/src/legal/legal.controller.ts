import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { AuditEntity } from '../common/audit/audit.interceptor';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { LegalService } from './legal.service';

const File = z.strictObject({
  caseType: z.enum(['S64_REFERENCE', 'S73_REDETERMINATION', 'S74_APPEAL', 'WRIT']),
  caseNo: z.string().max(100).nullish(),
  parcelId: z.uuid().nullish(),
  personId: z.uuid().nullish(),
  affectedFamilyId: z.uuid().nullish(),
  filedAt: z.iso.datetime({ offset: true }).nullish(),
});
const Update = z.strictObject({
  status: z.enum(['filed', 'hearing', 'decided', 'appealed', 'closed']).optional(),
  nextHearingAt: z.iso.datetime({ offset: true }).nullish(),
  differentialLiabilityRupees: z.union([z.string(), z.number()]).nullish(),
  orderDocumentId: z.uuid().nullish(),
  note: z.string().max(4000).nullish(),
});

/** Module H — LARR Authority (§22). */
@Controller()
@AuditEntity('legal_case')
export class LegalController {
  constructor(private readonly l: LegalService) {}

  @Get('legal/cases')
  list(@CurrentUser() u: AuthUser, @Query('projectId') projectId?: string) {
    return this.l.list(u, projectId || undefined);
  }

  @Get('dashboards/legal')
  dashboard(@CurrentUser() u: AuthUser) {
    return this.l.dashboard(u);
  }

  @Post('projects/:id/legal-cases')
  file(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(File)) b: z.infer<typeof File>,
  ) {
    return this.l.file(u, id, b);
  }

  @Patch('legal-cases/:id')
  update(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Update)) b: z.infer<typeof Update>,
  ) {
    return this.l.update(u, id, b);
  }
}
