'use client';

/**
 * Browser calls to the public API (/api/v1/public, CLAUDE.md §25) through the portal's /api rewrite.
 * Cookies are deliberately omitted: a public page must see exactly what an anonymous citizen sees,
 * even when an officer has the portal open. What may be shown is decided by the public_* views
 * behind these endpoints (G22, G13) — never by this file.
 */
export class PublicProblem extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    detail: string,
  ) {
    super(detail);
  }
}

export interface PublicMeta {
  provenance: string;
  asOf: string;
}

export interface PublicList<T> extends PublicMeta {
  data: T[];
}

export interface Village {
  code: string;
  name: string;
  name_local: string | null;
  sub_district: string;
  district: string;
  state: string;
}

/** One row of public_parcel_status. */
export interface ParcelStatus {
  village_code: string;
  village_name: string;
  village_name_local: string | null;
  survey_number: string;
  sub_division: string | null;
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

/** One row of public_notices. */
export interface PublicNotice {
  document_id: string;
  doc_type: string;
  title: string;
  language: string | null;
  published_at: string;
  sha256: string | null;
  project_code: string;
  project_name: string;
  state_code: string | null;
}

export interface ObjectionInput {
  projectCode: string;
  villageCode: string;
  surveyNo: string;
  name?: string;
  body: string;
  language: 'en' | 'hi' | 'mr';
}

export interface ObjectionFiled extends PublicMeta {
  filed: boolean;
  reference: string;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1/public${path}`, {
      ...init,
      credentials: 'omit',
      headers: { 'content-type': 'application/json', ...init.headers },
    });
  } catch {
    throw new PublicProblem(0, 'NETWORK', '');
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    throw new PublicProblem(
      res.status,
      typeof body.code === 'string' ? body.code : 'ERROR',
      typeof body.detail === 'string' ? body.detail : '',
    );
  }
  return body as T;
}

function qs(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const publicApi = {
  villages: (q: string) => call<PublicList<Village>>(`/villages${qs({ q })}`),
  parcels: (village: string, survey?: string) => call<PublicList<ParcelStatus>>(`/parcels${qs({ village, survey })}`),
  notices: (project?: string) => call<PublicList<PublicNotice>>(`/notices${qs({ project })}`),
  fileObjection: (input: ObjectionInput) =>
    call<ObjectionFiled>('/objections', { method: 'POST', body: JSON.stringify(input) }),
};

/** The statutory clock's "now" from GET /health (public). Footer fallback when a page made no data call. */
export async function clockNow(): Promise<string | null> {
  try {
    const res = await fetch('/api/v1/health', { credentials: 'omit', cache: 'no-store' });
    if (!res.ok) return null;
    const h = (await res.json()) as { clock?: { now?: string } };
    return h.clock?.now ?? null;
  } catch {
    return null;
  }
}
