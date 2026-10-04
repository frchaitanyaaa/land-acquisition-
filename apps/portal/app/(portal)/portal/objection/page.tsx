'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useId, useState, type FormEvent } from 'react';
import { publicApi, type ObjectionFiled, type ObjectionInput } from '@/lib/portal-public-api';
import { usePortal } from '../portal-shell';

export default function ObjectionPage() {
  return (
    <Suspense>
      <ObjectionForm />
    </Suspense>
  );
}

const MIN_BODY = 10; // matches the API's validation of `body` (public.controller.ts)

/**
 * File an objection through POST /public/objections → public_file_objection() (CLAUDE.md §25).
 * Whether the objection window is open is decided by that SQL function; this form only shows its answer.
 */
function ObjectionForm() {
  const portal = usePortal();
  const { t, lang, demoMode, reportAsOf } = portal;
  const params = useSearchParams();
  const ids = useId();

  const [projectCode, setProjectCode] = useState(params.get('project') ?? '');
  const [villageCode, setVillageCode] = useState(params.get('village') ?? '');
  const [surveyNo, setSurveyNo] = useState(params.get('survey') ?? '');
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [tooShort, setTooShort] = useState(false);
  const prefilled = Boolean(params.get('project'));

  const file = useMutation({
    mutationFn: (input: ObjectionInput) => publicApi.fileObjection(input),
  });
  const filed: ObjectionFiled | undefined = file.data;
  useEffect(() => reportAsOf(filed?.asOf), [filed, reportAsOf]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (body.trim().length < MIN_BODY) {
      setTooShort(true);
      return;
    }
    setTooShort(false);
    file.mutate({
      projectCode: projectCode.trim(),
      villageCode: villageCode.trim(),
      surveyNo: surveyNo.trim(),
      name: name.trim() || undefined,
      body: body.trim(),
      language: lang,
    });
  }

  function reset() {
    file.reset();
    setBody('');
    setName('');
  }

  if (filed?.filed) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold text-slate-950">{t('objection.done')}</h1>
        <div role="status" className="rounded-lg border border-teal-600 bg-teal-50 p-4">
          <p className="text-lg font-semibold text-teal-900">{t('objection.reference', { ref: filed.reference })}</p>
          <p className="mt-1 text-sm text-slate-700">{t('objection.keepRef')}</p>
        </div>
        <button onClick={reset} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">
          {t('objection.another')}
        </button>
      </div>
    );
  }

  const fieldClass = 'space-y-1';
  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl font-semibold text-slate-950">{t('objection.title')}</h1>
        <p className="text-slate-700">{t('objection.intro')}</p>
        {!prefilled && (
          <p className="text-sm text-slate-600">
            {t('objection.prefill')}{' '}
            <Link href="/portal/search" className="text-teal-800 underline">
              {t('nav.search')}
            </Link>
          </p>
        )}
      </div>

      <form onSubmit={submit} className="max-w-xl space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className={fieldClass}>
            <label htmlFor={`${ids}-project`} className="block text-sm text-slate-700">
              {t('objection.project')}
            </label>
            <input
              id={`${ids}-project`}
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              required
              maxLength={40}
              className="input"
            />
          </div>
          <div className={fieldClass}>
            <label htmlFor={`${ids}-village`} className="block text-sm text-slate-700">
              {t('objection.village')}
            </label>
            <input
              id={`${ids}-village`}
              value={villageCode}
              onChange={(e) => setVillageCode(e.target.value)}
              required
              maxLength={64}
              className="input"
            />
          </div>
          <div className={fieldClass}>
            <label htmlFor={`${ids}-survey`} className="block text-sm text-slate-700">
              {t('objection.survey')}
            </label>
            <input
              id={`${ids}-survey`}
              value={surveyNo}
              onChange={(e) => setSurveyNo(e.target.value)}
              required
              maxLength={32}
              aria-describedby={`${ids}-survey-hint`}
              className="input"
            />
          </div>
          <p id={`${ids}-survey-hint`} className="text-xs text-slate-500 sm:col-span-3">
            {t('objection.surveyHint')}
          </p>
        </div>

        <div className={fieldClass}>
          <label htmlFor={`${ids}-name`} className="block text-sm text-slate-700">
            {t('objection.name')}
          </label>
          <input
            id={`${ids}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoComplete="name"
            className="input"
          />
        </div>

        <div className={fieldClass}>
          <label htmlFor={`${ids}-body`} className="block text-sm text-slate-700">
            {t('objection.body')}
          </label>
          <textarea
            id={`${ids}-body`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            minLength={MIN_BODY}
            maxLength={10_000}
            rows={7}
            aria-describedby={`${ids}-body-hint`}
            className="input"
          />
          <p id={`${ids}-body-hint`} className="text-xs text-slate-500">
            {t('objection.bodyHint')}
          </p>
        </div>

        <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p>{t('objection.privacy')}</p>
          {demoMode && <p className="font-semibold">{t('objection.demo')}</p>}
        </div>

        {tooShort && (
          <p role="alert" className="text-sm text-red-700">
            {t('objection.tooShort')}
          </p>
        )}
        {file.isError && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold">{t('objection.rejected')}</p>
            <p>{portal.errorText(file.error)}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={file.isPending}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {file.isPending ? t('objection.submitting') : t('objection.submit')}
        </button>
      </form>
    </div>
  );
}
