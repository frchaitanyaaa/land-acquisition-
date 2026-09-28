import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { AuditEntity } from '../common/audit/audit.interceptor';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { ComplianceService } from './compliance.service';

const Rupees = z.union([z.string(), z.number()]);

/** Module I — long-term compliance (§23). */
@Controller()
@AuditEntity('compliance')
export class ComplianceController {
  constructor(private readonly c: ComplianceService) {}

  @Get('compliance/annuities')
  annuities(@CurrentUser() u: AuthUser, @Query('projectId') projectId?: string) {
    return this.c.annuities(u, projectId || undefined);
  }

  @Get('compliance/utilisation')
  utilisation(@CurrentUser() u: AuthUser) {
    return this.c.utilisation(u);
  }

  @Post('project-parcels/:id/severance')
  severance(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(z.object({ inspectionDocumentId: z.uuid().nullish() })))
    b: { inspectionDocumentId?: string | null },
  ) {
    return this.c.severance(u, id, b.inspectionDocumentId);
  }

  @Post('severance/:id/decide')
  @HttpCode(200)
  decide(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(z.object({ decision: z.enum(['acquire_whole', 's28_damages', 'rejected']) })))
    b: { decision: 'acquire_whole' | 's28_damages' | 'rejected' },
  ) {
    return this.c.decideSeverance(u, id, b.decision);
  }

  @Post('project-parcels/:id/utilisation-audit')
  audit(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(
      new ZodPipe(
        z.object({
          status: z.enum(['utilised', 'unutilised']),
          finding: z.string().min(3),
          reversion: z.enum(['owner', 'land_bank', 'custody_transfer']).nullish(),
        }),
      ),
    )
    b: {
      status: 'utilised' | 'unutilised';
      finding: string;
      reversion?: 'owner' | 'land_bank' | 'custody_transfer' | null;
    },
  ) {
    return this.c.utilisationAudit(u, id, b);
  }

  @Post('project-parcels/:id/value-sharing')
  valueSharing(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(
      new ZodPipe(
        z.object({
          transferDate: z.iso.date(),
          considerationRupees: Rupees,
          appreciatedValueRupees: Rupees,
          shareRupees: Rupees,
        }),
      ),
    )
    b: {
      transferDate: string;
      considerationRupees: string | number;
      appreciatedValueRupees: string | number;
      shareRupees: string | number;
    },
  ) {
    return this.c.valueSharing(u, id, b);
  }

  @Post('projects/:id/monitoring-audits')
  monitoring(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(
      new ZodPipe(
        z.object({
          committee: z.enum(['national', 'state']),
          period: z.string().min(1),
          reportDocumentId: z.uuid().nullish(),
          findings: z.unknown().optional(),
        }),
      ),
    )
    b: { committee: 'national' | 'state'; period: string; reportDocumentId?: string | null; findings?: unknown },
  ) {
    return this.c.monitoringAudit(u, id, b);
  }
}
