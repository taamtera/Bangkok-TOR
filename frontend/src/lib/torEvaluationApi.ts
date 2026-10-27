import { fetchWithSessionRefresh } from './authApi';
import { resolveApiUrl } from './api';

export interface CompanyTorEvaluation {
  summary: string;
  priceScore: number | null;
  priceAssessment: string;
  qualificationMatchScore: number | null;
  qualificationAnalysis: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Unknown';
  riskAnalysis: string;
  keyRequirementsExtracted: string[];
  strengths: string[];
  gaps: string[];
  missingInformation: string[];
  aiModel: string;
  evaluatedAt: string;
}
export interface EvaluationResult {
  status: 'missing' | 'processing' | 'completed' | 'failed' | 'insufficient_data';
  evaluation: CompanyTorEvaluation | null;
  error: { code: string; message: string } | null;
  missingInformation?: string[];
}
export async function getTorEvaluation(projectId: string, start: boolean, signal: AbortSignal): Promise<EvaluationResult> {
  const response = await fetchWithSessionRefresh(resolveApiUrl(`/api/tors/${encodeURIComponent(projectId)}/evaluation`)!, {
    method: start ? 'POST' : 'GET', cache: 'no-store', signal
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || 'The AI evaluation could not be loaded.');
  return body;
}
