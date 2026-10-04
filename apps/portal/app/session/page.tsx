'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PostSwitcher } from '@/components/post-switcher';
import { api, ApiProblem, type Me } from '@/lib/api';
import { homeFor } from '@/lib/roles';

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

  async function signOut() {
    await api('/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  if (error) return <p className="text-red-700">{error}</p>;
  if (!me) return <p className="text-slate-500">Loading…</p>;

  const home = homeFor(me.activePost);

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
        <div className="mt-2">
          <PostSwitcher
            posts={me.posts}
            activePostId={me.activePost.id}
            onChosen={(_post, next) => {
              if (next) setMe(next);
            }}
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-3 text-sm">
        {home !== '/session' && (
          <Link href={home} className="rounded-md bg-teal-700 px-3 py-1.5 font-medium text-white hover:bg-teal-800">
            Open my dashboard
          </Link>
        )}
        {/* Beat 7: the public pages call the API without cookies, so they show only what public_* views allow. */}
        <Link href="/portal" className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100">
          View the public portal (as a citizen)
        </Link>
      </div>
    </div>
  );
}
