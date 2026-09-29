import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiUpload } from '@/lib/api';

export interface RequiringBody {
  id: string;
  name: string;
  shortCode: string;
  type: string;
}
export interface StateRef {
  code: string;
  name: string;
}
export interface DistrictRef {
  code: string;
  name: string;
  stateCode: string;
  stateName: string;
}

export function useRequiringBodies() {
  return useQuery({ queryKey: ['org', 'requiring-bodies'], queryFn: () => api<RequiringBody[]>('/org/requiring-bodies') });
}
export function useStates() {
  return useQuery({ queryKey: ['org', 'states'], queryFn: () => api<StateRef[]>('/org/states') });
}
export function useDistricts() {
  return useQuery({ queryKey: ['org', 'districts'], queryFn: () => api<DistrictRef[]>('/org/districts') });
}

export interface CreateProjectInput {
  name: string;
  nameLocal?: string | null;
  category: string;
  subCategory?: string | null;
  acquisitionType: string;
  requiringBodyId: string;
  nationalImportance: boolean;
  estimatedBudgetRupees?: string | null;
  totalAreaHa?: number | null;
  appropriateGovt: string;
  stateCode: string;
  districtCodes: string[];
  isLinear: boolean;
  rowWidthM?: number | null;
  isUrgency: boolean;
}

export interface ProjectDraft {
  id: string;
  code: string;
  name: string;
  status: string;
  isLinear: boolean;
  rowWidthM: string | null;
}

export function useCreateProject() {
  return useMutation({
    mutationFn: (body: CreateProjectInput) => api<ProjectDraft>('/projects', { method: 'POST', body: JSON.stringify(body) }),
  });
}

export interface AlignmentPreview {
  alignment: unknown;
  footprint: unknown;
  footprint_area_sqm: string | null;
  alignment_km: string | null;
}

export function useUploadAlignment(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiUpload<AlignmentPreview>(`/projects/${projectId}/alignment`, form);
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['project', projectId] }),
  });
}

export interface PrescrutinyItem {
  code: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'NOT_EVALUATED';
  message: string;
  detail?: unknown;
}
export interface PrescrutinyResult {
  projectId: string;
  ok: boolean;
  items: PrescrutinyItem[];
}

export function useRunPrescrutiny(projectId: string) {
  return useMutation({
    mutationFn: () => api<PrescrutinyResult>(`/projects/${projectId}/prescrutiny`, { method: 'POST' }),
  });
}

export function useSubmitProject(projectId: string) {
  return useMutation({
    mutationFn: () => api(`/projects/${projectId}/submit`, { method: 'POST' }),
  });
}
