'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DashboardSkeleton } from '@/components/scope-dashboard';
import { useNationalDashboard } from '@/lib/dashboards-api';
import { useMe } from '@/components/shell/shell-data';

/** /state without a code: a state post goes to its own state; a national post to the first state with projects. */
export default function StateIndexPage() {
  const router = useRouter();
  const me = useMe();
  const { data } = useNationalDashboard();
  useEffect(() => {
    const own = me.data?.activePost.stateCode;
    if (own) return router.replace(`/state/${own}`);
    const first = [...(data?.states ?? [])].sort((a, b) => b.projects - a.projects)[0];
    if (first) router.replace(`/state/${first.state_code}`);
  }, [me.data, data, router]);
  return <DashboardSkeleton />;
}
