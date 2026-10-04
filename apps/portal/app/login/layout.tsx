import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';

/** Signed-out chrome: no sidebar, project switcher, bell or user menu. Madhav restyles the page itself. */
export default function LoginLayout({ children }: { children: ReactNode }) {
  return <AppShell variant="minimal">{children}</AppShell>;
}
