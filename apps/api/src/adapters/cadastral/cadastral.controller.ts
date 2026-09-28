import { Body, Controller, Get, NotImplementedException, Post, Query } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AuthUser } from '../../common/auth-user';
import { DbService } from '../../common/db/db.service';
import { rows } from '../../common/db/raw';
import { requireRole } from '../../common/roles';
import { CurrentUser } from '../../common/guards/decorators';
import { ZodPipe } from '../../common/validation/zod.pipe';
import { env } from '../../config/env';

/**
 * CadastralAdapter (§30, G7). Never Bhu-Naksha: the MOCK returns the seeded "cadastral" parcels of a
 * village (they are already land_parcels with boundary_source CADASTRAL_IMPORT), labelled MOCK.
 */
@Controller()
export class CadastralController {
  constructor(private readonly db: DbService) {}

  @Get('cadastral/parcels')
  parcels(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(z.object({ village: z.string(), survey: z.string().optional() })))
    q: { village: string; survey?: string },
  ) {
    if (env().CADASTRAL_PROVIDER !== 'mock') throw new NotImplementedException('No real cadastral integration (G7).');
    return this.db.withScope(user, async (tx) => ({
      provider: 'MOCK',
      type: 'FeatureCollection',
      features: (
        await rows<{ id: string; survey_no: string; recorded_area_sqm: string; geometry: unknown }>(
          tx,
          sql`SELECT id, survey_number || coalesce('/' || sub_division, '') AS survey_no, recorded_area_sqm, ST_AsGeoJSON(geom, 7)::json AS geometry
              FROM land_parcels WHERE village_code = ${q.village} AND boundary_source = 'CADASTRAL_IMPORT'
                AND (${q.survey ?? null}::text IS NULL OR survey_number = split_part(${q.survey ?? null}, '/', 1)) LIMIT 500`,
        )
      ).map((r) => ({
        type: 'Feature',
        id: r.id,
        geometry: r.geometry,
        properties: { surveyNo: r.survey_no, recordedAreaSqm: r.recorded_area_sqm, provider: 'MOCK' },
      })),
    }));
  }

  /** Import = the mock's parcels already exist; report what would be imported (idempotent no-op). */
  @Post('parcels/import-cadastral')
  importCadastral(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(z.object({ villageCode: z.string() }))) b: { villageCode: string },
  ) {
    requireRole(user, ['DILR', 'LAO', 'TEHSILDAR'], 'Importing cadastral parcels');
    return this.db.withScope(user, async (tx) => {
      const [r] = await rows<{ n: number }>(
        tx,
        sql`SELECT count(*)::int AS n FROM land_parcels WHERE village_code = ${b.villageCode} AND boundary_source = 'CADASTRAL_IMPORT'`,
      );
      return { provider: 'MOCK', villageCode: b.villageCode, alreadyPresent: r?.n ?? 0, imported: 0 };
    });
  }
}
