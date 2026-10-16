import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BSON, MongoClient } from 'mongodb';
import { loadEnvironment } from './env.mjs';
import { ingestionDefinitions, ingestionIndexes } from './ingestion-schema.mjs';

// One-time bridge for the demo dataset: import genuine RSS rows from the test
// crawler collection into the canonical collection queried by the local app.
const mode = process.argv[2];
const backupPath = process.argv[3];
if (!['preview', 'backup', 'apply'].includes(mode)) {
  throw new Error('Usage: node scripts/repair-demo-discovery.mjs <preview|backup|apply> [backup.ejson]');
}
if (mode !== 'preview' && (!backupPath || backupPath.startsWith('--'))) {
  throw new Error(`${mode} requires a backup file path`);
}

const { uri, databaseName } = loadEnvironment();
if (databaseName !== 'tor_software_test') throw new Error(`Expected local test database tor_software_test; got ${databaseName}`);
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
const iso = value => value instanceof Date ? value.toISOString() : value;
function dateOnly(value) {
  const text = iso(value);
  if (typeof text !== 'string' || Number.isNaN(Date.parse(text))) throw new Error(`Invalid publication date: ${text}`);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : new Date(text).toISOString().slice(0, 10);
}
function stageInfo(raw) {
  const announcementType = raw.announcementType;
  const label = typeof announcementType === 'string' ? announcementType : announcementType?.nameTh ?? '';
  // The EGP RSS phrase means invitation published. Unknown types remain visible
  // with status unknown and do not get a fabricated stage observation.
  return /เชิญชวน/u.test(label) ? 'D0' : null;
}
function canonicalProject(raw, { legacy = false } = {}) {
  const projectId = legacy ? raw.projectId || raw.externalId : raw.projectId;
  if (typeof projectId !== 'string' || !projectId.trim()) throw new Error(`Missing source project identity in document ${raw._id}`);
  const publishedAt = dateOnly(raw.publishedAt);
  const firstSeenAt = iso(raw.firstSeenAt);
  const lastSeenAt = iso(raw.lastSeenAt);
  if (![firstSeenAt, lastSeenAt].every(value => typeof value === 'string' && !Number.isNaN(Date.parse(value)))) {
    throw new Error(`Invalid sighting timestamps in document ${raw._id}`);
  }
  const d0 = !legacy ? stageInfo(raw) : null;
  const observation = {
    title: raw.title ?? null,
    description: raw.description ?? null,
    publishedAt,
    url: raw.url ?? null,
    documentUrl: raw.documentUrl ?? raw.url ?? null,
    channelParams: raw.channelParams ?? {},
    itemParams: {
      ...(raw.itemParams ?? {}),
      ...(raw.templateId ? { templateId: raw.templateId } : {}),
      ...(raw.announcementType === undefined ? {} : { announcementType: raw.announcementType })
    },
    firstSeenAt,
    lastSeenAt
  };
  const status = d0 ? 'invitation_published' : 'unknown';
  const project = {
    _id: raw._id,
    projectId,
    sourceId: legacy ? (raw.sourceId?.code ?? raw.sourceId ?? 'BMA') : raw.sourceId ?? 'EGP',
    scope: 'department',
    identityScope: projectId.startsWith('P') ? 'plan' : 'project',
    linkedProjectId: null,
    departmentId: raw.departmentId == null ? null : String(raw.departmentId),
    departmentName: raw.departmentName ?? raw.organization?.nameTh ?? null,
    title: raw.title ?? null,
    description: raw.description ?? raw.summary ?? null,
    publishedAt,
    url: raw.url ?? raw.sourceUrl ?? null,
    documentUrl: raw.documentUrl ?? raw.documents?.[0]?.url ?? raw.sourceUrl ?? raw.url ?? null,
    thumbnail: `/api/thumbnail/${encodeURIComponent(projectId)}`,
    thumbnailSourceUrl: null,
    procurementMethod: raw.procurementMethod ?? null,
    channelParams: raw.channelParams ?? {},
    itemParams: observation.itemParams,
    firstSeenAt,
    lastSeenAt,
    status,
    statusPublishedAt: publishedAt,
    statusOrderAmbiguous: false,
    stageObservations: d0 ? { [d0]: observation } : {},
    biddingOpenVerified: false,
    titleMatchedKeywords: []
  };
  return project;
}
const sortDocs = docs => [...docs].sort((a, b) => String(a._id).localeCompare(String(b._id)));

