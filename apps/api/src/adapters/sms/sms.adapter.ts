import { devOutboxSms, maskPhone, type Tx } from '@bhoomisetu/db';
import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { env } from '../../config/env';

/** SmsAdapter (§30). The mock stores messages in dev_outbox_sms (visible at /dev/sms). */
@Injectable()
export class SmsService {
  private readonly logger = new Logger('SMS');

  async send(tx: Tx, msg: { to: string | null; template: string; body: string }) {
    if (env().SMS_PROVIDER !== 'mock') throw new NotImplementedException('No real SMS gateway (G7).');
    const toMasked = msg.to ? (msg.to.includes('X') ? msg.to : maskPhone(msg.to)) : 'unknown';
    await tx.insert(devOutboxSms).values({ toMasked, template: msg.template, body: msg.body });
    this.logger.log(`[MOCK SMS → ${toMasked}] ${msg.template}`);
    return { provider: 'MOCK' as const, toMasked };
  }
}
