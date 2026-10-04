import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { AuditEntity } from '../common/audit/audit.interceptor';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { GisLayersService, MAP_LAYERS, type BBox, type MapLayer } from './gis-layers.service';
import { GisRegistryService } from './gis-registry.service';
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
const LayersQuery = z.object({
  bbox: z
    .string()
    .transform((s) => s.split(',').map(Number))
    .refine(
      (b): b is BBox =>
        b.length === 4 && b.every(Number.isFinite) && b[0]! >= -180 && b[2]! <= 180 && b[1]! >= -90 && b[3]! <= 90 && b[0]! < b[2]! && b[1]! < b[3]!,
      'bbox must be minLng,minLat,maxLng,maxLat',
    ),
  layers: z
    .string()
    .default('villages,constraints')
    .transform((s) => [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))])
    .refine((l): l is MapLayer[] => l.length > 0 && l.every((x) => (MAP_LAYERS as readonly string[]).includes(x)), {
      message: `layers must be a comma list of: ${MAP_LAYERS.join(', ')}`,
    }),
  zoom: z.coerce.number().int().min(0).max(22).optional(),
});
const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');
const RegistryQuery = z.object({
  projectId: z.uuid().optional(),
  q: z.string().max(100).optional(),
  district: z.string().max(64).optional(),
  subDistrict: z.string().max(64).optional(),
  village: z.string().max(64).optional(),
  landClass: z.string().max(40).optional(),
  status: z.string().max(40).optional(),
  payment: z.enum(['NONE', 'UNPAID', 'PART_PAID', 'PAID', 'ACKNOWLEDGED']).optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  flagged: bool.optional(),
  geometry: bool.default(false),
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

/** Module B — GIS (§15). */
@Controller()
@AuditEntity('land_parcel')
export class GisController {
  constructor(
    private readonly gis: GisService,
    private readonly mapLayers: GisLayersService,
    private readonly registry: GisRegistryService,
  ) {}

  /** A2/A3 — land registry and GIS list: filtered, cursor-paginated, with the KPI/legend summary. */
  @Get('gis/parcels')
  parcelRegistry(@CurrentUser() user: AuthUser, @Query(new ZodPipe(RegistryQuery)) q: z.infer<typeof RegistryQuery>) {
    return this.registry.registry(user, q);
  }

  /** A3 — families with an interest in the parcel, with entitlements, payments and acknowledgements. */
  @Get('project-parcels/:id/families')
  parcelFamilies(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.registry.parcelFamilies(user, id);
  }

  /** A3 — advisory risk factors for one project parcel, with the rows behind each factor. */
  @Get('project-parcels/:id/risk')
  parcelRisk(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.registry.parcelRisk(user, id);
  }

  /** A1 — reference layers for the portal maps, one FeatureCollection per layer (RLS-scoped). */
  @Get('gis/layers')
  layers(@CurrentUser() user: AuthUser, @Query(new ZodPipe(LayersQuery)) q: z.infer<typeof LayersQuery>) {
    return this.mapLayers.layers(user, q.bbox as BBox, q.layers as MapLayer[], q.zoom);
  }

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
