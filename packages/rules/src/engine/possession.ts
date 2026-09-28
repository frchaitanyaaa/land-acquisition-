import type { EntitlementStatus, PaymentStatus } from '@bhoomisetu/shared';
import type { Pack } from '../../schema/pack.schema';
import type { GuardFailure } from './workflow';

// Possession follows payment and acknowledgement (s.38, CLAUDE.md §12.6).

export interface GateEntitlement {
  id: string;
  familyId: string;
  headCode: string;
  status: EntitlementStatus;
  /** Status of the latest disbursement against this entitlement, if any. */
  paymentStatus?: PaymentStatus | null;
}

export interface GateFamily {
  id: string;
  isDisplaced: boolean;
  /** Resettlement site readiness, 0–100 (complete amenity milestones / applicable). */
  siteReadinessPct?: number | null;
  /** Collector recorded an exception to the site-readiness rule. */
  siteException?: boolean;
}

export interface PossessionGateInput {
  entitlements: GateEntitlement[];
  families: GateFamily[];
  vacationCertificateAttested: boolean;
  legalStay?: boolean;
}

export interface GateResult {
  allowed: boolean;
  failures: GuardFailure[];
}

const SETTLED: ReadonlySet<EntitlementStatus> = new Set(['ACKNOWLEDGED', 'DEPOSITED_WITH_AUTHORITY']);

const isSettled = (e: GateEntitlement) =>
  SETTLED.has(e.status) || (e.status === 'UNDER_PROTEST' && e.paymentStatus === 'SUCCESS');

export function possessionGate(pack: Pack, input: PossessionGateInput): GateResult {
  const failures: GuardFailure[] = [];
  const kindOf = new Map(pack.entitlementHeads.map((h) => [h.code, h.kind]));
  const displaced = new Set(input.families.filter((f) => f.isDisplaced).map((f) => f.id));

  for (const e of input.entitlements) {
    const kind = kindOf.get(e.headCode);
    const gated = kind === 'LAND' || (kind === 'MONETARY_RNR' && displaced.has(e.familyId));
    if (gated && !isSettled(e)) {
      failures.push({
        code: kind === 'LAND' ? 'LAND_HEAD_UNSETTLED' : 'RNR_HEAD_UNSETTLED',
        message: `Entitlement ${e.headCode} for family ${e.familyId} is ${e.status}${e.paymentStatus ? ` (payment ${e.paymentStatus})` : ''} — not acknowledged or deposited`,
      });
    }
  }
  for (const f of input.families) {
    if (f.isDisplaced && (f.siteReadinessPct ?? 0) < 100 && !f.siteException) {
      failures.push({
        code: 'SITE_NOT_READY',
        message: `Resettlement site for displaced family ${f.id} is ${f.siteReadinessPct ?? 0}% ready`,
      });
    }
  }
  if (!input.vacationCertificateAttested) {
    failures.push({
      code: 'VACATION_CERTIFICATE_MISSING',
      message: 'Vacation certificate is not uploaded and attested',
    });
  }
  if (input.legalStay) failures.push({ code: 'LEGAL_STAY', message: 'A legal stay is in force on this parcel' });

  return { allowed: failures.length === 0, failures };
}
