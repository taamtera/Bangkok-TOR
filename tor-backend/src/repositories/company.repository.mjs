import { getDatabase } from '../config/database.mjs';
import { toObjectId } from '../utils/object-id.mjs';
import { companyProfileTagEntries, mergeQualifications } from '../utils/company-profile.mjs';
import { assertActiveTagIds, findOrCreateProfileTag } from './tag.repository.mjs';

function companies() {
  return getDatabase().collection('companies');
}

export async function createCompany({
  legalName,
  displayName = null,
  taxId = null,
  companySize = null,
  district = null,
  createdByUserId = null
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
    verificationStatus: 'unverified',
    createdByUserId: createdByUserId ? toObjectId(createdByUserId, 'createdByUserId') : null,
    memberCount: 1,
    updatedAt: now,
    createdAt: now
  };

  const result = await companies().insertOne(document);
  return { ...document, _id: result.insertedId };
}

export async function setCompanyCreator(companyId, userId) {
  return companies().updateOne(
    { _id: toObjectId(companyId, 'companyId') },
    { $set: { createdByUserId: toObjectId(userId, 'userId'), updatedAt: new Date() } }
  );
}

export async function findCompanyById(companyId) {
  return companies().findOne({ _id: toObjectId(companyId, 'companyId') });
}

export async function updateCompanyProfile(companyId, profile) {
  const id = toObjectId(companyId, 'companyId');
  const current = await companies().findOne({ _id: id }, { projection: { qualifications: 1, contact: 1 } });
  if (!current) return null;

  const now = new Date();
  const updated = await companies().findOneAndUpdate(
    { _id: id },
    {
      $set: {
        displayName: profile.displayName,
        companySize: profile.companySize,
        district: profile.district,
        technologies: profile.technologies,
        qualifications: mergeQualifications(current.qualifications, profile.qualifications),
        contact: { ...(current.contact && typeof current.contact === 'object' ? current.contact : {}), email: profile.contactEmail },
        updatedAt: now
      }
    },
    { returnDocument: 'after' }
  );
  return updated;
}

export async function syncCompanyProfileTagAssignments(companyId) {
  const id = toObjectId(companyId, 'companyId');
  const company = await companies().findOne({ _id: id }, { projection: { technologies: 1, qualifications: 1, tagAssignments: 1 } });
  if (!company) return null;

  const profileAssignments = [];
  const profileTagIds = new Set();
  for (const entry of companyProfileTagEntries(company.technologies, company.qualifications)) {
    const tag = await findOrCreateProfileTag(entry);
    if (!tag) continue; // Respect catalog deactivation; never silently re-enable it.
    if (profileTagIds.has(String(tag._id))) continue;
    profileTagIds.add(String(tag._id));
    profileAssignments.push({
      tagId: tag._id,
      source: 'manual',
      confidence: 1,
      verificationLevel: 'claimed',
      reviewStatus: 'approved',
      evidence: entry.evidence,
      reviewedByUserId: null,
      reviewedAt: null,
      assignedAt: new Date()
    });
  }

  // Profile-derived links follow the current profile. Preserve any separate
  // assignments the company explicitly manages in Matching setup.
  const isProfileLink = (assignment) => assignment.source === 'manual'
    && typeof assignment.evidence === 'string'
    && assignment.evidence.startsWith('Self-reported company profile ');
  const preserved = (company.tagAssignments || []).filter((assignment) => !isProfileLink(assignment));
  const preservedTagIds = new Set(preserved.map((assignment) => assignment.tagId?.toString()).filter(Boolean));
  const merged = [...preserved, ...profileAssignments.filter((assignment) => !preservedTagIds.has(assignment.tagId.toString()))];
  const now = new Date();
  await companies().updateOne({ _id: id }, { $set: { tagAssignments: merged, updatedAt: now } });
  return merged;
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

