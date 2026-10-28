export const alertableProject = project => !['award_published', 'award_cancelled', 'award_amended', 'invitation_cancelled'].includes(project?.status);
// One positive match alert per person/company/project/version; retain legacy v1 keys.
// Scores are coverage signals, not AI suitability or procurement eligibility.
export function newMatchEvents(records, projects, users, now = new Date()) {
  const byId = new Map(projects.map(project => [String(project._id), project]));
  const events = new Map();
  for (const record of records) {
    if (record.resultType !== 'requirement_match' || record.status !== 'compared'
        || !Number.isFinite(record.score) || record.score <= 0) continue;
    const project = byId.get(String(record.torId));
    if (!project?.projectId || !alertableProject(project)) continue;
    for (const user of users) {
      if (user.status !== 'active' || user.deletedAt || String(user.companyId) !== String(record.companyId)
          || !user.notificationPreferences?.channels?.includes('in_app')
          || !user.notificationPreferences?.alertTypes?.includes('new_match')) continue;
      const version = record.torVersion || 1;
      const eventKey = `in_app:new_match:${user._id}:${record.companyId}:${record.torId}${version === 1 ? '' : `:v${version}`}`;
      events.set(eventKey, {
        eventKey, userId: user._id, companyId: record.companyId, torId: record.torId,
        type: 'new_match', channel: 'in_app', status: 'sent',
        title: 'New TOR requirement match',
        message: `${project.title || project.projectId} has ${Math.round(record.score)}% requirement coverage. Review the match details and any missing requirements.`,
        attemptCount: 0, nextAttemptAt: null, deliveryError: null,
        createdAt: now, sentAt: now, readAt: null
      });
    }
  }
  return [...events.values()];
}

export function serializeNotification(row) {
  return { id: String(row._id), type: row.type, title: row.title, message: row.message,
    projectId: row.project?.projectId || null, isRead: row.status === 'read',
    createdAt: row.createdAt, readAt: row.readAt || null };
}
