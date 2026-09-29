import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import { serverEnv } from '@/lib/server-env';
import './globals.css';

export const metadata: Metadata = {
  title: 'BhoomiSetu',
  description: 'National Land Acquisition & Management System',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              BhoomiSetu
            </Link>
            {serverEnv.demoMode && (
              // §9: shown whenever DEMO_MODE=true. Every record is synthetic (G18).
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-900 ring-1 ring-amber-300">
                Demo data
              </span>
            )}
            <nav className="ml-auto flex gap-4 text-sm">
              <Link href="/national" className="text-slate-700 hover:text-slate-950">
                National
              </Link>
              <Link href="/collector" className="text-slate-700 hover:text-slate-950">
                Collector
              </Link>
              <Link href="/projects/new" className="text-slate-700 hover:text-slate-950">
                New proposal
              </Link>
              <Link href="/session" className="text-slate-700 hover:text-slate-950">
                Session
              </Link>
              <Link href="/login" className="text-slate-700 hover:text-slate-950">
                Sign in
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">
          <QueryProvider>{children}</QueryProvider>
        </main>
      </body>
    </html>
  );
}
