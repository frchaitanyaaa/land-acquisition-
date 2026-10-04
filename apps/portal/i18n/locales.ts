export const LOCALES = ['en', 'hi', 'mr'] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', hi: 'हिन्दी', mr: 'मराठी' };
export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);
