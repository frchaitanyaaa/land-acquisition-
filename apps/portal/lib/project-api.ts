import type { ActionOption, Pack, Stage } from '@bhoomisetu/rules';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DeadlineRow } from '@/lib/dashboards-api';

export interface District {
  code: string;
  name: string;
  state_code: string;
}

export interface ProjectDetail {
  id: string;
  code: string;
  name: string;
  name_local: string | null;
  category: string;
  sub_category: string | null;
  acquisition_type: 'GOVERNMENT' | 'PPP' | 'PRIVATE';
  requiring_body_id: string;
  requiring_body_name: string;
  national_importance: boolean;
  estimated_budget_paise: string | null;
  rule_pack_code: string | null;
  rule_pack_version: string | null;
  appropriate_govt: string;
  state_code: string;
  is_linear: boolean;
  row_width_m: string | null;
  total_area_proposed_sqm: string | null;
  is_urgency: boolean;
  in_scheduled_area: boolean;
  status: string;
  current_stage: string | null;
  submitted_at: string | null;
  data_source: string;
  footprint_area_sqm: string | null;
  alignment_km: string | null;
  rulePack: { code: string; version: string; title: string; verify: string[] } | null;
  districts: District[];
  kpis: Record<string, unknown> | null;
  nextDeadline: DeadlineRow | null;
  openDeadlines: DeadlineRow[];
}

export interface StageInstance {
  id: string;
  projectId: string;
  stageCode: string;
  attempt: number;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  assignedPostId: string | null;
  outcome: unknown;
  transitions: StageTransition[];
}

export interface StageTransition {
  id: string;
  fromStatus: string;
  toStatus: string;
  action: string;
  targetStageCode: string | null;
  reasonCode: string | null;
  remarks: string | null;
  actorUserId: string;
  actorPostId: string;
  at: string;
}

export interface TimelineStage {
  code: string;
  name: string;
  order: number;
  sections: string[];
  ownerRole: string;
  attempts: StageInstance[];
}

/** DeadlinesService.listForProject() — camelCase (Drizzle-typed), a different shape from
 * v_deadline_board's raw-SQL DeadlineRow. `status` is the full DeadlineStatus set (§10.2), not
 * just the three v_deadline_board computes. */
export interface ProjectDeadline {
  id: string;
  projectId: string;
  clockCode: string;
  section: string;
  subjectType: string;
  subjectId: string;
  startEvent: string;
  startedAt: string;
  dueAt: string;
  consequence: string;
  status: 'NOT_STARTED' | 'SAFE' | 'DUE_SOON' | 'BREACHED' | 'SATISFIED' | 'WAIVED' | 'VOIDED';
  daysRemaining: number | null;
  label: string;
  consequenceText: string | null;
}

export interface Timeline {
  project: { id: string; code: string; name: string; status: string; currentStage: string | null; rulePack: string };
  stages: TimelineStage[];
  deadlines: ProjectDeadline[];
}

export interface StageActionsView {
  stageCode: string;
  stageName: string;
  sections: string[];
  status: string;
  attempt: number | null;
  checklist: Array<{ code: string; type: string; docType?: string; hearingType?: string; required: boolean; satisfied: boolean }>;
  actions: ActionOption[];
}

export interface StageActionBody {
  action: string;
  reasonCode?: string | null;
  remarks?: string | null;
  targetStageCode?: string | null;
  writtenReasons?: string | null;
  documentIds?: string[];
  conditions?: string | null;
  attest?: boolean;
}

export const projectKey = (id: string) => ['project', id] as const;
export const timelineKey = (id: string) => ['project', id, 'timeline'] as const;
export const actionsKey = (id: string, stageCode: string) => ['project', id, 'actions', stageCode] as const;
export const packKey = (code: string, version: string) => ['rule-pack', code, version] as const;

export function useProject(id: string) {
  return useQuery({ queryKey: projectKey(id), queryFn: () => api<ProjectDetail>(`/projects/${id}`) });
}

export function useTimeline(id: string) {
  return useQuery({ queryKey: timelineKey(id), queryFn: () => api<Timeline>(`/projects/${id}/timeline`) });
}

export function useRulePack(code: string | null | undefined, version: string | null | undefined) {
  return useQuery({
    queryKey: packKey(code ?? '', version ?? ''),
    queryFn: () => api<Pack>(`/rules/packs/${code}/${version}`),
    enabled: !!code && !!version,
  });
}

export function useStageActions(projectId: string, stageCode: string | null) {
  return useQuery({
    queryKey: actionsKey(projectId, stageCode ?? ''),
    queryFn: () => api<StageActionsView>(`/projects/${projectId}/stages/${stageCode}/actions`),
    enabled: !!stageCode,
  });
}

export function useActOnStage(projectId: string, stageCode: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: StageActionBody) =>
      api(`/projects/${projectId}/stages/${stageCode}/actions`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: projectKey(projectId) });
      void client.invalidateQueries({ queryKey: timelineKey(projectId) });
      void client.invalidateQueries({ queryKey: actionsKey(projectId, stageCode) });
    },
  });
}

export type { Stage };
