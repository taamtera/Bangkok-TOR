import { getDatabase } from '../config/database.mjs';
import { toObjectId } from '../utils/object-id.mjs';

function users() {
  return getDatabase().collection('users');
}

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export async function findUserById(userId) {
  return users().findOne({ _id: toObjectId(userId, 'userId'), deletedAt: null });
}

export async function findUserByEmail(email) {
  return users().findOne({ emailNormalized: normalizeEmail(email), deletedAt: null });
}

export async function createRegisteredUser({
  email,
  passwordHash,
  firstName,
  lastName,
  phone = null,
  jobTitle = null,
  companyId = null,
  role = 'company_admin',
  registrationSource = 'self',
  termsAcceptedAt = new Date()
}) {
  const now = new Date();
  const emailNormalized = normalizeEmail(email);
  const document = {
    email: email.trim(),
    emailNormalized,
    passwordHash,
    displayName: `${firstName.trim()} ${lastName.trim()}`,
    profile: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone,
      avatarUrl: null,
      jobTitle
    },
    role,
    companyId: companyId ? toObjectId(companyId, 'companyId') : null,
    notificationPreferences: {
      channels: ['in_app'],
      matchEmailOptIn: false,
      alertTypes: ['new_match', 'tor_updated', 'deadline_reminder'],
      deadlineReminderDays: 7
    },
    status: 'pending_verification',
    registrationSource,
    emailVerifiedAt: null,
    lastLoginAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    passwordChangedAt: now,
    termsAcceptedAt,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  };

  const result = await users().insertOne(document);
  return { ...document, _id: result.insertedId };
}

export async function updateUserStatus(userId, status) {
  const allowedStatuses = ['pending_verification', 'active', 'suspended', 'disabled'];

  if (!allowedStatuses.includes(status)) {
    const error = new Error('User status is invalid.');
    error.status = 400;
    error.code = 'INVALID_USER_STATUS';
    throw error;
  }

  return users().findOneAndUpdate(
    { _id: toObjectId(userId, 'userId'), deletedAt: null },
    { $set: { status, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
}

export async function recordSuccessfulLogin(userId) {
  return users().updateOne(
    { _id: toObjectId(userId, 'userId'), status: 'active', deletedAt: null },
    {
      $set: {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date()
      }
    }
  );
}

export async function recordFailedLogin(userId, lockUntil = null) {
  const update = {
    $inc: { failedLoginAttempts: 1 },
    $set: { updatedAt: new Date() }
  };

  if (lockUntil) {
    update.$set.lockedUntil = lockUntil;
  }

  return users().updateOne(
    { _id: toObjectId(userId, 'userId'), deletedAt: null },
    update
  );
}

export async function changePassword(userId, passwordHash) {
  const now = new Date();
  return users().updateOne(
    { _id: toObjectId(userId, 'userId'), deletedAt: null },
    {
      $set: {
        passwordHash,
        passwordChangedAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: now
      }
    }
  );
}
