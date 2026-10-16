import { getDatabase } from '../config/database.mjs';
import { ObjectId } from 'mongodb';
import { toObjectId } from '../utils/object-id.mjs';
import { assertActiveTagIds } from './tag.repository.mjs';
import { buildDiscoveryQuery, METHOD_VALUE, VALID_PROJECT_ID_FILTER } from './tor-query.mjs';

function tors() {
  return getDatabase().collection('tor_announcements');
}

export async function findTorByProjectId(projectId) {
  return tors().findOne({ projectId });
}

export async function updateTor(torId, changes, updatedByUserId) {
  const now = new Date();
  return tors().findOneAndUpdate(
    { projectId: torId },
    {
      $set: {
        ...changes,
        updatedAt: now,
        updatedByUserId: toObjectId(updatedByUserId, 'updatedByUserId')
      }
    },
    { returnDocument: 'after' }
  );
}

export async function listTors({
  search = null,
  departmentId = null,
  stage = null,
  stageScope = 'latest',
  procurementMethod = null,
  fromDate = null,
  toDate = null,
  sort = null,
  status = null,
  category = null,
  tagIds = [],
  sourceId = null,
  organizationId = null,
  minBudget = null,
  maxBudget = null,
  deadlineAfter = null,
  page = 1,
  limit = 20
} = {}) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
  const discovery = buildDiscoveryQuery({ search, departmentId, stage, stageScope, procurementMethod, fromDate, toDate, sort });
  const filter = discovery.filter;

  if (status) {
    filter.status = status;
  }

  if (category) {
    filter.category = category;
  }

  if (tagIds.length > 0) {
    filter.tagAssignments = {
      $all: tagIds.map((tagId) => ({
        $elemMatch: {
          tagId: toObjectId(tagId, 'tagId'),
          reviewStatus: 'approved'
        }
      }))
    };
  }

  if (sourceId) {
    filter.sourceId = sourceId;
  }

  if (organizationId) {
    filter['organization.organizationId'] = toObjectId(organizationId, 'organizationId');
  }

  if (minBudget !== null) {
    filter['budget.maxAmount'] = { ...(filter['budget.maxAmount'] || {}), $gte: Number(minBudget) };
  }

  if (maxBudget !== null) {
    filter['budget.minAmount'] = { ...(filter['budget.minAmount'] || {}), $lte: Number(maxBudget) };
  }

  if (deadlineAfter) {
    filter.submissionDeadline = { $gte: new Date(deadlineAfter) };
  }

  const cursor = tors().aggregate([
    { $match: filter },
    ...(discovery.ranking ? [{ $set: { _searchRank: discovery.ranking } }] : []),
    { $sort: discovery.sort },
    { $skip: (safePage - 1) * safeLimit }, { $limit: safeLimit },
    { $unset: '_searchRank' }
  ]);
  const [items, total, metadata] = await Promise.all([
    cursor.toArray(),
    tors().countDocuments(filter),
    tors().aggregate([{ $match: VALID_PROJECT_ID_FILTER }, { $facet: {
      departments: [
        { $group: { _id: { $ifNull: ['$departmentId', ''] }, name: { $max: '$departmentName' }, count: { $sum: 1 } } },
        { $project: { _id: 0, value: { $cond: [{ $eq: ['$_id', ''] }, '__unknown__', '$_id'] }, name: 1, count: 1 } }
      ],
      methods: [
        { $group: { _id: { $ifNull: [METHOD_VALUE, ''] }, count: { $sum: 1 } } },
        { $project: { _id: 0, value: { $cond: [{ $eq: ['$_id', ''] }, '__unknown__', '$_id'] }, count: 1 } }
      ],
      total: [{ $count: 'count' }]
    } }]).next()
  ]);

  return {
    items,
    facets: { departments: metadata.departments, methods: metadata.methods },
    totalAllProjects: metadata.total[0]?.count ?? 0,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit)
    }
  };
}

export async function replaceTorTagAssignments(torId, assignments, reviewedByUserId) {
  const objectIds = await assertActiveTagIds(assignments.map(({ tagId }) => tagId));
  const current = await tors().findOne({ projectId: torId });
  if (!current) return null;
  const sourceDocumentUrl = current.documentUrl || current.url || null;
  if (assignments.length > 0 && !sourceDocumentUrl) {
    const error = new Error('This TOR has no source document or announcement URL to cite.');
    error.status = 400;
    error.code = 'TOR_SOURCE_REQUIRED';
    throw error;
  }
  const now = new Date();
  const tagAssignments = assignments.map((assignment, index) => ({
    tagId: objectIds[index],
    requirementLevel: assignment.requirementLevel,
    source: 'manual',
    confidence: 1,
    reviewStatus: 'approved',
    evidence: assignment.evidence,
    sourceDocumentUrl,
    sourcePage: null,
    reviewedByUserId: toObjectId(reviewedByUserId, 'reviewedByUserId'),
    reviewedAt: now,
    assignedAt: now
  }));

  // Manual replacement controls the reviewed annotations, while unreviewed
  // and rejected AI suggestions remain available for audit/review.
  const retainedSuggestions = (current.tagAssignments || []).filter((assignment) =>
    assignment.source === 'ai' && ['suggested', 'rejected'].includes(assignment.reviewStatus));
  return tors().findOneAndUpdate(
    { _id: current._id },
    { $set: { tagAssignments: [...tagAssignments, ...retainedSuggestions], updatedAt: now } },
    { returnDocument: 'after' }
  );
}

