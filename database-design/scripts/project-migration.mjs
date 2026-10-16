import { STAGE_STATUS, REMOVED_ENRICHMENT_FIELDS } from './ingestion-schema.mjs';

const nullableFields = ['departmentName', 'documentUrl', 'thumbnailSourceUrl'];
const observationFields = ['title', 'description', 'publishedAt', 'url', 'documentUrl', 'channelParams', 'itemParams', 'firstSeenAt', 'lastSeenAt'];
const iso = value => value instanceof Date ? value.toISOString() : value;
const sourceString = value => typeof value === 'string' && value.length ? value
  : Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
function publicationDate(value) {
  const text = iso(value);
  if (typeof text !== 'string') throw new Error('Missing publication date');
  const parsed = new Date(text);
  if (Number.isNaN(parsed.valueOf())) throw new Error('Invalid publication date');
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : parsed.toISOString().slice(0, 10);
}
function linkedId(document) {
  try { return new URL(document.documentUrl || document.url).searchParams.get('projectId'); }
  catch { return null; }
}
function stageCode(document) {
  const statusCode = Object.keys(STAGE_STATUS).find(key => STAGE_STATUS[key] === document.status);
  if (statusCode) return statusCode;
  // Document templateType is a raw document parameter, not authoritative RSS stage metadata.
  for (const raw of [document.channelParams?.announcementType, document.channelParams?.announceType, document.announcementType]) {
    const code = typeof raw === 'string' ? raw : raw?.code ?? raw?.id ?? raw?.value;
    if (STAGE_STATUS[code]) return code;
  }
  // This exact legacy RSS label is present in the repository's original schema samples.
  if (document.announcementType === 'ประกาศเชิญชวน') return 'D0';
  return undefined;
}
function compareObservations(left, right) {
  return (left.publishedAt || '').localeCompare(right.publishedAt || '')
    || (Date.parse(iso(left.lastSeenAt)) || 0) - (Date.parse(iso(right.lastSeenAt)) || 0)
    || String(left._id).localeCompare(String(right._id));
}
function normalizeObservation(document) {
  const observation = Object.fromEntries(observationFields.filter(field => document[field] !== undefined).map(field => [field, iso(document[field])]));
  observation.publishedAt = publicationDate(document.publishedAt);
  observation.itemParams = { ...(document.itemParams || {}) };
  if (document.announcementType !== undefined && observation.itemParams.announcementType === undefined) observation.itemParams.announcementType = document.announcementType;
  // Retain raw document IDs in their parameter bag before removing top-level fields.
  if (document.templateId && !observation.itemParams.templateId) observation.itemParams.templateId = document.templateId;
  return observation;
}

