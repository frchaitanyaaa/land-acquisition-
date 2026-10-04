import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LANG_COOKIE, parseLang } from '@/lib/i18n/public';
import { serverEnv } from '@/lib/server-env';
import { PortalShell } from './portal-shell';

export const metadata: Metadata = {
  title: 'BhoomiSetu · Public portal',
  description: 'Land acquisition information for citizens: parcel status, notices, objections and compensation.',
};

/**
 * Public portal (CLAUDE.md §25): no login. Nothing here checks a session, and every data call goes to
 * /api/v1/public, which reads only public_* views and functions (G22). The layout sits under
 * (public)/portal so it does not collide with any group-level layout another stream adds.
 */
export default async function PublicPortalLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const lang = parseLang(jar.get(LANG_COOKIE)?.value);
  return (
    // The root layout is a bare document shell; the portal supplies its own page frame.
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/" className="mb-6 inline-block text-lg font-semibold tracking-tight text-slate-950">
        BhoomiSetu
      </Link>
      <PortalShell initialLang={lang} demoMode={serverEnv.demoMode}>
        {children}
      </PortalShell>
    </main>
  );
}
