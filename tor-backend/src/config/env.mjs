import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load tor-backend's own .env (path is relative to this file, not the cwd, so it
// works no matter where node is started). Missing file is a no-op — in Docker the
// values come from the image/compose environment instead.
dotenv.config({
  path: resolve(fileURLToPath(new URL('../../.env', import.meta.url))),
  quiet: true
});

function required(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePort(value) {
  const port = Number.parseInt(value, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }

  return port;
}

function parseIntEnv(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

const configuredFrontendOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const localFrontendOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001'
];

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV?.trim() || 'development',
  port: parsePort(process.env.PORT?.trim() || '4000'),
  frontendOrigins: [...new Set([
    ...configuredFrontendOrigins,
    ...(process.env.NODE_ENV?.trim() === 'production' ? [] : localFrontendOrigins)
  ])],
  mongodbUri: required('MONGODB_URI'),
  mongodbDatabaseName: process.env.MONGODB_DB_NAME?.trim() || 'tor_software',
  // Deliberate opt-in, confined to the existing test database.
  demoMatchingEnabled: process.env.MATCHING_DEMO_ENABLED === 'true'
    && process.env.MONGODB_DB_NAME?.trim() === 'tor_software_test'
});

const accessSecret = process.env.AUTH_ACCESS_SECRET?.trim();

if (env.nodeEnv === 'production' && (!accessSecret || accessSecret.length < 32)) {
  throw new Error('AUTH_ACCESS_SECRET must be set to at least 32 characters in production.');
}

// Authentication configuration. Secrets and lifetimes for access/refresh tokens,
// one-time email tokens, and the login lockout policy. See docs/authentication-contract.md.
export const authConfig = Object.freeze({
  accessSecret: accessSecret || 'dev-insecure-access-secret-change-me-please-0123456789',
  accessTtlSeconds: parseIntEnv(process.env.AUTH_ACCESS_TTL_SECONDS, 15 * 60),
  refreshTtlDays: parseIntEnv(process.env.AUTH_REFRESH_TTL_DAYS, 7),
  cookieSecure: env.nodeEnv === 'production',
  loginMaxAttempts: parseIntEnv(process.env.LOGIN_MAX_ATTEMPTS, 5),
  loginLockMinutes: parseIntEnv(process.env.LOGIN_LOCK_MINUTES, 15),
  passwordResetTtlMinutes: parseIntEnv(process.env.AUTH_PASSWORD_RESET_TTL_MINUTES, 30),
  appBaseUrl: env.frontendOrigins[0] || 'http://localhost:3000'
});
