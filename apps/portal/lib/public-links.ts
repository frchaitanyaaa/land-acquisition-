/**
 * Token pages built by WS3 (passbook and acknowledgement — CLAUDE.md §19, §21.2).
 * The citizen and grievance hubs only link to them; they are not rebuilt here.
 * If WS3 mounted them at different paths, change them here only.
 */
export const WS3_PATHS = {
  passbook: '/passbook',
  acknowledge: '/ack',
} as const;

export type TokenPage = keyof typeof WS3_PATHS;

/** Same shape the API accepts for tokens (public.controller.ts). */
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/**
 * Accepts what a citizen is likely to paste — the full SMS link, a path, or the bare code — and
 * returns the token, or null. Nothing is sent to the server here; WS3's page validates the token.
 */
export function extractToken(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (TOKEN.test(raw)) return raw;
  let path = raw;
  try {
    const u = new URL(raw, 'http://local.invalid');
    const q = u.searchParams.get('token');
    if (q && TOKEN.test(q)) return q;
    path = u.pathname;
  } catch {
    /* fall through to path parsing */
  }
  const last = path.split('/').filter(Boolean).pop() ?? '';
  return TOKEN.test(last) ? last : null;
}

export function tokenHref(page: TokenPage, token: string): string {
  return `${WS3_PATHS[page]}/${encodeURIComponent(token)}`;
}
