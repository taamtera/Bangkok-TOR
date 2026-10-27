import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { once } from 'node:events';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { matchingValidator } from '../src/models/matching-schema.mjs';

// All writes use a generated database. Source collections supply schema/index metadata only.
test('current APIs work with canonical tags, live validators, sessions and policy-3 storage', {
  skip: process.env.BACKEND_DB_TEST !== '1', timeout: 60000
}, async () => {
  dotenv.config({ path: new URL('../.env', import.meta.url), quiet: true });
  const sourceName = process.env.MONGODB_DB_NAME || 'tor_software';
  const testName = `api_audit_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  process.env.MONGODB_DB_NAME = testName;
  process.env.NODE_ENV = 'test';
  process.env.AI_REQUIREMENTS_TOKEN = 'integration-test-worker-token-'.repeat(3);
  const client = new MongoClient(process.env.MONGODB_URI);
  const { connectDatabase, closeDatabase } = await import('../src/config/database.mjs');
  let server;
  try {
    await client.connect();
    const db = client.db(testName);
    for (const name of ['companies', 'users', 'sessions', 'auth_tokens', 'audit_logs', 'tags',
      'tor_announcements', 'company_matches', 'ai_evaluations', 'requirement_sources', 'notifications', 'tor_versions', 'thumbnails']) {
      const source = await client.db(sourceName).listCollections({ name }).next();
      await db.createCollection(name, source?.options?.validator
        ? { validator: source.options.validator, validationLevel: 'strict', validationAction: 'error' } : {});
      if (source) for (const index of await client.db(sourceName).collection(name).indexes()) {
        if (index.name !== '_id_' && index.unique) await db.collection(name).createIndex(index.key, {
          unique: true, name: index.name, ...(index.partialFilterExpression ? { partialFilterExpression: index.partialFilterExpression } : {})
        });
      }
    }
    const matchInfo = await db.listCollections({ name: 'company_matches' }).next();
    const before = structuredClone(matchInfo.options.validator);
    const aligned = matchingValidator(before);
    assert.deepEqual(matchingValidator(aligned), aligned);
    assert.deepEqual(before, matchInfo.options.validator);
    await db.command({ collMod: 'company_matches', validator: aligned });
    await connectDatabase();
    const { app } = await import('../src/app.mjs');
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api`;
    let cookie = '';
    const request = (path, method = 'GET', body, headers = {}) => fetch(base + path, {
      method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    const registered = await request('/auth/register', 'POST', { firstName: 'API', lastName: 'Fixture',
      email: 'fixture@example.invalid', password: 'Temporary-API-test-123!', termsAccepted: true,
      company: { mode: 'create', legalName: 'Schema API Fixture' } });
    assert.equal(registered.status, 201);
    cookie = registered.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const user = await db.collection('users').findOne({ email: 'fixture@example.invalid' });
    const company = await db.collection('companies').findOne({ _id: user.companyId });
    assert.equal(String(company.ownerUserId), String(user._id));
    assert.deepEqual(company.memberUserIds, [user._id]);
    assert.equal('createdByUserId' in company, false);
    assert.equal('memberCount' in company, false);
    // Authorization must use the current DB role, even with the original access cookie.
    await db.collection('users').updateOne({ _id: user._id }, { $set: { role: 'system_admin' } });
    const canonicalId = new ObjectId();
    await db.collection('tags').insertOne({ _id: canonicalId, text: 'Docker', category: 'technology', type: 'specification' });
    const catalog = await (await request('/tags?search=Docker')).json();
    assert.equal(catalog.items[0].name, 'Docker');
    const duplicate = await request('/tags', 'POST', { text: ' DOCKER ', category: 'technology', type: 'specification' });
    assert.equal(duplicate.status, 409);
    const created = await request('/tags', 'POST', { text: 'Internet Service', category: 'technology', type: 'specification' });
    assert.equal(created.status, 201);
    const tag = (await created.json()).tag;
    const storedTag = await db.collection('tags').findOne({ _id: new ObjectId(tag._id) });
    for (const retired of ['name', 'slug', 'normalizedName']) assert.equal(retired in storedTag, false);
    const renameDuplicate = await request(`/tags/${tag._id}`, 'PATCH', { text: 'docker' });
    assert.equal(renameDuplicate.status, 409);
    const projectId = '00123456789';
    const torId = new ObjectId(), sourceId = new ObjectId();
    const sourceUrl = 'https://process.gprocurement.go.th/fixture.pdf';
    const quote = 'The contractor must use Docker for the proposed server installation.';
    const documentHash = createHash('sha256').update(quote).digest('hex');
    await db.collection('tor_announcements').insertOne({ _id: torId, projectId, scope: 'department', identityScope: 'project',
      title: 'Schema fixture', description: null, departmentId: '0001', publishedAt: '2026-10-27',
      url: sourceUrl, documentUrl: sourceUrl, procurementMethod: 'e-bidding', channelParams: {}, itemParams: {},
      firstSeenAt: '2026-10-27', lastSeenAt: '2026-10-27', status: 'invitation_published', statusPublishedAt: '2026-10-27',
      statusOrderAmbiguous: false, stageObservations: {}, biddingOpenVerified: false, budget: { maxAmount: 884000 },
      tagAssignments: [{ tagId: canonicalId, requirementLevel: 'required', evidence: quote, source: 'ai', reviewStatus: 'suggested' }],
      requirementSource: { snapshotId: sourceId, sourceUrl, documentHash, torVersion: 1 } });
    assert.equal((await (await request('/tors?maxBudget=900000')).json()).pagination.total, 1);
    assert.equal((await (await request('/tors?maxBudget=800000')).json()).pagination.total, 0);
    for (const query of ['limit=bad', 'page=1.5', 'minBudget=nope', 'minBudget=100&maxBudget=1']) {
      assert.equal((await request(`/tors?${query}`)).status, 400);
    }
    const listed = await (await request(`/tors?tagIds=${canonicalId}`)).json();
    assert.equal(listed.items[0].tagAssignments[0].tagText, 'Docker');
    assert.equal((await (await request(`/tors/${projectId}`)).json()).tor.tagAssignments[0].tagText, 'Docker');
    assert.equal((await request(`/tors/${projectId}`, 'PATCH', { publishedAt: '2026-02-30' })).status, 400);
    assert.equal((await request(`/tors/${projectId}`, 'PATCH', { budget: { minAmount: 9, maxAmount: 1 } })).status, 400);
    await db.collection('requirement_sources').insertOne({ _id: sourceId, torId, torVersion: 1, sourceUrl, documentHash,
      pages: [{ page: 1, text: quote }], fetchedAt: new Date(), createdAt: new Date() });
    const extraction = { sourceId: String(sourceId), torVersion: 1,
      model: { provider: 'fixture', name: 'fixture', version: '1', promptVersion: '1' }, requirements: [{
        key: 'server', text: 'Docker server installation', importance: 'required', confidence: 0.95,
        evidence: { page: 1, quote }, clauses: [{ anyOf: [{ tagId: String(canonicalId) }] },
          { anyOf: [{ name: 'server installation', category: 'project_type' }] }]
      }] };
    const aiHeaders = { authorization: `Bearer ${process.env.AI_REQUIREMENTS_TOKEN}` };
    const ingested = await request(`/ai/tors/${projectId}/requirements`, 'POST', extraction, aiHeaders);
    const ingestedBody = await ingested.json();
    assert.equal(ingested.status, 200, JSON.stringify(ingestedBody));
    assert.equal(ingestedBody.matchingRefreshed, true);
    const aiTag = await db.collection('tags').findOne({ text: 'server installation' });
    assert.equal(aiTag.type, 'specification');
    assert.equal('normalizedName' in aiTag, false);
    const repeated = await request(`/ai/tors/${projectId}/requirements`, 'POST', extraction, aiHeaders);
    assert.equal((await repeated.json()).unchanged, true);
    await db.collection('users').updateOne({ _id: user._id }, { $set: { role: 'company_admin' } });
    const profile = await request('/companies/me', 'PUT', { displayName: 'Schema API Fixture', companySize: '',
      district: '', contactEmail: '', technologies: ['Docker', 'server installation'], qualifications: [], tags: [{ tagId: String(canonicalId) }] });
    assert.equal(profile.status, 200, JSON.stringify(await profile.json()));
    const matches = await request('/matches'); const result = await matches.json();
    assert.equal(matches.status, 200, JSON.stringify(result));
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].score, 100);
    assert.ok(result.items[0].tor.tagAssignments.every(assignment => assignment.tagText));
    assert.equal('recommendation' in (await db.collection('company_matches').findOne({ companyId: company._id })), false);
    const notifications = await request('/notifications');
    assert.equal(notifications.status, 200);
    assert.equal((await notifications.json()).unreadCount, 1);
    assert.equal((await request('/recommendations')).status, 200);
    assert.equal((await request('/auth/logout', 'POST')).status, 200);
    assert.equal((await request('/auth/me')).status, 401);
    assert.equal((await (await request('/auth/session')).json()).user, null);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await closeDatabase();
    assert.match(testName, /^api_audit_[a-f0-9]{20}$/); assert.notEqual(testName, sourceName);
    try { await client.db(testName).dropDatabase(); } finally { await client.close(); }
  }
});
