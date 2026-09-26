'use client';

/** An RFC 7807 problem returned by the API. */
export class ApiProblem extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    detail: string,
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
  const body = (await res.json()) as T & { code?: string; detail?: string };
  if (!res.ok) throw new ApiProblem(res.status, body.code ?? 'ERROR', body.detail ?? res.statusText);
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