try {
  await client.connect();
  const target = client.db(databaseName);
  const source = client.db('tor_software_test');
  const targetCollection = target.collection('tor_announcements');
  const rawCollection = source.collection('tor_announcements_raw_test');
  const [targetInfo, rawInfo] = await Promise.all([
    target.listCollections({ name: 'tor_announcements' }).next(),
    source.listCollections({ name: 'tor_announcements_raw_test' }).next()
  ]);
  if (!targetInfo || !rawInfo) throw new Error('Expected canonical and raw demo collections were not found');
  const [existing, raw] = await Promise.all([targetCollection.find({}).toArray(), rawCollection.find({}).toArray()]);
  const liveRaw = raw.filter(row => typeof row.projectId === 'string' && row.projectId.trim()
    && !/^TEST\b/i.test(row.projectId)
    && !/example\.com/i.test([row.url, row.documentUrl].filter(Boolean).join(' ')));
  if (!liveRaw.length) throw new Error('No non-test raw EGP announcements were found');
  const legacyProjects = existing.map(row => canonicalProject(row, { legacy: !row.projectId }));
  const importedProjects = liveRaw.map(row => canonicalProject(row));
  const projects = [...legacyProjects, ...importedProjects];
  const ids = new Set();
  const projectIds = new Set();
  for (const row of projects) {
    const id = String(row._id);
    if (ids.has(id)) throw new Error(`Duplicate _id would overwrite a preserved record: ${id}`);
    ids.add(id);
    if (projectIds.has(row.projectId)) throw new Error(`Duplicate projectId in planned data: ${row.projectId}`);
    projectIds.add(row.projectId);
  }
  const snapshot = {
    database: databaseName,
    sourceDatabase: 'tor_software_test',
    backedUpAt: new Date(),
    target: { documents: existing, options: targetInfo.options, indexes: await targetCollection.listIndexes().toArray() },
    source: { documents: raw, options: rawInfo.options, indexes: await rawCollection.listIndexes().toArray() }
  };
  console.log(JSON.stringify({
    mode, database: databaseName, existingCanonicalRows: existing.length,
    sourceRawRows: raw.length, genuineRowsToImport: liveRaw.length,
    excludedExampleRows: raw.length - liveRaw.length,
    resultingProjects: projects.map(({ projectId, sourceId, status }) => ({ projectId, sourceId: typeof sourceId === 'string' ? sourceId : 'preserved source reference', status }))
  }, null, 2));
  if (mode === 'preview') process.exitCode = 0;
  if (mode === 'backup') {
    await writeFile(resolve(backupPath), BSON.EJSON.stringify(snapshot, { relaxed: false }), { flag: 'wx', mode: 0o600 });
    console.log(`Backup written: ${resolve(backupPath)}`);
  }
  if (mode === 'apply') {
    const backup = BSON.EJSON.parse(await readFile(resolve(backupPath), 'utf8'));
    if (backup.database !== databaseName || backup.sourceDatabase !== 'tor_software_test') throw new Error('Backup file does not match the demo databases');
    const canonical = docs => BSON.EJSON.stringify(sortDocs(docs), { relaxed: false });
    if (canonical(backup.target.documents) !== canonical(existing)) {
      throw new Error('Canonical data changed since the backup; no changes applied. Create a fresh backup.');
    }
    if (canonical(backup.source.documents) !== canonical(raw)) {
      throw new Error('Raw source data changed since the backup; no changes applied. Create a fresh backup.');
    }
    const tempName = `tor_announcements_repair_${Date.now()}`;
    const validator = { $jsonSchema: { bsonType: 'object', required: ingestionDefinitions.tor_announcements.required, properties: ingestionDefinitions.tor_announcements.properties } };
    await target.createCollection(tempName, { validator, validationLevel: 'strict', validationAction: 'error' });
    try {
      const temp = target.collection(tempName);
      await temp.insertMany(projects);
      for (const [keys, options] of ingestionIndexes.tor_announcements) await temp.createIndex(keys, options);
      const currentRawCount = await rawCollection.countDocuments({});
      if (currentRawCount !== raw.length) throw new Error('Raw source changed since preview; temporary collection retained for inspection and canonical data is unchanged.');
      await target.collection(tempName).rename('tor_announcements', { dropTarget: true });
      console.log('Canonical demo TOR collection replaced successfully. Original IDs were retained where available.');
    } catch (error) {
      // Keep the failed temp collection for inspection; canonical collection is untouched until rename.
      throw error;
    }
  }
} finally {
  await client.close();
}
