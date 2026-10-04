'use client';

import { useParams, useRouter } from 'next/navigation';
import { DashboardSkeleton, ScopeDashboard } from '@/components/scope-dashboard';
import { ApiProblem } from '@/lib/api';
import { useScopeDashboard } from '@/lib/dashboards-api';

/** §24.1 at state scope — GET /dashboards/state/:code; RLS limits it to what the post may see. */
export default function StateDashboardPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { data, error, isLoading } = useScopeDashboard('state', code);

  if (error) {
    if (error instanceof ApiProblem && error.status === 401) {
      router.replace('/login');
      return null;
    }
    return <p className="text-red-700">Could not load the state dashboard.</p>;
  }
  if (isLoading || !data) return <DashboardSkeleton />;
  const name = data.states[0]?.state_name;
  return <ScopeDashboard title={name ? `State dashboard · ${name}` : 'State dashboard'} data={data} breakdown="district" />;
}
