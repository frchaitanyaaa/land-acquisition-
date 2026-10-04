'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  codeLabel,
  fill,
  LANG_COOKIE,
  LANG_LOCALE,
  LANG_NAMES,
  LANGS,
  messages,
  type Lang,
  type MsgKey,
} from '@/lib/i18n/public';
import { clockNow, PublicProblem } from '@/lib/portal-public-api';

interface PortalContextValue {
  lang: Lang;
  demoMode: boolean;
  t: (key: MsgKey, vars?: Record<string, string | number>) => string;
  label: (group: 'stage' | 'parcelStatus' | 'projectStatus' | 'docType', code: string | null) => string;
  formatDate: (iso: string | null, withTime?: boolean) => string;
  /** Pages pass the `asOf` returned by the public API so the footer shows when the data is from. */
  reportAsOf: (iso: string | undefined) => void;
  /** Plain-language message for a failed public call. */
  errorText: (err: unknown) => string;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be used inside the public portal layout');
  return ctx;
}

const NAV: Array<{ href: string; key: MsgKey }> = [
  { href: '/portal', key: 'nav.home' },
  { href: '/portal/search', key: 'nav.search' },
  { href: '/portal/notices', key: 'nav.notices' },
  { href: '/portal/my-land', key: 'nav.myLand' },
  { href: '/portal/grievance', key: 'nav.grievance' },
  { href: '/portal/track', key: 'nav.track' },
  { href: '/portal/login', key: 'nav.signIn' },
];

export function PortalShell({
  initialLang,
  demoMode,
  children,
}: {
  initialLang: Lang;
  demoMode: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [asOfFromPage, setAsOfFromPage] = useState(false);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  // Footer fallback: pages without a data call still show the statutory clock time.
  useEffect(() => {
    if (asOfFromPage) return;
    let cancelled = false;
    void clockNow().then((now) => {
      if (!cancelled && now) setAsOf((cur) => cur ?? now);
    });
    return () => {
      cancelled = true;
    };
  }, [asOfFromPage, pathname]);

  const value = useMemo<PortalContextValue>(() => {
    const table = messages(lang);
    const dateFmt = new Intl.DateTimeFormat(LANG_LOCALE[lang], { dateStyle: 'medium', timeZone: 'Asia/Kolkata' });
    const dateTimeFmt = new Intl.DateTimeFormat(LANG_LOCALE[lang], {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    });
    return {
      lang,
      demoMode,
      t: (key, vars) => fill(table[key], vars),
      label: (group, code) => codeLabel(lang, group, code),
      formatDate: (iso, withTime = false) => {
        if (!iso) return table['common.dash'];
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return (withTime ? dateTimeFmt : dateFmt).format(d);
      },
      reportAsOf: (iso) => {
        if (!iso) return;
        setAsOfFromPage(true);
        setAsOf(iso);
      },
      errorText: (err) => {
        if (err instanceof PublicProblem) {
          if (err.status === 0) return table['common.network'];
          if (err.status === 429) return table['common.tooMany'];
          if (err.status >= 500) return table['common.serverError'];
          return err.message || table['common.serverError'];
        }
        return table['common.network'];
      },
    };
  }, [lang, demoMode]);

  return (
    <PortalContext.Provider value={value}>
      <div lang={lang} className="space-y-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-slate-200 pb-4">
          <nav aria-label={value.t('nav.label')} className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {NAV.map((item) => {
              const active = item.href === '/portal' ? pathname === '/portal' : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'font-semibold text-teal-800 underline decoration-2 underline-offset-4'
                      : 'text-slate-700 hover:text-slate-950 hover:underline'
                  }
                >
                  {value.t(item.key)}
                </Link>
              );
            })}
          </nav>
          <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
            {value.t('lang.label')}
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            >
              {LANGS.map((l) => (
                <option key={l} value={l} lang={l}>
                  {LANG_NAMES[l]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>{children}</div>

        <footer className="space-y-2 border-t border-slate-200 pt-4 text-xs text-slate-600">
          <p className="max-w-3xl">
            {value.t('footer.provenance')}{' '}
            {asOf ? value.t('footer.asOf', { time: value.formatDate(asOf, true) }) : value.t('footer.asOfUnknown')}
          </p>
          {demoMode && <p className="font-semibold text-amber-900">{value.t('footer.demo')}</p>}
          <p>
            <Link href="/login" className="text-slate-600 underline hover:text-slate-900">
              {value.t('footer.officer')}
            </Link>
          </p>
        </footer>
      </div>
    </PortalContext.Provider>
  );
}
