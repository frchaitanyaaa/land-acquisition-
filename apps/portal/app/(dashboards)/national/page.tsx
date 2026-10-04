'use client';

import { useRouter } from 'next/navigation';
import { DashboardSkeleton, ScopeDashboard } from '@/components/scope-dashboard';
import { nationalKey, useNationalDashboard } from '@/lib/dashboards-api';
import { ApiProblem } from '@/lib/api';
import { useLiveUpdates } from '@/lib/use-live-updates';

export default function NationalDashboard() {
  const router = useRouter();
  const { data, error, isLoading } = useNationalDashboard();
  useLiveUpdates([nationalKey]);

  if (error) {
    if (error instanceof ApiProblem && error.status === 401) {
      router.replace('/login');
      return null;
    }
    return <p className="text-red-700">Could not load the national dashboard.</p>;
  }
  if (isLoading || !data) return <DashboardSkeleton />;
  return <ScopeDashboard title="National dashboard" data={data} breakdown="state" />;
}
