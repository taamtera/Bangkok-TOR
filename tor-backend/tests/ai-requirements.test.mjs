import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { validateAiRequirements, validateTagEvidence } from '../src/services/ai-requirement-validation.mjs';
import { coreTagForName, normalizeTagName, remapTagReferences } from '../src/services/tag-catalog.mjs';
import { planCatalogCleanup } from '../src/tag-catalog-migration.mjs';
import { allowedRequirementUrl, fetchRequirementPdf, extractPdfPages } from '../src/services/requirement-source.mjs';
import { authenticateAiWorker } from '../src/middleware/authenticate-ai-worker.mjs';
import { prepareMatchingTors } from '../src/services/requirement-input.mjs';

const source = { _id: new ObjectId(), torVersion: 1, pages: [{ page: 1, text: 'The contractor must deliver microservices using Docker or Kubernetes.' }] };
const input = () => ({ sourceId: String(source._id), torVersion: 1, model: { provider: 'test', name: 'fixture', version: '1', promptVersion: '1' }, requirements: [{
  key: 'r1', text: 'Microservices using containers', importance: 'required', confidence: 0.95,
  evidence: { page: 1, quote: source.pages[0].text }, clauses: [{ anyOf: [{ name: 'Docker', category: 'technology' }] }]
}] });

