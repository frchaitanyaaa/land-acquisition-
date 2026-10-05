'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiProblem, type Me } from '@/lib/api';
import { DEMO_PASSWORD, demoEmail, LOGIN_ROLES } from '@/lib/demo-accounts';
import { homeFor } from '@/lib/roles';

const input =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1f3c8f] focus:outline-none focus:ring-2 focus:ring-[#1f3c8f]/20';

/**
 * Officer sign-in, role first (CLAUDE.md §25): "Login as" lists roles, never a person's posts; the server signs
 * into the user's post with that role (POST /auth/login {role}) and refuses if they hold none. In demo mode,
 * choosing a role fills in that role's synthetic account.
 */
export function LoginForm({ demo = false }: { demo?: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = LOGIN_ROLES.find((r) => r.role === role);

  // ?role=COLLECTOR preselects a role (and, in demo mode, its account).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('role');
    if (q && LOGIN_ROLES.some((r) => r.role === q)) pick(q);
    // Runs once on mount.
  }, [demo]);

  function pick(next: string) {
    setRole(next);
    setError(null);
    const r = LOGIN_ROLES.find((x) => x.role === next);
    if (demo && r && !r.fieldApp) {
      setEmail(demoEmail(r.demo));
      setPassword(DEMO_PASSWORD);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!chosen || chosen.fieldApp) return;
    setBusy(true);
    setError(null);
    try {
      const session = await api<Me>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, role }),
      });
      // A new sign-in changes user, post, RLS scope and sidebar: nothing cached from a previous session may
      // survive, or the shell shows the old post until a reload.
      qc.clear();
      router.push(homeFor(session.activePost));
    } catch (err) {
      setError(
        err instanceof ApiProblem
          ? err.code === 'ROLE_NOT_HELD'
            ? `This account does not hold a ${chosen.label} post. Choose the role you were assigned.`
            : err.message
          : 'Could not reach the server.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium text-slate-800">
        Login as
        <select required value={role} onChange={(e) => pick(e.target.value)} className={input}>
          <option value="" disabled>
            Select your role…
          </option>
          {LOGIN_ROLES.map((r) => (
            <option key={r.role} value={r.role}>
              {r.label}
            </option>
          ))}
        </select>
        {chosen && <span className="mt-1 block text-xs font-normal text-slate-500">{chosen.hint}</span>}
      </label>

      {chosen?.fieldApp ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Field officers work on the mobile field app, which also works offline.
          <a
            href="/field"
            className="mt-3 flex w-full items-center justify-center rounded-lg bg-[#1f3c8f] px-4 py-2.5 font-semibold text-white hover:bg-[#182f72]"
          >
            Open the field app →
          </a>
          {demo && (
            <p className="mt-2 text-xs text-slate-500">
              Demo: <code>{demoEmail(chosen.demo)}</code> · password <code>{DEMO_PASSWORD}</code>
            </p>
          )}
        </div>
      ) : (
        <>
          <label className="block text-sm font-medium text-slate-800">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="name@department.gov.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
            />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            Password
            <span className="relative block">
              <input
                name="password"
                type={show ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${input} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute inset-y-0 right-2 my-auto h-7 rounded px-2 text-xs font-medium text-[#1f3c8f] hover:bg-slate-100"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? 'Hide' : 'Show'}
              </button>
            </span>
          </label>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !role}
            className="flex w-full items-center justify-center rounded-lg bg-[#1f3c8f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#182f72] disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Login as officer →'}
          </button>
          {demo && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <span className="font-semibold">Demo:</span> choose any role and its synthetic account is filled in —
              just press Login.
            </p>
          )}
        </>
      )}
    </form>
  );
}
