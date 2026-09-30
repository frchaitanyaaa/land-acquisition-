'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, type Me } from '@/lib/api';

/**
 * Post switcher in the portal shell (§34 beat 7). Switching changes what the API returns at once —
 * RLS scope, redaction and role checks follow the active post — so every cached query is dropped.
 */
export function RoleSwitcher() {
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data: me, isError } = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/auth/me'), retry: false });

  if (isError || !me)
    return (
      <Link href="/login" className="text-slate-700 hover:text-slate-950">
        Sign in
      </Link>
    );

  async function switchTo(postId: string) {
    setBusy(true);
    try {
      await api<Me>('/auth/switch-post', { method: 'POST', body: JSON.stringify({ postId }) });
      await qc.resetQueries();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="flex items-center gap-2 text-xs text-slate-500">
      <span className="hidden sm:inline">Acting as</span>
      <select
        value={me.activePost.id}
        disabled={busy || me.posts.length < 2}
        onChange={(e) => void switchTo(e.target.value)}
        className="max-w-56 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800"
      >
        {me.posts.map((p) => (
          <option key={p.id} value={p.id}>
            {p.designation} · {p.level}
          </option>
        ))}
      </select>
    </label>
  );
}
