'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FeatureCollection, Geometry } from 'geojson';
import { api } from '@/lib/api';

// Map layers, land registry and the field-office queue (A1–A4).

export type MapLayerName = 'villages' | 'districts' | 'states' | 'constraints' | 'projects';
export type BBox = [number, number, number, number];
export const INDIA_BBOX: BBox = [68, 6, 98, 37];

export interface LayersResponse {
  bbox: BBox;
  zoom: number;
  layers: Partial<Record<MapLayerName, FeatureCollection<Geometry, Record<string, unknown>>>>;
  notes: Record<string, string>;
}

/** Rounded so panning a few pixels doesn't refetch; the API cuts to the bbox and simplifies by zoom. */
const roundBBox = (b: BBox): BBox => [Math.floor(b[0] * 100) / 100, Math.floor(b[1] * 100) / 100, Math.ceil(b[2] * 100) / 100, Math.ceil(b[3] * 100) / 100];

export function useMapLayers(bbox: BBox | null, layers: MapLayerName[], zoom?: number) {
  const b = bbox ? roundBBox(bbox) : null;
  const names = [...layers].sort().join(',');
  return useQuery({
    queryKey: ['gis-layers', b?.join(','), names, zoom ?? null],
    queryFn: () => api<LayersResponse>(`/gis/layers?bbox=${b!.join(',')}&layers=${names}${zoom != null ? `&zoom=${zoom}` : ''}`),
    enabled: !!b && layers.length > 0,
    staleTime: 5 * 60_000,
    retry: false, // the maps must degrade to an empty state quickly when the API is down
  });
}

export interface RegistryFilters {
  projectId?: string;
  q?: string;
  district?: string;
  subDistrict?: string;
  village?: string;
  landClass?: string;
  status?: string;
  payment?: 'NONE' | 'UNPAID' | 'PART_PAID' | 'PAID' | 'ACKNOWLEDGED';
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  flagged?: boolean;
}

export interface RegistryRow {
  project_parcel_id: string;
  parcel_id: string;
  project_id: string;
  project_code: string;
  project_name: string;
  survey_no: string;
  village_code: string;
  village_name: string;
  sub_district_code: string;
  sub_district: string;
  district_code: string;
  district: string;
  land_class: string;
  boundary_source: string;
  version: number;
  status: string;
  flags: string[];
  affected_area_sqm: string | null;
  affected_pct: string | null;
  chainage_km: string | null;
  recorded_area_sqm: string | null;
  field_area_sqm: string | null;
  area_diff_pct: string | null;
  payment: string;
  deadline_risk: 'BREACHED' | 'DUE_SOON' | 'SAFE';
  legal_stay: boolean;
  open_flags: number;
  open_objections: number;
  unacknowledged: boolean;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  geometry: Geometry | null;
}

export interface RegistrySummary {
  parcels: number;
  affected_area_sqm: string;
  high_risk: number;
  payments_pending: number;
  legal_stays: number;
  flagged: number;
  by_status: Record<string, number>;
  by_payment: Record<string, number>;
  by_deadline_risk: Record<string, number>;
  by_risk_level: Record<string, number>;
}

export interface RegistryPage {
  items: RegistryRow[];
  nextCursor: string | null;
  summary?: RegistrySummary;
  riskNote: string;
}

const qs = (o: Record<string, string | number | boolean | undefined>) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== '' && v !== false)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');

/** Cursor-paginated registry; the first page carries the summary for the KPI strip and legend. */
export function useParcelRegistry(filters: RegistryFilters, opts: { geometry?: boolean; limit?: number } = {}) {
  return useInfiniteQuery({
    queryKey: ['gis-parcels', filters, opts],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api<RegistryPage>(`/gis/parcels?${qs({ ...filters, geometry: opts.geometry, limit: opts.limit ?? 100, cursor: pageParam ?? undefined })}`),
    getNextPageParam: (last) => last.nextCursor,
  });
}

export interface ParcelRisk {
  projectParcelId: string;
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: Array<{ code: string; points: number; label: string }>;
  evidence: Record<string, Array<Record<string, unknown>>>;
  note: string;
}

export const useParcelRisk = (projectParcelId: string | null) =>
  useQuery({
    queryKey: ['parcel-risk', projectParcelId],
    queryFn: () => api<ParcelRisk>(`/project-parcels/${projectParcelId}/risk`),
    enabled: !!projectParcelId,
  });

// ---- field office (A4)

export type SurveyQueueStatus = 'submitted' | 'verified' | 'returned';

export interface SurveyQueueRow {
  id: string;
  project_id: string;
  project_code: string;
  parcel_id: string | null;
  survey_type: string;
  status: SurveyQueueStatus;
  started_at: string | null;
  submitted_at: string | null;
  survey_no: string | null;
  village_name: string | null;
  surveyor_name: string;
  surveyor_designation: string;
  verified_by_designation: string | null;
  verification_remarks: string | null;
  flags: string[];
  vertex_count: number;
}

