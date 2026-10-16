import { TORContract, TORRequirement, ProjectFields } from '@/types';
import { resolveApiUrl } from './api';

export interface BackendTor extends Partial<ProjectFields> {
  projectId: string;
  sourceId?: string | null;
  departmentId?: string | null;
  title?: string | null;
  description?: string | null;
  departmentName?: string | null;
  publishedAt?: string | null;
  submissionDeadline?: string | null;
  projectStartAt?: string | null;
  projectEndAt?: string | null;
  url?: string | null;
  documentUrl?: string | null;
  thumbnail?: string | null;
  procurementMethod?: string | Record<string, unknown> | null;
  category?: string | null;
  status?: string | null;
  budget?: {
    minAmount?: number | null;
    maxAmount?: number | null;
  } | null;
  tagAssignments?: Array<{
    tagId?: string;
    requirementLevel?: 'required' | 'preferred' | 'mentioned' | 'informational';
    evidence?: string | null;
    reviewStatus?: string | null;
    source?: string | null;
    suggestionId?: string | null;
    confidence?: number | null;
    sourceDocumentUrl?: string | null;
    sourcePage?: string | number | null;
  }>;
}

interface BackendTorListResponse {
  items: BackendTor[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function textValue(value: string | Record<string, unknown> | null | undefined) {
  if (typeof value === 'string') return value;
  return String(value?.name || value?.label || value?.code || value?.id || '');
}

function formatBudget(amount: number | null) {
  return amount === null ? 'Not specified' : `${amount.toLocaleString('en-US')} THB`;
}

function mapRequirements(tor: BackendTor): TORRequirement[] {
  return (tor.tagAssignments || []).map((assignment, index) => ({
    id: assignment.tagId || `tag-${index}`,
    property: assignment.evidence || assignment.requirementLevel || 'Tagged requirement',
    category: 'technical',
    required: assignment.requirementLevel === 'required'
  }));
}

export function toTorContract(tor: BackendTor): TORContract {
  if (typeof tor.projectId !== 'string' || !tor.projectId.trim()) throw new Error('Project ID must be a non-empty string.');
  const title = tor.title?.trim() || 'Untitled TOR announcement';
  const publicationDate = tor.publishedAt || '';
  const documentUrl = tor.documentUrl || tor.url || null;

  return {
    id: tor.projectId,
    projectId: tor.projectId,
    scope: tor.scope ?? 'department',
    identityScope: tor.identityScope ?? (tor.projectId.startsWith('P') ? 'plan' : 'project'),
    linkedProjectId: tor.linkedProjectId ?? null,
    statusPublishedAt: tor.statusPublishedAt ?? null,
    statusOrderAmbiguous: tor.statusOrderAmbiguous === true,
    stageObservations: tor.stageObservations ?? {},
    biddingOpenVerified: tor.biddingOpenVerified === true,
    titleMatchedKeywords: tor.titleMatchedKeywords ?? [],
    thumbnailSourceUrl: tor.thumbnailSourceUrl ?? null,
    channelParams: tor.channelParams ?? {}, itemParams: tor.itemParams ?? {},
    firstSeenAt: tor.firstSeenAt ?? null, lastSeenAt: tor.lastSeenAt ?? null,
    sourceId: tor.sourceId || null,
    title,
    contractOwner: tor.departmentName || tor.sourceId || 'e-GP',
    departmentId: tor.departmentId || null,
    departmentName: tor.departmentName || null,
    publisherType: 'Ministry',
    price: tor.budget?.maxAmount ?? tor.budget?.minAmount ?? null,
    priceFormatted: formatBudget(tor.budget?.maxAmount ?? tor.budget?.minAmount ?? null),
    startDate: tor.projectStartAt || '',
    endDate: tor.projectEndAt || '',
    postingDate: publicationDate,
    publishedAt: tor.publishedAt || null,
    submissionDeadline: tor.submissionDeadline || 'Not specified',
    category: textValue(tor.procurementMethod) || 'Government procurement',
    procurementMethod: tor.procurementMethod || null,
    description: tor.description || '',
    properties: mapRequirements(tor),
    pdfUrl: documentUrl || '',
    url: tor.url || null,
    documentUrl: tor.documentUrl || null,
    aiEvaluation: {
      priceScore: 0,
      priceAssessment: 'AI evaluation not available yet.',
      qualificationMatchScore: 0,
      riskLevel: 'Medium',
      riskAnalysis: 'No AI evaluation is available for this announcement.',
      keyRequirementsExtracted: [],
      aiModel: 'Not evaluated',
      evaluatedAt: ''
    },
    status: tor.status || 'unknown',
    thumbnail: `/api/thumbnail/${encodeURIComponent(tor.projectId)}`
  };
}

export interface DiscoveryFacets {
  departments: Array<{ value: string; name: string | null; count: number }>;
  methods: Array<{ value: string; count: number }>;
}
export async function listTors(options: Record<string, string | number> = {}, signal?: AbortSignal) {
  const result = await listBackendTors(options, signal);
  return { items: result.items.map(toTorContract), total: result.pagination.total,
    pagination: result.pagination, totalAllProjects: result.totalAllProjects,
    facets: result.facets };
}

export async function listBackendTors(options: Record<string, string | number> = {}, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: '1', limit: '25' });
  Object.entries(options).forEach(([key, value]) => { if (value !== '') params.set(key, String(value)); });
  const endpoint = resolveApiUrl(`/api/tors?${params}`)!;
  const response = await fetch(endpoint, { credentials: 'include', cache: 'no-store', signal });
  if (!response.ok) throw new Error(`The TOR backend returned HTTP ${response.status}.`);
  const body = await response.json() as BackendTorListResponse & { facets?: DiscoveryFacets; totalAllProjects?: number };
  const validItems = (body.items || []).filter(tor => typeof tor.projectId === 'string' && tor.projectId.trim().length > 0);
  return { items: validItems, pagination: body.pagination, totalAllProjects: body.totalAllProjects ?? body.pagination.total,
    facets: body.facets ?? { departments: [], methods: [] } };
}

export async function getTor(projectId: string, signal?: AbortSignal): Promise<BackendTor> {
  const endpoint = resolveApiUrl(`/api/tors/${encodeURIComponent(projectId)}`);
  if (!endpoint) throw new Error('The TOR API is not configured.');
  const response = await fetch(endpoint, { credentials: 'include', cache: 'no-store', signal });
  const body = await response.json().catch(() => null) as { tor?: BackendTor; error?: { message?: string } } | null;
  if (!response.ok || !body?.tor) throw new Error(body?.error?.message || `TOR details could not be loaded (HTTP ${response.status}).`);
  return body.tor;
}
