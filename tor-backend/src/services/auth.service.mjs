import { authConfig } from '../config/env.mjs';
import {
  changePassword,
  consumeAuthToken,
  createAuthToken,
  createCompany,
  createRegisteredUser,
  createSession,
  findActiveSession,
  findCompanyByTaxId,
  findUserByEmail,
  findUserById,
  recordAuditEvent,
  recordFailedLogin,
  recordSuccessfulLogin,
  revokeAllUserSessions,
  revokeSession,
  rotateSession,
  setCompanyOwner,
  updateUserStatus
} from '../repositories/index.mjs';
import { toSafeUser } from '../serializers/user.serializer.mjs';
import { httpError } from '../utils/http-error.mjs';
import { hashPassword, verifyPassword } from '../utils/password.mjs';
import { generateRawToken, sha256, signAccessToken } from '../utils/tokens.mjs';
import { ensureEmailDeliveryConfigured, sendPasswordResetEmail } from './email.service.mjs';

const PASSWORD_RESET = 'password_reset';

// A generic response is returned for forgot-password so the API never reveals
// whether an email address is registered.
const GENERIC_EMAIL_RESULT = Object.freeze({
  message: 'If an account exists for that email, a message has been sent.'
});

function refreshExpiry() {
  return new Date(Date.now() + authConfig.refreshTtlDays * 24 * 60 * 60 * 1000);
}

async function audit(context, { event, outcome, targetType, targetId = null, actorUserId = null, metadata = {} }) {
  try {
    await recordAuditEvent({
      actorUserId,
      event,
      outcome,
      targetType,
      targetId,
      requestId: context?.requestId ?? null,
      userAgent: context?.userAgent ?? null,
      ipAddressHash: context?.ipAddressHash ?? null,
      metadata
    });
  } catch (error) {
    // Auditing must never break the primary flow.
    console.error('Failed to record audit event', event, error);
  }
}

// Issues a signed access token plus a fresh refresh session, and returns the raw
// values (for cookies) along with the safe user. Never returns token hashes.
async function establishSession(user, context) {
  const refreshToken = generateRawToken(32);

  const session = await createSession({
    userId: user._id,
    refreshTokenHash: sha256(refreshToken),
    expiresAt: refreshExpiry(),
    userAgent: context?.userAgent ?? null,
    ipAddressHash: context?.ipAddressHash ?? null
  });

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    companyId: user.companyId ? user.companyId.toString() : null,
    role: user.role,
    sid: session._id.toString()
  });

  return { accessToken, refreshToken, user: toSafeUser(user) };
}

export async function register(input, context) {
  const existing = await findUserByEmail(input.email);

  if (existing) {
    await audit(context, {
      event: 'auth.register',
      outcome: 'failure',
      targetType: 'user',
      metadata: { reason: 'email_exists' }
    });
    throw httpError(409, 'EMAIL_ALREADY_REGISTERED', 'This email is already registered.');
  }

  if (input.company.mode === 'join') {
    // Joining an existing company requires a valid invitation token, which is owned
    // by the (not-yet-built) invitation flow. Reject rather than trust a companyId.
    throw httpError(400, 'INVITATION_REQUIRED', 'Joining a company requires a valid invitation.');
  }

  if (input.company.taxId) {
    const duplicate = await findCompanyByTaxId(input.company.taxId);

    if (duplicate) {
      throw httpError(409, 'COMPANY_ALREADY_REGISTERED', 'A company with this Tax ID already exists.');
    }
  }

  const passwordHash = await hashPassword(input.password);

  const company = await createCompany({
    legalName: input.company.legalName,
    displayName: input.company.displayName,
    taxId: input.company.taxId,
    companySize: input.company.companySize,
    district: input.company.district
  });

  let createdUser;
  try {
    createdUser = await createRegisteredUser({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      jobTitle: input.jobTitle,
      companyId: company._id,
      role: 'company_admin'
    });
  } catch (error) {
    // The `uq_users_email_normalized` unique index is the last line of defense: if two
    // registrations race past the findUserByEmail check above, the second insert fails
    // with a duplicate-key error. Map it to the same clean 409 instead of a 500.
    if (error?.code === 11000) {
      await audit(context, {
        event: 'auth.register',
        outcome: 'failure',
        targetType: 'user',
        metadata: { reason: 'email_exists_race' }
      });
      throw httpError(409, 'EMAIL_ALREADY_REGISTERED', 'This email is already registered.');
    }
    throw error;
  }

  await setCompanyOwner(company._id, createdUser._id);
  // Email verification is disabled: activate the account immediately.
  const activated = await updateUserStatus(createdUser._id, 'active');
  const user = activated ?? { ...createdUser, status: 'active' };

  await audit(context, {
    event: 'auth.register',
    outcome: 'success',
    targetType: 'user',
    targetId: user._id,
    actorUserId: user._id,
    metadata: { companyId: company._id.toString() }
  });

  // Sign the new user straight in.
  await recordSuccessfulLogin(user._id);
  return establishSession(user, context);
}

