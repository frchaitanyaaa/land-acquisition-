'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { publicApi, type Village } from '@/lib/portal-public-api';

export interface VillagePickerText {
  label: string;
  placeholder: string;
  none: string;
  loading: string;
  chosen: (village: string) => string;
  change: string;
  error: (err: unknown) => string;
}

/** Shows the village's local-script name next to the English one when the UI is not English. */
export function villageName(v: Pick<Village, 'name' | 'name_local'>, localFirst: boolean): string {
  if (!v.name_local || v.name_local === v.name) return v.name;
  return localFirst ? `${v.name_local} (${v.name})` : `${v.name} (${v.name_local})`;
}

/**
 * LGD village search over GET /public/villages (CLAUDE.md §25). Debounced; needs 2+ characters.
 */
export function VillagePicker({
  value,
  onChange,
  localFirst,
  text,
}: {
  value: Village | null;
  onChange: (v: Village | null) => void;
  localFirst: boolean;
  text: VillagePickerText;
}) {
  const inputId = useId();
  const listId = useId();
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setQ(typed.trim()), 250);
    return () => clearTimeout(handle);
  }, [typed]);

  const villages = useQuery({
    queryKey: ['public', 'villages', q],
    queryFn: () => publicApi.villages(q),
    enabled: !value && q.length >= 2,
    staleTime: 5 * 60_000,
  });

  if (value) {
    return (
      <div className="space-y-1">
        <span className="block text-sm text-slate-700">{text.label}</span>
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-teal-600 bg-teal-50 px-3 py-2 text-sm">
          <span className="font-medium text-slate-900">
            {text.chosen(villageName(value, localFirst))}
            <span className="block text-xs font-normal text-slate-600">
              {value.sub_district}, {value.district}, {value.state}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setTyped('');
            }}
            className="ml-auto rounded-md border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-100"
          >
            {text.change}
          </button>
        </div>
      </div>
    );
  }

  const rows = villages.data?.data ?? [];
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm text-slate-700">
        {text.label}
      </label>
      <input
        id={inputId}
        type="search"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={text.placeholder}
        autoComplete="off"
        aria-controls={listId}
        className="input"
      />
      <div id={listId} aria-live="polite" className="text-sm">
        {q.length >= 2 && villages.isFetching && <p className="py-2 text-slate-500">{text.loading}</p>}
        {villages.isError && <p className="py-2 text-red-700">{text.error(villages.error)}</p>}
        {q.length >= 2 && villages.isSuccess && rows.length === 0 && <p className="py-2 text-slate-600">{text.none}</p>}
        {rows.length > 0 && (
          <ul className="mt-1 max-h-72 divide-y divide-slate-100 overflow-auto rounded-md border border-slate-200 bg-white">
            {rows.map((v) => (
              <li key={v.code}>
                <button
                  type="button"
                  onClick={() => onChange(v)}
                  className="block w-full px-3 py-2 text-left hover:bg-teal-50 focus-visible:bg-teal-50 focus-visible:outline-none"
                >
                  <span className="font-medium text-slate-900">{villageName(v, localFirst)}</span>
                  <span className="block text-xs text-slate-600">
                    {v.sub_district}, {v.district}, {v.state}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
