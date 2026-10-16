import { createHash } from 'node:crypto';
import { getDatabase, startDatabaseSession } from '../config/database.mjs';
import { httpError } from '../utils/http-error.mjs';
import { toObjectId } from '../utils/object-id.mjs';
import { coreTagForName, normalizeTagName } from './tag-catalog.mjs';
import { validateAiRequirements, validateTagEvidence } from './ai-requirement-validation.mjs';
import { refreshTorRequirementMatches } from './requirement-matching.service.mjs';

async function resolveTag(db, requested, quote, session) {
  let tag;
  if (requested.tagId) tag = await db.collection('tags').findOne({ _id: toObjectId(requested.tagId, 'tagId') }, { session });
  else {
    const core = coreTagForName(requested.name);
    const name = core?.name || requested.name; const category = core?.category || requested.category;
    const normalizedName = normalizeTagName(name);
    const existing = await db.collection('tags').find({ category }, { session }).toArray();
    tag = existing.find((item) => [item.name, ...(item.aliases || [])].some((alias) => normalizeTagName(alias) === normalizeTagName(requested.name)));
    if (!tag) {
      const now = new Date();
      tag = await db.collection('tags').findOneAndUpdate({ category, normalizedName }, {
        $setOnInsert: { name, category, normalizedName, aliases: core?.aliases || [name],
          ...(core ? { conceptKey: core.conceptKey } : {}),
          slug: `auto-${createHash('sha256').update(`${category}:${normalizedName}`).digest('hex').slice(0, 20)}`,
          status: 'active', createdAt: now, updatedAt: now, createdByUserId: null,
          description: 'Created from a source-cited requirement; not a company verification.' }
      }, { session, upsert: true, returnDocument: 'after' });
    }
  }
  validateTagEvidence(tag, quote); return tag;
}

export async function ingestAiRequirements(projectId, body) {
  const db = getDatabase(); const session = startDatabaseSession(); let tor; let evaluation; let unchanged = false;
  try {
    for (let attempt = 0; ; attempt++) {
    try {
    await session.withTransaction(async () => {
      tor = await db.collection('tor_announcements').findOne({ projectId }, { session });
      if (!tor) throw httpError(404, 'TOR_NOT_FOUND', 'The TOR does not exist.');
      const source = await db.collection('requirement_sources').findOne({ _id: toObjectId(body?.sourceId, 'sourceId'), torId: tor._id }, { session });
      if (!source || source.sourceUrl !== (tor.documentUrl || tor.url)
        || String(tor.requirementSource?.snapshotId) !== String(source._id)) throw httpError(409, 'AI_SOURCE_STALE', 'Prepare the current source document before submitting requirements.');
      const latest = await db.collection('tor_versions').findOne({ torId: tor._id }, { session, sort: { version: -1 } });
      if (source.torVersion !== (latest?.version ?? tor.version ?? tor.torVersion ?? 1)) throw httpError(409, 'AI_SOURCE_STALE', 'The TOR version changed.');
      const validated = validateAiRequirements(body, source);
      const inputHash = createHash('sha256').update(JSON.stringify({ sourceId: body.sourceId, ...validated })).digest('hex');
      const previous = await db.collection('ai_evaluations').findOne({ torId: tor._id, torVersion: source.torVersion }, { session });
      if (previous?.inputHash === inputHash) { evaluation = previous; unchanged = true; return; }
      // Never replace the existing BMA demo seed through the AI ingestion route.
      if (previous?.requirements?.some((item) => item.evidence?.excerpt === 'Demo evidence text')) throw httpError(409, 'DEMO_REQUIREMENTS_PROTECTED', 'The existing demo evaluation is reserved for demo matching.');
      const requirements = []; const assignments = []; const now = new Date();
      for (const item of validated.requirements) {
        const clauses = [];
        for (const clause of item.clauses) {
          const tagIds = [];
          for (const requested of clause.anyOf) {
            const tag = await resolveTag(db, requested, item.evidence.quote, session);
            tagIds.push(tag._id);
            assignments.push({ tagId: tag._id, requirementKey: item.key, requirementLevel: item.importance,
              source: 'ai', confidence: item.confidence, reviewStatus: 'validated', validationMethod: 'source_quote_v1',
              evidence: item.evidence.quote, sourceDocumentUrl: source.sourceUrl, sourcePage: String(item.evidence.page),
              sourceSnapshotId: source._id, assignedAt: now });
          }
          clauses.push({ anyOfTagIds: [...new Map(tagIds.map((id) => [String(id), id])).values()] });
        }
        requirements.push({ ...item, clauses, evidence: { excerpt: item.evidence.quote, page: item.evidence.page, sourceUrl: source.sourceUrl } });
      }
      evaluation = await db.collection('ai_evaluations').findOneAndUpdate({ torId: tor._id, torVersion: source.torVersion }, {
        $set: { status: 'completed', retryCount: 0, lastAttemptAt: now, nextAttemptAt: null, lastError: null,
          requirements, model: validated.model, generatedAt: now, updatedAt: now, inputHash,
          validation: { status: 'passed', method: 'source_quote_v1', sourceId: source._id,
            sourceUrl: source.sourceUrl, documentHash: source.documentHash, validatedAt: now,
            dataMode: source.dataMode === 'demo' ? 'demo' : 'source' } },
        $setOnInsert: { createdAt: now }
      }, { session, upsert: true, returnDocument: 'after' });
      const retained = (tor.tagAssignments || []).filter((entry) => entry.validationMethod !== 'source_quote_v1');
      await db.collection('tor_announcements').updateOne({ _id: tor._id }, { $set: {
        tagAssignments: [...retained, ...assignments], requirementExtraction: { evaluationId: evaluation._id,
          inputHash, sourceId: source._id, torVersion: source.torVersion, updatedAt: now }
      } }, { session });
    });
    break;
    } catch (error) {
      // Concurrent extractions may discover the same new tag. Restart the
      // transaction and reuse the catalog winner instead of duplicating it.
      if (error?.code !== 11000 || attempt >= 2) throw error;
    }
    }
  } finally { await session.endSession(); }
  let matchingRefreshed = true;
  try { await refreshTorRequirementMatches(await db.collection('tor_announcements').findOne({ _id: tor._id })); }
  catch { matchingRefreshed = false; }
  return { projectId, torVersion: evaluation.torVersion, evaluationId: String(evaluation._id),
    status: 'stored', requirements: evaluation.requirements.length, unchanged, matchingRefreshed };
}