export async function replaceTorTagSuggestions(torId, suggestions, suggestedByUserId) {
  const objectIds = await assertActiveTagIds(suggestions.map(({ tagId }) => tagId));
  const current = await tors().findOne({ projectId: torId });
  if (!current) return null;
  const allowedSourceUrls = new Set([current.documentUrl, current.url].filter((value) => typeof value === 'string' && value.trim()));
  if (suggestions.some(({ sourceDocumentUrl }) => !allowedSourceUrls.has(sourceDocumentUrl))) {
    const error = new Error('AI suggestions must cite this TOR announcement or its stored source document URL.');
    error.status = 400;
    error.code = 'TOR_SUGGESTION_SOURCE_MISMATCH';
    throw error;
  }
  const now = new Date();
  const pending = suggestions.map((suggestion, index) => ({
    suggestionId: new ObjectId(),
    tagId: objectIds[index],
    requirementLevel: suggestion.requirementLevel,
    source: 'ai',
    confidence: suggestion.confidence,
    reviewStatus: 'suggested',
    evidence: suggestion.evidence,
    sourceDocumentUrl: suggestion.sourceDocumentUrl,
    sourcePage: suggestion.sourcePage,
    suggestedByUserId: toObjectId(suggestedByUserId, 'suggestedByUserId'),
    suggestedAt: now,
    reviewedByUserId: null,
    reviewedAt: null,
    assignedAt: now
  }));

  // A fresh extraction replaces only the previous pending AI batch. Approved,
  // rejected, and manually reviewed annotations remain intact for auditability.
  const retained = (current.tagAssignments || []).filter((assignment) => !(assignment.source === 'ai' && assignment.reviewStatus === 'suggested'));
  const updated = await tors().findOneAndUpdate(
    { _id: current._id },
    { $set: { tagAssignments: [...retained, ...pending], updatedAt: now } },
    { returnDocument: 'after' }
  );
  return updated;
}

export async function reviewTorTagSuggestion(torId, suggestionId, reviewStatus, reviewerUserId) {
  const id = toObjectId(suggestionId, 'suggestionId');
  const tor = await tors().findOne({ projectId: torId });
  if (!tor) return null;
  const suggestion = (tor.tagAssignments || []).find((assignment) => assignment.suggestionId?.toString() === id.toString());
  if (!suggestion || suggestion.source !== 'ai') {
    const error = new Error('The TOR requirement suggestion does not exist.');
    error.status = 404;
    error.code = 'TOR_SUGGESTION_NOT_FOUND';
    throw error;
  }
  if (suggestion.reviewStatus !== 'suggested') {
    const error = new Error('This TOR requirement suggestion has already been reviewed.');
    error.status = 409;
    error.code = 'TOR_SUGGESTION_ALREADY_REVIEWED';
    throw error;
  }
  if (suggestion.suggestedByUserId?.toString() === reviewerUserId) {
    const error = new Error('A reviewer cannot approve or reject their own AI submission.');
    error.status = 403;
    error.code = 'TOR_SUGGESTION_SELF_REVIEW';
    throw error;
  }

  if (reviewStatus === 'approved' && (tor.tagAssignments || []).some((assignment) =>
    assignment.suggestionId?.toString() !== id.toString()
      && assignment.reviewStatus === 'approved'
      && assignment.tagId?.toString() === suggestion.tagId?.toString())) {
    const error = new Error('This tag already has an approved requirement classification for the TOR.');
    error.status = 409;
    error.code = 'TOR_REQUIREMENT_ALREADY_TAGGED';
    throw error;
  }

  const reviewerId = toObjectId(reviewerUserId, 'reviewerUserId');
  const reviewedAt = new Date();
  const tagAssignments = tor.tagAssignments.map((assignment) => assignment.suggestionId?.toString() === id.toString()
    ? { ...assignment, reviewStatus, reviewedByUserId: reviewerId, reviewedAt }
    : assignment);
  const result = await tors().updateOne(
    { _id: tor._id, tagAssignments: { $elemMatch: { suggestionId: id, reviewStatus: 'suggested' } } },
    { $set: { tagAssignments, updatedAt: reviewedAt } }
  );
  if (result.matchedCount !== 1) {
    const error = new Error('This TOR requirement suggestion has already been reviewed.');
    error.status = 409;
    error.code = 'TOR_SUGGESTION_ALREADY_REVIEWED';
    throw error;
  }
  return tors().findOne({ _id: tor._id });
}

