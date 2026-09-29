import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type ColorBy = 'stage' | 'payment' | 'risk';

export interface ParcelFeature {
  type: 'Feature';
  id: string;
  geometry: unknown;
  properties: {
    project_parcel_id: string;
    parcel_id: string;
    village_code: string;
    village_name: string;
    survey_no: string;
    land_class: string;
    boundary_source: string;
    version: number;
    status: string;
    flags: string[];
    affected_area_sqm: string;
    affected_pct: string;
    chainage_km: string | null;
    recorded_area_sqm: string | null;
    field_area_sqm: string | null;
    area_diff_pct: string | null;
    transfer_frozen_at: string | null;
    payment: string;
    risk: 'BREACHED' | 'DUE_SOON' | 'SAFE';
    category: string;
  };
}

export interface ParcelsGeoJson {
  type: 'FeatureCollection';
  colorBy: ColorBy;
  project: { id: string; code: string; name: string; footprint: unknown; alignment: unknown; bbox: unknown };
  features: ParcelFeature[];
}

export interface ChainageBin {
  bin: number;
  from_km: string;
  to_km: string;
  parcels: number;
  affected_area_sqm: string;
  flagged: number;
  possessed: number;
  statuses: string[];
}

export interface SpatialFlag {
  id: string;
  project_id: string;
  project_parcel_id: string | null;
  layer_type: string | null;
  flag_type: string;
  overlap_area_sqm: string | null;
  message: string;
  raised_at: string;
  acknowledged_by_post_id: string | null;
  acknowledged_at: string | null;
  survey_no: string | null;
  village_name: string | null;
}

export interface ParcelDetail {
  id: string;
  village_code: string;
  village_name: string;
  village_name_local: string | null;
  survey_number: string;
  sub_division: string | null;
  survey_no: string;
  recorded_area_sqm: string | null;
  field_area_sqm: string | null;
  area_diff_pct: string | null;
  boundary_source: string;
  land_class: string;
  is_irrigated_multicrop: boolean;
  in_scheduled_area: boolean;
  transfer_frozen_at: string | null;
  geom_hash: string;
  version: number;
  data_source: string;
  geom_area_sqm: string;
  geometry: unknown;
  versions: Array<{
    version: number;
    geom_hash: string;
    recorded_area_sqm: string | null;
    field_area_sqm: string | null;
    boundary_source: string;
    superseded_at: string;
    geometry: unknown;
  }>;
  projects: Array<{
    project_parcel_id: string;
    project_id: string;
    project_code: string;
    project_name: string;
    status: string;
    flags: string[];
    affected_area_sqm: string;
    affected_pct: string;
    chainage_km: string | null;
  }>;
  interests: Array<{
    id: string;
    interest_type: string;
    share_fraction: string | null;
    verification_status: string;
    person_id: string;
    full_name: string;
    person: { id: string; fullName: string; phone: string | null; bankRef: string | null };
  }>;
  surveys: Array<{
    id: string;
    project_id: string;
    survey_type: string;
    status: string;
    started_at: string | null;
    submitted_at: string | null;
    notice_served_on: string | null;
    plausibility: { flags?: Record<string, unknown> } | null;
    verification_remarks: string | null;
    override_reason: string | null;
    verified_by_post_id: string | null;
    track: unknown;
  }>;
  vertices: Array<{
    id: string;
    survey_id: string;
    seq: number;
    lat: string;
    lng: string;
    accuracy_m: string;
    capture_method: string;
    samples_averaged: number | null;
    photo_document_id: string | null;
    captured_at: string;
    synced_at: string;
  }>;
  jirItems: Array<{ id: string; item_type: string; description: string | null; quantity: string | null; unit: string | null; photo_document_id: string | null }>;
  pillars: Array<{ id: string; pillar_no: number; point: unknown; photo_document_id: string | null }>;
  corrections: Array<{
    id: string;
    from_version: number;
    to_version: number | null;
    reason: string;
    status: string;
    requested_by_post_id: string;
    approved_by_post_id: string | null;
    decided_at: string | null;
    proposed_geometry: unknown;
  }>;
  chain: Array<{ entity_version: number; event_type: string; status: string; tx_hash: string | null; block_number: number | null; anchored_at: string | null; data_hash: string }>;
}

export const parcelsKey = (projectId: string, colorBy: ColorBy) => ['project', projectId, 'parcels', colorBy] as const;
export const chainageKey = (projectId: string, binM: number) => ['project', projectId, 'chainage', binM] as const;
export const flagsKey = (projectId: string) => ['project', projectId, 'flags'] as const;
export const parcelKey = (id: string) => ['parcel', id] as const;

export function useParcels(projectId: string, colorBy: ColorBy) {
  return useQuery({
    queryKey: parcelsKey(projectId, colorBy),
    queryFn: () => api<ParcelsGeoJson>(`/projects/${projectId}/parcels?colorBy=${colorBy}`),
  });
}

export function useChainage(projectId: string, binM = 500) {
  return useQuery({
    queryKey: chainageKey(projectId, binM),
    queryFn: () => api<ChainageBin[]>(`/projects/${projectId}/chainage?binM=${binM}`),
  });
}

export function useFlags(projectId: string) {
  return useQuery({ queryKey: flagsKey(projectId), queryFn: () => api<SpatialFlag[]>(`/projects/${projectId}/flags`) });
}

export function useAcknowledgeFlag(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (flagId: string) => api(`/flags/${flagId}/acknowledge`, { method: 'POST' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: flagsKey(projectId) }),
  });
}

export function useParcel(id: string | null) {
  return useQuery({
    queryKey: parcelKey(id ?? ''),
    queryFn: () => api<ParcelDetail>(`/parcels/${id}`),
    enabled: !!id,
  });
}

export function useVerifyParcel(parcelId: string, projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { remarks?: string | null; overrideReason?: string | null }) =>
      api(`/parcels/${parcelId}/verify`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: parcelKey(parcelId) });
      void client.invalidateQueries({ queryKey: parcelsKey(projectId, 'stage') });
      void client.invalidateQueries({ queryKey: parcelsKey(projectId, 'payment') });
      void client.invalidateQueries({ queryKey: parcelsKey(projectId, 'risk') });
    },
  });
}

export function useRequestCorrection(parcelId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { geometry: unknown; reason: string }) =>
      api(`/parcels/${parcelId}/corrections`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: parcelKey(parcelId) }),
  });
}

export function useDecideCorrection(parcelId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ correctionId, approve }: { correctionId: string; approve: boolean }) =>
      api(`/parcel-corrections/${correctionId}/decide`, { method: 'POST', body: JSON.stringify({ approve }) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: parcelKey(parcelId) }),
  });
}
