import { Global, Module } from '@nestjs/common';
import { CadastralController } from './cadastral/cadastral.controller';
import { IdentityService } from './identity/identity.adapter';
import { PaymentService } from './payment/payment.adapter';
import { SmsService } from './sms/sms.adapter';

/** All external integrations sit behind these adapters; every mock result says provider MOCK (G7). */
@Global()
@Module({
  controllers: [CadastralController],
  providers: [PaymentService, SmsService, IdentityService],
  exports: [PaymentService, SmsService, IdentityService],
})
export class AdaptersModule {}
