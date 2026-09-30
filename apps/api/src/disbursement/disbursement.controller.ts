import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { AuditEntity } from '../common/audit/audit.interceptor';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/guards/decorators';
import { RedactAs } from '../common/redaction/redaction.interceptor';
import { ZodPipe } from '../common/validation/zod.pipe';
import { DisbursementService } from './disbursement.service';

const Disburse = z.strictObject({
  amountRupees: z.union([z.string(), z.number()]).nullish(),
  isFirstInstalment: z.boolean().default(false),
  acceptanceType: z.enum(['ABSOLUTE', 'UNDER_PROTEST']).default('ABSOLUTE'),
  indemnityBondDocumentId: z.uuid().nullish(),
});
const Hold = z.strictObject({ reasonCode: z.string().regex(/^[A-Z][A-Z0-9_]*$/), reason: z.string().min(3).max(4000) });
const Deposit = z.strictObject({ reason: z.string().min(3).max(4000), openReference: z.boolean().default(false) });
const Fallback = z.strictObject({
  fallbackReason: z.string().min(3).max(1000),
  photoDocumentId: z.uuid().nullish(),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
});
const Possession = z.strictObject({
  panchnamaDocumentId: z.uuid(),
  noticeDocumentId: z.uuid().nullish(),
  possessionCertificateDocumentId: z.uuid().nullish(),
  handoverDocumentId: z.uuid().nullish(),
  vacationCertificateDocumentId: z.uuid().nullish(),
  witnesses: z
    .array(z.object({ name: z.string().min(1), role: z.string().optional() }))
    .min(1)
    .max(10),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  siteExceptionReason: z.string().max(4000).nullish(),
});
const Mutation = z.strictObject({
  direction: z.enum(['pre_award_heir', 'post_possession_transfer']),
  fromHolder: z.string().min(1),
  toHolder: z.string().min(1),
  extractDocumentId: z.uuid().nullish(),
});
const FamiliesQuery = z.object({ limit: z.coerce.number().int().min(1).max(2000).default(500) });

/** Module G — disbursement, acknowledgement, possession (§21). */
@Controller()
@AuditEntity('disbursement')
export class DisbursementController {
  constructor(private readonly svc: DisbursementService) {}

  @Post('entitlements/:id/disbursements')
  @RedactAs('disbursement')
  disburse(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body(new ZodPipe(Disburse)) body: z.infer<typeof Disburse>,
  ) {
    return this.svc.disburse(user, id, key, body);
  }

  @Post('entitlements/:id/deposit-authority')
  deposit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Deposit)) body: z.infer<typeof Deposit>,
  ) {
    return this.svc.depositWithAuthority(user, id, body);
  }

  @Post('disbursements/:id/hold')
  @HttpCode(200)
  @RedactAs('disbursement')
  hold(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Hold)) body: z.infer<typeof Hold>,
  ) {
    return this.svc.hold(user, id, body);
  }

  @Post('disbursements/:id/release')
  @HttpCode(200)
  @RedactAs('disbursement')
  release(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.release(user, id);
  }

  @Post('disbursements/:id/ack-link')
  ackLink(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.ackLink(user, id);
  }

  @Post('disbursements/:id/attest-fallback')
  fallback(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Fallback)) body: z.infer<typeof Fallback>,
  ) {
    return this.svc.attestFallback(user, id, body);
  }

  @Post('persons/:id/webauthn/enrol-link')
  enrolLink(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.enrolLink(user, id);
  }

  @Post('families/:id/passbook/issue')
  passbook(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.passbookLink(user, id);
  }

  @Get('families/:id/passbook')
  familyPassbook(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.familyPassbook(user, id);
  }

  @Get('families/:id/money')
  money(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.familyMoney(user, id);
  }

  @Get('projects/:id/families')
  families(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodPipe(FamiliesQuery)) q: z.infer<typeof FamiliesQuery>,
  ) {
    return this.svc.projectFamilies(user, id, q);
  }

  @Get('project-parcels/:id/possession-gate')
  gate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.possessionGate(user, id);
  }

  @Post('project-parcels/:id/possession')
  @AuditEntity('project_parcel')
  possession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Possession)) body: z.infer<typeof Possession>,
  ) {
    return this.svc.takePossession(user, id, body);
  }

  @Post('parcels/:id/mutations')
  @AuditEntity('land_parcel')
  mutation(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(Mutation)) body: z.infer<typeof Mutation>,
  ) {
    return this.svc.recordMutation(user, id, body);
  }
}
