import { Module } from '@nestjs/common';
import { DisbursementModule } from '../disbursement/disbursement.module';
import { PublicController } from './public.controller';

@Module({ imports: [DisbursementModule], controllers: [PublicController] })
export class PublicModule {}
