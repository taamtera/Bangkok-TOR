import test from 'node:test';
import assert from 'node:assert/strict';
import { createPasswordResetSender } from '../src/services/password-reset-email.mjs';

const config = {
  mode: 'smtp', production: false, appBaseUrl: 'http://localhost:3001', ttlMinutes: 30,
  host: 'smtp.gmail.com', port: 465, secure: true,
  user: 'sender@example.com', pass: 'test-app-password', from: 'sender@example.com'
};

test('SMTP sends the reset link to the requested recipient with expiry instructions', async () => {
  let options;
  let message;
  const sender = createPasswordResetSender(config, {
    createTransport(value) {
      options = value;
      return { async sendMail(value) { message = value; return { accepted: [value.to], rejected: [] }; } };
    },
    log() { assert.fail('SMTP must not log reset links'); }
  });
  await sender({ email: 'recipient@example.com', token: 'a+b/token' });
  assert.equal(options.secure, true);
  assert.equal(options.auth.user, config.user);
  assert.equal(message.to, 'recipient@example.com');
  const link = new URL(message.text.match(/http:\/\/localhost:3001\/\S+/)[0]);
  assert.equal(link.searchParams.get('token'), 'a+b/token');
  assert.match(message.text, /30 minutes/);
  assert.match(message.text, /used once/);
});

test('delivery errors propagate instead of being reported as successful sends', async () => {
  const sender = createPasswordResetSender(config, {
    createTransport: () => ({ sendMail: async () => { throw new Error('SMTP unavailable'); } })
  });
  await assert.rejects(sender({ email: 'recipient@example.com', token: 'test' }), /SMTP unavailable/);
});

test('recipient rejection fails delivery', async () => {
  const sender = createPasswordResetSender(config, {
    createTransport: () => ({ sendMail: async () => ({ accepted: [], rejected: ['recipient@example.com'] }) })
  });
  await assert.rejects(sender({ email: 'recipient@example.com', token: 'test' }), /did not accept/);
});

test('missing SMTP configuration fails without falling back to logging tokens', async () => {
  const sender = createPasswordResetSender({ ...config, pass: '' }, {
    log() { assert.fail('Secrets must not be logged on configuration errors'); }
  });
  await assert.rejects(sender({ email: 'recipient@example.com', token: 'test' }), /not configured/);
});

test('console mode is explicit and prohibited in production', async () => {
  const logs = [];
  await createPasswordResetSender({ ...config, mode: 'console' }, { log: value => logs.push(value) })({ email: 'recipient@example.com', token: 'test' });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /token=test/);
  await assert.rejects(createPasswordResetSender({ ...config, mode: 'console', production: true })({ email: 'recipient@example.com', token: 'test' }), /not configured/);
});
