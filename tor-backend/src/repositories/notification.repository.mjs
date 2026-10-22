import { getDatabase } from '../config/database.mjs';
import { toObjectId } from '../utils/object-id.mjs';
import { newMatchEvents, serializeNotification } from '../services/notification-events.mjs';
import { httpError } from '../utils/http-error.mjs';

const collection = () => getDatabase().collection('notifications');
const visible = userId => ({ userId: toObjectId(userId, 'userId'), channel: 'in_app', status: { $in: ['sent', 'read'] } });

export async function publishMatchNotifications(records, projects) {
  const companyIds = [...new Map(records.filter(row => row.resultType === 'requirement_match'
    && row.status === 'compared' && row.score > 0).map(row => [String(row.companyId), row.companyId])).values()];
  if (!companyIds.length) return;
  const users = await getDatabase().collection('users').find({
    companyId: { $in: companyIds }, status: 'active', deletedAt: null,
    'notificationPreferences.channels': 'in_app', 'notificationPreferences.alertTypes': 'new_match'
  }, { projection: { companyId: 1, status: 1, notificationPreferences: 1 } }).toArray();
  const events = newMatchEvents(records, projects, users);
  if (!events.length) return;
  try {
    await collection().bulkWrite(events.map(event => ({ updateOne: {
      filter: { eventKey: event.eventKey }, update: { $setOnInsert: event }, upsert: true
    } })), { ordered: false });
  } catch (error) {
    // Concurrent recalculations can race the unique eventKey index. Every other
    // failure must be reported; an existing notification's read state is preserved.
    if (!error.writeErrors?.length || error.writeErrors.some(item => item.code !== 11000)) throw error;
  }
}

export async function listNotifications(userId, { page = 1, limit = 20 } = {}) {
  const pageNumber = Number(page);
  const pageSize = Number(limit);
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > 100000
      || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw httpError(400, 'INVALID_NOTIFICATION_PAGE', 'Choose a valid notification page and a limit between 1 and 50.');
  }
  const filter = visible(userId);
  const [rows, total, unreadCount] = await Promise.all([
    collection().aggregate([
      { $match: filter }, { $sort: { createdAt: -1, _id: -1 } },
      { $skip: (pageNumber - 1) * pageSize }, { $limit: pageSize },
      { $lookup: { from: 'tor_announcements', localField: 'torId', foreignField: '_id', as: 'project',
        pipeline: [{ $project: { projectId: 1 } }] } },
      { $set: { project: { $arrayElemAt: ['$project', 0] } } }
    ]).toArray(),
    collection().countDocuments(filter),
    collection().countDocuments({ ...filter, status: 'sent' })
  ]);
  return { items: rows.map(serializeNotification), unreadCount,
    pagination: { page: pageNumber, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function markNotificationRead(userId, id) {
  const filter = { ...visible(userId), _id: toObjectId(id, 'notificationId') };
  const changed = await collection().findOneAndUpdate({ ...filter, status: 'sent' },
    { $set: { status: 'read', readAt: new Date() } }, { returnDocument: 'after' });
  if (!changed && !await collection().findOne({ ...filter, status: 'read' })) {
    throw httpError(404, 'NOTIFICATION_NOT_FOUND', 'The notification does not exist.');
  }
  return { message: 'Notification marked as read.' };
}

export async function markAllNotificationsRead(userId) {
  await collection().updateMany({ ...visible(userId), status: 'sent' }, { $set: { status: 'read', readAt: new Date() } });
  return { message: 'All notifications marked as read.' };
}
