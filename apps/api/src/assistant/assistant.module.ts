import { Module } from '@nestjs/common';
import { DashboardsModule } from '../dashboards/dashboards.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({ imports: [DashboardsModule], controllers: [AssistantController], providers: [AssistantService] })
export class AssistantModule {}
