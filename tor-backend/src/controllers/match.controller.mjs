import { getAiRecommendationInput, getCompanyMatches } from '../services/requirement-matching.service.mjs';

export async function list(request, response) {
  response.json(await getCompanyMatches(request.user.companyId, request.query));
}

export async function aiInput(request, response) {
  response.json(await getAiRecommendationInput(request.user.companyId));
}
