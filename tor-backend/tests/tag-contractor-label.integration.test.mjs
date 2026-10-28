import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';

const localUri = process.env.TAG_LABEL_TEST_MONGODB_URI;
test('catalog label persists through create, PATCH, search, legacy reads, and profile tag creation', { skip: !localUri }, async () => {
  assert.match(localUri, /^mongodb:\/\/(127\.0\.0\.1|localhost):\d+(?:\/|$)/);
  process.env.MONGODB_URI = localUri;
  process.env.MONGODB_DB_NAME = `contractor_label_test_${randomUUID().replaceAll('-', '')}`;
  process.env.NODE_ENV = 'test';
  const { connectDatabase, closeDatabase } = await import('../src/config/database.mjs');
  const { createControlledTag, updateControlledTag, listControlledTags, findControlledTagById, findOrCreateCatalogTag } = await import('../src/repositories/tag.repository.mjs');
  const { validateCreateTag, validateUpdateTag } = await import('../src/validators/tag.validators.mjs');
  const { createCompany, updateCompanyProfile, findCompanyProfileById } = await import('../src/repositories/company.repository.mjs');
  const { validateCompanyProfile } = await import('../src/validators/company.validators.mjs');
  let db;
  try {
    db = await connectDatabase();
    await db.collection('tags').createIndex({ category: 1, text: 1 }, { unique: true });
    const created = await createControlledTag({ ...validateCreateTag({ text: 'Internet Service', category: 'technology', type: 'specification', contractorLabel: ' Internet Service Provider ' }), createdByUserId: new ObjectId().toString() });
    assert.equal(created.contractorLabel, 'Internet Service Provider');
    assert.equal((await db.collection('tags').findOne({ _id: created._id })).contractorLabel, 'Internet Service Provider');
    assert.equal((await listControlledTags({ search: 'Service Provider' })).length, 1);
    const updated = await updateControlledTag(created._id.toString(), validateUpdateTag({ contractorLabel: 'Managed Internet Provider' }));
    assert.equal(updated.contractorLabel, 'Managed Internet Provider');
    assert.equal(String(updated._id), String(created._id));
    assert.equal(updated.text, created.text);
    assert.equal(updated.category, created.category);
    assert.equal(updated.type, created.type);
    assert.equal(updated.slug, created.slug);
    const legacyId = new ObjectId();
    await db.collection('tags').insertOne({ _id: legacyId, text: 'Legacy Service', category: 'technology', type: 'specification' });
    assert.equal((await findControlledTagById(legacyId.toString())).contractorLabel, null);
    const legacyUpdated = await updateControlledTag(legacyId.toString(), validateUpdateTag({ contractorLabel: 'Legacy Service Provider' }));
    assert.equal(legacyUpdated.contractorLabel, 'Legacy Service Provider');
    assert.equal(legacyUpdated.text, 'Legacy Service');
    assert.equal(Object.hasOwn(legacyUpdated, 'normalizedName'), false);
    const reused = await findOrCreateCatalogTag({ name: 'Legacy Service', category: 'technology', contractorLabel: 'Do not replace the existing label' });
    assert.equal(String(reused._id), String(legacyId));
    assert.equal(reused.contractorLabel, 'Legacy Service Provider');
    assert.equal((await updateControlledTag(created._id.toString(), validateUpdateTag({ contractorLabel: null }))).contractorLabel, null);
    const profileTag = await findOrCreateCatalogTag({ name: 'Example consulting', category: 'capability' });
    assert.equal(profileTag.contractorLabel, null);
    const suppliedProfileTag = await findOrCreateCatalogTag({ name: 'Example hosting', category: 'capability', contractorLabel: 'Hosting Provider' });
    assert.equal(suppliedProfileTag.contractorLabel, 'Hosting Provider');

    await updateControlledTag(created._id.toString(), { contractorLabel: 'Internet Service Provider' });
    const company = await createCompany({ legalName: 'Example Internet Company' });
    const companyId = company._id.toString();
    const base = { displayName: 'Example Internet Company', technologies: [], qualifications: [] };
    await updateCompanyProfile(companyId, validateCompanyProfile({ ...base, tags: [{ tagId: created._id.toString() }] }));
    const storedCompany = await db.collection('companies').findOne({ _id: company._id });
    assert.deepEqual(storedCompany.tags, [{ tagId: created._id }]);
    assert.equal(storedCompany.tagAssignments.length, 1);
    assert.equal(String(storedCompany.tagAssignments[0].tagId), String(created._id));
    assert.equal(storedCompany.tagAssignments[0].verificationLevel, 'claimed');
    assert.equal((await findCompanyProfileById(companyId)).tags[0].contractorLabel, 'Internet Service Provider');
    await updateControlledTag(created._id.toString(), { contractorLabel: 'Updated Internet Service Provider' });
    assert.equal((await findCompanyProfileById(companyId)).tags[0].contractorLabel, 'Updated Internet Service Provider');
    await updateCompanyProfile(companyId, validateCompanyProfile({ ...base, displayName: 'Renamed company' }));
    assert.equal((await findCompanyProfileById(companyId)).tags.length, 1);
    await assert.rejects(updateCompanyProfile(companyId, validateCompanyProfile({ ...base, tags: [{ tagId: new ObjectId().toString() }] })), { code: 'UNKNOWN_TAG' });
    await updateControlledTag(created._id.toString(), { status: 'inactive' });
    // Keep existing inactive links during a normal save, but reject new ones.
    await updateCompanyProfile(companyId, validateCompanyProfile({ ...base, tags: [{ tagId: created._id.toString() }] }));
    const otherCompany = await createCompany({ legalName: 'Other Company' });
    await assert.rejects(updateCompanyProfile(otherCompany._id.toString(), validateCompanyProfile({ ...base, tags: [{ tagId: created._id.toString() }] })), { code: 'UNKNOWN_TAG' });
    await db.collection('tags').deleteOne({ _id: created._id });
    assert.equal((await findCompanyProfileById(companyId)).tags[0].contractorLabel, null);
    await updateCompanyProfile(companyId, validateCompanyProfile({ ...base, tags: [] }));
    assert.deepEqual((await findCompanyProfileById(companyId)).tags, []);
  } finally {
    if (db) await db.dropDatabase();
    await closeDatabase();
  }
});
