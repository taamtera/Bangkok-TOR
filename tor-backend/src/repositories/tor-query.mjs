import { httpError } from '../utils/http-error.mjs';

export const STAGE_STATUS = {
  P0: 'procurement_planned', '15': 'reference_price_published', B0: 'draft_tender_published',
  D0: 'invitation_published', W0: 'award_published', D1: 'invitation_cancelled',
  W1: 'award_cancelled', D2: 'invitation_amended', W2: 'award_amended'
};
const SEARCH_FIELDS = ['projectId', 'title', 'description', 'departmentId', 'departmentName'];
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const VALID_PROJECT_ID_FILTER = Object.freeze({
  projectId: Object.freeze({ $type: 'string', $regex: /\S/ })
});
export const METHOD_VALUE = { $cond: [
  { $eq: [{ $type: '$procurementMethod' }, 'string'] }, '$procurementMethod',
  { $ifNull: ['$procurementMethod.name', { $ifNull: ['$procurementMethod.label', { $ifNull: ['$procurementMethod.code', '$procurementMethod.id'] }] }] }
] };

function text(value, name) {
  if (value == null) return '';
  if (typeof value !== 'string') throw httpError(400, 'INVALID_SEARCH_FILTER', `${name} must be text.`);
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ');
}
function date(value, name) {
  const result = text(value, name);
  if (!result) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result) {
    throw httpError(400, 'INVALID_SEARCH_FILTER', `${name} must be a valid YYYY-MM-DD date.`);
  }
  return result;
}
const regexMatch = (field, regex) => ({ $regexMatch: { input: { $ifNull: [`$${field}`, ''] }, regex, options: 'i' } });

export function buildDiscoveryQuery(options = {}) {
  const search = text(options.search, 'search');
  if (search.length > 160) throw httpError(400, 'INVALID_SEARCH_FILTER', 'Search must contain at most 160 characters.');
  const tokens = search.split(' ').filter(Boolean);
  if (tokens.length > 12) throw httpError(400, 'INVALID_SEARCH_FILTER', 'Search must contain at most 12 words.');
  const departmentId = text(options.departmentId, 'departmentId');
  const stage = text(options.stage, 'stage');
  const stageScope = text(options.stageScope, 'stageScope') || 'latest';
  const procurementMethod = text(options.procurementMethod, 'procurementMethod');
  const fromDate = date(options.fromDate, 'fromDate');
  const toDate = date(options.toDate, 'toDate');
  const sort = text(options.sort, 'sort') || (search ? 'relevance' : 'latest');
  if (!['latest', 'retained'].includes(stageScope)) throw httpError(400, 'INVALID_SEARCH_FILTER', 'stageScope is invalid.');
  if (stage && !Object.hasOwn(STAGE_STATUS, stage) && stage !== 'multiple_announcements_same_day') throw httpError(400, 'INVALID_SEARCH_FILTER', 'stage is invalid.');
  if (!['latest', 'oldest', 'relevance'].includes(sort)) throw httpError(400, 'INVALID_SEARCH_FILTER', 'sort is invalid.');
  if (fromDate && toDate && fromDate > toDate) throw httpError(400, 'INVALID_SEARCH_FILTER', 'The start date must not be after the end date.');

  const conditions = tokens.map(token => ({ $or: SEARCH_FIELDS.map(field => ({ [field]: { $regex: escapeRegex(token), $options: 'i' } })) }));
  if (departmentId === '__unknown__') conditions.push({ $or: [{ departmentId: null }, { departmentId: '' }] });
  else if (departmentId) conditions.push({ departmentId });
  if (procurementMethod === '__unknown__') conditions.push({ $expr: { $in: [{ $ifNull: [METHOD_VALUE, ''] }, ['', null]] } });
  else if (procurementMethod) conditions.push({ $expr: { $eq: [METHOD_VALUE, procurementMethod] } });
  if (fromDate || toDate) conditions.push({ statusPublishedAt: { ...(fromDate ? { $gte: fromDate } : {}), ...(toDate ? { $lte: toDate } : {}) } });
  if (stage === 'multiple_announcements_same_day') conditions.push({ statusOrderAmbiguous: true });
  else if (stage) {
    const path = `stageObservations.${stage}`;
    if (stageScope === 'retained') conditions.push({ [path]: { $type: 'object' } });
    else conditions.push({ $or: [
      { status: STAGE_STATUS[stage] },
      { $and: [{ [path]: { $type: 'object' } }, { $expr: { $eq: [`$${path}.publishedAt`, '$statusPublishedAt'] } }] }
    ] });
  }
  const ranking = search ? { $add: [
    { $cond: [{ $eq: ['$projectId', search] }, 1000, 0] },
    { $cond: [{ $eq: ['$departmentId', search] }, 300, 0] },
    { $cond: [regexMatch('title', escapeRegex(search)), 100, 0] },
    ...tokens.flatMap(token => [
      { $cond: [regexMatch('title', escapeRegex(token)), 20, 0] },
      { $cond: [regexMatch('departmentName', escapeRegex(token)), 10, 0] }
    ])
  ] } : null;
  return {
    filter: {
      ...VALID_PROJECT_ID_FILTER,
      ...(conditions.length ? { $and: conditions } : {})
    },
    ranking: search && sort === 'relevance' ? ranking : null,
    sort: search && sort === 'relevance' ? { _searchRank: -1, statusPublishedAt: -1, projectId: 1 }
      : { statusPublishedAt: sort === 'oldest' ? 1 : -1, projectId: 1 }
  };
}
