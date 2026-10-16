import test from 'node:test';
import assert from 'node:assert/strict';
import { planProjectMigration } from '../scripts/project-migration.mjs';
import { ingestionDefinitions, ingestionIndexes, assertProjectIdentitiesReady, REMOVED_ENRICHMENT_FIELDS } from '../scripts/ingestion-schema.mjs';

const announcement = (overrides = {}) => ({
  _id: 'a', projectId: '00123456789', departmentId: '0001', title: 'Software project',
  description: 'IT', procurementMethod: 'e-Bidding', templateId: 'template-a',
  announcementType: 'D0', publishedAt: '2026-10-01',
  url: 'https://example.com/a', documentUrl: 'https://example.com/a.pdf',
  channelParams: {}, itemParams: { templateType: 'D0' },
  firstSeenAt: '2026-10-01T00:00:00Z', lastSeenAt: '2026-10-01T01:00:00Z',
  ...overrides
});
const thumbnail = (overrides = {}) => ({
  _id: 'thumb-a', templateId: 'template-a', contentType: 'image/webp', data: 'd2VicA==',
  sourceUrl: 'https://example.com/a.pdf', sourcePublishedAt: '2026-10-01',
  width: 320, quality: 80, size: 4, updatedAt: '2026-10-01T02:00:00Z', ...overrides
});

test('merges by string project identity and retains the latest observation per stage', () => {
  const first = announcement();
  const last = announcement({ _id: 'b', templateId: 'template-b', publishedAt: '2026-10-03', documentUrl: 'https://example.com/b.pdf', firstSeenAt: '2026-10-03T00:00:00Z', lastSeenAt: '2026-10-04T00:00:00Z' });
  const result = planProjectMigration([last, first], []);
  assert.deepEqual(result.errors, []);
  const project = result.projects[0];
  assert.equal(result.projects.length, 1);
  assert.equal(project._id, 'a');
  assert.equal(project.projectId, '00123456789');
  assert.equal(project.departmentId, '0001');
  assert.equal(project.firstSeenAt, first.firstSeenAt);
  assert.equal(project.lastSeenAt, last.lastSeenAt);
  assert.equal(project.stageObservations.D0.title, last.title);
  assert.equal(project.itemParams.templateId, 'template-b');
  assert.equal(project.status, 'invitation_published');
  assert.equal(project.biddingOpenVerified, false);
  for (const field of REMOVED_ENRICHMENT_FIELDS) assert.equal(field in project, false);
  for (const field of ['templateId', 'projectKey', 'announcementType']) assert.equal(field in project, false);
  assert.deepEqual(result.removedAnnouncementIds, ['b']);
});

test('latest-date ties stay ambiguous, without imposing stage order', () => {
  const result = planProjectMigration([
    announcement(), announcement({ _id: 'b', announcementType: 'W0', itemParams: { templateType: 'W0' } }),
    announcement({ _id: 'c', announcementType: 'B0', publishedAt: '2026-09-20', itemParams: { templateType: 'B0' } })
  ], []);
  const project = result.projects[0];
  assert.equal(project.status, 'multiple_announcements_same_day');
  assert.equal(project.statusOrderAmbiguous, true);
  assert.equal(project.statusPublishedAt, '2026-10-01');
  assert.deepEqual(Object.keys(project.stageObservations).sort(), ['B0', 'D0', 'W0']);
});

test('plan IDs remain separate from linked numeric IDs', () => {
  const result = planProjectMigration([
    announcement({ projectId: 'P69100015073', announcementType: 'P0', documentUrl: 'https://example.com/?projectId=69100015073', itemParams: { templateType: 'P0' } }),
    announcement({ _id: 'b', projectId: '69100015073' })
  ], []);
  assert.equal(result.projects.length, 2);
  const plan = result.projects.find(project => project.identityScope === 'plan');
  assert.equal(plan.linkedProjectId, '69100015073');
  assert.equal(plan.status, 'procurement_planned');
});

test('keeps the newest current thumbnail and discards stale or duplicate images', () => {
  const result = planProjectMigration([announcement()], [thumbnail(),
    thumbnail({ _id: 'thumb-new', updatedAt: '2026-10-02T00:00:00Z' }),
    thumbnail({ _id: 'thumb-stale', sourceUrl: 'https://example.com/old.pdf' })
  ]);
  assert.equal(result.images.length, 1);
  assert.equal(result.images[0]._id, 'thumb-new');
  assert.equal(result.images[0].projectId, '00123456789');
  assert.equal('templateId' in result.images[0], false);
  assert.deepEqual(result.removedThumbnailIds.sort(), ['thumb-a', 'thumb-stale']);
});

