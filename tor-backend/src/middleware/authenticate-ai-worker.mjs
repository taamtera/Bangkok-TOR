import { createHash, timingSafeEqual } from 'node:crypto';
import { httpError } from '../utils/http-error.mjs';

export function authenticateAiWorker(request, response, next) {
  const configured = process.env.AI_REQUIREMENTS_TOKEN || '';
  if (configured.length < 32) return next(httpError(503, 'AI_WORKER_NOT_CONFIGURED', 'The AI requirements integration is not configured.'));
  const presented = request.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1] || '';
  const digest = (value) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(configured), digest(presented))) return next(httpError(401, 'AI_WORKER_UNAUTHORIZED', 'AI worker authentication is required.'));
  // This credential is accepted only on the requirements integration routes.
  // It grants no company-profile access, human administrator role, or recommendation publishing.
  next();
}
