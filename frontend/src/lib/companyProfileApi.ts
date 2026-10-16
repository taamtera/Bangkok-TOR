import { resolveApiUrl } from './api';
import { fetchWithSessionRefresh } from './authApi';

export interface CompanyProfileData {
  displayName: string;
  companySize: string;
  district: string;
  contactEmail: string;
  technologies: string[];
  qualifications: string[];
}

async function request(path: string, method: 'GET' | 'PUT', profile?: CompanyProfileData) {
  const endpoint = resolveApiUrl(path);
  if (!endpoint) throw new Error('The company profile API is not configured.');

  let response: Response;
  try {
    response = await fetchWithSessionRefresh(endpoint, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: profile ? { 'Content-Type': 'application/json' } : undefined,
      body: profile ? JSON.stringify(profile) : undefined
    });
  } catch {
    throw new Error('Could not reach the server to load or save the company profile.');
  }

  const body = await response.json().catch(() => null) as {
    company?: CompanyProfileData;
    error?: { message?: string };
  } | null;
  if (!response.ok || !body?.company) {
    throw new Error(body?.error?.message || `Company profile could not be ${method === 'GET' ? 'loaded' : 'saved'} (HTTP ${response.status}).`);
  }
  return body.company;
}

export function getMyCompanyProfile() {
  return request('/api/companies/me', 'GET');
}

export function updateMyCompanyProfile(profile: CompanyProfileData) {
  return request('/api/companies/me', 'PUT', profile);
}

export async function syncMyMatchingTags() {
  const endpoint = resolveApiUrl('/api/companies/me/matching-tags/sync');
  if (!endpoint) throw new Error('The company profile API is not configured.');
  const response = await fetchWithSessionRefresh(endpoint, { method: 'POST', credentials: 'include', cache: 'no-store' });
  const body = await response.json().catch(() => null) as { linkedCapabilities?: number; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(body?.error?.message || `Profile capabilities could not be linked (HTTP ${response.status}).`);
  return body?.linkedCapabilities ?? 0;
}