// Pure planner: a preview and tests use exactly the same merge rules as --apply.
export function planProjectMigration(announcements, thumbnails) {
  const errors = [];
  const groups = new Map();
  const templateProjects = new Map();
  for (const original of announcements) {
    try {
      const document = { ...original, projectId: sourceString(original.projectId ?? original.itemParams?.planId ?? original.itemParams?.projectId ?? linkedId(original) ?? original.externalId) };
      if (!document.projectId) throw new Error('No reliable projectId; projectKey is not a source identity');
      if (document.departmentId != null && typeof document.departmentId !== 'string') throw new Error('departmentId must be restored as a source string to preserve leading zeros');
      for (const field of ['firstSeenAt', 'lastSeenAt']) {
        document[field] = iso(document[field]);
        if (typeof document[field] !== 'string' || Number.isNaN(Date.parse(document[field]))) throw new Error(`Missing or invalid ${field}`);
      }
      document.publishedAt = publicationDate(document.publishedAt);
      const observations = {};
      for (const [code, observation] of Object.entries(document.stageObservations || {})) {
        if (!STAGE_STATUS[code]) throw new Error(`Unknown stage ${code}`);
        observations[code] = normalizeObservation(observation);
      }
      const code = stageCode(document);
      if (code) {
        const current = normalizeObservation(document);
        if (!observations[code] || compareObservations(current, observations[code]) > 0) observations[code] = current;
      }
      document.stageObservations = observations;
      groups.set(document.projectId, [...(groups.get(document.projectId) || []), document]);
      const templateId = original.templateId ?? original.itemParams?.templateId;
      if (templateId) {
        const identities = templateProjects.get(templateId) || new Set();
        identities.add(document.projectId);
        templateProjects.set(templateId, identities);
      }
    } catch (error) { errors.push(`tor_announcements ${original._id}: ${error.message}`); }
  }

  const projects = [];
  const removedAnnouncementIds = [];
  for (const [projectId, documents] of groups) {
    documents.sort(compareObservations);
    const latest = documents.at(-1);
    const survivor = [...documents].sort((left, right) => Date.parse(left.firstSeenAt) - Date.parse(right.firstSeenAt) || String(left._id).localeCompare(String(right._id)))[0];
    const observations = {};
    for (const document of documents) {
      for (const [code, observation] of Object.entries(document.stageObservations)) {
        if (!observations[code] || compareObservations(observation, observations[code]) > 0) observations[code] = observation;
      }
    }
    const statusPublishedAt = Object.values(observations).map(value => value.publishedAt).sort().at(-1) || publicationDate(latest.publishedAt);
    const latestCodes = Object.keys(observations).filter(code => observations[code].publishedAt === statusPublishedAt);
    const project = {
      ...latest, _id: survivor._id, projectId,
      title: latest.title ?? null, description: latest.description ?? null,
      departmentId: latest.departmentId ?? null, url: latest.url ?? null,
      procurementMethod: latest.procurementMethod ?? null,
      scope: 'department', identityScope: projectId.startsWith('P') ? 'plan' : 'project',
      linkedProjectId: latest.linkedProjectId ?? linkedId(latest),
      stageObservations: observations, statusPublishedAt,
      statusOrderAmbiguous: latestCodes.length > 1,
      status: latestCodes.length > 1 ? 'multiple_announcements_same_day' : STAGE_STATUS[latestCodes[0]] || 'unknown',
      biddingOpenVerified: false, titleMatchedKeywords: latest.titleMatchedKeywords ?? [],
      itemParams: normalizeObservation(latest).itemParams, channelParams: latest.channelParams ?? {},
      thumbnail: `/api/thumbnail/${encodeURIComponent(projectId)}`,
      firstSeenAt: survivor.firstSeenAt,
      lastSeenAt: documents.map(value => value.lastSeenAt).sort((left, right) => Date.parse(left) - Date.parse(right)).at(-1)
    };
    for (const field of nullableFields) project[field] = iso(latest[field]) ?? null;
    for (const field of REMOVED_ENRICHMENT_FIELDS) delete project[field];
    delete project.templateId;
    delete project.projectKey;
    delete project.announcementType;
    delete project.externalId;
    delete project.dedupKey;
    delete project.documents;
    delete project.organization;
    delete project.sourceUrl;
    projects.push(project);
    removedAnnouncementIds.push(...documents.filter(value => String(value._id) !== String(survivor._id)).map(value => value._id));
  }

  const byProject = new Map(projects.map(project => [project.projectId, project]));
  const thumbnailGroups = new Map();
  const removedThumbnailIds = [];
  for (const thumbnail of thumbnails) {
    let projectId = sourceString(thumbnail.projectId);
    if (!projectId && thumbnail.templateId) {
      const identities = templateProjects.get(thumbnail.templateId);
      if (identities?.size === 1) projectId = [...identities][0];
      else { errors.push(`thumbnails ${thumbnail._id}: missing or ambiguous template-to-project mapping`); continue; }
    }
    if (!projectId) { errors.push(`thumbnails ${thumbnail._id}: no reliable projectId`); continue; }
    const project = byProject.get(projectId);
    if (!project?.documentUrl || thumbnail.sourceUrl !== project.documentUrl) {
      removedThumbnailIds.push(thumbnail._id);
      continue;
    }
    if (thumbnail.contentType !== 'image/webp') { errors.push(`thumbnails ${thumbnail._id}: image must be regenerated as WebP`); continue; }
    if (Number.isNaN(Date.parse(iso(thumbnail.updatedAt)))) { errors.push(`thumbnails ${thumbnail._id}: missing or invalid updatedAt`); continue; }
    const image = { ...thumbnail, projectId, sourcePublishedAt: publicationDate(thumbnail.sourcePublishedAt ?? project.publishedAt), updatedAt: iso(thumbnail.updatedAt) };
    delete image.templateId;
    thumbnailGroups.set(projectId, [...(thumbnailGroups.get(projectId) || []), image]);
  }
  const images = [];
  for (const [projectId, group] of thumbnailGroups) {
    group.sort((left, right) => Date.parse(left.updatedAt) - Date.parse(right.updatedAt) || String(left._id).localeCompare(String(right._id)));
    const image = group.at(-1);
    images.push(image);
    byProject.get(projectId).thumbnailSourceUrl = image.sourceUrl;
    removedThumbnailIds.push(...group.slice(0, -1).map(value => value._id));
  }
  return { projects, images, removedAnnouncementIds, removedThumbnailIds, errors };
}
