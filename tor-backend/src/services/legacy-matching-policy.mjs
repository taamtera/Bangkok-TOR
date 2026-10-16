// Policy 2 compatibility helper for historical records/tests. Not used by HTTP routes.
import { detectTorTextTagMentions } from './tor-text-matching.mjs';

const MATCH_POLICY_VERSION = 2;
const REQUIREMENT_WEIGHT = { required: 3, preferred: 1, mentioned: 1, informational: 0 };
const EVIDENCE_FACTOR = { claimed: 0.5, experienced: 0.75, verified: 1 };

function approvedAssignments(assignments = []) {
  return assignments.filter((assignment) => assignment?.reviewStatus === 'approved'
    && assignment.tagId
    && typeof assignment.evidence === 'string'
    && assignment.evidence.trim().length > 0);
}

function sourceBackedTorAssignments(tor, activeTags) {
  const reviewed = approvedAssignments(tor.tagAssignments);
  const reviewedIds = new Set(reviewed.map(({ tagId }) => tagId.toString()));
  const automatic = detectTorTextTagMentions(tor, activeTags)
    .filter(({ tagId }) => !reviewedIds.has(tagId.toString()));
  return [...reviewed, ...automatic];
}

function profileCompleteness(company, approvedCompanyTags) {
  if (Number.isFinite(company.profileCompleteness)) {
    return Math.max(0, Math.min(100, Math.round(company.profileCompleteness)));
  }

  // Fallback until the company-profile endpoint owns this value: five explicit
  // profile sections, each worth 20 percent.
  const completeSections = [
    Boolean(company.legalName || company.displayName),
    Boolean(company.companySize),
    Array.isArray(company.technologies) && company.technologies.length > 0,
    Array.isArray(company.qualifications) && company.qualifications.length > 0,
    approvedCompanyTags.length > 0
  ].filter(Boolean).length;
  return completeSections * 20;
}

function strongestAssignments(assignments, activeTags) {
  const result = new Map();
  for (const assignment of approvedAssignments(assignments)) {
    const tagId = assignment.tagId.toString();
    if (!activeTags.has(tagId) || !EVIDENCE_FACTOR[assignment.verificationLevel]) continue;
    const current = result.get(tagId);
    if (!current || EVIDENCE_FACTOR[assignment.verificationLevel] > EVIDENCE_FACTOR[current.verificationLevel]) {
      result.set(tagId, assignment);
    }
  }
  return result;
}

export function computeCompanyMatch(company, tor, tagsById, torVersion) {
  const companyTags = strongestAssignments(company.tagAssignments, tagsById);
  const torAssignments = (tor.matchingTagAssignments || sourceBackedTorAssignments(tor, [...tagsById.values()]))
    .filter((assignment) => tagsById.has(assignment.tagId.toString()) && REQUIREMENT_WEIGHT[assignment.requirementLevel] !== undefined);
  const scoredRequirements = torAssignments.filter(({ requirementLevel }) => REQUIREMENT_WEIGHT[requirementLevel] > 0);
  const totalWeight = scoredRequirements.reduce((sum, item) => sum + REQUIREMENT_WEIGHT[item.requirementLevel], 0);

  let earnedWeight = 0;
  const strengths = [];
  const gaps = [];
  const requirementMatches = torAssignments.map((requirement) => {
    const tagId = requirement.tagId.toString();
    const tag = tagsById.get(tagId);
    const companyAssignment = companyTags.get(tagId);
    const verificationLevel = companyAssignment?.verificationLevel ?? null;
    const factor = verificationLevel ? EVIDENCE_FACTOR[verificationLevel] : 0;
    const weight = REQUIREMENT_WEIGHT[requirement.requirementLevel];

    if (weight > 0) earnedWeight += weight * factor;

    let status;
    if (requirement.requirementLevel === 'informational') {
      status = 'informational';
    } else if (!companyAssignment) {
      status = 'missing';
      const level = requirement.requirementLevel === 'required' ? 'Required'
        : requirement.requirementLevel === 'mentioned' ? 'Mentioned in announcement'
          : 'Preferred';
      gaps.push(`${level} capability not listed: ${tag.name}`);
    } else if (factor === 1) {
      status = 'met';
      strengths.push(`Verified capability: ${tag.name}`);
    } else {
      status = 'partial';
      strengths.push(`${verificationLevel === 'claimed' ? 'Claimed' : 'Experienced'} capability: ${tag.name}`);
    }

    return {
      tagId: requirement.tagId,
      tagName: tag.name,
      requirementLevel: requirement.requirementLevel,
      status,
      verificationLevel,
      requirementEvidence: requirement.evidence ?? null,
      requirementSourceUrl: requirement.sourceDocumentUrl || tor.documentUrl || tor.url || null,
      requirementSourcePage: requirement.sourcePage ?? null,
      companyEvidence: companyAssignment?.evidence ?? null
    };
  });

  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
  const recommendation = score >= 80
    ? 'strong_match'
    : score >= 45
      ? 'possible_match'
      : 'not_recommended';
  const completeness = profileCompleteness(company, [...companyTags.values()]);
  const satisfied = requirementMatches.filter(({ status }) => status === 'met' || status === 'partial').length;
  const explanation = totalWeight > 0
    ? `Your profile matches ${satisfied} of ${scoredRequirements.length} capability signals found for this TOR.`
    : 'No matching capability terms were found in this TOR’s stored announcement text.';

  return {
    companyId: company._id,
    torId: tor._id,
    torVersion,
    score,
    recommendation: totalWeight > 0 ? recommendation : 'possible_match',
    requirementMatches,
    strengths,
    gaps,
    explanation,
    profileCompleteness: completeness,
    policyVersion: MATCH_POLICY_VERSION,
    computedAt: new Date()
  };
}
