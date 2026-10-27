import { Router } from 'express';
import * as torController from '../controllers/tor.controller.mjs';
import { authenticate } from '../middleware/authenticate.mjs';
import { authorize } from '../middleware/authorize.mjs';
import { evaluation } from '../controllers/company-tor-evaluation.controller.mjs';

function handle(controller) {
  return (request, response, next) => Promise.resolve(controller(request, response, next)).catch(next);
}

export const torRouter = Router();

torRouter.get('/', handle(torController.list));
torRouter.get('/:projectId/evaluation', authenticate, authorize('company_admin', 'company_member'), handle(evaluation));
torRouter.post('/:projectId/evaluation', authenticate, authorize('company_admin', 'company_member'), handle(evaluation));
torRouter.get('/documents/:projectId', handle(torController.previewDocument));
torRouter.get('/documents/:projectId/download', handle(torController.downloadDocument));
torRouter.get('/:projectId', handle(torController.getByProjectId));
torRouter.patch('/:projectId', authenticate, authorize('project_manager', 'system_admin'), handle(torController.update));
