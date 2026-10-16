import type { TORContract } from '@/types';
import { BackendTor, toTorContract } from './torApi';
import { resolveApiUrl } from './api';
import { fetchWithSessionRefresh } from './authApi';

export interface MatchComponent {
  label: string;
  status: 'met' | 'partial' | 'missing';
  companyCapability: { text: string; verificationLevel: 'claimed' | 'experienced' | 'verified'; evidence: string } | null;
}

export interface RequirementMatch {
  requirementId: string;
  tagId: string | null;
  requirementText: string;
  requirementLevel: 'required' | 'preferred' | 'mentioned' | 'informational';
  status: 'met' | 'partial' | 'missing' | 'informational' | 'unassessed';
  coverage: number;
  verificationLevel: 'claimed' | 'experienced' | 'verified' | null;
  requirementEvidence: string | null;
  requirementSourceUrl: string | null;
  companyEvidence: string | null;
  components: MatchComponent[];
}

export interface MatchingItem {
  score: number;
  evidenceScore: number;
  dataMode: 'demo' | 'source';
  torVersion: number;
  requirementMatches: RequirementMatch[];
  explanation: string;
  counts: { met: number; partial: number; missing: number; unassessed: number };
  tor: BackendTor;
  contract: TORContract;
}

export interface MatchingResponse {
  items: MatchingItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export async function getMatches(page = 1, signal?: AbortSignal): Promise<MatchingResponse> {
  const endpoint = resolveApiUrl(`/api/matches?page=${page}&limit=20`);
  if (!endpoint) throw new Error('The matching API is not configured.');
  const response = await fetchWithSessionRefresh(endpoint, { cache: 'no-store', signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.code === 'MATCHING_ENGINE_UNAVAILABLE'
    ? 'Matching is temporarily unavailable. Your profile remains saved. Please try again.'
    : body.error?.message || `Matches could not be loaded (HTTP ${response.status}).`);
  return { pagination: body.pagination, items: body.items.map((item: Omit<MatchingItem, 'contract'>) => ({
    ...item, contract: { ...toTorContract(item.tor), properties: item.requirementMatches.map((requirement) => ({
      id: requirement.requirementId, property: requirement.requirementText,
      category: 'technical' as const, required: requirement.requirementLevel === 'required',
      fulfilledBySoftwareHouse: requirement.status === 'met'
    })) }
  })) };
}
