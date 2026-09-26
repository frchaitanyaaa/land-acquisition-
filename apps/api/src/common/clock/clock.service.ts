import { parseIsoInstant } from '@bhoomisetu/shared';
import { Injectable } from '@nestjs/common';

/**
 * The only source of "now" for business logic (G16). With DEMO_NOW set the clock is frozen, so
 * statutory countdowns read the same on every run of the demo.
 *
 * `realNow()` exists for security expiries only (JWT, refresh tokens, lockouts): those must follow
 * the wall clock even while the demo clock is frozen.
 */
@Injectable()
export class ClockService {
  private readonly frozenAt: Date | null;

  constructor(demoNow?: string) {
    this.frozenAt = demoNow ? parseIsoInstant(demoNow, 'DEMO_NOW') : null;
  }

  now(): Date {
    return this.frozenAt ? new Date(this.frozenAt.getTime()) : new Date();
  }

  get frozen(): boolean {
    return this.frozenAt !== null;
  }

  realNow(): Date {
    return new Date();
  }
}
