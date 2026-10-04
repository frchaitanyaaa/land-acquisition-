'use client';

import { useState } from 'react';
import { api, ApiProblem, type Me, type Post } from '@/lib/api';
import { jurisdictionText, roleLabel } from '@/lib/roles';

/**
 * Lists the posts a user holds and switches the active one through POST /auth/switch-post.
 * Switching changes what the API returns at once (RLS scope, redaction, role checks — G13, G19);
 * this component only asks for the switch, it never filters data itself.
 *
 * variant="switch": the active post is marked, the others get a Switch button (session page).
 * variant="choose": every post gets a button, the active one included (post selection after sign-in).
 */
export function PostSwitcher({
  posts,
  activePostId,
  variant = 'switch',
  onChosen,
}: {
  posts: Post[];
  activePostId: string;
  variant?: 'switch' | 'choose';
  /** Called after the switch succeeded (or straight away when the active post is chosen). */
  onChosen: (post: Post, me: Me | null) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(post: Post) {
    if (busyId) return;
    setError(null);
    if (post.id === activePostId) {
      onChosen(post, null);
      return;
    }
    setBusyId(post.id);
    try {
      const me = await api<Me>('/auth/switch-post', { method: 'POST', body: JSON.stringify({ postId: post.id }) });
      onChosen(me.activePost, me);
    } catch (err) {
      setError(err instanceof ApiProblem ? err.message : 'Could not reach the server.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {posts.map((p) => {
          const active = p.id === activePostId;
          const showButton = variant === 'choose' || !active;
          return (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{p.designation}</p>
                <p className="text-xs text-slate-500">
                  {roleLabel(p.role)}, {jurisdictionText(p)}
                </p>
              </div>
              {active && variant === 'switch' && (
                <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-900">Active</span>
              )}
              {showButton && (
                <button
                  type="button"
                  onClick={() => void choose(p)}
                  disabled={busyId !== null}
                  aria-label={`${variant === 'choose' ? 'Continue as' : 'Switch to'} ${p.designation}`}
                  className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-60"
                >
                  {busyId === p.id ? 'Switching…' : variant === 'choose' ? 'Continue' : 'Switch'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
