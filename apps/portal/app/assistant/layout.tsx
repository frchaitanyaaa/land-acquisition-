import type { ReactNode } from 'react';
import { OfficerShell } from '@/components/officer-shell';

export default function ShellLayout({ children }: { children: ReactNode }) {
  return <OfficerShell>{children}</OfficerShell>;
}
