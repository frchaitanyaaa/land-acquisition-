import { useSyncExternalStore } from 'react';
import { createApiClient } from './api';

/** The page's API client. The access token only ever lives in this object's memory. */
export const api = createApiClient();

export interface Post {
  id: string;
  designation: string;
  role: string;
  level: string;
}

export interface Profile {
  user: { id: string; fullName: string; email: string };
  activePost: Post;
}

interface LoginResponse extends Profile {
  accessToken: string;
  expiresIn: number;
  posts: Post[];
}

// Who is signed in is cached (not the token) so the app still opens in airplane mode after a
// reload; a fresh access token is fetched through the refresh cookie whenever the network is back.
const KEY = 'bhoomisetu.field.profile';
const listeners = new Set<() => void>();
let profile: Profile | null = readProfile();

function readProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

function setProfile(p: Profile | null) {
  profile = p;
  if (p) localStorage.setItem(KEY, JSON.stringify(p));
  else localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

export function useProfile(): Profile | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => profile,
  );
}

/** Same endpoint and body as the portal's login form (apps/portal/app/login/login-form.tsx). */
export async function login(email: string, password: string): Promise<Profile> {
  const r = await api.json<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  api.setToken(r.accessToken);
  const p: Profile = { user: r.user, activePost: r.activePost };
  setProfile(p);
  return p;
}

/** On start-up while online: get an access token from the refresh cookie. false = must sign in again. */
export async function resumeSession(): Promise<boolean> {
  const ok = await api.refresh();
  if (!ok) setProfile(null);
  return ok;
}

export async function logout(): Promise<void> {
  try {
    await api.request('/auth/logout', { method: 'POST' });
  } catch {
    /* offline — the cookie expires on its own */
  }
  api.setToken(null);
  setProfile(null);
}
