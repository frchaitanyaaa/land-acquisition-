import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';

/** Public front door: signed-out chrome (no sidebar, project switcher or user menu). */
export default function LandingLayout({ children }: { children: ReactNode }) {
  return <AppShell variant="minimal">{children}</AppShell>;
}
