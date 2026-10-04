'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Module G — family money, acknowledgement links, possession (§21).

export interface Disbursement {
  id: string;
  amountPaise: string;
  instrument: 'DBT' | 'DEPOSIT_WITH_AUTHORITY';
  paymentStatus: 'INITIATED' | 'PENDING' | 'SUCCESS' | 'FAILED';
  paidOn: string | null;
  initiatedAt: string;
  acceptanceType: string | null;
  adapterProvider: string | null;
  /** Present only if the server's redaction map lets this viewer see it (§11.4). */
  holdReasonCode?: string | null;
  holdReason?: string | null;
  acknowledgement: { method: string; confirmedAt: string } | null;
}

export interface MoneyEntitlement {
  entitlement_id: string;
  head_code: string;
  schedule_ref: string | null;
  amount_awarded_paise: string;
  status: string;
  due_by: string | null;
  award_no: string;
  award_type: 'LAND' | 'RNR';
  disbursements: Disbursement[];
}

export interface FamilyMoney {
  family: {
    id: string;
    project_id: string;
    head_person_id: string;
    authorised_recipient_person_id: string | null;
    head_name: string;
    phone_masked: string | null;
    project_code: string;
    project_name: string;
    is_displaced: boolean;
    is_sc_st: boolean;
    has_passkey: boolean;
  };
  money: {
    assessed_paise: string;
    sanctioned_paise: string;
    disbursed_paise: string;
    acknowledged_paise: string;
    unconfirmed_paise: string;
    held_paise: string;
    deposited_paise: string;
  };
  entitlements: MoneyEntitlement[];
  estimatedInterestLiability: { estimated_interest_paise: string } | null;
  /** The server sends the exact label (G2) — render it, don't retype it. */
  label: string;
}

export interface TokenLink {
  url: string;
  token: string;
  expiresInMinutes?: number;
}

export interface GateResult {
  projectParcelId: string;
  projectId: string;
  parcelId: string;
  status: string;
  allowed: boolean;
  failures: Array<{ code: string; message: string }>;
  families: number;
  entitlements: number;
}

export const useFamilyMoney = (familyId: string) =>
  useQuery({ queryKey: ['family-money', familyId], queryFn: () => api<FamilyMoney>(`/families/${familyId}/money`) });

export const useEnrolLink = () =>
  useMutation({
    mutationFn: (personId: string) => api<TokenLink>(`/persons/${personId}/webauthn/enrol-link`, { method: 'POST' }),
  });

export const useAckLink = () =>
  useMutation({
    mutationFn: (disbursementId: string) => api<TokenLink>(`/disbursements/${disbursementId}/ack-link`, { method: 'POST' }),
  });

export const usePassbookLink = () =>
  useMutation({
    mutationFn: (familyId: string) => api<TokenLink>(`/families/${familyId}/passbook/issue`, { method: 'POST' }),
  });

export const usePossessionGate = (projectParcelId: string) =>
  useQuery({
    queryKey: ['possession-gate', projectParcelId],
    queryFn: () => api<GateResult>(`/project-parcels/${projectParcelId}/possession-gate`),
  });

export interface PossessionBody {
  panchnamaDocumentId: string;
  noticeDocumentId?: string | null;
  possessionCertificateDocumentId?: string | null;
  handoverDocumentId?: string | null;
  vacationCertificateDocumentId?: string | null;
  witnesses: Array<{ name: string; role?: string }>;
  lat?: number | null;
  lng?: number | null;
}

export function useTakePossession(projectParcelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PossessionBody) =>
      api(`/project-parcels/${projectParcelId}/possession`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['possession-gate', projectParcelId] }),
  });
}

/**
 * Relative path of a token link. The API builds links on PUBLIC_BASE_URL (the tunnel in a demo) —
 * the QR must carry that full URL so the beneficiary's phone can open it; this is only for
 * opening the same page in this browser.
 */
export const localPath = (url: string) => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};
