import { companyTorEvaluation } from '../services/company-tor-evaluation.mjs';
import { httpError } from '../utils/http-error.mjs';

export async function evaluation(request, response) {
  if (!request.user.companyId) throw httpError(403, 'COMPANY_REQUIRED', 'A company profile is required for AI evaluation.');
  const result = await companyTorEvaluation(request.user.companyId, request.params.projectId, { start: request.method === 'POST' });
  response.setHeader('Cache-Control', 'no-store');
  response.status(result.status === 'processing' ? 202 : 200).json(result);
}
