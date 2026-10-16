import { findTorByProjectId, listTors, updateTor } from '../repositories/tor.repository.mjs';
import { createDocumentHandler } from './document.controller.mjs';
import { env } from '../config/env.mjs';
import { serializeTor } from '../serializers/tor.serializer.mjs';
import { httpError } from '../utils/http-error.mjs';
import { validateTorUpdate } from '../validators/tor.validators.mjs';
import { refreshTorRequirementMatches as refreshMatchesForTor } from '../services/requirement-matching.service.mjs';

export async function list(request, response) {
  const tagIds = request.query.tagIds
    ? (Array.isArray(request.query.tagIds) ? request.query.tagIds : request.query.tagIds.split(',')).filter(Boolean)
    : [];
  const result = await listTors({ ...request.query, tagIds });
  response.json({ ...result, items: result.items.map(serializeTor) });
}

export async function getByProjectId(request, response) {
  const tor = await findTorByProjectId(request.params.projectId);
  if (!tor) {
    throw httpError(404, 'TOR_NOT_FOUND', 'The TOR does not exist.');
  }
  response.json({ tor: serializeTor(tor) });
}

export const previewDocument = createDocumentHandler({ findProject: findTorByProjectId, frontendOrigins: env.frontendOrigins });
export const downloadDocument = createDocumentHandler({ findProject: findTorByProjectId, frontendOrigins: env.frontendOrigins, disposition: 'attachment' });

export async function update(request, response) {
  const changes = validateTorUpdate(request.body);
  const tor = await updateTor(request.params.projectId, changes, request.user.id);
  if (!tor) {
    throw httpError(404, 'TOR_NOT_FOUND', 'The TOR does not exist.');
  }
  await refreshMatchesForTor(tor);
  response.json({ tor: serializeTor(tor) });
}
