'use client';

import Link from 'next/link';
import { TokenLinkForm } from '@/components/public/token-link-form';
import { usePortal } from '../portal-shell';

/**
 * "My land & compensation" — the citizen hub. No account, password or OTP login: citizens use the
 * single-use links the office sends (access_tokens: passbook, acknowledge), and parcel search needs
 * no personal data. The passbook and acknowledgement pages themselves belong to WS3.
 */
export default function MyLandPage() {
  const { t } = usePortal();
  const linkText = {
    label: t('myLand.linkLabel'),
    placeholder: t('myLand.linkPlaceholder'),
    open: t('myLand.open'),
    bad: t('myLand.badLink'),
  };

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl font-semibold text-slate-950">{t('myLand.title')}</h1>
        <p className="text-slate-700">{t('myLand.intro')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="ml-parcel" className="flex flex-col rounded-lg border border-slate-200 bg-white p-5">
          <h2 id="ml-parcel" className="text-lg font-semibold text-slate-950">
            {t('myLand.parcelTitle')}
          </h2>
          <p className="mt-1 flex-1 text-sm text-slate-700">{t('myLand.parcelDesc')}</p>
          <Link
            href="/portal/search"
            className="mt-4 self-start rounded-md bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
          >
            {t('myLand.parcelAction')}
          </Link>
        </section>

        <section aria-labelledby="ml-passbook" className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 id="ml-passbook" className="text-lg font-semibold text-slate-950">
            {t('myLand.passbookTitle')}
          </h2>
          <p className="mb-4 mt-1 text-sm text-slate-700">{t('myLand.passbookDesc')}</p>
          <TokenLinkForm page="passbook" text={linkText} />
        </section>

        <section aria-labelledby="ml-ack" className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 id="ml-ack" className="text-lg font-semibold text-slate-950">
            {t('myLand.ackTitle')}
          </h2>
          <p className="mb-4 mt-1 text-sm text-slate-700">{t('myLand.ackDesc')}</p>
          <TokenLinkForm page="acknowledge" text={linkText} />
        </section>
      </div>

      <p className="text-sm text-slate-600">{t('myLand.noLink')}</p>

      <section aria-labelledby="ml-privacy" className="max-w-2xl border-l-4 border-teal-700 pl-4">
        <h2 id="ml-privacy" className="font-semibold text-slate-950">
          {t('myLand.privacyTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-700">{t('myLand.privacyBody')}</p>
      </section>
    </div>
  );
}
