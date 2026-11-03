import { resolveApiUrl } from './api';

export interface DashboardStats {
  matches: { total: number; avgScore: number; companiesMatched: number };
  vendors: number;
  crawl: { runs: number; itemsFetched: number };
  sources: { count: number; names: string[] };
  topDemand: Array<{ count: number; name: string }>;
}

export async function getDashboardStats(signal?: AbortSignal): Promise<DashboardStats> {
  const endpoint = resolveApiUrl('/api/dashboard/stats');
  if (!endpoint) throw new Error('The dashboard API is not configured.');
  const response = await fetch(endpoint, { credentials: 'include', cache: 'no-store', signal });
  const body = await response.json().catch(() => null) as DashboardStats | { error?: { message?: string } } | null;
  if (!response.ok || !body || 'error' in body) {
    throw new Error((body as { error?: { message?: string } } | null)?.error?.message || `Dashboard stats could not be loaded (HTTP ${response.status}).`);
  }
  return body as DashboardStats;
}
