'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { VillagePicker, villageName } from '@/components/public/village-picker';
import { publicApi, type ParcelStatus, type Village } from '@/lib/portal-public-api';
import { usePortal } from '../portal-shell';

/**
 * Village + survey number → public_parcel_status (CLAUDE.md §25). Every field shown is a column of
 * that view; the view decides what is public (G22), not this page (G13).
 */
export default function ParcelSearchPage() {
  const portal = usePortal();
  const { t, lang } = portal;
  const surveyId = useId();
  const [village, setVillage] = useState<Village | null>(null);
  const [survey, setSurvey] = useState('');
  const [needVillage, setNeedVillage] = useState(false);
  const [submitted, setSubmitted] = useState<{ village: Village; survey: string } | null>(null);

  const parcels = useQuery({
    queryKey: ['public', 'parcels', submitted?.village.code ?? '', submitted?.survey ?? ''],
    queryFn: () => publicApi.parcels(submitted!.village.code, submitted!.survey || undefined),
    enabled: submitted !== null,
  });

  const { reportAsOf } = portal;
  useEffect(() => reportAsOf(parcels.data?.asOf), [parcels.data, reportAsOf]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!village) {
      setNeedVillage(true);
      return;
    }
    setNeedVillage(false);
    setSubmitted({ village, survey: survey.trim() });
  }

  const rows = parcels.data?.data ?? [];

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl font-semibold text-slate-950">{t('search.title')}</h1>
        <p className="text-slate-700">{t('search.intro')}</p>
      </div>

      <form onSubmit={submit} className="max-w-xl space-y-4" noValidate>
        <VillagePicker
          value={village}
          onChange={(v) => {
            setVillage(v);
            if (v) setNeedVillage(false);
          }}
          localFirst={lang !== 'en'}
          text={{
            label: t('search.village'),
            placeholder: t('search.villagePlaceholder'),
            none: t('search.villageNone'),
            loading: t('common.loading'),
            chosen: (name) => t('search.villageChosen', { village: name }),
            change: t('search.villageChange'),
            error: portal.errorText,
          }}
        />
        <div className="space-y-1">
          <label htmlFor={surveyId} className="block text-sm text-slate-700">
            {t('search.survey')}
          </label>
          <input
            id={surveyId}
            value={survey}
            onChange={(e) => setSurvey(e.target.value)}
            maxLength={32}
            inputMode="text"
            aria-describedby={`${surveyId}-hint`}
            className="input max-w-48"
          />
          <p id={`${surveyId}-hint`} className="text-xs text-slate-500">
            {t('search.surveyHint')}
          </p>
        </div>
        {needVillage && (
          <p role="alert" className="text-sm text-red-700">
            {t('search.needVillage')}
          </p>
        )}
        <button
          type="submit"
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          {t('search.submit')}
        </button>
      </form>

      <section aria-live="polite" className="space-y-4">
        {parcels.isFetching && <p className="text-slate-500">{t('common.loading')}</p>}
        {parcels.isError && (
          <p role="alert" className="text-red-700">
            {portal.errorText(parcels.error)}
          </p>
        )}
        {parcels.isSuccess && !parcels.isFetching && (
          <>
            <p className="text-sm text-slate-600">
              {t('search.count', { n: rows.length })}
              {submitted && `, ${villageName(submitted.village, lang !== 'en')}`}
            </p>
            {rows.length === 0 ? (
              <p className="max-w-2xl rounded-md border border-slate-200 bg-white p-4 text-slate-700">{t('search.empty')}</p>
            ) : (
              <ul className="space-y-4">
                {rows.map((r) => (
                  <ParcelCard key={`${r.project_code}-${r.village_code}-${r.survey_no}`} row={r} />
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function ParcelCard({ row }: { row: ParcelStatus }) {
  const { t, label, formatDate } = usePortal();
  const pct = row.affected_pct === null || row.affected_pct === '' ? null : Number(row.affected_pct);
  const objectionHref = `/portal/objection?${new URLSearchParams({
    project: row.project_code,
    village: row.village_code,
    survey: row.survey_no,
  }).toString()}`;

  return (
    <li className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-3">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('parcel.survey')} {row.survey_no}
        </h2>
        <p className="text-sm text-slate-600">
          {row.project_name} ({row.project_code})
        </p>
      </div>
      <dl className="grid gap-x-6 gap-y-3 px-4 py-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Field term={t('parcel.status')} value={label('parcelStatus', row.parcel_status)} strong />
        <Field term={t('parcel.stage')} value={label('stage', row.current_stage)} />
        <Field term={t('parcel.projectStatus')} value={label('projectStatus', row.project_status)} />
        <Field
          term={t('parcel.affected')}
          value={pct === null || Number.isNaN(pct) ? t('common.dash') : `${pct.toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`}
        />
        <Field term={t('parcel.frozen')} value={row.transfer_frozen ? t('common.yes') : t('common.no')} />
        <Field term={t('parcel.lastNotice')} value={formatDate(row.last_public_notice_at)} />
        <Field term={t('parcel.contact')} value={t('parcel.contactValue', { district: row.district_name })} />
      </dl>
      <div className="flex flex-wrap gap-3 border-t border-slate-100 px-4 py-3 text-sm">
        <Link
          href={`/portal/notices?project=${encodeURIComponent(row.project_code)}`}
          className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
        >
          {t('parcel.notices')}
        </Link>
        {row.project_status === 'ACTIVE' && (
          // The API refuses filings outside an open objection window; the form shows that reason.
          <Link href={objectionHref} className="rounded-md border border-teal-700 px-3 py-1.5 text-teal-800 hover:bg-teal-50">
            {t('parcel.object')}
          </Link>
        )}
      </div>
    </li>
  );
}

function Field({ term, value, strong = false }: { term: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-slate-500">{term}</dt>
      <dd className={strong ? 'font-semibold text-slate-950' : 'text-slate-900'}>{value}</dd>
    </div>
  );
}
