import Link from 'next/link';
import type { ReactNode } from 'react';
import { RoleSwitcher } from '@/components/role-switcher';
import { serverEnv } from '@/lib/server-env';

/** The signed-in officer's chrome. Public pages (app/(public)) have their own layout without it. */
export function OfficerShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            BhoomiSetu
          </Link>
          {serverEnv.demoMode && (
            // §9: shown whenever DEMO_MODE=true. Every record is synthetic (G18).
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-900 ring-1 ring-amber-300">
              Demo data
            </span>
          )}
          <nav className="ml-auto flex flex-wrap items-center gap-4 text-sm">
            <Link href="/national" className="text-slate-700 hover:text-slate-950">
              National
            </Link>
            <Link href="/collector" className="text-slate-700 hover:text-slate-950">
              Collector
            </Link>
            <Link href="/projects/new" className="text-slate-700 hover:text-slate-950">
              New proposal
            </Link>
            <Link href="/gis" className="text-slate-700 hover:text-slate-950">
              GIS
            </Link>
            <Link href="/field-office" className="text-slate-700 hover:text-slate-950">
              Field office
            </Link>
            <Link href="/rule-packs" className="text-slate-700 hover:text-slate-950">
              Rule packs
            </Link>
            <Link href="/public" className="text-slate-700 hover:text-slate-950">
              Public portal
            </Link>
            <Link href="/session" className="text-slate-700 hover:text-slate-950">
              Session
            </Link>
            <RoleSwitcher />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
