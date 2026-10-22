import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.mjs';
import { findUserById } from '../repositories/user.repository.mjs';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../repositories/notification.repository.mjs';
import { httpError } from '../utils/http-error.mjs';

export const notificationRouter = Router();
notificationRouter.use(authenticate);
notificationRouter.use((request, response, next) => {
  findUserById(request.user.id).then(user => {
    if (!user || user.status !== 'active') throw httpError(403, 'FORBIDDEN', 'This account cannot access notifications.');
    next();
  }).catch(next);
});
const handle = fn => (request, response, next) => Promise.resolve(fn(request, response)).catch(next);
notificationRouter.get('/', handle(async (request, response) => {
  response.json(await listNotifications(request.user.id, request.query));
}));
notificationRouter.patch('/read-all', handle(async (request, response) => {
  response.json(await markAllNotificationsRead(request.user.id));
}));
notificationRouter.patch('/:id/read', handle(async (request, response) => {
  response.json(await markNotificationRead(request.user.id, request.params.id));
}));
