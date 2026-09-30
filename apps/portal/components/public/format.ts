import { formatINR } from '@bhoomisetu/shared';

/** Full rupee amounts for families — never lakh/crore shorthand on a person's own money. */
export const rupees = (paise: string | number | null | undefined) => formatINR(BigInt(paise ?? 0));

export const dateIST = (iso: string | null | undefined, locale: string, withTime = false) =>
  iso
    ? new Intl.DateTimeFormat(locale === 'en' ? 'en-IN' : `${locale}-IN`, {
        dateStyle: 'medium',
        ...(withTime ? { timeStyle: 'short' } : {}),
        timeZone: 'Asia/Kolkata',
      }).format(new Date(iso))
    : '—';
