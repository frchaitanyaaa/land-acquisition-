'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** True when the API runs with DEMO_MODE=true (read from /health, which reports it). For client components. */
export function useDemoMode(): boolean {
  const { data } = useQuery({
    queryKey: ['health', 'demoMode'],
    queryFn: () => api<{ demoMode?: boolean }>('/health'),
    staleTime: Infinity,
  });
  return data?.demoMode === true;
}
