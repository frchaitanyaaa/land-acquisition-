import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Ux4gRuntime } from '@/components/shell/ux4g-runtime';
import { QueryProvider } from '@/lib/query-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'BhoomiSetu',
  description: 'National Land Acquisition & Management System',
};

/**
 * Root layout: document shell only. The visible chrome comes from the route groups —
 * OfficerShell for officer pages ((dashboards), login, session) and the public layout for (public).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Ux4gRuntime />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
