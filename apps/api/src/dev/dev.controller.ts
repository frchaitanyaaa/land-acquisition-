import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DbService } from '../common/db/db.service';
import { rows } from '../common/db/raw';
import { ProblemException } from '../common/errors/problem';
import { CurrentUser, Roles } from '../common/guards/decorators';
import { env } from '../config/env';

/** Demo/ops helpers (DEMO_MODE only): the mock SMS outbox and the audit-chain check (§11.6). */
@Controller()
export class DevController {
  constructor(private readonly db: DbService) {}

  private guard() {
    if (!env().DEMO_MODE) throw new ProblemException(404, 'NOT_FOUND', 'Not available.');
  }

  @Get('dev/sms')
  sms(@CurrentUser() user: AuthUser) {
    this.guard();
    return this.db.withScope(user, (tx) =>
      rows(tx, sql`SELECT to_masked, template, body, created_at FROM dev_outbox_sms ORDER BY created_at DESC LIMIT 50`),
    );
  }

  /** Walks the audit hash chain and reports the first broken link. */
  @Get('audit/verify')
  @Roles('SUPER_ADMIN', 'CENTRAL_VIEWER', 'MONITORING_COMMITTEE')
  auditVerify(@CurrentUser() user: AuthUser) {
    return this.db.withScope(user, async (tx) => {
      const [r] = await rows<{ checked: string; first_broken_id: string | null }>(
        tx,
        sql`SELECT * FROM audit_verify()`,
      );
      return {
        checked: Number(r?.checked ?? 0),
        intact: !r?.first_broken_id,
        firstBrokenId: r?.first_broken_id ?? null,
      };
    });
  }

  @Post('dev/ping')
  @HttpCode(200)
  ping() {
    this.guard();
    return { ok: true };
  }
}
