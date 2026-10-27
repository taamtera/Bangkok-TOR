import * as authService from '../services/auth.service.mjs';
import { ACCESS_COOKIE, clearAuthCookies, parseCookies, REFRESH_COOKIE, setAuthCookies } from '../utils/cookies.mjs';
import { sha256, verifyAccessToken } from '../utils/tokens.mjs';
import { authenticatedUser } from '../middleware/authenticate.mjs';
import { toSafeUser } from '../serializers/user.serializer.mjs';
import {
  validateEmailOnly,
  validateLogin,
  validateRegister,
  validateResetPassword
} from '../validators/auth.validators.mjs';

// Thin HTTP layer: validate input, build request context, call the service,
// translate the result into cookies + JSON. All orchestration lives in the service.

function contextOf(request) {
  const ip = request.ip || request.socket?.remoteAddress || null;
  return {
    requestId: request.requestId,
    userAgent: request.get('user-agent') || null,
    ipAddressHash: ip ? sha256(ip) : null
  };
}

export async function register(request, response) {
  const input = validateRegister(request.body);
  const { accessToken, refreshToken, user } = await authService.register(input, contextOf(request));
  // Registration signs the user straight in (email verification disabled).
  setAuthCookies(response, { accessToken, refreshToken });
  response.status(201).json({ user });
}

export async function login(request, response) {
  const input = validateLogin(request.body);
  const { accessToken, refreshToken, user } = await authService.login(input, contextOf(request));
  setAuthCookies(response, { accessToken, refreshToken });
  response.json({ user });
}

export async function refresh(request, response) {
  const refreshToken = parseCookies(request)[REFRESH_COOKIE] ?? null;
  const result = await authService.refresh({ refreshToken }, contextOf(request));
  setAuthCookies(response, { accessToken: result.accessToken, refreshToken: result.refreshToken });
  response.json({ user: result.user });
}

export async function logout(request, response) {
  const refreshToken = parseCookies(request)[REFRESH_COOKIE] ?? null;
  const result = await authService.logout({ refreshToken }, contextOf(request));
  clearAuthCookies(response);
  response.json(result);
}

export async function logoutAll(request, response) {
  const result = await authService.logoutAll({ userId: request.user.id }, contextOf(request));
  clearAuthCookies(response);
  response.json(result);
}

export async function forgotPassword(request, response) {
  const input = validateEmailOnly(request.body);
  const result = await authService.forgotPassword(input, contextOf(request));
  response.json(result);
}

export async function resetPassword(request, response) {
  const input = validateResetPassword(request.body);
  const result = await authService.resetPassword(input, contextOf(request));
  clearAuthCookies(response);
  response.json(result);
}

export async function me(request, response) {
  const result = await authService.getCurrentUser(request.user.id);
  response.json(result);
}

// Soft session check for the frontend's on-load "am I logged in?" probe. Unlike
// /me it never 401s — it returns 200 with { user: null } when there is no valid
// session, so a logged-out page load doesn't log a console error.
export async function session(request, response) {
  const claims = verifyAccessToken(parseCookies(request)[ACCESS_COOKIE]);

  if (!claims?.sub) {
    response.json({ user: null });
    return;
  }

  try {
    const user = await authenticatedUser(claims);
    response.json({ user: user ? toSafeUser(user) : null });
  } catch {
    response.json({ user: null });
  }
}
