import { authConfig, env } from '../config/env.mjs';
import { createPasswordResetSender, validateEmailConfiguration } from './password-reset-email.mjs';
import { httpError } from '../utils/http-error.mjs';

const emailConfig = {
  mode: process.env.EMAIL_DELIVERY || 'smtp',
  production: env.nodeEnv === 'production',
  appBaseUrl: authConfig.appBaseUrl,
  ttlMinutes: authConfig.passwordResetTtlMinutes,
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE !== 'false',
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASSWORD,
  from: process.env.EMAIL_FROM
};

export const sendPasswordResetEmail = createPasswordResetSender(emailConfig);

export function ensureEmailDeliveryConfigured() {
  try {
    validateEmailConfiguration(emailConfig);
  } catch {
    // Check before any user lookup so this response cannot reveal membership.
    throw httpError(503, 'EMAIL_NOT_CONFIGURED', 'Password reset is temporarily unavailable.');
  }
}
