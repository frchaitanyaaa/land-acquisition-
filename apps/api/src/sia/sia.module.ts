import { Module } from '@nestjs/common';
import { WorkflowModule } from '../workflow/workflow.module';
import { SiaController } from './sia.controller';
import { SiaService } from './sia.service';

@Module({ imports: [WorkflowModule], controllers: [SiaController], providers: [SiaService], exports: [SiaService] })
export class SiaModule {}
