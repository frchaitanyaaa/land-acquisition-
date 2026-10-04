'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LOCALE_COOKIE, LOCALES, type Locale } from '@/i18n/locales';
import {
  applyPref,
  isDarkReady,
  PREF_KEYS,
  readPref,
  writePref,
  type Contrast,
  type TextSize,
  type Theme,
} from './prefs';
import styles from './shell.module.css';

const LANG_LABEL: Record<Locale, { short: string; name: string }> = {
  en: { short: 'EN', name: 'English' },
  hi: { short: 'हिं', name: 'हिन्दी' },
  mr: { short: 'मरा', name: 'मराठी' },
};

function readLocale(): Locale {
  const m = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`));
  const v = m?.[1];
  return LOCALES.includes(v as Locale) ? (v as Locale) : 'en';
}

/**
 * UX4G Accessibility Bar (`ux4g-topbar`) above the navbar: skip link, text size, contrast, theme and
 * language. Text size scales the root font size (UX4G is rem-based); theme sets `data-theme`, which
 * UX4G requires on <html>. All three are remembered per browser (prefs.ts).
 */
export function AccessibilityBar() {
  const router = useRouter();
  const pathname = usePathname();
  const darkReady = isDarkReady(pathname);
  const [theme, setTheme] = useState<Theme>('light');
  const [size, setSize] = useState<TextSize>('m');
  const [contrast, setContrast] = useState<Contrast>('normal');
  const [locale, setLocale] = useState<Locale>('en');

  // The boot script already applied the saved values to <html>; mirror them into state.
  useEffect(() => {
    const root = document.documentElement;
    setTheme(readPref(PREF_KEYS.theme) === 'dark' ? 'dark' : 'light');
    setSize((root.getAttribute('data-text-size') as TextSize | null) ?? 'm');
    setContrast(root.getAttribute('data-contrast') === 'high' ? 'high' : 'normal');
    setLocale(readLocale());
  }, []);

  // The viewer's choice applies only where the screen is dark-ready (prefs.ts DARK_READY_ROUTES).
  useEffect(() => {
    applyPref('data-theme', theme === 'dark' && darkReady ? 'dark' : 'light');
  }, [theme, darkReady]);

  function changeSize(next: TextSize) {
    setSize(next);
    applyPref('data-text-size', next === 'm' ? null : next);
    writePref(PREF_KEYS.textSize, next === 'm' ? null : next);
  }
  function step(delta: 1 | -1) {
    const order: TextSize[] = ['s', 'm', 'l', 'xl'];
    const i = Math.min(order.length - 1, Math.max(0, order.indexOf(size) + delta));
    changeSize(order[i] ?? 'm');
  }
  function toggleContrast() {
    const next: Contrast = contrast === 'high' ? 'normal' : 'high';
    setContrast(next);
    applyPref('data-contrast', next === 'high' ? 'high' : null);
    writePref(PREF_KEYS.contrast, next === 'high' ? 'high' : null);
  }
  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    writePref(PREF_KEYS.theme, next);
  }
  function changeLocale(next: Locale) {
    setLocale(next);
    // Same cookie as the public portal (i18n/locales.ts), so token links stay language-neutral.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="ux4g-topbar">
      <div className="ux4g-topbar__wrap ux4g-d-flex ux4g-ai-center ux4g-jc-between ux4g-flex-wrap ux4g-px-m">
        <a href="#main-content" className={`ux4g-topbar__skip ${styles.skipLink}`}>
          Skip to main content
        </a>
        <div
          className="ux4g-topbar__group ux4g-d-flex ux4g-ai-center ux4g-flex-wrap"
          role="group"
          aria-label="Display settings"
        >
          <button
            type="button"
            className="ux4g-topbar__iconbtn"
            aria-label="Decrease text size"
            onClick={() => step(-1)}
            disabled={size === 's'}
          >
            A−
          </button>
          <button
            type="button"
            className="ux4g-topbar__iconbtn"
            aria-label="Default text size"
            aria-pressed={size === 'm'}
            onClick={() => changeSize('m')}
          >
            A
          </button>
          <button
            type="button"
            className="ux4g-topbar__iconbtn"
            aria-label="Increase text size"
            onClick={() => step(1)}
            disabled={size === 'xl'}
          >
            A+
          </button>
          <button
            type="button"
            className="ux4g-topbar__iconbtn"
            aria-label="High contrast"
            aria-pressed={contrast === 'high'}
            title="High contrast"
            onClick={toggleContrast}
          >
            <span className="ux4g-icon-outlined" aria-hidden="true">
              contrast
            </span>
          </button>
          <button
            type="button"
            className="ux4g-topbar__iconbtn"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-pressed={theme === 'dark'}
            title={
              darkReady
                ? theme === 'dark'
                  ? 'Light theme'
                  : 'Dark theme'
                : 'Dark theme (this screen stays light until it is restyled)'
            }
            onClick={toggleTheme}
          >
            <span className="ux4g-icon-outlined" aria-hidden="true">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
          <span className="ux4g-d-inline-flex ux4g-ai-center" role="group" aria-label="Language">
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                lang={l}
                className="ux4g-topbar__selectbtn ux4g-label-m-strong"
                aria-pressed={locale === l}
                aria-label={LANG_LABEL[l].name}
                onClick={() => changeLocale(l)}
              >
                <span className={locale === l ? 'ux4g-text-underline' : undefined}>{LANG_LABEL[l].short}</span>
              </button>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
