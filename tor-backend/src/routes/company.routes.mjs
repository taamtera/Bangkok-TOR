import { Router } from 'express';
import * as company from '../controllers/company.controller.mjs';
import { authenticate } from '../middleware/authenticate.mjs';
import { authorize } from '../middleware/authorize.mjs';

function handle(controller) {
  return (request, response, next) => Promise.resolve(controller(request, response, next)).catch(next);
}

export const companyRouter = Router();

companyRouter.use(authenticate, authorize('company_admin', 'company_member'));
companyRouter.get('/me', handle(company.getMyProfile));
companyRouter.put('/me', handle(company.updateMyProfile));
companyRouter.post('/me/matching-tags/sync', handle(company.syncMyMatchingTags));
