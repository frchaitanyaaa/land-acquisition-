'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { TokenLinkForm } from '@/components/public/token-link-form';
import { usePortal } from '../portal-shell';
import { GrievanceDesk } from './grievance-desk';

/**
 * Grievance hub. The top section (GrievanceDesk) is a browser-only MOCK of the grievance register
 * (lib/mock-citizen.ts). Below it, each kind of grievance is routed to the existing legal channel:
 *   objection        → POST /public/objections (open s.15 window only)
 *   payment dispute  → WS3 acknowledgement page ("I did not receive this" → public_dispute)
 *   entitlement check→ WS3 passbook page
 *   anything else    → office of the Collector (district from parcel search)
 */
export default function GrievancePage() {
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
        <h1 className="text-2xl font-semibold text-slate-950">{t('grievance.title')}</h1>
        <p className="text-slate-700">{t('grievance.intro')}</p>
      </div>

      <GrievanceDesk />

      <h2 className="text-lg font-semibold text-slate-950">Other ways to get help</h2>
      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        <Route title={t('grievance.objectionTitle')} desc={t('grievance.objectionDesc')}>
          <Link href="/portal/objection" className="inline-block rounded-md bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
            {t('grievance.objectionAction')}
          </Link>
        </Route>

        <Route title={t('grievance.disputeTitle')} desc={t('grievance.disputeDesc')}>
          <TokenLinkForm page="acknowledge" text={{ ...linkText, open: t('grievance.disputeAction') }} />
        </Route>

        <Route title={t('grievance.passbookTitle')} desc={t('grievance.passbookDesc')}>
          <TokenLinkForm page="passbook" text={{ ...linkText, open: t('grievance.passbookAction') }} />
        </Route>

        <Route title={t('grievance.collectorTitle')} desc={t('grievance.collectorDesc')}>
          <Link href="/portal/search" className="inline-block rounded-md border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-100">
            {t('grievance.collectorAction')}
          </Link>
        </Route>
      </div>

      <p className="text-sm text-slate-600">{t('grievance.keepRef')}</p>
      <p className="text-sm text-slate-600">{t('myLand.noLink')}</p>
    </div>
  );
}

function Route({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-start">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-700">{desc}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}
