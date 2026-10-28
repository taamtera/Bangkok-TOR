import nodemailer from 'nodemailer';
import { alertableProject } from './notification-events.mjs';
import { authConfig } from '../config/env.mjs';
import { getDatabase } from '../config/database.mjs';

export const matchEmailEnabled = () => process.env.MATCH_ALERT_EMAIL_ENABLED === 'true';
export const matchEmailAvailable = () => matchEmailEnabled() && (process.env.EMAIL_DELIVERY || 'smtp') === 'smtp'
  && Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.EMAIL_FROM);
export const optedIntoMatchEmail = user => user?.status === 'active' && !user.deletedAt
  && user.notificationPreferences?.matchEmailOptIn === true
  && user.notificationPreferences?.channels?.includes('email')
  && user.notificationPreferences?.alertTypes?.includes('new_match');

export function matchEmailEvents(records, projects, users, now = new Date()) {
  const projectsById = new Map(projects.map(p => [String(p._id), p]));
  const events = new Map();
  for (const record of records) {
    const project = projectsById.get(String(record.torId));
    if (!project?.projectId || !alertableProject(project) || record.resultType !== 'requirement_match' || record.status !== 'compared'
      || !Number.isFinite(record.score) || record.score <= 0) continue;
    for (const user of users) {
      if (!optedIntoMatchEmail(user) || String(user.companyId) !== String(record.companyId)) continue;
      const version = record.torVersion || 1;
      const id = `email:new_match:${user._id}:${record.companyId}:${record.torId}:v${version}`;
      events.set(id, { _id: id, userId: user._id, companyId: record.companyId, torId: record.torId,
        torVersion: version, projectId: project.projectId, title: project.title || project.projectId,
        score: record.score, status: 'queued', attempts: 0, nextAttemptAt: now, createdAt: now });
    }
  }
  return [...events.values()];
}

export async function queueMatchEmails(records, projects, users) {
  if (!matchEmailEnabled()) return;
  const events = matchEmailEvents(records, projects, users);
  if (!events.length) return;
  try {
    await getDatabase().collection('match_email_outbox').bulkWrite(events.map(({ _id, ...event }) => ({
      updateOne: { filter: { _id }, update: { $setOnInsert: event }, upsert: true }
    })), { ordered: false });
  } catch (error) {
    if (!error.writeErrors?.length || error.writeErrors.some(e => e.code !== 11000)) throw error;
  }
}

export function createMatchEmailSender({ createTransport = nodemailer.createTransport } = {}) {
  let transport;
  return async (event, email) => {
    if (!matchEmailAvailable()) throw new Error('Match email is not configured.');
    transport ??= createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE !== 'false', requireTLS: process.env.SMTP_SECURE === 'false',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
    const link = new URL('/', authConfig.appBaseUrl); link.searchParams.set('project', event.projectId);
    const subjectTitle = event.title.replace(/[\r\n]/g, ' ').slice(0, 120);
    const result = await transport.sendMail({ from: process.env.EMAIL_FROM, to: email,
      messageId: `<${Buffer.from(event._id).toString('base64url')}@tor-match.local>`,
      subject: `New TOR match: ${subjectTitle}`,
      text: `${event.title}\n\n${Math.round(event.score)}% coverage of stored requirements. This is not confirmation of eligibility or an open bidding period.\n\nReview the project and missing requirements:\n${link.href}\n\nCompany capabilities are self-reported. You can turn off match email alerts in the app notification settings.` });
    if (!result.accepted?.length || result.rejected?.length) {
      const error = new Error('Recipient rejected'); error.code = 'EENVELOPE'; throw error;
    }
  };
}
const defaultSender = createMatchEmailSender();

export async function deliverMatchEmails({ db = getDatabase(), send = defaultSender, enabled = matchEmailAvailable(), limit = 10 } = {}) {
  if (!enabled) return { sent: 0 };
  const queue = db.collection('match_email_outbox');
  // A process may have died after SMTP accepted a message. Never blindly resend an expired attempt.
  await queue.updateMany({ status: 'sending', leaseExpiresAt: { $lte: new Date() } }, {
    $set: { status: 'uncertain', errorCode: 'DELIVERY_INTERRUPTED' }, $unset: { leaseExpiresAt: '' }
  });
  let sent = 0;
  for (let i = 0; i < limit; i++) {
    const now = new Date();
    const event = await queue.findOneAndUpdate({ status: 'queued', attempts: { $lt: 3 }, nextAttemptAt: { $lte: now } }, {
      $set: { status: 'sending', leaseExpiresAt: new Date(Date.now() + 60000) }, $inc: { attempts: 1 }
    }, { sort: { createdAt: 1 }, returnDocument: 'after' });
    if (!event) break;
    const [user, project, match] = await Promise.all([
      db.collection('users').findOne({ _id: event.userId }),
      db.collection('tor_announcements').findOne({ _id: event.torId }),
      db.collection('company_matches').findOne({ companyId: event.companyId, torId: event.torId, torVersion: event.torVersion })
    ]);
    if (!optedIntoMatchEmail(user) || String(user.companyId) !== String(event.companyId) || !user.email
      || !project || !alertableProject(project) || match?.status !== 'compared' || !(match.score > 0)) {
      await queue.updateOne({ _id: event._id }, { $set: { status: 'cancelled' }, $unset: { leaseExpiresAt: '' } }); continue;
    }
    try {
      await send({ ...event, title: project.title || event.title, score: match.score }, user.email);
      await queue.updateOne({ _id: event._id }, { $set: { status: 'sent', sentAt: new Date() }, $unset: { leaseExpiresAt: '' } });
      sent++;
    } catch (error) {
      // Only definite pre-delivery failures retry. Ambiguous timeouts need inspection to avoid duplicate mail.
      const retry = ['ECONNECTION', 'EDNS', 'ECONNREFUSED'].includes(error.code) && event.attempts < 3;
      await queue.updateOne({ _id: event._id }, { $set: {
        status: retry ? 'queued' : ['EAUTH', 'EENVELOPE'].includes(error.code) ? 'failed' : 'uncertain',
        errorCode: ['EAUTH', 'EENVELOPE', 'ECONNECTION', 'EDNS', 'ECONNREFUSED'].includes(error.code) ? error.code : 'DELIVERY_UNCERTAIN',
        nextAttemptAt: new Date(Date.now() + event.attempts * 60000)
      }, $unset: { leaseExpiresAt: '' } });
    }
  }
  return { sent };
}
