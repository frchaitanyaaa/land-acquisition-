import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuditEntity } from '../common/audit/audit.interceptor';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { ConsentService } from './consent.service';

const Create = z.strictObject({ consentType: z.enum(['PRIVATE_80', 'PPP_70', 'GRAM_SABHA_S41']) });
const Display = z.strictObject({ displayFrom: z.iso.date(), displayTo: z.iso.date() });
const Entry = z.strictObject({
  personId: z.uuid(),
  eligibilityBasis: z.string().min(3).max(300),
  isHeirUpdate: z.boolean().default(false),
});
const Record = z.strictObject({
  registerEntryId: z.uuid(),
  decision: z.enum(['CONSENT', 'REFUSE']),
  formDocumentId: z.uuid().nullish(),
  observerPostId: z.uuid().nullish(),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
});
const Objection = z.strictObject({
  personId: z.uuid().nullish(),
  parcelId: z.uuid().nullish(),
  body: z.string().min(5).max(20_000),
  language: z.string().max(10).nullish(),
  channel: z.enum(['helpdesk', 'hearing_audio']).default('helpdesk'),
});
const Classify = z.strictObject({
  statutoryGround: z.enum(['AREA_SUITABILITY', 'PUBLIC_PURPOSE', 'SIA_FINDINGS']),
  operationalCategory: z.enum(['A_PUBLIC_PURPOSE', 'B_ALIGNMENT_SHIFT', 'C_SURVEY_ERROR']),
});
const Decide = z.strictObject({ decision: z.enum(['UPHELD', 'REJECTED']), remarks: z.string().min(3).max(8000) });

/** Module D — consent, s.11 draft, objections (§18). */
@Controller()
@AuditEntity('consent')
export class ConsentController {
  constructor(private readonly c: ConsentService) {}

  @Post('projects/:id/consent-registers')
  create(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Create)) b: z.infer<typeof Create>,
  ) {
    return this.c.createRegister(u, id, b.consentType);
  }

  @Get('consent-registers/:id/entries')
  entries(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.c.entries(u, id);
  }

  @Post('consent-registers/:id/display')
  @HttpCode(200)
  display(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Display)) b: z.infer<typeof Display>,
  ) {
    return this.c.display(u, id, b);
  }

  @Post('consent-registers/:id/entries')
  addEntry(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Entry)) b: z.infer<typeof Entry>,
  ) {
    return this.c.addEntry(u, id, b);
  }

  @Post('consent-entries/:id/remove')
  @HttpCode(200)
  removeEntry(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(z.object({ reason: z.string().min(3) }))) b: { reason: string },
  ) {
    return this.c.removeEntry(u, id, b.reason);
  }

  @Post('consent-registers/:id/certify')
  @HttpCode(200)
  certify(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.c.certify(u, id);
  }

  @Post('consent-registers/:id/records')
  record(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Record)) b: z.infer<typeof Record>,
  ) {
    return this.c.record(u, id, b);
  }

  @Post('consent-records/:id/observer-certify')
  @HttpCode(200)
  observer(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.c.observerCertify(u, id);
  }

  @Get('projects/:id/consent/tally')
  tally(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.c.tally(u, id);
  }

  @Get('projects/:id/s11/draft')
  s11(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.c.s11Draft(u, id);
  }

  @Get('projects/:id/objections')
  objections(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.c.listObjections(u, id);
  }

  @Post('projects/:id/objections')
  file(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Objection)) b: z.infer<typeof Objection>,
  ) {
    return this.c.fileObjection(u, id, b);
  }

  @Post('objections/:id/triage')
  @HttpCode(200)
  triage(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.c.triage(u, id);
  }

  @Post('objections/:id/classify')
  @HttpCode(200)
  classify(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Classify)) b: z.infer<typeof Classify>,
  ) {
    return this.c.classify(u, id, b);
  }

  @Post('objections/:id/schedule')
  @HttpCode(200)
  schedule(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(z.object({ hearingId: z.uuid() }))) b: { hearingId: string },
  ) {
    return this.c.schedule(u, id, b.hearingId);
  }

  @Post('objections/:id/decide')
  @HttpCode(200)
  decide(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Decide)) b: z.infer<typeof Decide>,
  ) {
    return this.c.decide(u, id, b);
  }
}
