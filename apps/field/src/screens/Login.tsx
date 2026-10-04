import { useState, type FormEvent } from 'react';
import { Button, ErrorText, Field, inputClass } from '../components/ui';
import { ApiProblem, OfflineError } from '../lib/api';
import { refreshAssignments } from '../lib/offline-pack';
import { go } from '../lib/router';
import { login } from '../lib/session';

/** §16.2 screen 1 — online only. Same POST /auth/login contract as the portal's login form. */
export function Login() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <div className="flex min-h-full flex-col justify-center bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-teal-800">BhoomiSetu Field</h1>
          <p className="mt-1 text-sm text-slate-600">Sign in while online. Capture then works in airplane mode.</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Email">
            <input name="email" type="email" required autoComplete="username" className={inputClass} />
          </Field>
          <Field label="Password">
            <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
