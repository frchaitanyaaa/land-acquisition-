'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { dateIST } from '@/components/public/format';
import { ApiProblem } from '@/lib/api';
import { publicApi, type Meta, type PublicNotice, type PublicParcel, type Village } from '@/lib/public-api';

type Tab = 'search' | 'notices' | 'objection';

/** Public portal home (§25): parcel status search, published notices, file an objection. */
export default function PublicPortalPage() {
  const t = useTranslations('nav');
  const [tab, setTab] = useState<Tab>('search');
  return (
    <div className="space-y-5">
      <nav className="flex gap-1 border-b border-slate-200">
        {(['search', 'notices', 'objection'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === k ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t(k)}
          </button>
        ))}
      </nav>
      {tab === 'search' && <Search />}
      {tab === 'notices' && <Notices />}
      {tab === 'objection' && <Objection />}
    </div>
  );
}

function VillagePicker({ value, onChange }: { value: Village | null; onChange: (v: Village | null) => void }) {
  const t = useTranslations();
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<Village[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) return setOptions([]);
    const id = setTimeout(() => {
      publicApi<Meta & { data: Village[] }>(`/villages?q=${encodeURIComponent(q.trim())}`)
        .then((r) => setOptions(r.data))
        .catch(() => setOptions([]));
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  if (value)
    return (
      <div className="flex items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
        <span>
          {value.name}
          {value.name_local ? ` (${value.name_local})` : ''} — {value.sub_district}, {value.district}
        </span>
        <button type="button" onClick={() => onChange(null)} className="text-xs text-teal-700 underline">
          ✕
        </button>
      </div>
    );
  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('search.villageHint')}
        className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      {options.length > 0 && (
        <ul className="mt-1 max-h-56 overflow-auto rounded-md border border-slate-200 bg-white text-sm shadow-sm">
          {options.map((v) => (
            <li key={v.code}>
              <button type="button" onClick={() => onChange(v)} className="block w-full px-3 py-2 text-left hover:bg-slate-50">
                {v.name}
                {v.name_local ? ` (${v.name_local})` : ''} <span className="text-slate-500">— {v.sub_district}, {v.district}, {v.state}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Search() {
  const t = useTranslations();
  const locale = useLocale();
  const [village, setVillage] = useState<Village | null>(null);
  const [survey, setSurvey] = useState('');
  const [rows, setRows] = useState<PublicParcel[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(e: FormEvent) {
    e.preventDefault();
    if (!village) return;
    setError(null);
    try {
      const params = new URLSearchParams({ village: village.code, ...(survey.trim() ? { survey: survey.trim() } : {}) });
      setRows((await publicApi<Meta & { data: PublicParcel[] }>(`/parcels?${params}`)).data);
    } catch {
      setError(t('common.error'));
    }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold">{t('search.heading')}</h1>
      <form onSubmit={run} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm">
          <span className="text-slate-700">{t('common.village')}</span>
          <div className="mt-1">
            <VillagePicker value={village} onChange={setVillage} />
          </div>
        </div>
        <label className="block text-sm">
          <span className="text-slate-700">
            {t('common.surveyNo')} <span className="text-slate-400">({t('common.optional')})</span>
          </span>
          <input value={survey} onChange={(e) => setSurvey(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button disabled={!village} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {t('common.search')}
        </button>
      </form>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {rows?.length === 0 && <p className="text-sm text-slate-600">{t('common.notFound')}</p>}
      {rows && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={`${r.project_code}:${r.survey_no}`} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <p className="font-medium">
                {t('common.surveyNo')} {r.survey_no} · {r.village_name}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-slate-700">
                <dt className="text-slate-500">{t('common.project')}</dt>
                <dd>
                  {r.project_name} ({r.project_code})
                </dd>
                <dt className="text-slate-500">{t('common.stage')}</dt>
                <dd>{r.current_stage ?? '—'}</dd>
                <dt className="text-slate-500">{t('common.status')}</dt>
                <dd>{r.parcel_status.replace(/_/g, ' ').toLowerCase()}</dd>
                <dt className="text-slate-500">{t('search.affected')}</dt>
                <dd>{r.affected_pct != null ? `${Number(r.affected_pct).toFixed(1)}%` : '—'}</dd>
                <dt className="text-slate-500">{t('search.frozen')}</dt>
                <dd>{r.transfer_frozen ? t('common.yes') : t('common.no')}</dd>
                <dt className="text-slate-500">{t('search.lastNotice')}</dt>
                <dd>{dateIST(r.last_public_notice_at, locale)}</dd>
                <dt className="text-slate-500">{t('common.district')}</dt>
                <dd>{r.district_name}</dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Notices() {
  const t = useTranslations();
  const locale = useLocale();
  const [rows, setRows] = useState<PublicNotice[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    publicApi<Meta & { data: PublicNotice[] }>('/notices')
      .then((r) => setRows(r.data))
      .catch(() => setError(true));
  }, []);
  return (
    <section className="space-y-3">
      <h1 className="text-lg font-semibold">{t('notices.heading')}</h1>
      <p className="text-xs text-slate-500">{t('notices.hint')}</p>
      {error && <p className="text-sm text-red-700">{t('common.error')}</p>}
      {!rows && !error && <p className="text-sm text-slate-500">{t('common.loading')}</p>}
      {rows?.length === 0 && <p className="text-sm text-slate-600">{t('common.notFound')}</p>}
      <ul className="space-y-2">
        {rows?.map((n) => (
          <li key={n.document_id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <p className="font-medium">{n.title}</p>
            <p className="text-slate-600">
              {n.doc_type.replace(/_/g, ' ')} · {n.project_name} ({n.project_code}) · {t('common.publishedOn')}{' '}
              {dateIST(n.published_at, locale)}
            </p>
            <p className="mt-1 break-all font-mono text-[11px] text-slate-500">
              {t('notices.fingerprint')}: {n.sha256}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Objection() {
  const t = useTranslations();
  const locale = useLocale();
  const [village, setVillage] = useState<Village | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!village) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setResult(null);
    try {
      const r = await publicApi<{ reference: string }>('/objections', {
        method: 'POST',
        body: JSON.stringify({
          projectCode: String(f.get('projectCode')).trim(),
          villageCode: village.code,
          surveyNo: String(f.get('surveyNo')).trim(),
          name: String(f.get('name') ?? '').trim() || undefined,
          body: String(f.get('body')).trim(),
          language: locale,
        }),
      });
      setResult({ ok: true, text: t('objection.filed', { ref: r.reference }) });
    } catch (err) {
      const closed = err instanceof ApiProblem && err.status === 422;
      setResult({ ok: false, text: closed ? `${t('objection.closed')} (${err.message})` : t('common.error') });
    } finally {
      setBusy(false);
    }
  }

  const input = 'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
  return (
    <section className="space-y-3">
      <h1 className="text-lg font-semibold">{t('objection.heading')}</h1>
      <p className="text-sm text-slate-600">{t('objection.intro')}</p>
      <form onSubmit={submit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="block text-sm">
          <span className="text-slate-700">{t('objection.projectCode')}</span>
          <input name="projectCode" required maxLength={40} placeholder="MH-PSX-2026-001" className={input} />
        </label>
        <div className="text-sm">
          <span className="text-slate-700">{t('common.village')}</span>
          <div className="mt-1">
            <VillagePicker value={village} onChange={setVillage} />
          </div>
        </div>
        <label className="block text-sm">
          <span className="text-slate-700">{t('common.surveyNo')}</span>
          <input name="surveyNo" required maxLength={32} className={input} />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">
            {t('objection.name')} <span className="text-slate-400">({t('common.optional')})</span>
          </span>
          <input name="name" maxLength={120} className={input} />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">{t('objection.body')}</span>
          <textarea name="body" required minLength={10} maxLength={10000} rows={5} className={input} />
        </label>
        {result && <p className={`text-sm ${result.ok ? 'text-emerald-800' : 'text-red-700'}`}>{result.text}</p>}
        <button disabled={busy || !village} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {t('objection.submit')}
        </button>
      </form>
    </section>
  );
}
