import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { HEARING_TYPES } from '@bhoomisetu/shared';
import { z } from 'zod';
import { AuditEntity } from '../common/audit/audit.interceptor';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { SiaService } from './sia.service';

const Iso = z.iso.datetime({ offset: true });
const Schedule = z.strictObject({
  type: z.enum(HEARING_TYPES),
  scheduledAt: Iso,
  venue: z.string().max(300).nullish(),
  villageCode: z.string().nullish(),
  noticePublishedAt: Iso.nullish(),
});
const HearingUpdate = z.strictObject({
  documents: z
    .partialRecord(z.enum(['NOTICE', 'LOCAL_LANGUAGE_SUMMARY', 'RECORDING', 'ATTENDANCE', 'RESPONSE_MATRIX']), z.uuid())
    .optional(),
  noticePublishedAt: Iso.nullish(),
  quorumMet: z.boolean().nullish(),
  held: z.boolean().optional(),
});
const Cpr = z.strictObject({
  villageCode: z.string(),
  cprType: z.enum(['well', 'grazing', 'worship', 'school', 'clinic', 'cremation', 'pond', 'other']),
  name: z.string().min(1).max(200),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  affected: z.boolean().default(true),
  notes: z.string().max(2000).nullish(),
});
const Csv = z.strictObject({ csv: z.string().min(1).max(20_000_000) });
const Constitute = z.strictObject({
  chairperson: z.string().min(1),
  members: z
    .array(
      z.strictObject({ name: z.string().min(1), seat: z.string().min(1), coiDeclarationDocId: z.uuid().nullish() }),
    )
    .min(1)
    .max(15),
});
const Recommend = z.strictObject({
  outcome: z.enum(['A_UNCONDITIONAL', 'B_CONDITIONAL', 'C_REJECTION']),
  conditions: z.string().max(8000).nullish(),
  dissentNotes: z.unknown().optional(),
  reportDocumentId: z.uuid(),
});
const Override = z.strictObject({
  writtenReasons: z.string().min(10).max(20_000),
  orderDocumentId: z.uuid().nullish(),
});

/** Module C — SIA, hearings, expert group (§17). */
@Controller()
@AuditEntity('sia')
export class SiaController {
  constructor(private readonly sia: SiaService) {}

  @Post('projects/:id/sia/commence')
  @HttpCode(200)
  commence(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sia.commence(u, id);
  }

  @Post('projects/:id/sia/report-final')
  @HttpCode(200)
  reportFinal(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sia.reportFinal(u, id);
  }

  @Post('projects/:id/sia/census/import')
  census(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Csv)) b: z.infer<typeof Csv>,
  ) {
    return this.sia.importCensus(u, id, b.csv);
  }

  @Get('projects/:id/hearings')
  hearings(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sia.listHearings(u, id);
  }

  @Post('projects/:id/hearings')
  schedule(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Schedule)) b: z.infer<typeof Schedule>,
  ) {
    return this.sia.scheduleHearing(u, id, b);
  }

  @Post('hearings/:id/documents')
  @HttpCode(200)
  hearingDocs(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(HearingUpdate)) b: z.infer<typeof HearingUpdate>,
  ) {
    return this.sia.updateHearing(u, id, b);
  }

  @Post('hearings/:id/validate')
  @HttpCode(200)
  validate(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sia.validateHearing(u, id);
  }

  @Post('hearings/:id/nullify')
  @HttpCode(200)
  nullify(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(z.object({ reasonCode: z.string() }))) b: { reasonCode: string },
  ) {
    return this.sia.nullifyHearing(u, id, b.reasonCode);
  }

  @Get('projects/:id/cpr')
  cprList(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sia.listCpr(u, id);
  }

  @Post('projects/:id/cpr')
  cpr(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Cpr)) b: z.infer<typeof Cpr>,
  ) {
    return this.sia.addCpr(u, id, b);
  }

  @Get('projects/:id/expert-group')
  expertGroup(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sia.expertGroup(u, id);
  }

  @Post('projects/:id/expert-group')
  constitute(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Constitute)) b: z.infer<typeof Constitute>,
  ) {
    return this.sia.constituteExpertGroup(u, id, b);
  }

  @Post('projects/:id/expert-group/recommendation')
  recommend(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Recommend)) b: z.infer<typeof Recommend>,
  ) {
    return this.sia.recommend(u, id, b);
  }

  @Post('projects/:id/override')
  override(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Override)) b: z.infer<typeof Override>,
  ) {
    return this.sia.override(u, id, b);
  }
}
