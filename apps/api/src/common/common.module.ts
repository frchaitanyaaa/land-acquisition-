import { Global, Module } from '@nestjs/common';
import { env } from '../config/env';
import { AuditService } from './audit/audit.service';
import { ClockService } from './clock/clock.service';
import { DbService } from './db/db.service';
import { WorkerDbService } from './db/worker-db.service';

@Global()
@Module({
  providers: [
    { provide: ClockService, useFactory: () => new ClockService(env().DEMO_NOW) },
    DbService,
    WorkerDbService,
    AuditService,
  ],
  exports: [ClockService, DbService, WorkerDbService, AuditService],
})
export class CommonModule {}
