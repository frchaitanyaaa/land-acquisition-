import { Module } from '@nestjs/common';
import { OutboxRelay } from './outbox-relay.service';

/** Background jobs (§31). The only module besides rules/ allowed to use WorkerDbService. */
@Module({
  providers: [OutboxRelay],
})
export class JobsModule {}
