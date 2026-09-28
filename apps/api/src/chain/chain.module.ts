import { Global, Module } from '@nestjs/common';
import { ChainController } from './chain.controller';
import { ChainService } from './chain.service';

@Global()
@Module({ controllers: [ChainController], providers: [ChainService], exports: [ChainService] })
export class ChainModule {}
