import { useRef, useState, type FormEvent } from 'react';
import { Button, ErrorText, Field, inputClass } from '../components/ui';
import { ApiProblem, OfflineError } from '../lib/api';
import { refreshAssignments } from '../lib/offline-pack';
import { go } from '../lib/router';
import { login } from '../lib/session';

/** Synthetic seed account (G18), offered only when the API reports DEMO_MODE. */
const DEMO = { email: 'talathi.khedshivapur@bhoomisetu.local', password: 'bhoomisetu-demo' };

/** §16.2 screen 1 — online only. Same POST /auth/login contract as the portal's login form. */
export function Login({ demoMode = false }: { demoMode?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await login(String(form.get('email')), String(form.get('password')));
      await refreshAssignments().catch(() => undefined);
      go('assignments');
    } catch (err) {
      setError(
        err instanceof ApiProblem
          ? err.message
          : err instanceof OfflineError
            ? 'You are offline. Sign in once while online; after that the app works without network.'
            : 'Could not reach the server.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <div className="h-1 bg-gradient-to-r from-[#ff9933] via-white to-[#138808]" aria-hidden />
      <main className="flex flex-1 flex-col justify-center px-5 py-10">
        <div className="mx-auto w-full max-w-sm">
          <p className="text-2xl font-bold tracking-tight text-[#13245a]">BhoomiSetu</p>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Field verification</p>

          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-slate-900">Sign in</h1>
            <p className="mt-1 text-sm text-slate-600">
              Sign in once while online. Surveys, photos and notices are then captured without network and synced later.
            </p>
            <form onSubmit={submit} className="mt-5 space-y-4">
              <Field label="Email">
                <input ref={email} name="email" type="email" required autoComplete="username" className={inputClass} />
              </Field>
              <Field label="Password">
                <input
                  ref={password}
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className={inputClass}
                />
              </Field>
              <ErrorText>{error}</ErrorText>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </div>

          {demoMode && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
              <span>
                Demo account (synthetic)
                <span className="mt-0.5 block break-all font-mono">{DEMO.email}</span>
              </span>
              <button
                type="button"
                className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1.5 font-medium hover:bg-amber-100"
                onClick={() => {
                  if (email.current) email.current.value = DEMO.email;
                  if (password.current) password.current.value = DEMO.password;
                }}
              >
                Use
              </button>
            </div>
          )}
        </div>
      </main>
      <footer className="px-5 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-[11px] text-slate-500">
        Ministry of Rural Development · Prototype for SIH 26016
      </footer>
    </div>
  );
}
