import { Router } from 'express';
import * as tagController from '../controllers/tag.controller.mjs';
import { authenticate } from '../middleware/authenticate.mjs';
import { authorize } from '../middleware/authorize.mjs';

function handle(controller) {
  return (request, response, next) => Promise.resolve(controller(request, response, next)).catch(next);
}

export const tagRouter = Router();

tagRouter.get('/', handle(tagController.list));
tagRouter.post('/', authenticate, authorize('system_admin'), handle(tagController.create));
tagRouter.put('/tors/:projectId/suggestions', authenticate, authorize('project_manager', 'system_admin'), handle(tagController.submitTorSuggestions));
tagRouter.get('/tors/:projectId/suggestions', authenticate, authorize('project_manager', 'system_admin'), handle(tagController.listTorSuggestions));
tagRouter.patch('/tors/:projectId/suggestions/:suggestionId', authenticate, authorize('project_manager', 'system_admin'), handle(tagController.reviewTorSuggestion));
tagRouter.get('/:tagId', authenticate, authorize('system_admin'), handle(tagController.get));
tagRouter.patch('/:tagId', authenticate, authorize('system_admin'), handle(tagController.update));
// Tags can be referenced by company and TOR assignments, so deletion is soft.
tagRouter.delete('/:tagId', authenticate, authorize('system_admin'), handle(tagController.deactivate));
tagRouter.get('/companies/:companyId', authenticate, handle(tagController.getCompanyAssignments));
tagRouter.put('/companies/:companyId', authenticate, handle(tagController.replaceCompanyAssignments));
tagRouter.put('/tors/:projectId', authenticate, authorize('project_manager', 'system_admin'), handle(tagController.replaceTorAssignments));
