import { getDatabase } from '../config/database.mjs';
import { toObjectId } from '../utils/object-id.mjs';

function companies() { return getDatabase().collection('companies'); }
function tors() { return getDatabase().collection('tor_announcements'); }
function tags() { return getDatabase().collection('tags'); }
function versions() { return getDatabase().collection('tor_versions'); }
function matches() { return getDatabase().collection('company_matches'); }

export async function listRequirementEvaluations(torIds) {
  if (!torIds.length) return [];
  return getDatabase().collection('ai_evaluations').find({ torId: { $in: torIds }, status: 'completed' }, {
    projection: { torId: 1, torVersion: 1, status: 1, requirements: 1, validation: 1 }
  }).sort({ updatedAt: -1 }).toArray();
}

export async function findCompanyForMatching(companyId) {
  return companies().findOne({ _id: toObjectId(companyId, 'companyId') });
}

export async function listTorsForMatching() {
  return tors().find({
    $and: [
      { $or: [
        { documentUrl: { $type: 'string', $regex: /^https?:\/\/\S+/iu } },
        { url: { $type: 'string', $regex: /^https?:\/\/\S+/iu } }
      ] },
      { $or: [
        { title: { $type: 'string', $regex: /\S/u } },
        { description: { $type: 'string', $regex: /\S/u } },
        { itemParams: { $type: 'object' } }
      ] }
    ]
  }).toArray();
}

export async function listCompaniesForMatching() {
  return companies().find({}).toArray();
}

export async function findActiveTagsByIds(ids) {
  if (ids.length === 0) return [];
  return tags().find({ _id: { $in: ids }, status: 'active' }).toArray();
}

export async function listActiveTagsForMatching() {
  return tags().find({ status: 'active' }).toArray();
}

export async function findLatestTorVersions(torIds) {
  if (torIds.length === 0) return new Map();
  const rows = await versions().find({ torId: { $in: torIds } }).sort({ version: -1 }).toArray();
  const latest = new Map();
  for (const row of rows) {
    if (!latest.has(row.torId.toString())) latest.set(row.torId.toString(), row.version);
  }
  return latest;
}

export async function saveCompanyMatches(records) {
  if (records.length === 0) return;
  const now = new Date();
  await matches().bulkWrite(records.map(({ companyId, torId, torVersion, ...record }) => ({
    updateOne: {
      filter: { companyId, torId, torVersion },
      update: {
        $set: { ...record, updatedAt: now },
        ...(record.resultType === 'requirement_match' ? { $unset: { recommendation: '' } } : {}),
        $setOnInsert: { createdAt: now }
      },
      upsert: true
    }
  })), { ordered: false });
}

export async function listCompanyMatches(companyId, torIds) {
  if (torIds.length === 0) return [];
  return matches().find({
    companyId: toObjectId(companyId, 'companyId'),
    torId: { $in: torIds }
  }).toArray();
}
