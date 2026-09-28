import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuditEntity } from '../common/audit/audit.interceptor';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { AwardService } from './award.service';

const Rupees = z.union([z.string(), z.number()]);
const CreateAward = z.strictObject({
  awardType: z.enum(['LAND', 'RNR']),
  awardNo: z.string().min(1).max(100),
  documentId: z.uuid().nullish(),
});
const Entries = z.strictObject({
  entries: z
    .array(z.strictObject({ affectedFamilyId: z.uuid(), headCode: z.string(), amountRupees: Rupees }))
    .min(1)
    .max(2000),
});
const Sign = z.strictObject({ overrideReason: z.string().max(4000).nullish() });
const S37 = z.strictObject({
  entries: z
    .array(z.strictObject({ affectedFamilyId: z.uuid(), presentAtAward: z.boolean() }))
    .min(1)
    .max(2000),
});
const Review = z.strictObject({
  accepted: z.array(z.strictObject({ key: z.string().min(1), value: Rupees })).min(1).max(2000),
});

/** Module F — award entry, checks, signing (§20). */
@Controller()
@AuditEntity('award')
export class AwardController {
  constructor(private readonly awards: AwardService) {}

  @Post('projects/:id/awards')
  create(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(CreateAward)) body: z.infer<typeof CreateAward>,
  ) {
    return this.awards.create(user, id, body);
  }

  @Get('projects/:id/awards')
  list(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.awards.listForProject(user, id);
  }

  @Get('awards/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.awards.get(user, id);
  }

  @Post('awards/:id/entitlements')
  entitlements(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Entries)) body: z.infer<typeof Entries>,
  ) {
    return this.awards.addEntitlements(user, id, body.entries);
  }

  @Get('awards/:id/checks')
  checks(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.awards.checks(user, id);
  }

  @Post('awards/:id/sign')
  @HttpCode(200)
  sign(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Sign)) body: z.infer<typeof Sign>,
  ) {
    return this.awards.sign(user, id, body);
  }

  @Post('awards/:id/s37-notices')
  s37(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(S37)) body: z.infer<typeof S37>,
  ) {
    return this.awards.s37Notices(user, id, body.entries);
  }

  @Get('families/:id/entitlements')
  familyEntitlements(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.awards.familyEntitlements(user, id);
  }

  @Get('ocr-extractions/:id')
  extraction(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.awards.getExtraction(user, id);
  }

  @Post('ocr-extractions/:id/review')
  @HttpCode(200)
  review(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Review)) body: z.infer<typeof Review>,
  ) {
    return this.awards.reviewExtraction(user, id, body);
  }
}
