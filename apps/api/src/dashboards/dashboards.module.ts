import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';

@Module({
  controllers: [DashboardsController],
  providers: [DashboardsService, AnalyticsService],
  exports: [DashboardsService, AnalyticsService],
})
export class DashboardsModule {}
