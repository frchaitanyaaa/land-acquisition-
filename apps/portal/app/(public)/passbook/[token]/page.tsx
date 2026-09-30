'use client';

import { useLocale, useTranslations } from 'next-intl';
import { use, useEffect, useState } from 'react';
import { dateIST, rupees } from '@/components/public/format';
import { publicApi, type Passbook } from '@/lib/public-api';

/**
 * /passbook/:token — the family's R&R passbook (§19): heads, amounts, status per head with
 * acknowledgement, due dates, site allotment, whom to contact. NEVER a hold reason — the
 * public_passbook() function doesn't select one, and a held payment reads "payment in process".
 */
export default function PublicPassbookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const t = useTranslations('passbook');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [pb, setPb] = useState<Passbook | null>(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    publicApi<Passbook>(`/passbook/${token}`)
      .then(setPb)
      .catch(() => setInvalid(true));
  }, [token]);

  if (invalid) return <p className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-900">{t('invalid')}</p>;
  if (!pb) return <p className="text-sm text-slate-500">{tc('loading')}</p>;

  const statusLabel = (s: string) => (t.has(`statuses.${s}`) ? t(`statuses.${s}`) : s.replace(/_/g, ' ').toLowerCase());
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{t('heading')}</h1>
        <p className="text-sm text-slate-600">
          {t('family')}: {pb.family.headFirstName} · {pb.family.projectName} ({pb.family.projectCode})
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">{t('entitlements')}</h2>
        <ul className="divide-y divide-slate-100">
          {pb.entitlements.map((e) => (
            <li key={e.headCode} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{e.headCode.replace(/_/g, ' ')}</p>
                <p className="text-slate-600">
                  {statusLabel(e.status)}
                  {e.dueBy ? ` · ${tc('dueBy')} ${dateIST(e.dueBy, locale)}` : ''}
                </p>
                {BigInt(e.paidPaise) > 0n && (
                  <p className={e.acknowledged ? 'text-emerald-800' : 'text-amber-800'}>
                    {e.acknowledged ? `✓ ${t('acknowledged')}` : t('notAcknowledged')}
                  </p>
                )}
              </div>
              <p className="font-semibold tabular-nums">{rupees(e.amountPaise)}</p>
            </li>
          ))}
        </ul>
      </section>

      {pb.annuity && pb.annuity.total > 0 && (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <span className="font-medium">{t('annuity')}:</span> {t('annuityPaid', { paid: pb.annuity.paid, total: pb.annuity.total })}
          {pb.annuity.nextDue ? ` · ${t('nextDue', { date: dateIST(pb.annuity.nextDue, locale) })}` : ''}
        </p>
      )}
      {pb.site && (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <span className="font-medium">{t('site')}:</span> {pb.site.name}
          {pb.site.readinessPct != null ? ` · ${t('ready', { pct: pb.site.readinessPct })}` : ''}
        </p>
      )}
      <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <span className="font-medium">{t('contact')}:</span> {pb.contact}
      </p>
    </div>
  );
}
