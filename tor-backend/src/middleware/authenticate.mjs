import { ACCESS_COOKIE, parseCookies } from '../utils/cookies.mjs';
import { httpError } from '../utils/http-error.mjs';
import { verifyAccessToken } from '../utils/tokens.mjs';
import { findUserById } from '../repositories/user.repository.mjs';
import { findActiveSessionById } from '../repositories/session.repository.mjs';

// Reads and verifies the access-token cookie and attaches request.user.
// Every protected route must run this — the frontend hiding an action is never
// sufficient (docs/authentication-contract.md).
export async function authenticatedUser(claims) {
  if (!claims?.sub || !claims.sid) return null;
  const [user, session] = await Promise.all([findUserById(claims.sub), findActiveSessionById(claims.sid, claims.sub)]);
  return user?.status === 'active' && session ? user : null;
}

export async function authenticate(request, response, next) {
  const cookies = parseCookies(request);
  const claims = verifyAccessToken(cookies[ACCESS_COOKIE]);

  try {
    const user = await authenticatedUser(claims);
    if (!user) {
      next(httpError(401, 'TOKEN_INVALID', 'Authentication is required.'));
      return;
    }

    request.user = {
      id: String(user._id),
      companyId: user.companyId ? String(user.companyId) : null,
      role: user.role,
      sessionId: claims.sid ?? null
    };

    next();
  } catch (error) { next(error); }
}
