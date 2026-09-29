'use client';

/** An RFC 7807 problem returned by the API. `extra` carries any additional fields the problem
 * body sent (e.g. GUARD_FAILED's `failures[]`, §13). */
export class ApiProblem extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    detail: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(detail);
  }
}

const NO_RETRY = new Set(['/auth/login', '/auth/refresh', '/auth/logout']);

/**
 * Browser fetch to the API through the portal's /api rewrite. Auth rides in httpOnly cookies; on a
 * 401 it refreshes once and retries.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const call = () =>
    fetch(`/api/v1${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...init.headers },
    });

  let res = await call();
  if (res.status === 401 && !NO_RETRY.has(path)) {
    const refreshed = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
    if (refreshed.ok) res = await call();
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json()) as T & { code?: string; detail?: string; [k: string]: unknown };
  if (!res.ok) {
    const { code, detail, type: _type, title: _title, status: _status, instance: _instance, requestId: _requestId, ...extra } = body as Record<string, unknown>;
    throw new ApiProblem(res.status, (code as string) ?? 'ERROR', (detail as string) ?? res.statusText, extra);
  }
  return body;
}

/** Multipart upload (documents, hearing audio, …) — never set content-type manually; the browser
 * derives the correct multipart boundary from the FormData instance. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const call = () => fetch(`/api/v1${path}`, { method: 'POST', credentials: 'include', body: form });
  let res = await call();
  if (res.status === 401) {
    const refreshed = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
    if (refreshed.ok) res = await call();
  }
  const body = (await res.json()) as T & { code?: string; detail?: string; [k: string]: unknown };
  if (!res.ok) {
    const { code, detail, type: _type, title: _title, status: _status, instance: _instance, requestId: _requestId, ...extra } = body as Record<string, unknown>;
    throw new ApiProblem(res.status, (code as string) ?? 'ERROR', (detail as string) ?? res.statusText, extra);
  }
  return body;
}

export interface Post {
  id: string;
  designation: string;
  role: string;
  level: string;
  stateCode: string | null;
  districtCode: string | null;
}

export interface Me {
  user: { id: string; fullName: string; email: string };
  activePost: Post;
  posts: Post[];
}
