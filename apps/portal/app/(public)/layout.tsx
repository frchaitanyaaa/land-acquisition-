import Link from 'next/link';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { dateIST } from '@/components/public/format';
import { LanguageSwitcher } from '@/components/public/language-switcher';
import { serverEnv } from '@/lib/server-env';

export const dynamic = 'force-dynamic';

async function appNow(): Promise<string | null> {
  try {
    const res = await fetch(`${serverEnv.apiOrigin}/api/v1/health`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as { clock: { now: string } }).clock.now : null;
  } catch {
    return null;
  }
}

/**
 * Public portal (§25): separate layout, no login, no officer chrome. The beneficiary's phone
 * opens /ack/…, /enrol/…, /passbook/… here with no officer session at all.
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [locale, messages, t, now] = await Promise.all([getLocale(), getMessages(), getTranslations(), appNow()]);
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <Link href="/portal" className="text-base font-semibold tracking-tight text-teal-800">
              {t('common.title')}
            </Link>
            {serverEnv.demoMode && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 ring-1 ring-amber-300">
                Demo data
              </span>
            )}
            <div className="ml-auto">
              <LanguageSwitcher />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <p className="mx-auto max-w-3xl px-4 py-4 text-xs leading-relaxed text-slate-600">
            {t('footer.provenance')} {t('footer.asOf', { when: now ? dateIST(now, locale, true) : '—' })}
          </p>
        </footer>
      </div>
    </NextIntlClientProvider>
  );
}
