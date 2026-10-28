import { createHash, randomUUID } from 'node:crypto';
import { getDatabase } from '../config/database.mjs';
import { refreshTorRequirementMatches } from './requirement-matching.service.mjs';
import { deliverMatchEmails } from './match-alert-email.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function torAlertFingerprint(tor, catalogHash = '') {
  return hash({ policy: 1, catalogHash, title: tor.title, projectId: tor.projectId, documentUrl: tor.documentUrl, url: tor.url,
    tags: tor.tagAssignments, processing: { status: tor.aiProcessing?.status, review: tor.aiProcessing?.tagReviewStatus },
    source: tor.requirementSource, extraction: tor.requirementExtraction, version: tor.version || tor.torVersion,
    status: tor.status, budget: tor.budget });
}

export async function scanTorAlerts({ db = getDatabase(), refresh = refreshTorRequirementMatches, limit = 20 } = {}) {
  const states = db.collection('match_alert_state'), owner = randomUUID();
  let lock;
  try { lock = await states.findOneAndUpdate({ _id: 'scan-lock', $or: [
    { expiresAt: { $lte: new Date() } }, { expiresAt: { $exists: false } }
  ] }, { $set: { owner, expiresAt: new Date(Date.now() + 300000) } }, { upsert: true, returnDocument: 'after' }); }
  catch (error) { if (error.code === 11000) return { busy: true }; throw error; }
  if (!lock) return { busy: true };
  try {
    const [catalog, tors, baseline] = await Promise.all([
      db.collection('tags').find({}, { projection: { text: 1, name: 1, aliases: 1, conceptKey: 1, status: 1, matchingExcluded: 1 } }).sort({ _id: 1 }).toArray(),
      db.collection('tor_announcements').find({}, { projection: { documents: 0, aiExtractedRequirements: 0 } }).sort({ _id: 1 }).toArray(),
      states.findOne({ _id: 'baseline' })
    ]);
    const catalogHash = hash(catalog);
    let refreshed = 0;
    for (const tor of tors) {
      const _id = `tor:${tor._id}`, fingerprint = torAlertFingerprint(tor, catalogHash);
      const saved = await states.findOne({ _id });
      if (saved?.fingerprint === fingerprint) continue;
      if (baseline) {
        if (refreshed >= limit) break;
        await refresh(tor, { strictNotifications: true }); refreshed++;
      }
      await states.updateOne({ _id }, { $set: { fingerprint, checkedAt: new Date() } }, { upsert: true });
      const renewed = await states.updateOne({ _id: 'scan-lock', owner }, { $set: { expiresAt: new Date(Date.now() + 300000) } });
      if (!renewed.matchedCount) throw new Error('Match alert lease was lost.');
    }
    if (!baseline) await states.updateOne({ _id: 'baseline' }, { $set: { initializedAt: new Date() } }, { upsert: true });
    return { refreshed, baselined: !baseline };
  } finally { await states.updateOne({ _id: 'scan-lock', owner }, { $set: { expiresAt: new Date(0) } }); }
}

export function startAutomaticMatchAlerts() {
  if (process.env.MATCH_ALERT_WORKER_ENABLED === 'false') return async () => {};
  let timer, running, stopped = false;
  const interval = Math.min(3600000, Math.max(15000, Number(process.env.MATCH_ALERT_INTERVAL_MS) || 60000));
  const tick = () => {
    running = (async () => {
      try { await scanTorAlerts(); await deliverMatchEmails(); }
      catch { console.error('Automatic match alerts could not complete; the next check will retry.'); }
      finally { if (!stopped) { timer = setTimeout(tick, interval); timer.unref(); } }
    })();
  };
  tick();
  return async () => { stopped = true; clearTimeout(timer); await running; };
}
