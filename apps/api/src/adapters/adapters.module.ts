import { Global, Module } from '@nestjs/common';
import { IdentityService } from './identity/identity.adapter';
import { PaymentService } from './payment/payment.adapter';
import { SmsService } from './sms/sms.adapter';

/** All external integrations sit behind these adapters; every mock result says provider MOCK (G7). */
@Global()
@Module({
  providers: [PaymentService, SmsService, IdentityService],
  exports: [PaymentService, SmsService, IdentityService],
})
export class AdaptersModule {}
