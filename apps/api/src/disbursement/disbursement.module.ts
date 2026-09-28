import { Module } from '@nestjs/common';
import { DisbursementController } from './disbursement.controller';
import { DisbursementService } from './disbursement.service';
import { PublicAckService } from './public-ack.service';

@Module({
  controllers: [DisbursementController],
  providers: [DisbursementService, PublicAckService],
  exports: [DisbursementService, PublicAckService],
})
export class DisbursementModule {}