test('source quotations and explicit clauses validate without human approval', () => {
  assert.equal(validateAiRequirements(input(), source).requirements[0].importance, 'required');
});
test('fabricated quotes, wrong pages, low confidence and stale versions are rejected', () => {
  for (const mutate of [
    (body) => { body.requirements[0].evidence.quote = 'The company must possess an ISO 27001 certificate.'; },
    (body) => { body.requirements[0].evidence.page = 2; },
    (body) => { body.requirements[0].confidence = 0.5; },
    (body) => { body.torVersion = 2; },
    (body) => { body.sourceId = String(new ObjectId()); }
  ]) { const body = input(); mutate(body); assert.throws(() => validateAiRequirements(body, source)); }
});
test('new tags require literal source evidence and valid categories', () => {
  const body = input(); body.requirements[0].clauses[0].anyOf = [{ name: 'Flutter', category: 'technology' }];
  assert.throws(() => validateAiRequirements(body, source), { code: 'AI_TAG_EVIDENCE_MISMATCH' });
  body.requirements[0].clauses[0].anyOf = [{ name: 'Docker', category: 'anything' }];
  assert.throws(() => validateAiRequirements(body, source));
});
test('existing tag IDs also need active, quoted names or aliases', () => {
  validateTagEvidence({ name: 'Kubernetes', status: 'active', aliases: ['K8s'] }, 'The system must use K8s containers.');
  assert.throws(() => validateTagEvidence({ name: 'Docker', status: 'inactive' }, source.pages[0].text));
  assert.throws(() => validateTagEvidence({ name: 'ISO 270001', status: 'active' }, 'ISO 270001 is written here.'));
  assert.throws(() => validateTagEvidence({ name: 'Flutter', status: 'active' }, source.pages[0].text));
});
test('duplicate requirement keys and malformed compound clauses are rejected', () => {
  const body = input(); body.requirements.push(body.requirements[0]); assert.throws(() => validateAiRequirements(body, source));
  const other = input(); other.requirements[0].clauses = []; assert.throws(() => validateAiRequirements(other, source));
});
test('catalog aliases map profiles without accepting the ISO typo or a negative claim', () => {
  assert.equal(coreTagForName('Hospital information system development', { profile: true }).conceptKey, 'hospital-system');
  assert.equal(coreTagForName('ISO/IEC 27001 certification', { profile: true }).category, 'certification');
  assert.equal(coreTagForName('ISO 270001', { profile: true }), null);
  assert.equal(coreTagForName('No Docker experience', { profile: true }), null);
  assert.equal(normalizeTagName('  Ｄｏｃｋｅｒ  '), 'docker');
});
test('catalog cleanup preserves references and original evidence', () => {
  const a = new ObjectId('000000000000000000000001'), b = new ObjectId('000000000000000000000002');
  const plan = planCatalogCleanup([{ _id: a, name: 'Docker', category: 'technology', aliases: ['docker'], slug: 'docker' },
    { _id: b, name: ' Docker ', category: 'technology', aliases: ['container tool'], slug: 'docker' }]);
  assert.equal(plan.duplicates.length, 1); assert.deepEqual(plan.updates[0].aliases, ['docker', 'container tool']);
  const original = { companyId: b, tagAssignments: [{ tagId: b, evidence: 'Original profile claim' }], clauses: [{ anyOfTagIds: [b, a] }] };
  const changed = remapTagReferences(original, plan.mapping);
  assert.equal(String(changed.companyId), String(b)); assert.equal(String(changed.tagAssignments[0].tagId), String(a));
  assert.equal(changed.tagAssignments[0].evidence, original.tagAssignments[0].evidence); assert.equal(changed.clauses[0].anyOfTagIds.length, 1);
});
test('unsupported hosts and redirects cannot be used as AI source documents', async () => {
  assert.equal(allowedRequirementUrl('https://127.0.0.1/private'), null);
  assert.equal(allowedRequirementUrl('https://user:pass@process5.gprocurement.go.th/file'), null);
  assert.equal(allowedRequirementUrl('https://process5.gprocurement.go.th:80/file'), null);
  assert.equal(allowedRequirementUrl('http://process5.gprocurement.go.th/file').protocol, 'https:');
  await assert.rejects(fetchRequirementPdf('https://process5.gprocurement.go.th/file', async () => new Response('', {
    status: 302, headers: { location: 'https://127.0.0.1/private' }
  })), { code: 'DOCUMENT_HOST_NOT_ALLOWED' });
});
test('HTML is not silently treated as a PDF source', async () => {
  await assert.rejects(fetchRequirementPdf('https://process5.gprocurement.go.th/file', async () => new Response('<html>not a PDF</html>')), { code: 'PDF_REQUIRED' });
});
test('PDF source text is parsed in the isolated worker', async () => {
  const text = 'The contractor must use Docker for deployment.';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const content = `BT /F1 12 Tf 40 700 Td (${text}) Tj ET`;
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => String(offset).padStart(10, '0') + ' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const pages = await extractPdfPages(Buffer.from(pdf)); assert.equal(pages[0].page, 1); assert.ok(pages[0].text.includes(text));
});
test('AI worker key is scoped separately from human cookies', () => {
  const previous = process.env.AI_REQUIREMENTS_TOKEN; process.env.AI_REQUIREMENTS_TOKEN = 'test-key-'.repeat(8);
  try {
    let error = undefined;
    authenticateAiWorker({ get: () => 'Bearer wrong' }, {}, (failure) => { error = failure; }); assert.equal(error.code, 'AI_WORKER_UNAUTHORIZED');
    authenticateAiWorker({ get: () => `Bearer ${process.env.AI_REQUIREMENTS_TOKEN}` }, {}, (failure) => { error = failure; }); assert.equal(error, undefined);
    delete process.env.AI_REQUIREMENTS_TOKEN;
    authenticateAiWorker({ get: () => '' }, {}, (failure) => { error = failure; }); assert.equal(error.code, 'AI_WORKER_NOT_CONFIGURED');
  } finally { if (previous === undefined) delete process.env.AI_REQUIREMENTS_TOKEN; else process.env.AI_REQUIREMENTS_TOKEN = previous; }
});
test('validated extraction reaches matching only for the current source and version', () => {
  const torId = new ObjectId(), sourceId = new ObjectId(), tagId = new ObjectId();
  const tor = { _id: torId, projectId: 'example', documentUrl: 'https://process5.gprocurement.go.th/file',
    requirementSource: { snapshotId: sourceId, documentHash: 'abc' } };
  const evaluation = { torId, torVersion: 1, validation: { status: 'passed', method: 'source_quote_v1', sourceId,
    sourceUrl: tor.documentUrl, documentHash: 'abc', dataMode: 'source' }, requirements: [{ key: 'r1',
    text: 'Docker deployment', importance: 'required', evidence: { excerpt: 'Must use Docker', page: 1, sourceUrl: tor.documentUrl }, clauses: [{ anyOfTagIds: [tagId] }] }] };
  const tags = [{ _id: tagId, name: 'Docker', conceptKey: 'docker' }];
  assert.deepEqual(prepareMatchingTors([tor], tags, new Map(), [evaluation])[0].matchingRequirements[0].clauses, [{ anyOf: ['docker'] }]);
  const changed = { ...tor, documentUrl: tor.documentUrl + '?changed=1' };
  assert.equal(prepareMatchingTors([changed], tags, new Map(), [evaluation])[0].matchingRequirements.length, 0);
  assert.equal(prepareMatchingTors([tor], tags, new Map([[String(torId), 2]]), [evaluation])[0].matchingRequirements.length, 0);
  const unavailable = prepareMatchingTors([tor], [], new Map(), [evaluation])[0].matchingRequirements;
  assert.equal(unavailable.length, 1); // Preserve the denominator when a catalog tag becomes inactive.
  assert.equal(unavailable[0].clauses[0].anyOf[0], `unavailable:${tagId}`);
});
