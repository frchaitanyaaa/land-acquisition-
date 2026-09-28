import { Injectable, NotImplementedException } from '@nestjs/common';
import { env } from '../../config/env';

/** IdentityAdapter (§30, G7): never Aadhaar / UIDAI e-KYC. The mock always verifies. */
@Injectable()
export class IdentityService {
  async verify(p: { personId: string; method: string }) {
    if (env().IDENTITY_PROVIDER !== 'mock') throw new NotImplementedException('No real identity integration (G7).');
    return {
      verified: true,
      ref: `DEMO-${p.personId.slice(0, 4).toUpperCase()}`,
      provider: 'MOCK' as const,
      method: p.method,
    };
  }
}
