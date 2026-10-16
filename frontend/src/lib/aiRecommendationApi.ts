import { resolveApiUrl } from './api';
import { fetchWithSessionRefresh } from './authApi';

// AI suitability results are deliberately separate from matchingApi.ts.
export interface RecommendationItem {
  projectId: string;
  torVersion: number;
  title: string;
  suitability: 'suitable' | 'needs_review' | 'not_suitable';
  summary: string;
  reasons: string[];
  risks: string[];
  dataMode: 'demo' | 'source';
  model: string;
  evaluatedAt: string;
}

export interface RecommendationResponse {
  resultType: 'ai_recommendation';
  status: 'not_configured' | 'pending' | 'ready';
  items: RecommendationItem[];
}

export async function getRecommendations(signal?: AbortSignal): Promise<RecommendationResponse> {
  const endpoint = resolveApiUrl('/api/recommendations');
  if (!endpoint) throw new Error('The recommendation API is not configured.');
  const response = await fetchWithSessionRefresh(endpoint, { cache: 'no-store', signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || `Recommendations could not be loaded (HTTP ${response.status}).`);
  return body as RecommendationResponse;
}
