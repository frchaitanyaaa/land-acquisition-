import { Module } from '@nestjs/common';
import { RulesModule } from '../rules/rules.module';
import { DeadlineScan } from './deadline-scan.service';
import { OutboxRelay } from './outbox-relay.service';

/** Background jobs (§31). The only module besides rules/ allowed to use WorkerDbService. */
@Module({
  imports: [RulesModule],
  providers: [OutboxRelay, DeadlineScan],
})
export class JobsModule {}
