import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { torAlertFingerprint } from '../src/services/automatic-match-alerts.mjs';
import { matchEmailEvents, createMatchEmailSender } from '../src/services/match-alert-email.mjs';
const companyId = new ObjectId(), torId = new ObjectId();
const project = { _id: torId, projectId: 'P-1', title: 'Network service', status: 'invitation_published' };
const match = { companyId, torId, torVersion: 1, resultType: 'requirement_match', status: 'compared', score: 60 };
const user = { _id: new ObjectId(), companyId, status: 'active', notificationPreferences: {
  matchEmailOptIn: true, channels: ['in_app', 'email'], alertTypes: ['new_match'] } };
test('fingerprints ignore sightings but track requirements, reviews, stages and catalog changes', () => {
  const initial = torAlertFingerprint(project, 'catalog');
  assert.equal(initial, torAlertFingerprint({ ...project, lastSeenAt: new Date(), documents: ['changed'] }, 'catalog'));
  for (const patch of [{ tagAssignments: [{ tagId: 'x' }] }, { aiProcessing: { status: 'completed', tagReviewStatus: 'approved' } },
    { status: 'award_published' }, { torVersion: 2 }]) assert.notEqual(initial, torAlertFingerprint({ ...project, ...patch }, 'catalog'));
  assert.notEqual(initial, torAlertFingerprint(project, 'changed catalog'));
});
test('email requires explicit consent and deduplicates per user, TOR and version', () => {
  const events = matchEmailEvents([match, match], [project], [user]);
  assert.equal(events.length, 1);
  assert.notEqual(events[0]._id, matchEmailEvents([{ ...match, torVersion: 2 }], [project], [user])[0]._id);
  for (const candidate of [{ ...user, status: 'suspended' }, { ...user, companyId: new ObjectId() },
    { ...user, notificationPreferences: { channels: ['email'], alertTypes: ['new_match'] } },
    { ...user, notificationPreferences: { ...user.notificationPreferences, matchEmailOptIn: false } }]) {
    assert.deepEqual(matchEmailEvents([match], [project], [candidate]), []);
  }
  assert.deepEqual(matchEmailEvents([match], [{ ...project, status: 'award_published' }], [user]), []);
});
test('SMTP formatting uses account recipient, project link and honest coverage explanation', async () => {
  const keys = ['MATCH_ALERT_EMAIL_ENABLED', 'EMAIL_DELIVERY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM'];
  const before = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  Object.assign(process.env, { MATCH_ALERT_EMAIL_ENABLED: 'true', EMAIL_DELIVERY: 'smtp', SMTP_HOST: 'smtp.example.invalid',
    SMTP_USER: 'fixture', SMTP_PASSWORD: 'fixture', EMAIL_FROM: 'fixture@example.invalid' });
  try {
    let mail;
    const send = createMatchEmailSender({ createTransport: () => ({ sendMail: async value => { mail = value; return { accepted: ['recipient@example.invalid'], rejected: [] }; } }) });
    await send(matchEmailEvents([match], [project], [user])[0], 'recipient@example.invalid');
    assert.equal(mail.to, 'recipient@example.invalid');
    assert.match(mail.text, /60% coverage/); assert.match(mail.text, /project=P-1/);
    assert.match(mail.text, /not confirmation of eligibility/); assert.match(mail.text, /turn off/);
  } finally { for (const key of keys) if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
});
