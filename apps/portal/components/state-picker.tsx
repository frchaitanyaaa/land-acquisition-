'use client';

import { useRouter } from 'next/navigation';
import { useNationalDashboard } from '@/lib/dashboards-api';

/**
 * Which state the state dashboard shows. The list is the states the post may see (the national dashboard
 * is RLS-scoped, G13): every state for a national post, only its own for a state post — then it is a label.
 */
export function StatePicker({
  current,
  dark = false,
}: {
  current: string;
  /** On the navy header band. */ dark?: boolean;
}) {
  const router = useRouter();
  const { data } = useNationalDashboard();
  const states = [...(data?.states ?? [])].sort((a, b) => a.state_name.localeCompare(b.state_name));
  if (states.length <= 1) {
    const only = states[0];
    if (!only) return null;
    return (
      <p
        className={`rounded-md border px-3 py-2 text-sm ${dark ? 'border-white/30 bg-white/10 text-white' : 'border-slate-300 bg-white'}`}
      >
        <span className={`font-medium ${dark ? 'text-white' : 'text-slate-700'}`}>State:</span> {only.state_name}
        <span className={dark ? 'text-white/70' : 'text-slate-500'}> · your jurisdiction</span>
      </p>
    );
  }
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className={`font-medium ${dark ? 'text-white' : 'text-slate-700'}`}>State</span>
      <select
        value={current}
        onChange={(e) => router.push(`/state/${e.target.value}`)}
        className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-[#1f3c8f] focus:outline-none focus:ring-1 focus:ring-[#1f3c8f]"
      >
        {states.map((s) => (
          <option key={s.state_code} value={s.state_code}>
            {s.state_name} · {s.projects} project{s.projects === 1 ? '' : 's'}
          </option>
        ))}
      </select>
    </label>
  );
}
