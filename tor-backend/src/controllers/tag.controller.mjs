import { findCompanyById, replaceCompanyTagAssignments } from '../repositories/company.repository.mjs';
import {
  createControlledTag,
  deactivateControlledTag,
  findControlledTagById,
  listControlledTags,
  updateControlledTag
} from '../repositories/tag.repository.mjs';
import { findTorByProjectId, replaceTorTagAssignments, replaceTorTagSuggestions, reviewTorTagSuggestion } from '../repositories/tor.repository.mjs';
import { httpError } from '../utils/http-error.mjs';
import { serializeTor } from '../serializers/tor.serializer.mjs';
import { refreshCompanyRequirementMatches as refreshCompanyMatches,
  refreshTorRequirementMatches as refreshMatchesForTor } from '../services/requirement-matching.service.mjs';
import {
  TAG_CATEGORIES,
  validateCompanyTagAssignments,
  validateCreateTag,
  validateTorTagAssignments,
  validateTorTagSuggestions,
  validateTorSuggestionReview,
  validateUpdateTag
} from '../validators/tag.validators.mjs';

export async function list(request, response) {
  const category = request.query.category || null;
  if (category && !TAG_CATEGORIES.includes(category)) {
    throw httpError(400, 'INVALID_TAG_CATEGORY', 'The tag category is invalid.');
  }

  const items = await listControlledTags({ category, search: request.query.search || null });
  response.json({ items });
}

export async function create(request, response) {
  const input = validateCreateTag(request.body);
  const tag = await createControlledTag({ ...input, createdByUserId: request.user.id });
  response.status(201).json({ tag });
}

export async function get(request, response) {
  const tag = await findControlledTagById(request.params.tagId);
  if (!tag) {
    throw httpError(404, 'TAG_NOT_FOUND', 'The tag does not exist.');
  }
  response.json({ tag });
}

export async function update(request, response) {
  const updates = validateUpdateTag(request.body);
  const tag = await updateControlledTag(request.params.tagId, updates);
  response.json({ tag });
}

export async function deactivate(request, response) {
  const tag = await deactivateControlledTag(request.params.tagId);
  response.json({ tag });
}

export async function replaceCompanyAssignments(request, response) {
  const company = await findCompanyById(request.params.companyId);
  if (!company) {
    throw httpError(404, 'COMPANY_NOT_FOUND', 'The company does not exist.');
  }

  const ownsCompany = request.user.companyId === request.params.companyId;
  if (!ownsCompany && request.user.role !== 'system_admin') {
    throw httpError(403, 'FORBIDDEN', 'You cannot update tags for this company.');
  }

  const assignments = validateCompanyTagAssignments(request.body, {
    allowVerified: request.user.role === 'system_admin'
  });
  const updatedCompany = await replaceCompanyTagAssignments(request.params.companyId, assignments, request.user.id);
  if (updatedCompany) await refreshCompanyMatches(request.params.companyId);
  response.json({ company: updatedCompany });
}

export async function getCompanyAssignments(request, response) {
  const company = await findCompanyById(request.params.companyId);
  if (!company) {
    throw httpError(404, 'COMPANY_NOT_FOUND', 'The company does not exist.');
  }

  const ownsCompany = request.user.companyId === request.params.companyId;
  if (!ownsCompany && request.user.role !== 'system_admin') {
    throw httpError(403, 'FORBIDDEN', 'You cannot view tags for this company.');
  }

  response.json({ assignments: (company.tagAssignments || []).map((assignment) => ({
    tagId: assignment.tagId?.toString(),
    verificationLevel: assignment.verificationLevel,
    evidence: assignment.evidence ?? null,
    reviewStatus: assignment.reviewStatus ?? null,
    profileDerived: assignment.source === 'manual' && typeof assignment.evidence === 'string'
      && assignment.evidence.startsWith('Self-reported company profile ')
  })) });
}

export async function replaceTorAssignments(request, response) {
  const assignments = validateTorTagAssignments(request.body);
  const tor = await replaceTorTagAssignments(request.params.projectId, assignments, request.user.id);
  if (!tor) {
    throw httpError(404, 'TOR_NOT_FOUND', 'The TOR does not exist.');
  }
  await refreshMatchesForTor(tor);
  response.json({ tor: serializeTor(tor) });
}

export async function submitTorSuggestions(request, response) {
  const suggestions = validateTorTagSuggestions(request.body);
  const tor = await replaceTorTagSuggestions(request.params.projectId, suggestions, request.user.id);
  if (!tor) throw httpError(404, 'TOR_NOT_FOUND', 'The TOR does not exist.');
  response.status(202).json({
    projectId: tor.projectId,
    suggestions: (tor.tagAssignments || []).filter((assignment) => assignment.source === 'ai' && assignment.reviewStatus === 'suggested')
  });
}

export async function listTorSuggestions(request, response) {
  const tor = await findTorByProjectId(request.params.projectId);
  if (!tor) throw httpError(404, 'TOR_NOT_FOUND', 'The TOR does not exist.');
  response.json({
    projectId: tor.projectId,
    suggestions: (tor.tagAssignments || []).filter((assignment) => assignment.source === 'ai')
  });
}

export async function reviewTorSuggestion(request, response) {
  const { reviewStatus } = validateTorSuggestionReview(request.body);
  const tor = await reviewTorTagSuggestion(request.params.projectId, request.params.suggestionId, reviewStatus, request.user.id);
  if (!tor) throw httpError(404, 'TOR_NOT_FOUND', 'The TOR does not exist.');
  if (reviewStatus === 'approved') await refreshMatchesForTor(tor);
  response.json({ tor: serializeTor(tor) });
}
