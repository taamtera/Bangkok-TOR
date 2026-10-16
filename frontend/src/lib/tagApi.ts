import { resolveApiUrl } from './api';
import { fetchWithSessionRefresh } from './authApi';

export type RequirementLevel = 'required' | 'preferred' | 'informational';
export type CompanyEvidenceLevel = 'claimed' | 'experienced' | 'verified';

export interface ControlledTag {
  _id: string;
  name: string;
  category: string;
  aliases?: string[];
  description?: string | null;
  status: 'active' | 'inactive';
}

export interface CompanyTagAssignment {
  tagId: string;
  verificationLevel: CompanyEvidenceLevel;
  evidence: string;
  reviewStatus?: string | null;
  profileDerived?: boolean;
}

export interface TorTagAssignment {
  tagId: string;
  requirementLevel: RequirementLevel;
  evidence: string;
  reviewStatus?: string | null;
}

export interface TorTagSuggestion extends TorTagAssignment {
  suggestionId: string;
  sourceDocumentUrl: string;
  sourcePage?: string | number | null;
  confidence: number;
  suggestedByUserId?: string | null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const endpoint = resolveApiUrl(path);
  if (!endpoint) throw new Error('The tag API is not configured.');
  const response = await fetchWithSessionRefresh(endpoint, {
    credentials: 'include', cache: 'no-store', ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) }
  });
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  if (!response.ok) throw new Error(body?.error?.message || `Tag request failed (HTTP ${response.status}).`);
  return body as T;
}

export async function listTags() {
  const body = await request<{ items: ControlledTag[] }>('/api/tags');
  return body.items || [];
}

export async function getCompanyAssignments(companyId: string) {
  const body = await request<{ assignments: CompanyTagAssignment[] }>(`/api/tags/companies/${encodeURIComponent(companyId)}`);
  return body.assignments || [];
}

export async function saveCompanyAssignments(companyId: string, assignments: CompanyTagAssignment[]) {
  return request(`/api/tags/companies/${encodeURIComponent(companyId)}`, {
    method: 'PUT', body: JSON.stringify({ assignments: assignments.map(({ tagId, verificationLevel, evidence }) => ({ tagId, verificationLevel, evidence })) })
  });
}

export async function saveTorAssignments(projectId: string, assignments: TorTagAssignment[]) {
  return request(`/api/tags/tors/${encodeURIComponent(projectId)}`, {
    method: 'PUT', body: JSON.stringify({ assignments: assignments.map(({ tagId, requirementLevel, evidence }) => ({ tagId, requirementLevel, evidence })) })
  });
}

export async function listTorSuggestions(projectId: string) {
  const body = await request<{ suggestions: TorTagSuggestion[] }>(`/api/tags/tors/${encodeURIComponent(projectId)}/suggestions`);
  return body.suggestions || [];
}

export async function reviewTorSuggestion(projectId: string, suggestionId: string, reviewStatus: 'approved' | 'rejected') {
  return request(`/api/tags/tors/${encodeURIComponent(projectId)}/suggestions/${encodeURIComponent(suggestionId)}`, {
    method: 'PATCH', body: JSON.stringify({ reviewStatus })
  });
}

export async function createTag(input: Pick<ControlledTag, 'name' | 'category'> & { aliases: string[]; description: string }) {
  return request<{ tag: ControlledTag }>('/api/tags', { method: 'POST', body: JSON.stringify(input) });
}