export interface SurveyDetail extends Omit<SurveyQueueRow, 'flags' | 'vertex_count'> {
  project_name: string;
  device_info: Record<string, unknown> | null;
  plausibility: {
    flags: Record<string, string>;
    vertices: Array<{ seq: number; issues: string[] }>;
    rejectedSeqs: number[];
    checkedAt: string;
  } | null;
  override_reason: string | null;
  notice_served_on: string | null;
  notice_document_id: string | null;
  track: Geometry | null;
  parcel_version: number | null;
  boundary_source: string | null;
  recorded_area_sqm: string | null;
  field_area_sqm: string | null;
  area_diff_pct: string | null;
  parcel_geometry: Geometry | null;
  recorded_geometry: Geometry | null;
  vertices: Array<{
    seq: number;
    lat: number;
    lng: number;
    accuracy_m: string | null;
    capture_method: string;
    samples_averaged: number | null;
    photo_document_id: string | null;
    captured_at: string;
    synced_at: string;
  }>;
  jirItems: Array<{ id: string; item_type: string; description: string | null; quantity: string | null; unit: string | null; photo_document_id: string | null }>;
  pillars: Array<{ pillar_no: number; photo_document_id: string | null; point: Geometry }>;
}

export const useSurveyQueue = (status: SurveyQueueStatus, projectId?: string) =>
  useQuery({
    queryKey: ['field-surveys', status, projectId ?? null],
    queryFn: () => api<SurveyQueueRow[]>(`/field/surveys?${qs({ status, projectId })}`),
  });

export const useSurveyDetail = (id: string | null) =>
  useQuery({ queryKey: ['field-survey', id], queryFn: () => api<SurveyDetail>(`/field/surveys/${id}`), enabled: !!id });

export function useReturnSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api(`/field/surveys/${id}/return`, { method: 'POST', body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['field-surveys'] });
      void qc.invalidateQueries({ queryKey: ['field-survey'] });
    },
  });
}

// ---- A3: families / payments on a parcel

export interface ParcelFamilyDisbursement {
  id: string;
  amountPaise: string;
  instrument: 'DBT' | 'DEPOSIT_WITH_AUTHORITY';
  paymentStatus: 'INITIATED' | 'PENDING' | 'SUCCESS' | 'FAILED';
  paidOn: string | null;
  adapterProvider: string | null;
  adapterRef: string | null;
  /** Present only when the server's redaction map lets this post see it (§11.4). */
  holdReasonCode?: string | null;
  holdReason?: string | null;
  acknowledgement: { method: string; confirmedAt: string } | null;
}

export interface ParcelFamily {
  id: string;
  affected_type: string;
  is_displaced: boolean;
  is_sc_st: boolean;
  head_name: string;
  interest_type: string;
  assessed_paise: string | null;
  disbursed_paise: string | null;
  acknowledged_paise: string | null;
  unconfirmed_paise: string | null;
  held_paise: string | null;
  deposited_paise: string | null;
  entitlements: Array<{ id: string; headCode: string; amountPaise: string; status: string; dueBy: string | null; disbursements: ParcelFamilyDisbursement[] }>;
}

export const useParcelFamilies = (projectParcelId: string | null) =>
  useQuery({
    queryKey: ['parcel-families', projectParcelId],
    queryFn: () => api<ParcelFamily[]>(`/project-parcels/${projectParcelId}/families`),
    enabled: !!projectParcelId,
  });

export interface ParcelDocument {
  id: string;
  doc_type: string;
  title: string;
  version: number;
  supersedes_id: string | null;
  sha256: string;
  uploaded_at: string;
  uploaded_by_designation: string | null;
  declaration_version: string | null;
  attested_at: string | null;
  designation_snapshot: string | null;
  is_current: boolean;
}

/** Documents filed against the parcel and against its project-parcel link. */
export function useParcelDocuments(parcelId: string | null, projectParcelId: string | null) {
  return useQuery({
    queryKey: ['parcel-documents', parcelId, projectParcelId],
    enabled: !!parcelId,
    queryFn: async () => {
      const [a, b] = await Promise.all([
        api<ParcelDocument[]>(`/documents?entityId=${parcelId}`),
        projectParcelId ? api<ParcelDocument[]>(`/documents?entityId=${projectParcelId}`) : Promise.resolve([]),
      ]);
      return [...a, ...b].sort((x, y) => y.uploaded_at.localeCompare(x.uploaded_at));
    },
  });
}

// ---- A4: boundary corrections queue

export interface CorrectionRow {
  id: string;
  parcel_id: string;
  from_version: number;
  to_version: number | null;
  reason: string;
  status: 'requested' | 'approved' | 'rejected';
  created_at: string;
  decided_at: string | null;
  requested_by_post_id: string;
  requested_by_designation: string;
  decided_by_designation: string | null;
  survey_no: string;
  village_name: string;
  current_version: number;
  from_geometry: Geometry | null;
  proposed_geometry: Geometry | null;
  proposed_area_sqm: string | null;
  current_area_sqm: string | null;
}

export const useCorrections = (status: CorrectionRow['status'] = 'requested') =>
  useQuery({ queryKey: ['field-corrections', status], queryFn: () => api<CorrectionRow[]>(`/field/corrections?status=${status}`) });

export interface Assignment {
  project_parcel_id: string;
  project_id: string;
  project_code: string;
  project_name: string;
  parcel_id: string;
  village_name: string;
  survey_no: string;
  boundary_source: string;
  status: string;
  last_survey_status: string | null;
  lat: number | null;
  lng: number | null;
}

export const useAssignments = () => useQuery({ queryKey: ['field-assignments'], queryFn: () => api<Assignment[]>('/field/assignments') });
