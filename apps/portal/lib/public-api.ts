'use client';

import { ApiProblem } from '@/lib/api';

// Public, unauthenticated calls (§25, G22). No cookies, no refresh-and-retry: the beneficiary's
// phone has no officer session and must never borrow one.

export async function publicApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/v1/public${path}`, {
    ...init,
    credentials: 'omit',
    headers: { 'content-type': 'application/json', ...init.headers },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const { code, detail, ...extra } = body;
    throw new ApiProblem(res.status, (code as string) ?? 'ERROR', (detail as string) ?? res.statusText, extra);
  }
  return body as T;
}

export interface Meta {
  provenance: string;
  asOf: string;
}

export interface PublicParcel {
  village_code: string;
  village_name: string;
  village_name_local: string | null;
  survey_no: string;
  project_code: string;
  project_name: string;
  project_status: string;
  current_stage: string | null;
  parcel_status: string;
  affected_pct: string | number | null;
  transfer_frozen: boolean;
  district_name: string;
  last_public_notice_at: string | null;
}

export interface PublicNotice {
  document_id: string;
  doc_type: string;
  title: string;
  language: string | null;
  published_at: string;
  sha256: string;
  project_code: string;
  project_name: string;
}

export interface Village {
  code: string;
  name: string;
  name_local: string | null;
  sub_district: string;
  district: string;
  state: string;
}

export interface AckInfo {
  amountPaise: string;
  headCode: string;
  paidOn: string | null;
  paymentStatus: 'PAID' | 'PAYMENT_IN_PROCESS';
  projectCode: string;
  projectName: string;
  recipientFirstName: string;
  acknowledged: boolean;
  canUsePasskey: boolean;
  expired: boolean;
  used: boolean;
}

export interface Passbook {
  family: { headFirstName: string; projectCode: string; projectName: string; isDisplaced: boolean };
  entitlements: Array<{
    headCode: string;
    amountPaise: string;
    status: string;
    dueBy: string | null;
    paidPaise: string;
    acknowledged: boolean;
  }>;
  annuity: { paid: number; total: number; nextDue: string | null } | null;
  site: { name: string; readinessPct: number | null } | null;
  contact: string;
  asOf: string;
}
