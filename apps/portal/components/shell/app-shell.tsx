import type { ReactNode } from 'react';
import { serverEnv } from '@/lib/server-env';
import { ShellFrame, type ShellVariant } from './shell-frame';

/**
 * The officer portal chrome (C1). `full` = accessibility bar, top bar, sidebar, footer.
 * `minimal` = no sidebar, project switcher, bell or user menu (login).
 * Public pages (app/(public)) keep their own layout.
 */
export function AppShell({ children, variant = 'full' }: { children: ReactNode; variant?: ShellVariant }) {
  return (
    <ShellFrame variant={variant} demoMode={serverEnv.demoMode}>
      {children}
    </ShellFrame>
  );
}
