import { Router } from 'express';
import * as controller from '../controllers/match.controller.mjs';
import { authenticate } from '../middleware/authenticate.mjs';
import { authorize } from '../middleware/authorize.mjs';

const handle = (action) => (request, response, next) => Promise.resolve(action(request, response)).catch(next);
export const matchRouter = Router();
matchRouter.use(authenticate, authorize('company_admin', 'company_member'));
matchRouter.get('/', handle(controller.list));
matchRouter.get('/ai-input', handle(controller.aiInput));
