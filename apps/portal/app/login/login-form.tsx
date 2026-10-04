'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { PostSwitcher } from '@/components/post-switcher';
import { api, ApiProblem, type Me, type Post } from '@/lib/api';
import { homeFor } from '@/lib/roles';

/** Only passed by the server page when DEMO_MODE=true (G18: these accounts are synthetic). */
export interface DemoLogin {
  password: string;
  accounts: Array<{ email: string; label: string }>;
}

/**
 * Step 1: email + password → POST /auth/login (signs in to the first post held).
 * Step 2: if the user holds more than one post, they choose one; a different choice goes through
 * POST /auth/switch-post. Then the user lands on that post's home screen (lib/roles.ts).
 */
export function LoginForm({ demo = null }: { demo?: DemoLogin | null }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  // Landing page "Sign in →" links pass ?email=; in demo mode the demo password is filled in too.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('email');
    if (!q) return;
    setEmail(q);
    if (demo) setPassword(demo.password);
  }, [demo]);

  function go(post: Post) {
    router.push(homeFor(post));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await api<Me>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (session.posts.length > 1) setMe(session);
      else go(session.activePost);
    } catch (err) {
      setError(err instanceof ApiProblem ? err.message : 'Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  if (me) {
    return (
      <div className="space-y-4">
        <div>
          <p className="font-medium text-slate-900">Signed in as {me.user.fullName}</p>
          <p className="text-sm text-slate-600">
            You hold {me.posts.length} posts. Choose the post you are acting in now. What you can see and do follows
            this post, and you can switch later from Session.
          </p>
        </div>
        <PostSwitcher posts={me.posts} activePostId={me.activePost.id} variant="choose" onChosen={(post) => go(post)} />
      </div>
    );
  }

  const inputClass =
    'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600';

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-slate-700">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {demo && demo.accounts.length > 0 && (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-950">
            Demo accounts (synthetic) — pick one to fill in. Password <code>{demo.password}</code>.
          </p>
          <div className="flex flex-wrap gap-2">
            {demo.accounts.map((acct) => (
              <button
                key={acct.email}
                type="button"
                title={acct.email}
                onClick={() => {
                  setEmail(acct.email);
                  setPassword(demo.password);
                }}
                className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs text-amber-950 hover:bg-amber-100"
              >
                {acct.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
