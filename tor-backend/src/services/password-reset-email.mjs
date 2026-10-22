import nodemailer from 'nodemailer';

export function validateEmailConfiguration(config) {
  if (config.mode === 'console' && !config.production) return;
  if (config.mode !== 'smtp' || !config.host || !config.user || !config.pass || !config.from
      || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('Email delivery is not configured. Set SMTP settings in the backend environment.');
  }
}

export function createPasswordResetSender(config, { createTransport = nodemailer.createTransport, log = console.info } = {}) {
  let transport;
  return async function sendPasswordResetEmail({ email, token }) {
    validateEmailConfiguration(config);
    const link = new URL('/reset-password', config.appBaseUrl);
    link.searchParams.set('token', token);
    if (config.mode === 'console' && !config.production) {
      log(`[email:reset-password] to=${email} link=${link.href}`);
      return;
    }
    transport ??= createTransport({
      host: config.host, port: config.port, secure: config.secure,
      requireTLS: !config.secure,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
    });
    const result = await transport.sendMail({
      from: config.from, to: email,
      subject: 'Reset your Thailand TOR Intelligence password',
      text: `A password reset was requested for your Thailand TOR Intelligence account.\n\nOpen this link to choose a new password:\n${link.href}\n\nThis link expires in ${config.ttlMinutes} minutes and can be used once. If you did not request this, you can ignore this email.`
    });
    if (result.rejected?.length || !result.accepted?.length) {
      throw new Error('The email server did not accept the password reset message.');
    }
  };
}
