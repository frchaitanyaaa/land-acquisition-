import { Module } from '@nestjs/common';
import { WorkflowModule } from '../workflow/workflow.module';
import { RnrController } from './rnr.controller';
import { RnrService } from './rnr.service';

@Module({ imports: [WorkflowModule], controllers: [RnrController], providers: [RnrService] })
export class RnrModule {}
