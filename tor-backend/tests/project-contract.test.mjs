import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeTor } from '../src/serializers/tor.serializer.mjs';

// Set inert configuration before importing modules; no database connection is opened.
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/unused';
process.env.MONGODB_DB_NAME = 'unused';
process.env.ACCESS_TOKEN_SECRET = 'test-secret-for-local-contract-checks-only';
const { createThumbnailHandler } = await import('../src/controllers/thumbnail.controller.mjs');

function responseRecorder() {
  return { headers: {}, statusCode: 200, setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; }, end() {}, send(body) { this.body = body; } };
}

const removedFields = ['opend', 'opendLookup', 'province', 'district', 'subdistrict', 'projectLocation', 'projectMoney', 'referencePrice', 'totalContractValue', 'contractProjectStatus', 'contracts', 'opendUpdatedAt', 'locationFilter'];

test('public TOR serialization excludes pending and rejected AI requirement suggestions', () => {
  const result = serializeTor({ projectId: '123', tagAssignments: [
    { tagId: 'approved', reviewStatus: 'approved', source: 'manual' },
    { tagId: 'pending', reviewStatus: 'suggested', source: 'ai' },
    { tagId: 'rejected', reviewStatus: 'rejected', source: 'ai' }
  ] });
  assert.deepEqual(result.tagAssignments.map(({ tagId }) => tagId), ['approved']);
});

test('serialization keeps project identity and RSS stages while omitting all removed fields', () => {
  const legacy = Object.fromEntries(removedFields.map(field => [field, { stale: 'data' }]));
  const result = serializeTor({ ...legacy, _id: 'internal', projectId: 'P69100015073', departmentId: '0001',
    templateId: 'legacy', announcementType: 'D0', projectKey: 'old',
    status: 'multiple_announcements_same_day', statusOrderAmbiguous: true,
    stageObservations: { D0: { publishedAt: '2026-10-01' }, W0: { publishedAt: '2026-10-01' } } });
  assert.equal(result.projectId, 'P69100015073');
  assert.equal(result.departmentId, '0001');
  assert.equal(result.thumbnail, '/api/thumbnail/P69100015073');
  assert.equal(result.status, 'multiple_announcements_same_day');
  assert.equal(result.biddingOpenVerified, false);
  for (const field of [...removedFields, '_id', 'templateId', 'projectKey', 'announcementType']) assert.equal(field in result, false);
  const clean = serializeTor({ projectId: '123' });
  for (const field of removedFields) assert.equal(field in clean, false);
});

test('thumbnail endpoint decodes base64 and looks up exact string projectId', async () => {
  const calls = [];
  const handler = createThumbnailHandler({
    findThumbnail: async id => { calls.push(id); return { sourceUrl: 'https://example.com/current.pdf', data: Buffer.from('webp-image').toString('base64') }; },
    findProject: async id => { calls.push(id); return { documentUrl: 'https://example.com/current.pdf' }; }
  });
  const response = responseRecorder();
  await handler({ params: { projectId: '00123' } }, response);
  assert.deepEqual(calls, ['00123', '00123']);
  assert.equal(response.headers['Content-Type'], 'image/webp');
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(response.body.toString(), 'webp-image');
});

test('stale or absent thumbnail never serves cached bytes; later arrival succeeds', async () => {
  let image = null;
  const handler = createThumbnailHandler({ findThumbnail: async () => image, findProject: async () => ({ documentUrl: 'current' }) });
  let response = responseRecorder();
  await handler({ params: { projectId: '123' } }, response);
  assert.equal(response.statusCode, 404);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  image = { sourceUrl: 'old', data: 'd2VicA==' };
  response = responseRecorder();
  await handler({ params: { projectId: '123' } }, response);
  assert.equal(response.statusCode, 404);
  assert.equal(response.body, undefined);
  image.sourceUrl = 'current';
  response = responseRecorder();
  await handler({ params: { projectId: '123' } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.toString(), 'webp');
});
