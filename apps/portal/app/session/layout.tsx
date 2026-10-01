import type { ReactNode } from 'react';
import { OfficerShell } from '@/components/officer-shell';

export default function SessionLayout({ children }: { children: ReactNode }) {
  return <OfficerShell>{children}</OfficerShell>;
}
