import { Controller, Get, Header, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { ClockService } from '../common/clock/clock.service';
import { ProblemException } from '../common/errors/problem';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { AnalyticsService, toCsv } from './analytics.service';
import { DashboardsService } from './dashboards.service';
import { renderReportPdf } from './pdf-report';

const BoardQuery = z.object({ withinDays: z.coerce.number().int().min(0).max(3650).optional() });
const RiskQuery = z.object({ projectId: z.uuid().optional() });
const ReportQuery = z.object({
  format: z.enum(['csv', 'json', 'pdf']).default('csv'),
  stateCode: z.string().optional(),
  districtCode: z.string().optional(),
  projectId: z.uuid().optional(),
});

/** Module J — dashboards, analytics, MIS (§24). */
@Controller()
export class DashboardsController {
  constructor(
    private readonly dashboards: DashboardsService,
    private readonly analytics: AnalyticsService,
    private readonly clock: ClockService,
  ) {}

  @Get('dashboards/national')
  national(@CurrentUser() user: AuthUser) {
    return this.dashboards.national(user);
  }

  @Get('dashboards/state/:code')
  state(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.dashboards.state(user, code);
  }

  @Get('dashboards/district/:code')
  district(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.dashboards.district(user, code);
  }

  @Get('dashboards/project/:id')
  project(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.dashboards.project(user, id);
  }

  @Get('dashboards/collector')
  collector(@CurrentUser() user: AuthUser) {
    return this.dashboards.collector(user);
  }

  @Get('deadlines/board')
  board(@CurrentUser() user: AuthUser, @Query(new ZodPipe(BoardQuery)) q: z.infer<typeof BoardQuery>) {
    return this.dashboards.deadlineBoard(user, q.withinDays);
  }

  @Get('analytics/risk')
  risk(@CurrentUser() user: AuthUser, @Query(new ZodPipe(RiskQuery)) q: z.infer<typeof RiskQuery>) {
    return this.analytics.risk(user, q.projectId);
  }

  @Get('analytics/bottlenecks')
  bottlenecks(@CurrentUser() user: AuthUser) {
    return this.analytics.bottlenecks(user);
  }

  @Get('reports/:type')
  @Header('Cache-Control', 'no-store')
  async report(
    @CurrentUser() user: AuthUser,
    @Param('type') type: string,
    @Query(new ZodPipe(ReportQuery)) q: z.infer<typeof ReportQuery>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.analytics.report(user, type, q);
    if (!data)
      throw new ProblemException(404, 'REPORT_NOT_FOUND', `Unknown report ${type}.`, {
        available: [
          'project-progress',
          'compensation-register',
          'rnr-status',
          'deadline-compliance',
          'district-comparison',
        ],
      });
    if (q.format === 'json') return data;
    if (q.format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${type}.pdf"`);
      return renderReportPdf(type, data, this.clock.now());
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
    return toCsv(
      data.map((r) =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? v.toString() : v])),
      ),
    );
  }
}
