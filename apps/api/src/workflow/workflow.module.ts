import { Module } from '@nestjs/common';
import { RulesModule } from '../rules/rules.module';
import { DeadlinesService } from './deadlines.service';
import { PipelineController } from './pipeline.controller';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [RulesModule],
  controllers: [WorkflowController, PipelineController],
  providers: [WorkflowService, DeadlinesService],
  exports: [WorkflowService, DeadlinesService],
})
export class WorkflowModule {}
