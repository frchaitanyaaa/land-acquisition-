'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Module F — award entry, OCR review, checks, signing (§20). The portal RECORDS the Collector's
// award (G1): every amount is typed by the LAO or accepted field-by-field from OCR by a human.

export interface AwardListRow {
  id: string;
  project_id: string;
  award_type: 'LAND' | 'RNR';
  award_no: string;
  document_id: string | null;
  status: string;
  version: number;
  entitlements: number;
  total_paise: string;
  ocr_extraction_id: string | null;
}

/** One suggested field from the extractor (apps/api/src/jobs/ocr-extract.ts). */
export interface ExtractedField {
  /** `<affectedFamilyId>:<headCode>` */
  key: string;
  value: string;
  confidence: number;
  page: number;
  /** [x, y, w, h] in PDF points when the extractor has it; the demo extractor gives null. */
  bbox: [number, number, number, number] | null;
}

export interface Extraction {
  id: string;
  document_id: string;
  engine: string;
  status: 'pending' | 'ready' | 'reviewed';
  fields: ExtractedField[];
  accepted: Array<{ key: string; value: string | number; acceptedAt: string }>;
  last_error: string | null;
}

export interface CheckResult {
  code: string;
  section: string;
  status: 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'NOT_EVALUATED';
  message: string;
  headCode?: string;
}

export interface AwardChecks {
  families: Array<{ familyId: string; results: CheckResult[]; failed: CheckResult[] }>;
  failures: number;
}

export interface FamilyRow {
  id: string;
  affected_type: string;
  is_displaced: boolean;
  is_sc_st: boolean;
  head_name: string;
  village_code: string;
  assessed_paise: string;
  sanctioned_paise: string;
  disbursed_paise: string;
  acknowledged_paise: string;
  unconfirmed_paise: string;
  held_paise: string;
  deposited_paise: string;
  money_state: 'NOT_AWARDED' | 'ACKNOWLEDGED' | 'DISBURSED_NOT_ACKNOWLEDGED' | 'PART_PAID' | 'UNPAID';
}

export const useAwards = (projectId: string) =>
  useQuery({ queryKey: ['awards', projectId], queryFn: () => api<AwardListRow[]>(`/projects/${projectId}/awards`) });

export const useProjectFamilies = (projectId: string) =>
  useQuery({
    queryKey: ['project-families', projectId],
    queryFn: () => api<FamilyRow[]>(`/projects/${projectId}/families?limit=2000`),
  });

/** Polls while the OCR job is still running. */
export const useExtraction = (id: string | null) =>
  useQuery({
    queryKey: ['ocr-extraction', id],
    queryFn: () => api<Extraction>(`/ocr-extractions/${id}`),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 2000 : false),
  });

export const useAwardChecks = (awardId: string | null) =>
  useQuery({
    queryKey: ['award-checks', awardId],
    queryFn: () => api<AwardChecks>(`/awards/${awardId}/checks`),
    enabled: !!awardId,
  });

export function useCreateAward(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { awardType: 'LAND' | 'RNR'; awardNo: string; documentId: string }) =>
      api<AwardListRow & { ocrExtractionId: string | null }>(`/projects/${projectId}/awards`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['awards', projectId] }),
  });
}

/** Accept ONE field (never a bulk auto-accept, §20). */
export function useAcceptField(extractionId: string, projectId: string, awardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (field: { key: string; value: string }) =>
      api(`/ocr-extractions/${extractionId}/review`, { method: 'POST', body: JSON.stringify({ accepted: [field] }) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ocr-extraction', extractionId] });
      void qc.invalidateQueries({ queryKey: ['award-checks', awardId] });
      void qc.invalidateQueries({ queryKey: ['awards', projectId] });
    },
  });
}

export function useSignAward(projectId: string, awardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { overrideReason: string | null }) =>
      api(`/awards/${awardId}/sign`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['awards', projectId] });
      void qc.invalidateQueries({ queryKey: ['award-checks', awardId] });
    },
  });
}
