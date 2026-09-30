import type { Geometry } from 'geojson';

// Shapes returned by apps/api/src/field (§16). Raw SQL rows keep their snake_case column names.

export const JIR_ITEM_TYPES = ['TREE', 'CROP', 'WELL', 'BOREWELL', 'IRRIGATION_PIPE', 'STRUCTURE', 'OTHER'] as const;
export type JirItemType = (typeof JIR_ITEM_TYPES)[number];

/** GET /field/assignments row. */
export interface Assignment {
  project_parcel_id: string;
  project_id: string;
  project_code: string;
  project_name: string;
  parcel_id: string;
  village_code: string;
  village_name: string;
  survey_no: string;
  boundary_source: string;
  status: string;
  affected_area_sqm: number | string | null;
  recorded_area_sqm: number | string | null;
  last_survey_status: string | null;
  lat: number | string | null;
  lng: number | string | null;
}

export interface Thresholds {
  gpsAccuracyWarnM: number;
  gpsAccuracyRejectM: number;
  photoMaxDistanceFromParcelM: number;
}

/** GET /field/assignments/:id/offline-pack. */
export interface OfflinePack {
  assignment: {
    projectParcelId: string;
    projectId: string;
    parcelId: string;
    projectCode: string;
    projectName: string;
  };
  footprint: Geometry | null;
  alignment: Geometry | null;
  village_boundary: Geometry | null;
  parcel_geometry: Geometry | null;
  neighbours: Array<{ id: string; survey_no: string; geometry: Geometry }>;
  jirItemTypes: JirItemType[];
  thresholds: Thresholds;
  reasonCodes: unknown;
  generatedAt: string;
}

// ---- Dexie records (§16.3) ----

export interface OfflinePackRow {
  projectParcelId: string;
  pack: OfflinePack;
  downloadedAt: string;
  basemap: { ok: boolean; message?: string };
}

export type SurveyStatus = 'draft' | 'queued' | 'synced' | 'rejected';

export interface SurveyRow {
  /** Client id; the server maps it to a deterministic survey id (idempotent CREATE_SURVEY). */
  clientId: string;
  projectParcelId: string;
  projectId: string;
  parcelId: string;
  surveyType: 'PARCEL_IDENTIFICATION' | 'JOINT_INSPECTION';
  startedAt: string;
  status: SurveyStatus;
  closed: boolean;
  /** Walked track as [lng, lat] — GeoJSON order, what SUBMIT_SURVEY expects. */
  track: Array<[number, number]>;
  notice?: { servedOn: string; photoLocalId: string };
  submittedAt?: string;
  /** Flags shown on Review when the survey was queued — compared with the server's on the Sync screen. */
  localFlags?: Record<string, string>;
  serverResult?: { surveyId?: string; parcelVersion?: number | null; vertices?: number; flags?: Record<string, string> };
  lastError?: string;
}

export interface VertexRow {
  surveyClientId: string;
  seq: number;
  lat: number;
  lng: number;
  accuracyM: number;
  samplesAveraged: number;
  photoLocalId: string;
  capturedAt: string;
}

export type PhotoKind = 'FIELD_PHOTO' | 'PILLAR_PHOTO' | 'S12_NOTICE_OF_ENTRY';
export type PhotoStatus = 'pending' | 'uploading' | 'uploaded' | 'rejected' | 'dropped';

export interface PhotoRow {
  localId: string;
  surveyClientId: string;
  projectId: string;
  kind: PhotoKind;
  blob: Blob;
  sha256: string;
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: string;
  /** Legal documents (the s.12 notice) are attested at upload (G21); field photos are not. */
  attest: boolean;
  status: PhotoStatus;
  documentId?: string;
  attempts: number;
  lastError?: string;
}

export interface JirItemRow {
  localId: string;
  surveyClientId: string;
  itemType: JirItemType;
  description: string;
  quantity: number | null;
  unit: string;
  photoLocalId: string;
  lat: number | null;
  lng: number | null;
  createdAt: string;
}

export interface PillarRow {
  localId: string;
  surveyClientId: string;
  pillarNo: number;
  lat: number;
  lng: number;
  photoLocalId: string;
}

export type SyncOpName = 'CREATE_SURVEY' | 'SET_NOTICE' | 'ADD_VERTEX' | 'ADD_JIR_ITEM' | 'ADD_PILLAR' | 'SUBMIT_SURVEY';
export type OutboxStatus = 'queued' | 'uploading' | 'synced' | 'rejected';

export interface OutboxRow {
  /** Auto-increment: insertion order is sync order. */
  id?: number;
  idempotencyKey: string;
  surveyClientId: string;
  op: SyncOpName;
  payload: Record<string, unknown>;
  /** A local photo whose server document id is filled into `payload[photoField]` just before sending. */
  photoLocalId?: string;
  photoField?: 'photoDocumentId' | 'documentId';
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  result?: unknown;
}
