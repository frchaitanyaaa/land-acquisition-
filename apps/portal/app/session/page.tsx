'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiProblem, type Me } from '@/lib/api';

/**
 * Who am I, and through which post? Switching post changes what the API returns immediately:
 * RLS scope, redaction and role checks all follow the active post (G19, §34 beat 7).
 */
export default function SessionPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMe(await api<Me>('/auth/me'));
    } catch (err) {
      if (err instanceof ApiProblem && err.status === 401) router.replace('/login');
      else setError('Could not load your session.');
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function switchTo(postId: string) {
    setMe(await api<Me>('/auth/switch-post', { method: 'POST', body: JSON.stringify({ postId }) }));
  }

  async function signOut() {
    await api('/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  if (error) return <p className="text-red-700">{error}</p>;
  if (!me) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{me.user.fullName}</h1>
          <p className="text-sm text-slate-600">{me.user.email}</p>
        </div>
        <button onClick={signOut} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
          Sign out
        </button>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Acting as</h2>
        <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {me.posts.map((p) => {
            const active = p.id === me.activePost.id;
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="font-medium">{p.designation}</p>
                  <p className="text-xs text-slate-500">
                    {p.role} · {p.level}
                    {p.districtCode ? ` · ${p.districtCode}` : p.stateCode ? ` · state ${p.stateCode}` : ''}
                  </p>
                </div>
                {active ? (
                  <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-900">Active</span>
                ) : (
                  <button
                    onClick={() => void switchTo(p.id)}
                    className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900"
                  >
                    Switch
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
