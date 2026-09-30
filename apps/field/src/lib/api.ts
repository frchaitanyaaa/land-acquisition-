// Field API client (§13). Same auth contract as the portal (POST /auth/login, POST /auth/refresh);
// the difference is only transport: the access token lives in memory and goes out as a Bearer
// token, and the refresh token stays in the httpOnly cookie the API sets on /api/v1/auth.
// DOM-free: the service worker builds its own client from this for Background Sync.

export const API_BASE = '/api/v1';

/** An RFC 7807 problem returned by the API. */
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

/** The request never reached the server (airplane mode, tunnel down). */
export class OfflineError extends Error {
  constructor() {
    super('No network connection.');
  }
}

const NO_RETRY = new Set(['/auth/login', '/auth/refresh', '/auth/logout']);

/**
 * The API rotates the refresh token on every use and revokes the whole family if a rotated token is
 * presented again (tokens.service.ts). The page and the service worker share one cookie, so their
 * refreshes must never overlap: a cross-context Web Lock serialises them, and each one then sends
 * the cookie the previous one just set.
 */
async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks)
    return await navigator.locks.request('bhoomisetu-auth-refresh', () => fn());
  return fn();
}

export interface ApiClient {
  readonly token: string | null;
  setToken(token: string | null): void;
  /** Exchanges the refresh cookie for a new access token. false = the session is gone (401/403); throws when offline. */
  refresh(): Promise<boolean>;
  request(path: string, init?: RequestInit): Promise<Response>;
  json<T>(path: string, init?: RequestInit): Promise<T>;
}

export async function problemFrom(res: Response): Promise<ApiProblem> {
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* not JSON */
  }
  const { code, detail, type: _t, title: _ti, status: _s, instance: _i, requestId: _r, ...extra } = body;
  return new ApiProblem(
    res.status,
    typeof code === 'string' ? code : 'ERROR',
    typeof detail === 'string' ? detail : res.statusText || `HTTP ${res.status}`,
    extra,
  );
}

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, { ...init, credentials: 'include' });
  } catch {
    throw new OfflineError();
  }
}

export function createApiClient(): ApiClient {
  let token: string | null = null;
  let refreshing: Promise<boolean> | null = null;

  const client: ApiClient = {
    get token() {
      return token;
    },
    setToken(t) {
      token = t;
    },
    refresh() {
      refreshing ??= exclusive(async () => {
        const res = await send('/auth/refresh', { method: 'POST' });
        if (res.status === 401 || res.status === 403) {
          token = null;
          return false;
        }
        if (!res.ok) throw await problemFrom(res);
        const body = (await res.json()) as { accessToken: string };
        token = body.accessToken;
        return true;
      }).finally(() => {
        refreshing = null;
      });
      return refreshing;
    },
    async request(path, init = {}) {
      const call = () => {
        const headers = new Headers(init.headers);
        if (token) headers.set('authorization', `Bearer ${token}`);
        if (typeof init.body === 'string' && !headers.has('content-type')) headers.set('content-type', 'application/json');
        return send(path, { ...init, headers });
      };
      let res = await call();
      if (res.status === 401 && !NO_RETRY.has(path) && (await client.refresh())) res = await call();
      return res;
    },
    async json<T>(path: string, init: RequestInit = {}) {
      const res = await client.request(path, init);
      if (!res.ok) throw await problemFrom(res);
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    },
  };
  return client;
}
