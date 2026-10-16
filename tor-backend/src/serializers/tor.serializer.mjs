const REMOVED_ENRICHMENT_FIELDS = ['opend', 'opendLookup', 'province', 'district', 'subdistrict', 'projectLocation', 'projectMoney', 'referencePrice', 'totalContractValue', 'contractProjectStatus', 'contracts', 'opendUpdatedAt', 'locationFilter'];

// Source identities are strings; MongoDB _id remains internal.
export function serializeTor(tor) {
  const { _id, templateId, projectKey, announcementType, ...project } = tor;
  const projectId = typeof tor.projectId === 'string' ? tor.projectId : null;
  const result = {
    ...project, projectId,
    // Expose reviewed annotations and exact, source-cited announcement mentions
    // used by automatic recommendation candidates. Pending AI suggestions stay private.
    tagAssignments: Array.isArray(tor.tagAssignments)
      ? tor.tagAssignments.filter((assignment) => assignment?.reviewStatus === 'approved' || assignment?.reviewStatus === 'auto_detected')
      : [],
    scope: tor.scope ?? 'department',
    identityScope: tor.identityScope ?? (projectId?.startsWith('P') ? 'plan' : 'project'),
    status: tor.status ?? 'unknown',
    statusOrderAmbiguous: tor.statusOrderAmbiguous === true,
    stageObservations: tor.stageObservations ?? {},
    biddingOpenVerified: tor.biddingOpenVerified === true,
    titleMatchedKeywords: tor.titleMatchedKeywords ?? [],
    channelParams: tor.channelParams ?? {}, itemParams: tor.itemParams ?? {},
    thumbnail: projectId ? `/api/thumbnail/${encodeURIComponent(projectId)}` : null
  };
  for (const field of [
    'title', 'description', 'departmentId', 'departmentName', 'procurementMethod',
    'publishedAt', 'url', 'documentUrl', 'thumbnailSourceUrl', 'linkedProjectId',
    'statusPublishedAt', 'firstSeenAt', 'lastSeenAt'
  ]) result[field] = tor[field] ?? null;
  for (const field of REMOVED_ENRICHMENT_FIELDS) delete result[field];
  return result;
}
