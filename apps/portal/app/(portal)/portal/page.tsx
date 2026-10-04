'use client';

import Link from 'next/link';
import type { MsgKey } from '@/lib/i18n/public';
import { usePortal } from './portal-shell';

const SECTIONS: Array<{ href: string; title: MsgKey; desc: MsgKey }> = [
  { href: '/portal/search', title: 'nav.search', desc: 'home.search' },
  { href: '/portal/notices', title: 'nav.notices', desc: 'home.notices' },
  { href: '/portal/my-land', title: 'nav.myLand', desc: 'home.myLand' },
  { href: '/portal/grievance', title: 'nav.grievance', desc: 'home.grievance' },
];

export default function PortalHome() {
  const { t } = usePortal();
  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl font-semibold text-slate-950">{t('home.title')}</h1>
        <p className="text-slate-700">{t('home.intro')}</p>
      </div>
      <ul className="grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.href} className="bg-white">
            <Link
              href={s.href}
              className="block h-full p-5 hover:bg-teal-50 focus-visible:bg-teal-50 focus-visible:outline-none"
            >
              <span className="text-lg font-semibold text-teal-800">{t(s.title)}</span>
              <span className="mt-1 block text-sm text-slate-700">{t(s.desc)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
