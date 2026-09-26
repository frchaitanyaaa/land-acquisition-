import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './auth/auth.module';
import { AuditInterceptor } from './common/audit/audit.interceptor';
import { CommonModule } from './common/common.module';
import { ProblemFilter } from './common/errors/problem.filter';
import { JwtGuard } from './common/guards/jwt.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { PostGuard } from './common/guards/post.guard';
import { RedactionInterceptor } from './common/redaction/redaction.interceptor';
import { HealthController } from './health/health.controller';
import { JobsModule } from './jobs/jobs.module';
import { OrgModule } from './org/org.module';
import { RulesModule } from './rules/rules.module';

@Module({
  imports: [CommonModule, JwtModule.register({ global: true }), OrgModule, AuthModule, RulesModule, JobsModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: ProblemFilter },
    // Guards run in this order: token → post held today → role.
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: PostGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    // Redaction is outermost so audit sees the unredacted response and nothing leaves unredacted.
    { provide: APP_INTERCEPTOR, useClass: RedactionInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
