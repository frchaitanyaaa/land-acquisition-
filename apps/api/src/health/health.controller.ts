import { Controller, Get } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ClockService } from '../common/clock/clock.service';
import { DbService } from '../common/db/db.service';
import { Public } from '../common/guards/decorators';
import { env } from '../config/env';

@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DbService,
    private readonly clock: ClockService,
  ) {}

  @Public()
  @Get()
  async health() {
    const db = await this.db
      .withScope(null, (tx) => tx.execute(sql`SELECT 1`))
      .then(() => 'ok' as const)
      .catch(() => 'down' as const);
    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      db,
      demoMode: env().DEMO_MODE,
      clock: { now: this.clock.now().toISOString(), frozen: this.clock.frozen },
    };
  }
}
