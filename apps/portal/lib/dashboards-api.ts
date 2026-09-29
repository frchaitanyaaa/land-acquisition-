import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Minimal GeoJSON typing — just enough for the map layer, no @types/geojson dependency. */
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}
export interface GeoPolygonish {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: unknown;
}
export type GeoGeometry = GeoPoint | GeoPolygonish;

export interface Kpis {
  projects: number;
  area_affected_sqm: string | number | null;
  area_notified_sqm: string | number | null;
  area_acquired_sqm: string | number | null;
  compensation_assessed_paise: string;
  compensation_paid_paise: string;
  compensation_acknowledged_paise: string;
  compensation_unconfirmed_paise: string;
  affected_families: number;
  displaced_families: number;
  possession_pct: string | number | null;
  rnr_completion_pct: string | number | null;
  timeline_adherence_pct: string | number | null;
  deadlines_breached: number;
}

export type LiveStatus = 'BREACHED' | 'DUE_SOON' | 'SAFE';

export interface Alert {
  id: string;
  project_id: string;
  project_code: string;
  project_name: string;
  clock_code: string;
  label: string | null;
  section: string | null;
  consequence: string | null;
  consequence_text: string | null;
  due_at: string;
  days_remaining: number;
  live_status: LiveStatus;
  subject_type: string;
  instances: number;
}

export interface ProjectMapRow {
  project_id: string;
  code: string;
  name: string;
  status: string;
  current_stage: string;
  state_code: string;
  footprint: GeoPolygonish | null;
  centroid: GeoPoint | null;
  risk: LiveStatus;
}

export interface StateRow extends Kpis {
  state_code: string;
  state_name: string;
}

export interface DistrictRow extends Kpis {
  district_code: string;
  district_name: string;
}

export interface InterestLiability {
  estimated_interest_paise: string;
  entitlements: number;
}

export interface NationalDashboard {
  scope: Record<string, unknown>;
  asOf: string;
  kpis: Kpis;
  alerts: Alert[];
  estimatedInterestLiability: InterestLiability;
  projects: ProjectMapRow[];
  states: StateRow[];
  districts: DistrictRow[];
}

export interface ConsentMeter {
  register_id: string;
  project_id: string;
  project_code: string;
  project_name: string;
  consent_type: string;
  status: string;
  eligible: number;
  consented: number;
  refused: number;
  pct: string | number | null;
  threshold: string | number | null;
  met: boolean | null;
}

export interface DeadlineRow {
  id: string;
  project_id: string;
  project_code: string;
  project_name: string;
  clock_code: string;
  section: string | null;
  subject_type: string;
  started_at: string;
  due_at: string;
  consequence: string | null;
  consequence_text: string | null;
  label: string | null;
  days_remaining: number;
  live_status: LiveStatus;
  assigned_post_id: string | null;
}

export interface PendingVerification {
  project_parcel_id: string;
  parcel_id: string;
  project_code: string;
  survey_no: string;
  village_name: string;
  status: string;
  flags: string[];
}

export interface ReturnedFile {
  project_id: string;
  project_code: string;
  stage_code: string;
  attempt: number;
  reason_code: string | null;
  remarks: string | null;
  at: string;
}

export interface UnacknowledgedRow {
  affected_family_id: string;
  project_id: string;
  project_code: string;
  head_name: string;
  disbursed_paise: string;
  acknowledged_paise: string;
  unconfirmed_paise: string;
  held_paise: string;
}

export interface CollectorDashboard {
  asOf: string;
  post: { designation: string; districtCode: string | null };
  kpis: Kpis;
  deadlineBoard: DeadlineRow[];
  entitlementClocks: Alert[];
  estimatedInterestLiability: InterestLiability;
  consentMeters: ConsentMeter[];
  pendingVerifications: PendingVerification[];
  returnedFiles: ReturnedFile[];
  unacknowledged: UnacknowledgedRow[];
}

export const nationalKey = ['dashboards', 'national'] as const;
export const collectorKey = ['dashboards', 'collector'] as const;

export function useNationalDashboard() {
  return useQuery({
    queryKey: nationalKey,
    queryFn: () => api<NationalDashboard>('/dashboards/national'),
  });
}

export function useCollectorDashboard() {
  return useQuery({
    queryKey: collectorKey,
    queryFn: () => api<CollectorDashboard>('/dashboards/collector'),
  });
}
