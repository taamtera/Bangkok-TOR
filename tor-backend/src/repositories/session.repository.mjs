import { getDatabase } from '../config/database.mjs';
import { toObjectId } from '../utils/object-id.mjs';

function sessions() {
  return getDatabase().collection('sessions');
}

export async function createSession({
  userId,
  refreshTokenHash,
  expiresAt,
  userAgent = null,
  ipAddressHash = null
}) {
  const now = new Date();
  const document = {
    userId: toObjectId(userId, 'userId'),
    refreshTokenHash,
    status: 'active',
    userAgent,
    ipAddressHash,
    expiresAt,
    lastUsedAt: now,
    revokedAt: null,
    createdAt: now
  };

  const result = await sessions().insertOne(document);
  return { ...document, _id: result.insertedId };
}

export async function findActiveSession(refreshTokenHash) {
  return sessions().findOne({
    refreshTokenHash,
    status: 'active',
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  });
}

export async function findActiveSessionById(sessionId, userId) {
  return sessions().findOne({ _id: toObjectId(sessionId, 'sessionId'), userId: toObjectId(userId, 'userId'),
    status: 'active', revokedAt: null, expiresAt: { $gt: new Date() } });
}

export async function rotateSession(sessionId, currentHash, nextHash, nextExpiresAt) {
  return sessions().findOneAndUpdate(
    {
      _id: toObjectId(sessionId, 'sessionId'),
      refreshTokenHash: currentHash,
      status: 'active',
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    },
    {
      $set: {
        refreshTokenHash: nextHash,
        expiresAt: nextExpiresAt,
        lastUsedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );
}

export async function revokeSession(sessionId) {
  return sessions().updateOne(
    { _id: toObjectId(sessionId, 'sessionId'), status: 'active' },
    { $set: { status: 'revoked', revokedAt: new Date() } }
  );
}

export async function revokeAllUserSessions(userId) {
  return sessions().updateMany(
    { userId: toObjectId(userId, 'userId'), status: 'active' },
    { $set: { status: 'revoked', revokedAt: new Date() } }
  );
}

