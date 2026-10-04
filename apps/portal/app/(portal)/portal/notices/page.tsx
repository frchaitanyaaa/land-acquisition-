'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useId, useState, type FormEvent } from 'react';
import { publicApi } from '@/lib/portal-public-api';
import { usePortal } from '../portal-shell';

export default function NoticesPage() {
  return (
    <Suspense>
      <Notices />
    </Suspense>
  );
}

/**
 * Published s.11 / s.19 / R&R scheme notices from public_notices (CLAUDE.md §25, G22).
 * There is no public document-download endpoint yet, so each notice shows its SHA-256 fingerprint
 * and where to get a copy.
 */
function Notices() {
  const portal = usePortal();
  const { t, label, formatDate, reportAsOf } = portal;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const project = (params.get('project') ?? '').trim().slice(0, 40);
  const notices = useQuery({
    queryKey: ['public', 'notices', project],
    queryFn: () => publicApi.notices(project || undefined),
  });
  useEffect(() => reportAsOf(notices.data?.asOf), [notices.data, reportAsOf]);

  const rows = notices.data?.data ?? [];

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl font-semibold text-slate-950">{t('notices.title')}</h1>
        <p className="text-slate-700">{t('notices.intro')}</p>
      </div>

      <NoticeFilter
        key={project}
        initial={project}
        onApply={(code) => router.push(code ? `${pathname}?project=${encodeURIComponent(code)}` : pathname)}
      />

      <section aria-live="polite" className="space-y-3">
        {notices.isFetching && <p className="text-slate-500">{t('common.loading')}</p>}
        {notices.isError && (
          <p role="alert" className="text-red-700">
            {portal.errorText(notices.error)}
          </p>
        )}
        {notices.isSuccess && !notices.isFetching && rows.length === 0 && (
          <p className="rounded-md border border-slate-200 bg-white p-4 text-slate-700">{t('notices.empty')}</p>
        )}
        {rows.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">{t('notices.type')}</th>
                    <th scope="col" className="px-4 py-2 font-medium">{t('notices.docTitle')}</th>
                    <th scope="col" className="px-4 py-2 font-medium">{t('parcel.project')}</th>
                    <th scope="col" className="px-4 py-2 font-medium">{t('notices.published')}</th>
                    <th scope="col" className="px-4 py-2 font-medium">{t('notices.language')}</th>
                    <th scope="col" className="px-4 py-2 font-medium">{t('notices.fingerprint')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((n) => (
                    <tr key={n.document_id} className="align-top">
                      <td className="px-4 py-3 font-medium text-slate-900">{label('docType', n.doc_type)}</td>
                      <td className="px-4 py-3 text-slate-800">{n.title}</td>
                      <td className="px-4 py-3 text-slate-800">
                        {n.project_name}
                        <span className="block text-xs text-slate-500">{n.project_code}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-800">{formatDate(n.published_at)}</td>
                      <td className="px-4 py-3 text-slate-800">{n.language ?? t('common.dash')}</td>
                      <td className="px-4 py-3">
                        {n.sha256 ? (
                          <code className="break-all text-xs text-slate-700" title={n.sha256}>
                            {n.sha256.slice(0, 16)}…
                          </code>
                        ) : (
                          t('common.dash')
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="max-w-2xl text-sm text-slate-600">{t('notices.copy')}</p>
          </>
        )}
      </section>
    </div>
  );
}

/** Keyed by the current filter, so it starts from the URL value without syncing state in an effect. */
function NoticeFilter({ initial, onApply }: { initial: string; onApply: (code: string) => void }) {
  const { t } = usePortal();
  const [draft, setDraft] = useState(initial);
  const inputId = useId();

  function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onApply(draft.trim());
  }

  return (
    <form onSubmit={apply} className="flex max-w-xl flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1 space-y-1">
        <label htmlFor={inputId} className="block text-sm text-slate-700">
          {t('notices.filter')}
        </label>
        <input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={40}
          aria-describedby={`${inputId}-hint`}
          className="input"
        />
      </div>
      <button type="submit" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
        {t('notices.apply')}
      </button>
      {initial && (
        <button
          type="button"
          onClick={() => onApply('')}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
        >
          {t('notices.clear')}
        </button>
      )}
      <p id={`${inputId}-hint`} className="w-full text-xs text-slate-500">
        {t('notices.filterHint')}
      </p>
    </form>
  );
}
