import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PREFS_BOOT_SCRIPT } from '@/components/shell/prefs';
import { Ux4gRuntime } from '@/components/shell/ux4g-runtime';
import { QueryProvider } from '@/lib/query-provider';
import 'ux4g-web-components/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'BhoomiSetu',
  description: 'National Land Acquisition & Management System',
};

/**
 * Root layout: document shell only. UX4G CSS + runtime load once here and nowhere else.
 * The visible chrome comes from the route groups — AppShell (components/shell) for officer pages
 * ((dashboards), login, session) and the public layout for (public).
 *
 * `data-theme` is required by UX4G (no fallback theme). The boot script applies the viewer's saved
 * theme / text size / contrast before first paint, so the attributes may differ from the server
 * render — hence suppressHydrationWarning on <html> only.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT_SCRIPT }} />
      </head>
      <body>
        <Ux4gRuntime />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
