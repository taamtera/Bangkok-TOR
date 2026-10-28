import { getDatabase } from '../config/database.mjs';
import { toObjectId } from '../utils/object-id.mjs';
import { matchEmailAvailable } from '../services/match-alert-email.mjs';
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
notificationRouter.get('/preferences', handle(async (request, response) => {
  const user = await findUserById(request.user.id);
  response.json({ emailAlerts: user.notificationPreferences?.matchEmailOptIn === true, emailAvailable: matchEmailAvailable() });
}));
notificationRouter.patch('/preferences', handle(async (request, response) => {
  if (!request.body || typeof request.body.emailAlerts !== 'boolean'
    || Object.keys(request.body).some(key => key !== 'emailAlerts')) {
    throw httpError(400, 'INVALID_NOTIFICATION_PREFERENCES', 'Choose whether to receive match email alerts.');
  }
  if (request.body.emailAlerts && !matchEmailAvailable()) {
    throw httpError(503, 'MATCH_EMAIL_NOT_CONFIGURED', 'Match email alerts are not available yet.');
  }
  const user = await findUserById(request.user.id);
  const channels = [...new Set([...(user.notificationPreferences?.channels || ['in_app']),
    ...(request.body.emailAlerts ? ['email'] : [])])];
  const alertTypes = [...new Set([...(user.notificationPreferences?.alertTypes || []), 'new_match'])];
  await getDatabase().collection('users').updateOne({ _id: toObjectId(request.user.id, 'userId') }, {
    $set: { 'notificationPreferences.matchEmailOptIn': request.body.emailAlerts,
      'notificationPreferences.channels': channels, 'notificationPreferences.alertTypes': alertTypes, updatedAt: new Date() }
  });
  response.json({ emailAlerts: request.body.emailAlerts, emailAvailable: matchEmailAvailable() });
}));
notificationRouter.get('/', handle(async (request, response) => {
  response.json(await listNotifications(request.user.id, request.query));
}));
notificationRouter.patch('/read-all', handle(async (request, response) => {
  response.json(await markAllNotificationsRead(request.user.id));
}));
notificationRouter.patch('/:id/read', handle(async (request, response) => {
  response.json(await markNotificationRead(request.user.id, request.params.id));
}));
