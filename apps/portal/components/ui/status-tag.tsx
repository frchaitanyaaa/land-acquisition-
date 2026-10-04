/**
 * One status → UX4G Tag colour map for the whole portal (C1). Status names repeat across domains
 * (SUBMITTED, TERMINATED, PENDING…), so callers say which domain with `kind`.
 *
 * Tone rule: error = a legal consequence or failure, warning = needs action / not yet confirmed,
 * success = done and confirmed, info = in progress, primary = decided but not executed,
 * neutral = not started / closed / no longer relevant.
 * Note DISBURSED is warning on purpose: disbursed is not received until the family acknowledges.
 */
export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';

export type StatusKind = 'deadline' | 'entitlement' | 'payment' | 'parcel' | 'chain' | 'stage' | 'project';

const TONES: Record<StatusKind, Record<string, Tone>> = {
  deadline: {
    SAFE: 'success',
    DUE_SOON: 'warning',
    BREACHED: 'error',
    SATISFIED: 'neutral',
    NOT_STARTED: 'neutral',
    WAIVED: 'neutral',
    VOIDED: 'neutral',
  },
  entitlement: {
    ASSESSED: 'neutral',
    SANCTIONED: 'info',
    DISBURSED: 'warning',
    ACKNOWLEDGED: 'success',
    DEPOSITED_WITH_AUTHORITY: 'info',
    UNDER_PROTEST: 'warning',
    DISPUTED: 'error',
  },
  payment: { INITIATED: 'info', PENDING: 'info', SUCCESS: 'success', FAILED: 'error' },
  parcel: {
    PROPOSED: 'neutral',
    VERIFICATION_PENDING: 'warning',
    VERIFIED: 'info',
    CONSENT_ACQUIRED_NOTIFIED: 'info',
    CLEARED_FOR_AWARD_RNR: 'info',
    AWARDED: 'primary',
    READY_FOR_POSSESSION: 'primary',
    ACQUIRED_POSSESSED: 'success',
    CLOSED: 'neutral',
    DENOTIFIED: 'neutral',
    TERMINATED: 'error',
  },
  chain: {
    QUEUED: 'info',
    SUBMITTED: 'info',
    PENDING: 'info',
    ANCHORED: 'success',
    VERIFIED: 'success',
    FAILED: 'error',
    MISMATCH: 'error',
    NOT_ANCHORED: 'neutral',
  },
  stage: {
    NOT_STARTED: 'neutral',
    IN_PROGRESS: 'info',
    SUBMITTED: 'primary',
    RETURNED: 'warning',
    APPROVED: 'success',
    NULLIFIED: 'error',
    SKIPPED: 'neutral',
    TERMINATED: 'error',
  },
  project: {
    DRAFT: 'neutral',
    SUBMITTED: 'info',
    ACTIVE: 'success',
    ON_HOLD: 'warning',
    TERMINATED: 'error',
    DENOTIFIED: 'neutral',
    ABANDONED: 'error',
    LAPSED: 'error',
    CLOSED: 'neutral',
  },
};

/** Overrides where sentence-casing the enum reads badly. */
const LABELS: Record<string, string> = {
  DEPOSITED_WITH_AUTHORITY: 'Deposited with Authority',
  CONSENT_ACQUIRED_NOTIFIED: 'Consent / notified',
  CLEARED_FOR_AWARD_RNR: 'Cleared for award & R&R',
  ACQUIRED_POSSESSED: 'Possessed',
  NOT_ANCHORED: 'Not anchored',
};

export function statusTone(kind: StatusKind, status: string): Tone {
  return TONES[kind][status] ?? 'neutral';
}

export function statusLabel(status: string): string {
  if (LABELS[status]) return LABELS[status];
  const s = status.replaceAll('_', ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StatusTag({
  kind,
  status,
  label,
  variant = 'tonal',
}: {
  kind: StatusKind;
  status: string;
  /** Defaults to the sentence-cased status. */
  label?: string;
  variant?: 'tonal' | 'filled' | 'outline';
}) {
  return (
    <span className={`ux4g-tag-${variant}-${statusTone(kind, status)} ux4g-tag-s`}>{label ?? statusLabel(status)}</span>
  );
}
