import { Router } from 'express';
import { authenticateAiWorker } from '../middleware/authenticate-ai-worker.mjs';
import { prepareRequirementSource } from '../services/requirement-source.mjs';
import { ingestAiRequirements } from '../services/ai-requirement-ingestion.mjs';

export const aiRequirementsRouter = Router();
aiRequirementsRouter.use(authenticateAiWorker);
aiRequirementsRouter.get('/tors/:projectId/source', async (request, response, next) => {
  try { response.json(await prepareRequirementSource(request.params.projectId)); } catch (error) { next(error); }
});
aiRequirementsRouter.post('/tors/:projectId/requirements', async (request, response, next) => {
  try { response.json(await ingestAiRequirements(request.params.projectId, request.body)); } catch (error) { next(error); }
});