test('migration removes enrichment without recreating null placeholders and is idempotent', () => {
  const contaminated = Object.fromEntries(REMOVED_ENRICHMENT_FIELDS.map(field => [field, { legacy: 'data' }]));
  const initial = planProjectMigration([announcement(contaminated)], [thumbnail()]);
  for (const field of REMOVED_ENRICHMENT_FIELDS) assert.equal(field in initial.projects[0], false);
  const repeated = planProjectMigration(initial.projects, initial.images);
  assert.deepEqual(repeated, initial);
});

test('invalid identities block migration instead of guessing lost leading zeros', () => {
  const result = planProjectMigration([
    announcement({ projectId: null, itemParams: {}, documentUrl: null }),
    announcement({ _id: 'b', departmentId: 1 }),
    announcement({ _id: 'c', projectId: Number.MAX_SAFE_INTEGER + 1 })
  ], []);
  assert.equal(result.errors.length, 3);
  assert.equal(result.projects.length, 0);
});

test('sighting timestamps compare instants while preserving their source strings', () => {
  const early = '2026-10-01T01:00:00+07:00';
  const later = '2026-09-30T20:00:00Z';
  const result = planProjectMigration([
    announcement({ _id: 'early', firstSeenAt: early, lastSeenAt: early }),
    announcement({ _id: 'later', firstSeenAt: later, lastSeenAt: later })
  ], []);
  assert.equal(result.projects[0]._id, 'early');
  assert.equal(result.projects[0].firstSeenAt, early);
  assert.equal(result.projects[0].lastSeenAt, later);
});

test('RSS stage metadata stays distinct from raw document templateType', () => {
  const result = planProjectMigration([announcement({ announcementType: 'ประกาศเชิญชวน', itemParams: { templateType: 'D2' } })], []);
  assert.equal(result.projects[0].status, 'invitation_published');
  assert.equal(result.projects[0].itemParams.templateType, 'D2');
  assert.equal(result.projects[0].stageObservations.D0.itemParams.templateType, 'D2');
  const unknown = planProjectMigration([announcement({ announcementType: null, itemParams: { templateType: 'D2' } })], []);
  assert.equal(unknown.errors.length, 0);
  assert.equal(unknown.projects[0].status, 'unknown');
});

test('migration preserves a legacy non-RSS TOR using its source externalId and an unknown stage', () => {
  const legacy = announcement({
    _id: 'legacy-id', projectId: null, externalId: 'BMA-DHR-2026-001',
    announcementType: { code: 'TOR', nameTh: 'ร่างขอบเขตของงาน' }, status: 'open',
    stageObservations: undefined
  });
  const result = planProjectMigration([legacy], []);
  assert.deepEqual(result.errors, []);
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0]._id, 'legacy-id');
  assert.equal(result.projects[0].projectId, 'BMA-DHR-2026-001');
  assert.equal(result.projects[0].status, 'unknown');
  assert.deepEqual(result.projects[0].stageObservations, {});
  assert.equal(result.projects[0].statusPublishedAt, '2026-10-01');
});

test('schemas and full unique indexes use projectId, with retired fields forbidden', () => {
  assert.deepEqual(Object.keys(ingestionDefinitions).sort(), ['ingestion_runs', 'thumbnails', 'tor_announcements']);
  for (const name of ['tor_announcements', 'thumbnails']) {
    assert.ok(ingestionDefinitions[name].required.includes('projectId'));
    assert.deepEqual(ingestionIndexes[name][0][0], { projectId: 1 });
    assert.equal(ingestionIndexes[name][0][1].unique, true);
    assert.equal(ingestionIndexes[name][0][1].partialFilterExpression, undefined);
  }
  assert.equal(ingestionDefinitions.tor_announcements.required.includes('templateId'), false);
  assert.equal(ingestionDefinitions.tor_announcements.properties.projectId.bsonType, 'string');
  for (const field of REMOVED_ENRICHMENT_FIELDS) {
    assert.deepEqual(ingestionDefinitions.tor_announcements.properties[field], { not: {} });
    assert.equal(ingestionDefinitions.tor_announcements.required.includes(field), false);
  }
});

test('setup preflight rejects duplicates before any validator or index mutation', async () => {
  const database = {
    listCollections: () => ({ hasNext: async () => true }),
    collection: () => ({ countDocuments: async () => 0, aggregate: () => ({ toArray: async () => [{ _id: '123', count: 2 }] }) })
  };
  await assert.rejects(assertProjectIdentitiesReady(database), /needs migration/);
});
