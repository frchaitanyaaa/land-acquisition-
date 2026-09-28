import { Module } from '@nestjs/common';
import { RulesModule } from '../rules/rules.module';
import { DeadlineScan } from './deadline-scan.service';
import { OutboxRelay } from './outbox-relay.service';
import { PaymentStatusJob } from './payment-status.service';
import { EventHandlers } from './event-handlers.service';
import { EventWorker } from './event-worker.service';
import { MvRefresh } from './mv-refresh.service';
import { DisbursementModule } from '../disbursement/disbursement.module';

/** Background jobs (§31). The only module besides rules/ allowed to use WorkerDbService. */
@Module({
  imports: [RulesModule, DisbursementModule],
  providers: [OutboxRelay, DeadlineScan, PaymentStatusJob, EventHandlers, EventWorker, MvRefresh],
  exports: [EventHandlers, MvRefresh],
})
export class JobsModule {}
