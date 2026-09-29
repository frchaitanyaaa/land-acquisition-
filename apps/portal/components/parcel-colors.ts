import { STATUS_COLOR } from '@/components/status';
import type { ColorBy } from '@/lib/parcels-api';

// Parcel status and payment status are both ordinal (a parcel moves forward through them), so
// each gets a single-hue sequential ramp (light → dark), not arbitrary categorical hues —
// per the dataviz convention: "sequential = one hue, light->dark. Never a rainbow." Denotified /
// terminated are neutral end-states outside the progression, so they get slate, not teal.
const STAGE_COLOR: Record<string, string> = {
  PROPOSED: '#CCFBF1',
  VERIFICATION_PENDING: '#99F6E4',
  VERIFIED: '#5EEAD4',
  CONSENT_ACQUIRED_NOTIFIED: '#2DD4BF',
  CLEARED_FOR_AWARD_RNR: '#14B8A6',
  AWARDED: '#0D9488',
  READY_FOR_POSSESSION: '#0F766E',
  ACQUIRED_POSSESSED: '#115E59',
  CLOSED: '#134E4A',
  DENOTIFIED: '#94A3B8',
  TERMINATED: '#64748B',
};

const PAYMENT_COLOR: Record<string, string> = {
  NONE: '#E2E8F0',
  UNPAID: '#FDE68A',
  PART_PAID: '#FBBF24',
  PAID: '#5EEAD4',
  ACKNOWLEDGED: '#0F766E',
};

const RISK_COLOR: Record<string, string> = STATUS_COLOR;

const SCALES: Record<ColorBy, Record<string, string>> = {
  stage: STAGE_COLOR,
  payment: PAYMENT_COLOR,
  risk: RISK_COLOR,
};

const FALLBACK = '#94A3B8';

export function parcelColor(colorBy: ColorBy, category: string): string {
  return SCALES[colorBy][category] ?? FALLBACK;
}

export const COLOR_BY_LEGEND: Record<ColorBy, Array<{ key: string; label: string }>> = {
  stage: [
    { key: 'PROPOSED', label: 'Proposed' },
    { key: 'VERIFICATION_PENDING', label: 'Verification pending' },
    { key: 'VERIFIED', label: 'Verified' },
    { key: 'CONSENT_ACQUIRED_NOTIFIED', label: 'Notified' },
    { key: 'CLEARED_FOR_AWARD_RNR', label: 'Cleared for award' },
    { key: 'AWARDED', label: 'Awarded' },
    { key: 'READY_FOR_POSSESSION', label: 'Ready for possession' },
    { key: 'ACQUIRED_POSSESSED', label: 'Possessed' },
    { key: 'CLOSED', label: 'Closed' },
    { key: 'DENOTIFIED', label: 'Denotified' },
    { key: 'TERMINATED', label: 'Terminated' },
  ],
  payment: [
    { key: 'NONE', label: 'No interest on record' },
    { key: 'UNPAID', label: 'Unpaid' },
    { key: 'PART_PAID', label: 'Part paid' },
    { key: 'PAID', label: 'Paid' },
    { key: 'ACKNOWLEDGED', label: 'Acknowledged' },
  ],
  risk: [
    { key: 'SAFE', label: 'Safe' },
    { key: 'DUE_SOON', label: 'Due soon' },
    { key: 'BREACHED', label: 'Breached' },
  ],
};
