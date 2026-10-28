import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import dns from 'node:dns';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

test('profile API atomically synchronizes services, preserves evidence, and rolls back resolution failures', {
  skip: process.env.PROFILE_SYNC_DB_TEST !== '1', timeout: 60000
}, async () => {
  dotenv.config({ path: new URL('../.env', import.meta.url), quiet: true });
  const sourceName = process.env.MONGODB_DB_NAME;
  const testName = `profile_sync_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
  assert.match(testName, /^profile_sync_[a-f0-9]{24}$/);
  assert.notEqual(testName, sourceName);
  if (process.env.PROFILE_SYNC_PUBLIC_DNS === '1') dns.setServers(['1.1.1.1', '8.8.8.8']);
  const metadataClient = new MongoClient(process.env.MONGODB_URI);
  process.env.MONGODB_DB_NAME = testName;
  process.env.NODE_ENV = 'test';
  const { connectDatabase, closeDatabase } = await import('../src/config/database.mjs');
  let db, server;
  try {
    await metadataClient.connect();
    const source = await metadataClient.db(sourceName).listCollections({ name: 'companies' }).next();
    db = await connectDatabase();
    await db.createCollection('companies', source?.options?.validator ? { validator: source.options.validator } : {});
    await db.createCollection('tags', { validator: { text: { $ne: 'Uncreatable capability' } } });
    await db.collection('tags').createIndex({ category: 1, text: 1 }, { unique: true });
    const service = new ObjectId(), proof = new ObjectId();
    await db.collection('tags').insertMany([
      { _id: service, text: 'Internet Service', category: 'technology', status: 'active', type: 'specification' },
      { _id: proof, text: 'ISO 27001', category: 'certification', status: 'active', type: 'contractor_requirement' }
    ]);
    const { createCompany } = await import('../src/repositories/company.repository.mjs');
    const company = await createCompany({ legalName: 'Profile synchronization fixture' });
    const verified = { tagId: proof, source: 'manual', confidence: 1, verificationLevel: 'verified',
      reviewStatus: 'approved', evidence: 'Reviewed certificate', reviewedByUserId: new ObjectId(),
      reviewedAt: new Date(), assignedAt: new Date() };
    await db.collection('companies').updateOne({ _id: company._id }, { $set: { tagAssignments: [verified] } });
    const userId = new ObjectId(), sessionId = new ObjectId();
    await db.collection('users').insertOne({ _id: userId, status: 'active', role: 'company_admin', companyId: company._id });
    await db.collection('sessions').insertOne({ _id: sessionId, userId, status: 'active', revokedAt: null, expiresAt: new Date(Date.now() + 60000) });
    const { signAccessToken } = await import('../src/utils/tokens.mjs');
    const token = signAccessToken({ sub: String(userId), sid: String(sessionId) });
    const { app } = await import('../src/app.mjs');
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const endpoint = `http://127.0.0.1:${server.address().port}/api/companies/me`;
    const base = { displayName: 'Profile synchronization fixture', companySize: '', district: '', contactEmail: '', technologies: [], qualifications: [] };
    const save = async body => { const r = await fetch(endpoint, { method: 'PUT', headers: {
      cookie: `tor_access=${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return { status: r.status, body: await r.json() }; };
    const stored = () => db.collection('companies').findOne({ _id: company._id });
    assert.equal((await save({ ...base, tags: [{ tagId: String(service) }] })).status, 200);
    let row = await stored();
    assert.equal(row.tags.length, 1); assert.equal(row.tagAssignments.length, 2);
    assert.deepEqual(row.tagAssignments.find(a => a.verificationLevel === 'verified'), verified);
    assert.equal((await save({ ...base, displayName: 'Renamed fixture' })).status, 200);
    row = await stored(); assert.equal(row.tags.length, 1); assert.equal(row.tagAssignments.length, 2);
    const beforeInvalid = row;
    assert.equal((await save({ ...base, tags: [{ tagId: String(new ObjectId()) }] })).status, 400);
    assert.deepEqual(await stored(), beforeInvalid);
    assert.equal((await save({ ...base, qualifications: ['Uncreatable capability'] })).status, 500);
    assert.deepEqual(await stored(), beforeInvalid);
    assert.equal((await save({ ...base, tags: [] })).status, 200);
    row = await stored(); assert.deepEqual(row.tags, []); assert.deepEqual(row.tagAssignments, [verified]);
    assert.equal((await save({ ...base, tags: [{ tagId: String(proof) }] })).status, 200);
    row = await stored(); assert.deepEqual(row.tagAssignments, [verified]);
    const first = await fetch(endpoint, { headers: { cookie: `tor_access=${token}` } });
    assert.equal(first.status, 200); assert.equal((await first.json()).company.tags.length, 1);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (db) { assert.equal(db.databaseName, testName); await db.dropDatabase(); }
    await closeDatabase(); await metadataClient.close();
  }
});
