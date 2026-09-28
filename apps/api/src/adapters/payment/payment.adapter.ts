import { createHash } from 'node:crypto';
import { Injectable, NotImplementedException } from '@nestjs/common';
import { env } from '../../config/env';

// PaymentAdapter (§30, G7): never PFMS / treasury / bank. The mock returns PENDING, then SUCCESS
// after ~3 s — except a deterministic 5% that FAIL (by hash of the disbursement id + SEED).

export type PaymentResult = { ref: string; status: 'PENDING' | 'SUCCESS' | 'FAILED'; provider: 'MOCK' | 'REAL' };

export interface PaymentAdapter {
  initiate(d: { disbursementId: string; amountPaise: bigint; beneficiaryRef: string | null }): Promise<PaymentResult>;
  status(ref: string): Promise<PaymentResult>;
}

const SETTLE_MS = 3_000;

@Injectable()
export class PaymentService implements PaymentAdapter {
  private readonly started = new Map<string, { at: number; fail: boolean }>();

  get provider(): 'MOCK' | 'REAL' {
    return env().PAYMENT_PROVIDER === 'mock' ? 'MOCK' : 'REAL';
  }

  async initiate(d: {
    disbursementId: string;
    amountPaise: bigint;
    beneficiaryRef: string | null;
  }): Promise<PaymentResult> {
    if (env().PAYMENT_PROVIDER !== 'mock') throw new NotImplementedException('No real payment integration (G7).');
    const h = createHash('sha256').update(`${env().SEED}:${d.disbursementId}`).digest();
    const ref = `MOCK-PAY-${d.disbursementId.slice(0, 8).toUpperCase()}`;
    this.started.set(ref, { at: Date.now(), fail: h[0]! < Math.round(256 * 0.05) });
    return { ref, status: 'PENDING', provider: 'MOCK' };
  }

  async status(ref: string): Promise<PaymentResult> {
    if (env().PAYMENT_PROVIDER !== 'mock') throw new NotImplementedException('No real payment integration (G7).');
    const s = this.started.get(ref);
    // Unknown after a restart: settle it now (as a successful mock).
    if (!s) return { ref, status: 'SUCCESS', provider: 'MOCK' };
    if (Date.now() - s.at < SETTLE_MS) return { ref, status: 'PENDING', provider: 'MOCK' };
    this.started.delete(ref);
    return { ref, status: s.fail ? 'FAILED' : 'SUCCESS', provider: 'MOCK' };
  }
}
