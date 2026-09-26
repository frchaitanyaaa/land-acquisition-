import type { CookieOptions, Response } from 'express';
import { env } from '../config/env';

export const ACCESS_COOKIE = 'bs_access';
export const REFRESH_COOKIE = 'bs_refresh';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

/** The refresh cookie is only ever sent to the auth endpoints. */
const REFRESH_PATH = '/api/v1/auth';

const base = (): CookieOptions => ({ httpOnly: true, sameSite: 'lax', secure: env().NODE_ENV === 'production' });

export function setSessionCookies(res: Response, session: { accessToken: string; refreshToken: string }): void {
  res.cookie(ACCESS_COOKIE, session.accessToken, { ...base(), path: '/', maxAge: ACCESS_TTL_SECONDS * 1000 });
  res.cookie(REFRESH_COOKIE, session.refreshToken, { ...base(), path: REFRESH_PATH, maxAge: REFRESH_TTL_SECONDS * 1000 });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...base(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base(), path: REFRESH_PATH });
}
