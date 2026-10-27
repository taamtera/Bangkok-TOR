import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Opt in: copy validators into a disposable database; never write application data.
test('registration accepts minimal company data and rejects names the database cannot store', {
  skip: process.env.AUTH_REGISTRATION_DB_TEST !== '1'
}, async () => {
  dotenv.config({ path: new URL('../.env', import.meta.url), quiet: true });
  const uri = process.env.MONGODB_URI;
  const sourceName = process.env.MONGODB_DB_NAME || 'tor_software';
  const testName = `auth_reg_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
  process.env.MONGODB_DB_NAME = testName;
  process.env.NODE_ENV = 'test';
  const client = new MongoClient(uri);
  const { connectDatabase, closeDatabase } = await import('../src/config/database.mjs');
  let server;
  try {
    await client.connect();
    const target = client.db(testName);
    for (const name of ['companies', 'users', 'sessions', 'audit_logs']) {
      const info = await client.db(sourceName).listCollections({ name }).next();
      assert.ok(info?.options?.validator, `Missing source validator: ${name}`);
      await target.createCollection(name, { validator: info.options.validator, validationLevel: 'strict', validationAction: 'error' });
    }
    await target.collection('users').createIndex({ emailNormalized: 1 }, { unique: true });
    await connectDatabase();
    const { app } = await import('../src/app.mjs');
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/api/auth/register`;
    let sequence = 0;
    const register = company => fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ firstName: 'Test', lastName: 'User',
        email: `registration-${sequence++}@example.com`, password: 'Temporary-Test-Password-123!',
        termsAccepted: true, company: { mode: 'create', ...company } })
    });
    for (const company of [{ legalName: 'Test Company' }, { legalName: 'Test Company', companySize: '' }]) {
      const response = await register(company);
      const body = await response.json();
      assert.equal(response.status, 201, JSON.stringify(body));
      assert.equal(body.user.status, 'active');
      assert.equal('passwordHash' in body.user, false);
      assert.match(response.headers.get('set-cookie'), /tor_access=/);
      const user = await target.collection('users').findOne({ email: body.user.email });
      const saved = await target.collection('companies').findOne({ _id: user.companyId });
      assert.equal(saved.companySize, 'Not specified');
    }
    for (const company of [{ legalName: 'A' }, { legalName: 'Test Company', displayName: 'A' }]) {
      const before = await target.collection('companies').countDocuments();
      const response = await register(company);
      const body = await response.json();
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal(body.error.code, 'VALIDATION_ERROR');
      assert.equal(await target.collection('companies').countDocuments(), before);
    }
    assert.equal(await target.collection('sessions').countDocuments(), 2);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await closeDatabase();
    assert.match(testName, /^auth_reg_[a-f0-9]{24}$/);
    assert.notEqual(testName, sourceName);
    try { await client.db(testName).dropDatabase(); } finally { await client.close(); }
  }
});
