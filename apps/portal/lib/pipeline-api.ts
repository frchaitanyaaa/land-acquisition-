'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type PipelineStageStatus = 'done' | 'active' | 'returned' | 'skipped' | 'stopped' | 'not_started';

export interface PipelineProject {
  id: string;
  code: string;
  name: string;
  stateCode: string | null;
  status: string;
  currentStage: string | null;
  rulePack: string;
  stages: Array<{
    code: string;
    name: string;
    sections: string[];
    status: PipelineStageStatus;
    attempts: number;
    startedAt: string | null;
    completedAt: string | null;
  }>;
  done: number;
  risk: 'SAFE' | 'DUE_SOON' | 'BREACHED';
  nextDeadline: {
    label: string | null;
    section: string;
    due_at: string;
    days_remaining: number;
    live_status: 'SAFE' | 'DUE_SOON' | 'BREACHED';
    consequence_text: string | null;
  } | null;
}

/** GET /pipeline (§24.3) — national and state posts only; RLS limits rows to the post's scope. */
export function usePipeline(state?: string) {
  return useQuery({
    queryKey: ['pipeline', state ?? 'all'],
    queryFn: () => api<{ asOf: string; projects: PipelineProject[] }>(`/pipeline${state ? `?state=${encodeURIComponent(state)}` : ''}`),
  });
}
