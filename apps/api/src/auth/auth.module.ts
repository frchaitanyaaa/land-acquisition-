import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';

@Module({
  imports: [OrgModule],
  controllers: [AuthController],
  providers: [AuthService, TokensService],
})
export class AuthModule {}
