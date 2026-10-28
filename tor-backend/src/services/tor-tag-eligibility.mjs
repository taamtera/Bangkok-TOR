// Eligibility is computed at read time. Keep the workflow's provenance unchanged.
export function usableTorTagAssignment(tor, assignment) {
  if (!assignment?.tagId || !['required', 'preferred', 'mentioned', 'informational'].includes(assignment.requirementLevel)
    || typeof assignment.evidence !== 'string' || !assignment.evidence.trim()) return false;
  if (assignment.tagMatchingExcluded === true
    || (Object.hasOwn(assignment, 'tagStatus') && assignment.tagStatus !== 'active')) return false;
  if (assignment.reviewStatus === 'rejected') return false;
  if (['approved', 'validated'].includes(assignment.reviewStatus)) return true;
  return assignment.reviewStatus === 'suggested' && assignment.source === 'ai'
    && tor.aiProcessing?.status === 'completed'
    && tor.aiProcessing?.tagReviewStatus === 'approved'
    && typeof assignment.confidence === 'number' && Number.isFinite(assignment.confidence)
    && assignment.confidence >= 0 && assignment.confidence <= 1;
}
