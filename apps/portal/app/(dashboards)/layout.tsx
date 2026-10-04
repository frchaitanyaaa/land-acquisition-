import type { ReactNode } from 'react';
import { OfficerShell } from '@/components/officer-shell';

export default function DashboardsLayout({ children }: { children: ReactNode }) {
  return <OfficerShell>{children}</OfficerShell>;
}