export async function login({ email, password }, context) {
  const user = await findUserByEmail(email);
  const invalidCredentials = httpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');

  if (!user) {
    // Verify against a throwaway hash to keep timing similar whether or not the
    // account exists, then fail generically.
    await verifyPassword(password, 'scrypt$16384$00$00');
    await audit(context, { event: 'auth.login', outcome: 'failure', targetType: 'user', metadata: { reason: 'no_user' } });
    throw invalidCredentials;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await audit(context, { event: 'auth.login', outcome: 'failure', targetType: 'user', targetId: user._id, metadata: { reason: 'locked' } });
    throw httpError(423, 'ACCOUNT_LOCKED', 'This account is temporarily locked. Try again later.');
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  if (!passwordMatches) {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const lockUntil = attempts >= authConfig.loginMaxAttempts
      ? new Date(Date.now() + authConfig.loginLockMinutes * 60 * 1000)
      : null;

    await recordFailedLogin(user._id, lockUntil);
    await audit(context, { event: 'auth.login', outcome: 'failure', targetType: 'user', targetId: user._id, metadata: { reason: 'bad_password', locked: Boolean(lockUntil) } });
    throw invalidCredentials;
  }

  if (user.status === 'suspended') {
    throw httpError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended.');
  }

  if (user.status !== 'active') {
    throw httpError(403, 'FORBIDDEN', 'This account cannot sign in.');
  }

  await recordSuccessfulLogin(user._id);
  const result = await establishSession(user, context);

  await audit(context, {
    event: 'auth.login',
    outcome: 'success',
    targetType: 'user',
    targetId: user._id,
    actorUserId: user._id
  });

  return result;
}

export async function refresh({ refreshToken }, context) {
  if (!refreshToken) {
    throw httpError(401, 'TOKEN_INVALID', 'No active session.');
  }

  const currentHash = sha256(refreshToken);
  const session = await findActiveSession(currentHash);

  if (!session) {
    throw httpError(401, 'TOKEN_INVALID', 'Your session has expired. Please sign in again.');
  }

  const user = await findUserById(session.userId);

  if (!user || user.status !== 'active') {
    await revokeSession(session._id);
    throw httpError(401, 'TOKEN_INVALID', 'Your session is no longer valid.');
  }

  const nextRefreshToken = generateRawToken(32);
  const rotated = await rotateSession(session._id, currentHash, sha256(nextRefreshToken), refreshExpiry());

  if (!rotated) {
    // Lost a rotation race (token reuse or concurrent refresh); force re-auth.
    throw httpError(401, 'TOKEN_INVALID', 'Your session has expired. Please sign in again.');
  }

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    companyId: user.companyId ? user.companyId.toString() : null,
    role: user.role,
    sid: session._id.toString()
  });

  return { accessToken, refreshToken: nextRefreshToken, user: toSafeUser(user) };
}

export async function logout({ refreshToken }, context) {
  if (refreshToken) {
    const session = await findActiveSession(sha256(refreshToken));

    if (session) {
      await revokeSession(session._id);
      await audit(context, { event: 'auth.logout', outcome: 'success', targetType: 'session', targetId: session._id, actorUserId: session.userId });
    }
  }

  return { message: 'Signed out.' };
}

export async function logoutAll({ userId }, context) {
  await revokeAllUserSessions(userId);
  await audit(context, { event: 'auth.logout_all', outcome: 'success', targetType: 'user', targetId: userId, actorUserId: userId });
  return { message: 'Signed out of all sessions.' };
}

export async function forgotPassword({ email }, context) {
  ensureEmailDeliveryConfigured();
  const user = await findUserByEmail(email);

  if (user) {
    const rawToken = generateRawToken(32);

    await createAuthToken({
      type: PASSWORD_RESET,
      tokenHash: sha256(rawToken),
      email: user.email,
      userId: user._id,
      expiresAt: new Date(Date.now() + authConfig.passwordResetTtlMinutes * 60 * 1000)
    });

    try {
      await sendPasswordResetEmail({ email: user.email, token: rawToken });
    } catch {
      // Keep the public response identical for registered and unknown addresses,
      // including when the mail provider is unavailable. Never log the raw token.
      console.error('Password reset email delivery failed. Check SMTP configuration and provider availability.');
      await audit(context, { event: 'auth.forgot_password', outcome: 'failure', targetType: 'user', targetId: user._id });
      return GENERIC_EMAIL_RESULT;
    }
    await audit(context, { event: 'auth.forgot_password', outcome: 'success', targetType: 'user', targetId: user._id });
  }

  return GENERIC_EMAIL_RESULT;
}

export async function resetPassword({ token, password }, context) {
  const record = await consumeAuthToken({ type: PASSWORD_RESET, tokenHash: sha256(token) });

  if (!record) {
    throw httpError(400, 'TOKEN_INVALID', 'This reset link is invalid or has expired.');
  }

  const passwordHash = await hashPassword(password);
  await changePassword(record.userId, passwordHash);
  // Password change must invalidate every existing session.
  await revokeAllUserSessions(record.userId);

  await audit(context, {
    event: 'auth.reset_password',
    outcome: 'success',
    targetType: 'user',
    targetId: record.userId,
    actorUserId: record.userId
  });

  return { message: 'Your password has been changed. Please sign in.' };
}

export async function getCurrentUser(userId) {
  const user = await findUserById(userId);

  if (!user) {
    throw httpError(401, 'TOKEN_INVALID', 'Authentication is required.');
  }

  return { user: toSafeUser(user) };
}
