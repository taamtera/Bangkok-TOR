import { httpError } from '../utils/http-error.mjs';
import { getDatabase } from '../config/database.mjs';
import { toObjectId } from '../utils/object-id.mjs';
import { companyProfileTagEntries, mergeQualifications, mergeProfileAssignments } from '../utils/company-profile.mjs';
import { assertActiveTagIds, findOrCreateCatalogTag } from './tag.repository.mjs';

function companies() {
  return getDatabase().collection('companies');
}

export async function createCompany({
  legalName,
  displayName = null,
  taxId = null,
  companySize = null,
  district = null,
  ownerUserId = null
}) {
  const now = new Date();
  const document = {
    legalName: legalName.trim(),
    displayName: (displayName || legalName).trim(),
    taxId: taxId ? taxId.trim() : null,
    // The database validator requires a string even when registration does not
    // collect company size yet. Use an explicit placeholder until the profile
    // is completed instead of inserting null.
    companySize: companySize?.trim() || 'Not specified',
    district: district ?? null,
    technologies: [],
    qualifications: [],
    tags: [],
    verificationStatus: 'unverified',
    ownerUserId: ownerUserId ? toObjectId(ownerUserId, 'ownerUserId') : null,
    memberUserIds: ownerUserId ? [toObjectId(ownerUserId, 'ownerUserId')] : [],
    updatedAt: now,
    createdAt: now
  };

  const result = await companies().insertOne(document);
  return { ...document, _id: result.insertedId };
}

export async function setCompanyOwner(companyId, userId) {
  return companies().updateOne(
    { _id: toObjectId(companyId, 'companyId') },
    { $set: { ownerUserId: toObjectId(userId, 'userId'), updatedAt: new Date() },
      $addToSet: { memberUserIds: toObjectId(userId, 'userId') } }
  );
}

export async function findCompanyById(companyId) {
  return companies().findOne({ _id: toObjectId(companyId, 'companyId') });
}

export async function findCompanyProfileById(companyId) {
  const [company] = await companies().aggregate([
    { $match: { _id: toObjectId(companyId, 'companyId') } },
    { $lookup: { from: 'tags', localField: 'tags.tagId', foreignField: '_id', as: 'catalogTags' } },
    { $set: { tags: { $map: {
      input: { $ifNull: ['$tags', []] }, as: 'link',
      in: { $let: {
        vars: { tag: { $arrayElemAt: [{ $filter: { input: '$catalogTags', as: 'entry', cond: { $eq: ['$$entry._id', '$$link.tagId'] } } }, 0] } },
        in: { tagId: '$$link.tagId', contractorLabel: { $ifNull: ['$$tag.contractorLabel', null] },
          text: { $ifNull: ['$$tag.text', { $ifNull: ['$$tag.name', null] }] },
          category: { $ifNull: ['$$tag.category', null] }, type: { $ifNull: ['$$tag.type', null] }, status: { $ifNull: ['$$tag.status', null] } }
      } }
    } } } },
    { $unset: 'catalogTags' }
  ]).toArray();
  return company ?? null;
}

async function profileAssignments(company) {
  const derived = [];
  const now = new Date();
  const claimed = (tagId, evidence) => ({ tagId, source: 'manual', confidence: 1,
    verificationLevel: 'claimed', reviewStatus: 'approved', evidence,
    reviewedByUserId: null, reviewedAt: null, assignedAt: now });
  for (const entry of companyProfileTagEntries(company.technologies, company.qualifications)) {
    const tag = await findOrCreateCatalogTag(entry);
    if (tag) derived.push(claimed(tag._id, entry.evidence));
  }
  const ids = (company.tags || []).map(link => link.tagId);
  const catalog = ids.length ? await getDatabase().collection('tags').find({
    _id: { $in: ids }, status: { $ne: 'inactive' }, matchingExcluded: { $ne: true }
  }).toArray() : [];
  for (const tag of catalog) derived.push(claimed(tag._id,
    `Self-reported company service selection: ${tag.contractorLabel || tag.text || tag.name || tag._id}`));
  return mergeProfileAssignments(company.tagAssignments, derived);
}

