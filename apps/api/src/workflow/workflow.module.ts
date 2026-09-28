import { Module } from '@nestjs/common';
import { RulesModule } from '../rules/rules.module';
import { DeadlinesService } from './deadlines.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [RulesModule],
  controllers: [WorkflowController],
  providers: [WorkflowService, DeadlinesService],
  exports: [WorkflowService, DeadlinesService],
})
export class WorkflowModule {}
