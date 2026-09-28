import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuditEntity } from '../common/audit/audit.interceptor';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { RnrService, THIRD_SCHEDULE } from './rnr.service';

const Csv = z.strictObject({ csv: z.string().min(1).max(20_000_000) });
const Site = z.strictObject({
  name: z.string().min(1).max(200),
  capacityFamilies: z.number().int().positive(),
  geometry: z.unknown().optional(),
  amenities: z.array(z.string()).default([...THIRD_SCHEDULE]),
});
const Milestone = z.strictObject({
  status: z.enum(['planned', 'in_progress', 'complete']),
  evidenceDocumentId: z.uuid().nullish(),
});

/** Module E — R&R (§19). */
@Controller()
@AuditEntity('rnr')
export class RnrController {
  constructor(private readonly r: RnrService) {}

  @Post('projects/:id/rnr/census/import')
  census(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Csv)) b: z.infer<typeof Csv>,
  ) {
    return this.r.importCensus(u, id, b.csv);
  }

  @Get('projects/:id/rnr/schemes')
  schemes(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.r.schemes(u, id);
  }

  @Post('projects/:id/rnr/schemes')
  draft(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(z.object({ draftDocumentId: z.uuid() }))) b: { draftDocumentId: string },
  ) {
    return this.r.draftScheme(u, id, b.draftDocumentId);
  }

  @Post('rnr/schemes/:id/submit')
  @HttpCode(200)
  submit(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(z.object({ to: z.enum(['hearing', 'committee']).default('hearing') })))
    b: { to: 'hearing' | 'committee' },
  ) {
    return this.r.advance(u, id, b.to);
  }

  @Post('rnr/schemes/:id/approve')
  @HttpCode(200)
  approve(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.r.advance(u, id, 'approved');
  }

  @Post('rnr/schemes/:id/publish')
  @HttpCode(200)
  publish(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(z.object({ gazetteDocumentId: z.uuid() }))) b: { gazetteDocumentId: string },
  ) {
    return this.r.advance(u, id, 'published', b.gazetteDocumentId);
  }

  @Get('projects/:id/sites')
  sites(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.r.sites(u, id);
  }

  @Post('projects/:id/sites')
  createSite(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Site)) b: z.infer<typeof Site>,
  ) {
    return this.r.createSite(u, id, b);
  }

  @Post('sites/:id/milestones/:code')
  @HttpCode(200)
  milestone(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('code') code: string,
    @Body(new ZodPipe(Milestone)) b: z.infer<typeof Milestone>,
  ) {
    return this.r.milestone(u, id, code, b);
  }

  @Post('sites/:id/commission')
  @HttpCode(200)
  commission(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(z.object({ certificateDocumentId: z.uuid() }))) b: { certificateDocumentId: string },
  ) {
    return this.r.commission(u, id, b.certificateDocumentId);
  }
}