function unchangedProfile(company) {
  // Detect concurrent profile/evidence edits rather than overwriting their data.
  const filter = { _id: company._id };
  for (const key of ['updatedAt', 'tags', 'tagAssignments']) {
    filter[key] = Object.hasOwn(company, key) ? company[key] : { $exists: false };
  }
  return filter;
}

export async function updateCompanyProfile(companyId, profile) {
  const id = toObjectId(companyId, 'companyId');
  const current = await companies().findOne({ _id: id });
  if (!current) return null;
  let linkedTags = current.tags || [];
  if (Object.hasOwn(profile, 'tags')) {
    const currentIds = new Set(linkedTags.map(link => String(link.tagId)));
    const addedIds = profile.tags.map(link => link.tagId).filter(tagId => !currentIds.has(tagId));
    if (addedIds.length) await assertActiveTagIds(addedIds);
    linkedTags = profile.tags.map(({ tagId }) => ({ tagId: toObjectId(tagId, 'tagId') }));
  }
  const changes = {
    displayName: profile.displayName,
    ...(Object.hasOwn(profile, 'description') ? { description: profile.description } : {}),
    ...(Object.hasOwn(profile, 'certifications') ? { certifications: profile.certifications } : {}),
    companySize: profile.companySize, district: profile.district,
    technologies: profile.technologies,
    qualifications: mergeQualifications(current.qualifications, profile.qualifications),
    contact: { ...(current.contact && typeof current.contact === 'object' ? current.contact : {}), email: profile.contactEmail },
    tags: linkedTags
  };
  // Resolve and validate before committing. Profile and matching links change in
  // one atomic company-document write; a resolution error saves neither.
  const tagAssignments = await profileAssignments({ ...current, ...changes });
  const updated = await companies().findOneAndUpdate(unchangedProfile(current), {
    $set: { ...changes, tagAssignments, updatedAt: new Date() }
  }, { returnDocument: 'after' });
  if (!updated) throw httpError(409, 'PROFILE_CHANGED', 'Your company profile changed. Reload it and save again.');
  return updated;
}

export async function syncCompanyProfileTagAssignments(companyId) {
  const company = await companies().findOne({ _id: toObjectId(companyId, 'companyId') });
  if (!company) return null;
  const tagAssignments = await profileAssignments(company);
  const result = await companies().updateOne(unchangedProfile(company), {
    $set: { tagAssignments, updatedAt: new Date() }
  });
  if (!result.matchedCount) throw httpError(409, 'PROFILE_CHANGED', 'Your company profile changed. Reload it and try again.');
  return tagAssignments;
}

export async function findCompanyByTaxId(taxId) {
  return companies().findOne({ taxId });
}

export async function updateCompanyVerification(companyId, verificationStatus) {
  const allowedStatuses = ['unverified', 'pending', 'verified', 'rejected'];

  if (!allowedStatuses.includes(verificationStatus)) {
    const error = new Error('Company verification status is invalid.');
    error.status = 400;
    error.code = 'INVALID_COMPANY_STATUS';
    throw error;
  }

  return companies().findOneAndUpdate(
    { _id: toObjectId(companyId, 'companyId') },
    { $set: { verificationStatus, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
}

export async function replaceCompanyTagAssignments(companyId, assignments, reviewedByUserId) {
  const objectIds = await assertActiveTagIds(assignments.map(({ tagId }) => tagId));
  const now = new Date();
  const tagAssignments = assignments.map((assignment, index) => ({
    tagId: objectIds[index],
    source: 'manual',
    confidence: 1,
    verificationLevel: assignment.verificationLevel,
    reviewStatus: 'approved',
    evidence: assignment.evidence,
    reviewedByUserId: toObjectId(reviewedByUserId, 'reviewedByUserId'),
    reviewedAt: now,
    assignedAt: now
  }));

  return companies().findOneAndUpdate(
    { _id: toObjectId(companyId, 'companyId') },
    { $set: { tagAssignments, updatedAt: now } },
    { returnDocument: 'after' }
  );
}

