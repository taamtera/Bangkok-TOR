import { getDatabase } from '../config/database.mjs';
import { normalizeEmail } from './user.repository.mjs';
import { toObjectId } from '../utils/object-id.mjs';

function authTokens() {
  return getDatabase().collection('auth_tokens');
}

export async function createAuthToken({
  type,
  tokenHash,
  email,
  userId = null,
  companyId = null,
  expiresAt
}) {
  const emailNormalized = normalizeEmail(email);
  const now = new Date();

  await authTokens().updateMany(
    { emailNormalized, type, usedAt: null, revokedAt: null },
    { $set: { revokedAt: now } }
  );

  const document = {
    type,
    tokenHash,
    userId: userId ? toObjectId(userId, 'userId') : null,
    companyId: companyId ? toObjectId(companyId, 'companyId') : null,
    emailNormalized,
    expiresAt,
    usedAt: null,
    revokedAt: null,
    createdAt: now
  };

  const result = await authTokens().insertOne(document);
  return { ...document, _id: result.insertedId };
}

export async function consumeAuthToken({ type, tokenHash }) {
  const now = new Date();
  return authTokens().findOneAndUpdate(
    {
      type,
      tokenHash,
      usedAt: null,
      revokedAt: null,
      expiresAt: { $gt: now }
    },
    { $set: { usedAt: now } },
    { returnDocument: 'after' }
  );
}

