import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { AuditEntity } from '../common/audit/audit.interceptor';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { GisService } from './gis.service';

const ColorByQuery = z.object({ colorBy: z.enum(['stage', 'payment', 'risk']).default('stage') });
const ChainageQuery = z.object({ binM: z.coerce.number().int().min(50).max(10_000).default(500) });
const VerifyBody = z.strictObject({
  remarks: z.string().max(4000).nullish(),
  overrideReason: z.string().max(4000).nullish(),
});
const CorrectionBody = z.strictObject({
  geometry: z.object({ type: z.enum(['Polygon', 'MultiPolygon']), coordinates: z.array(z.any()) }),
  reason: z.string().min(5).max(4000),
});
const DecideBody = z.strictObject({ approve: z.boolean() });

/** Module B — GIS (§15). */
@Controller()
@AuditEntity('land_parcel')
export class GisController {
  constructor(private readonly gis: GisService) {}

  @Post('projects/:id/intersect')
  @HttpCode(200)
  intersect(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.gis.intersect(user, id);
  }

  @Get('projects/:id/parcels')
  parcels(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodPipe(ColorByQuery)) q: z.infer<typeof ColorByQuery>,
  ) {
    return this.gis.parcels(user, id, q.colorBy);
  }

  @Get('projects/:id/chainage')
  chainage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodPipe(ChainageQuery)) q: z.infer<typeof ChainageQuery>,
  ) {
    return this.gis.chainage(user, id, q.binM);
  }

  @Get('projects/:id/flags')
  flags(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.gis.flags(user, id);
  }

  @Post('flags/:id/acknowledge')
  @HttpCode(200)
  @AuditEntity('spatial_flag')
  acknowledge(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.gis.acknowledgeFlag(user, id);
  }

  @Get('parcels/:id')
  parcel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.gis.parcel(user, id);
  }

  @Post('parcels/:id/verify')
  @HttpCode(200)
  verify(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(VerifyBody)) body: z.infer<typeof VerifyBody>,
  ) {
    return this.gis.verify(user, id, body);
  }

  @Post('parcels/:id/corrections')
  @AuditEntity('parcel_correction')
  correction(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(CorrectionBody)) body: z.infer<typeof CorrectionBody>,
  ) {
    return this.gis.requestCorrection(user, id, body);
  }

  @Post('parcel-corrections/:id/decide')
  @HttpCode(200)
  @AuditEntity('parcel_correction')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(DecideBody)) body: z.infer<typeof DecideBody>,
  ) {
    return this.gis.decideCorrection(user, id, body);
  }
}
