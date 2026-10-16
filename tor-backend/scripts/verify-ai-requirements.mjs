// Run inside the updated API container after copying this script to /tmp.
// Creates an explicitly marked demo fixture in tor_software_test and removes
// only its own records in finally. Never submits fixture data to real TORs.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const { ObjectId, BSON } = await import('/app/node_modules/mongodb/lib/index.js');
const { connectDatabase, closeDatabase } = await import('/app/src/config/database.mjs');
const { createCompany, syncCompanyProfileTagAssignments } = await import('/app/src/repositories/company.repository.mjs');
const { getCompanyMatches } = await import('/app/src/services/requirement-matching.service.mjs');
const { extractPdfPages } = await import('/app/src/services/requirement-source.mjs');
const { planCatalogCleanup } = await import('/app/src/tag-catalog-migration.mjs');

function pdfBytes(text) {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 3000 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const content = `BT /F1 12 Tf 40 700 Td (${text}) Tj ET`;
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => String(offset).padStart(10, '0') + ' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
const summary = { dataMode: 'demo', checks: [] };
let db, fixtureCompanyId; const torId = new ObjectId(), sourceId = new ObjectId();
const projectId = `TEST-AI-INTEGRATION-${randomUUID()}`;
const fixtureTagName = `FixtureCapability-${randomUUID()}`;
const sourceUrl = 'https://process5.gprocurement.go.th/test-fixture.pdf';
try {
  db = await connectDatabase();
  assert.equal(db.databaseName, 'tor_software_test');
  assert.ok(process.argv[2], 'Provide the private pre-migration backup path as the first argument.');
  const backup = BSON.EJSON.parse(await readFile(process.argv[2], 'utf8'));
  const rawFields = (company) => ({ technologies: company.technologies, qualifications: company.qualifications,
    displayName: company.displayName, district: company.district, companySize: company.companySize, contact: company.contact });
  for (const original of backup.records.companies) {
    const current = await db.collection('companies').findOne({ _id: original._id });
    assert.deepEqual(rawFields(current), rawFields(original));
    await syncCompanyProfileTagAssignments(String(current._id));
    assert.deepEqual(rawFields(await db.collection('companies').findOne({ _id: original._id })), rawFields(original));
  }
  summary.checks.push('All saved company profile fields preserved before and after canonical tag sync');
  const tags = await db.collection('tags').find({}).toArray();
  assert.equal(planCatalogCleanup(tags).duplicates.length, 0);
  const activeIds = new Set(tags.map((tag) => String(tag._id)));
  for (const collection of ['companies', 'tor_announcements']) {
    for (const record of await db.collection(collection).find({}).toArray()) {
      for (const assignment of record.tagAssignments || []) assert.ok(activeIds.has(String(assignment.tagId)));
    }
  }
  summary.checks.push('No duplicate tags; existing assignments still reference catalog records');
  const fixtureCompany = await createCompany({ legalName: projectId });
  fixtureCompanyId = fixtureCompany._id;
  await db.collection('companies').updateOne({ _id: fixtureCompanyId }, { $set: { technologies: ['Docker'] } });
  await syncCompanyProfileTagAssignments(String(fixtureCompanyId));
  const authHeaders = { Authorization: `Bearer ${process.env.AI_REQUIREMENTS_TOKEN}`, 'Content-Type': 'application/json' };
  const path = `http://127.0.0.1:4000/api/ai/tors/${encodeURIComponent(projectId)}/requirements`;
  assert.equal((await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  summary.checks.push('Unauthenticated worker submission rejected');
  const template = await db.collection('tor_announcements').findOne({ projectId: 'BMA-DHR-2026-001' });
  assert.ok(template);
  const quote = `The contractor must deliver microservices using Docker or Kubernetes. ${fixtureTagName} is context only.`;
  const bytes = pdfBytes(quote); const pages = await extractPdfPages(bytes);
  const documentHash = createHash('sha256').update(bytes).digest('hex'); const now = new Date();
  await db.collection('tor_announcements').insertOne({ ...template, _id: torId, projectId,
    externalId: projectId, title: 'Temporary demo AI integration check', version: 1, torVersion: 1,
    documentUrl: sourceUrl, url: sourceUrl, tagAssignments: [],
    requirementSource: { snapshotId: sourceId, documentHash, sourceUrl, torVersion: 1 } });
  await db.collection('requirement_sources').insertOne({ _id: sourceId, torId, torVersion: 1,
    sourceUrl, documentHash, pages, dataMode: 'demo', fetchedAt: now, createdAt: now });
  const tag = (conceptKey) => tags.find((item) => item.conceptKey === conceptKey && item.status === 'active');
  const input = { sourceId: String(sourceId), torVersion: 1,
    model: { provider: 'integration-test', name: 'fixture', version: '1', promptVersion: '1' },
    requirements: [{ key: 'deployment', text: 'Microservices with Docker or Kubernetes', importance: 'required', confidence: 0.95,
      evidence: { page: 1, quote }, clauses: [
        { anyOf: [{ tagId: String(tag('microservices')._id) }] },
        { anyOf: [{ name: 'Docker', category: 'technology' }, { name: 'Kubernetes', category: 'technology' }] }
      ] }, { key: 'context', text: fixtureTagName, importance: 'informational', confidence: 0.95,
        evidence: { page: 1, quote }, clauses: [{ anyOf: [{ name: fixtureTagName, category: 'capability' }] }] }] };
  const submit = async (body) => {
    const response = await fetch(path, { method: 'POST', headers: authHeaders, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const invalid = structuredClone(input); invalid.requirements[0].evidence.quote = 'An invented ISO 27001 certification is required.';
  assert.equal((await submit(invalid)).status, 422);
  assert.equal(await db.collection('ai_evaluations').countDocuments({ torId }), 0);
  summary.checks.push('Fabricated quotation rejected without storing requirements');
  const first = await submit(input);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.matchingRefreshed, true); assert.equal(first.body.requirements, 2);
  const repeated = await submit(input); assert.equal(repeated.status, 200); assert.equal(repeated.body.unchanged, true);
  assert.equal(await db.collection('ai_evaluations').countDocuments({ torId }), 1);
  const created = await db.collection('tags').findOne({ name: fixtureTagName }); assert.ok(created);
  const stored = await db.collection('ai_evaluations').findOne({ torId });
  assert.equal(stored.validation.dataMode, 'demo'); assert.equal(stored.requirements[0].evidence.page, 1);
  assert.equal(stored.requirements[0].clauses[1].anyOfTagIds.length, 2);
  summary.checks.push('Existing tags reused, supported new tag created, requirement/page/source stored, repeated request idempotent');
  // Force an error after a new tag would have been created, proving transactional rollback.
  const rollback = structuredClone(input); const rollbackName = `${fixtureTagName}-Rollback`;
  const rollbackQuote = `${quote} ${rollbackName} is context only.`;
  await db.collection('requirement_sources').updateOne({ _id: sourceId }, { $set: { pages: [{ page: 1, text: rollbackQuote }] } });
  rollback.requirements[0].evidence.quote = rollbackQuote;
  rollback.requirements[0].clauses = [{ anyOf: [{ name: rollbackName, category: 'capability' }] },
    { anyOf: [{ tagId: String(tag('gis')._id) }] }];
  assert.equal((await submit(rollback)).status, 422);
  assert.equal(await db.collection('tags').countDocuments({ name: rollbackName }), 0);
  assert.equal((await db.collection('ai_evaluations').findOne({ torId })).inputHash, stored.inputHash);
  summary.checks.push('Failed late validation rolls back new tags and preserves previous valid extraction');
  const matches = await getCompanyMatches(String(fixtureCompanyId), { projectId });
  assert.equal(matches.items.length, 1); assert.equal(matches.items[0].score, 50);
  assert.equal(matches.items[0].dataMode, 'demo'); assert.equal(matches.items[0].counts.partial, 1);
  assert.equal(matches.items[0].requirementMatches[0].components.length, 2);
  summary.checks.push('Python AND/OR comparison gives 50%: Docker covers containers but not microservices');
  const stale = { ...input, torVersion: 2 }; assert.equal((await submit(stale)).status, 422);
  summary.checks.push('Stale TOR version rejected');
  // Smoke-test one real PDF without submitting any invented real requirements.
  const real = await db.collection('tor_announcements').findOne({ projectId: { $ne: 'BMA-DHR-2026-001', $not: /^TEST-/ },
    documentUrl: /view-pdf-file/ });
  if (real) {
    const response = await fetch(`http://127.0.0.1:4000/api/ai/tors/${real.projectId}/source`, { headers: authHeaders });
    const payload = await response.json();
    summary.realPdf = { projectId: real.projectId, status: response.status,
      pages: payload.pages?.length ?? 0, textCharacters: payload.pages?.reduce((total, page) => total + page.text.length, 0) ?? 0,
      errorCode: payload.error?.code ?? null };
  }
  summary.status = 'passed';
} finally {
  if (db?.databaseName === 'tor_software_test') {
    await db.collection('company_matches').deleteMany({ torId });
    await db.collection('ai_evaluations').deleteMany({ torId });
    await db.collection('requirement_sources').deleteMany({ _id: sourceId, torId });
    await db.collection('tor_announcements').deleteOne({ _id: torId, projectId });
    await db.collection('tags').deleteOne({ name: fixtureTagName });
    if (fixtureCompanyId) {
      await db.collection('company_matches').deleteMany({ companyId: fixtureCompanyId });
      await db.collection('companies').deleteOne({ _id: fixtureCompanyId, legalName: projectId });
    }
    summary.fixtureRemoved = (await db.collection('tor_announcements').countDocuments({ _id: torId })) === 0;
  }
  await closeDatabase();
}
console.log(JSON.stringify(summary, null, 2));
