import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ChainVerification {
  entityType: string;
  entityId: string;
  version: number;
  currentHash: string | null;
  lineage: Array<{ version: number; status: string; blockNumber: number | null; txHash: string | null; eventType: string }>;
  result: 'VERIFIED' | 'MISMATCH' | 'PENDING' | 'NOT_ANCHORED';
  chainStatus?: string;
  lastError?: string | null;
  anchoredHash?: string;
  blockNumber?: number | null;
  txHash?: string | null;
  anchoredAt?: string;
  eventType?: string;
}

export function useChainVerify(entityType: string, entityId: string | null, version?: number) {
  return useQuery({
    queryKey: ['chain', 'verify', entityType, entityId, version ?? 'latest'],
    queryFn: () => api<ChainVerification>(`/chain/verify/${entityType}/${entityId}${version ? `?version=${version}` : ''}`),
    enabled: !!entityId,
    staleTime: 15_000,
  });
}
