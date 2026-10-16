import { Router } from 'express';
import * as recommendationController from '../controllers/recommendation.controller.mjs';
import { authenticate } from '../middleware/authenticate.mjs';
import { authorize } from '../middleware/authorize.mjs';

function handle(controller) {
  return (request, response, next) => Promise.resolve(controller(request, response, next)).catch(next);
}

export const recommendationRouter = Router();

recommendationRouter.get('/', authenticate, authorize('company_admin', 'company_member'), handle(recommendationController.list));
