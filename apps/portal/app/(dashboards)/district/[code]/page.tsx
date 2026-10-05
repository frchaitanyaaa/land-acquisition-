'use client';

import { useParams, useRouter } from 'next/navigation';
import { DashboardSkeleton, ScopeDashboard } from '@/components/scope-dashboard';
import { ApiProblem } from '@/lib/api';
import { useScopeDashboard } from '@/lib/dashboards-api';

/** §24.1 at district scope — GET /dashboards/district/:code; RLS limits it to what the post may see. */
export default function DistrictDashboardPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { data, error, isLoading } = useScopeDashboard('district', code);

  if (error) {
    if (error instanceof ApiProblem && error.status === 401) {
      router.replace('/login');
      return null;
    }
    return <p className="text-red-700">Could not load the district dashboard.</p>;
  }
  if (isLoading || !data) return <DashboardSkeleton />;
  const name = data.districts.find((d) => d.district_code === code)?.district_name;
  return (
    <ScopeDashboard
      title={name ? `District dashboard · ${name}` : 'District dashboard'}
      data={data}
      breakdown="projects"
    />
  );
}
