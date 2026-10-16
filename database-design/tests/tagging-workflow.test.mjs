import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { ingestionDefinitions, ingestionIndexes, retiredIdentityIndexes } from '../scripts/ingestion-schema.mjs';
import { buildPromptItems, parseAIResponses, buildTagUpsertPipeline, buildProjectUpdatePipeline, buildVerificationPipeline, slugFor } from '../scripts/tag-workflow-helpers.mjs';

const nodeId = '000000000000000000000001';
const catalog = [
  { _id: nodeId, name: 'Node.js', text: 'Node.js', normalizedName: 'node.js', category: 'technology', type: 'specification', aliases: ['NodeJS', 'Node JS'], status: 'active', slug: 'nodejs' },
  { _id: '000000000000000000000002', name: 'Old Tool', normalizedName: 'old tool', category: 'technology', aliases: [], status: 'inactive', slug: 'old-tool' }
];
const source = 'Use NodeJS, PostgreSQL, and Old Tool. Must deliver the system. Budget 100000 THB.';
const prompts = () => buildPromptItems([{ projectId: '000123', aiPrompt: source }], catalog);
const tag = (text = 'PostgreSQL', evidence = 'PostgreSQL') => ({ text, category: 'technology', type: 'specification', requirementLevel: 'required', evidence, confidence: 0.9 });
const payload = (overrides = {}) => ({ departmentName: null, procurementMethod: null, budgetAmount: null, projectStartAt: null, projectEndAt: null, requirements: [], tags: [], extractionWarnings: [], ...overrides });
const response = data => ({ model: 'qwen3.5:9bu', message: { content: JSON.stringify(data) } });
const requirement = (overrides = {}) => ({ text: 'Must deliver the system.', category: 'technical_specification', appliesTo: null, requirementLevel: 'required', evidence: 'Must deliver the system.', ...overrides });

test('canonical aliases resolve, inactive tags are skipped, and proposals deduplicate', () => {
  const result = parseAIResponses([response(payload({ tags: [tag('NodeJS'), tag('Node.js', 'NodeJS'), tag(), tag('Old Tool')] }))], prompts(), catalog);
  assert.equal(result.projects[0].aiProcessing.status, 'completed');
  assert.deepEqual(result.projects[0].proposals.map(p => p.key), ['technology:node.js', 'technology:postgresql']);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].name, 'PostgreSQL');
  assert.equal(result.projects[0].aiProcessing.warnings.length, 1);
  assert.equal(result.projects[0].aiProcessing.model, 'qwen3.5:9bu');
});

test('invalid and truncated responses never produce writes or partial new tags', () => {
  for (const input of [response({}), { error: 'timeout' }, { ...response(payload()), done_reason: 'length' }, response(payload({ tags: [tag(), tag('Bad', 'not in source')] }))]) {
    const result = parseAIResponses([input], prompts(), catalog);
    assert.equal(result.projects[0].aiProcessing.status, 'failed');
    assert.deepEqual(result.projects[0].proposals, []);
    assert.deepEqual(result.candidates, []);
    assert.equal(result.projects[0].budget, undefined);
  }
});

test('canonical type is required and a conflicting catalog type is never reassigned', () => {
  const untyped = tag();
  delete untyped.type;
  assert.equal(parseAIResponses([response(payload({ tags: [untyped] }))], prompts(), catalog).projects[0].aiProcessing.status, 'failed');
  const conflict = { ...tag('NodeJS'), type: 'contractor_requirement' };
  const parsed = parseAIResponses([response(payload({ tags: [conflict] }))], prompts(), catalog);
  assert.deepEqual(parsed.projects[0].proposals, []);
  assert.deepEqual(parsed.candidates, []);
  assert.match(parsed.projects[0].aiProcessing.warnings[0], /Canonical tag type differs/);
});

test('rejects invalid dates, date ordering, and coercible non-number budgets; zero is valid', () => {
  for (const data of [{ budgetAmount: true }, { budgetAmount: '1000' }, { projectStartAt: '2026-02-30' }, { projectStartAt: '2026-10-16', projectEndAt: '2026-10-15' }]) {
    assert.equal(parseAIResponses([response(payload(data))], prompts(), catalog).projects[0].aiProcessing.status, 'failed');
  }
  assert.equal(parseAIResponses([response(payload({ budgetAmount: 0 }))], prompts(), catalog).projects[0].budget.maxAmount, 0);
});

test('requirements retain categories, item scope, comparators, units, evidence, and warnings', () => {
  // Synthetic fixture: these scopes/thresholds are not claims about the real TOR.
  const copierSource = 'เครื่องชนิด ก ความเร็วไม่น้อยกว่า 20 แผ่นต่อนาที\nเครื่องชนิด ข ความเร็วไม่น้อยกว่า 30 แผ่นต่อนาที\nเครื่องชนิด ค ความเร็วไม่น้อยกว่า 50 แผ่นต่อนาที\nสินค้าต้องเป็นของแท้ ใหม่ ไม่เคยใช้งาน';
  const request = buildPromptItems([{ projectId: '69109065084', sourceText: copierSource, aiPrompt: 'Old prompt only said: 20, 30 or 50.' }], []);
  const requirements = [
    ...[['ก', 20], ['ข', 30], ['ค', 50]].map(([kind, speed]) => requirement({ text: `เครื่องชนิด ${kind} ความเร็วไม่น้อยกว่า ${speed} แผ่นต่อนาที`, appliesTo: `เครื่องชนิด ${kind}`, evidence: `เครื่องชนิด ${kind} ความเร็วไม่น้อยกว่า ${speed} แผ่นต่อนาที` })),
    requirement({ text: 'สินค้าต้องเป็นของแท้ ใหม่ ไม่เคยใช้งาน', category: 'product_condition', evidence: 'สินค้าต้องเป็นของแท้ ใหม่ ไม่เคยใช้งาน' })
  ];
  const parsed = parseAIResponses([response(payload({ requirements: [...requirements, requirements[0]], extractionWarnings: ['ไม่พบคุณสมบัติผู้ยื่นข้อเสนอในข้อความที่ให้มา'] }))], request, []);
  assert.equal(parsed.projects[0].aiProcessing.status, 'completed');
  assert.equal(parsed.projects[0].aiProcessing.version, 4);
  assert.deepEqual(parsed.projects[0].aiExtractedRequirements, requirements);
  assert.equal(parsed.projects[0].aiProcessing.warnings[0], 'ไม่พบคุณสมบัติผู้ยื่นข้อเสนอในข้อความที่ให้มา');
  assert.ok(request[0].aiRequest.messages[1].content.includes(copierSource));
  assert.ok(!request[0].aiRequest.messages[1].content.includes('Old prompt'));
  assert.match(request[0].aiRequest.messages[0].content, /Do NOT join specifications for different copier types/);
  assert.match(request[0].aiRequest.messages[0].content, /A copier purchase is not evidence of Node.js/);
  assert.equal(request[0].aiRequest.format.properties.requirements.items.type, 'object');
});

test('rejects legacy strings, tag categories on requirements, fabricated evidence, and invented scopes', () => {
  for (const bad of ['Must deliver the system.', requirement({ category: 'technology' }), requirement({ evidence: 'ISO 27001 required' }), requirement({ appliesTo: 'Invented Lot 2' })]) {
    const parsed = parseAIResponses([response(payload({ requirements: [bad], tags: [tag()] }))], prompts(), catalog);
    assert.equal(parsed.projects[0].aiProcessing.status, 'failed');
    assert.deepEqual(parsed.projects[0].aiExtractedRequirements, []);
    assert.deepEqual(parsed.candidates, []);
  }
});

test('prompt uses the actual configured model and JSON schema, and validates input identities', () => {
  const prompt = prompts()[0];
  assert.equal(prompt.aiModel, prompt.aiRequest.model);
  assert.equal(prompt.aiRequest.format.properties.tags.items.properties.category.enum.length, 7);
  assert.match(prompt.aiRequest.messages[0].content, /Never infer a budget from a reference price/);
  assert.throws(() => buildPromptItems([{ projectId: 123, aiPrompt: source }], catalog), /projectId/);
  assert.throws(() => buildPromptItems([{ projectId: 'x', aiPrompt: source }, { projectId: 'x', aiPrompt: source }], catalog), /projectId/);
  assert.notEqual(slugFor('skill', 'C++'), slugFor('skill', 'C#'));
  assert.match(slugFor('skill', 'ภาษาไทย'), /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

test('workflow Code nodes compile and every processing node is connected', () => {
  const workflow = JSON.parse(readFileSync(new URL('../../n8n-tor-ai-tags.json', import.meta.url)));
  for (const node of workflow.nodes) {
    if (node.type === 'n8n-nodes-base.stickyNote') continue;
    if (node.type === 'n8n-nodes-base.code') new Function(node.parameters.jsCode);
    if (node.type === 'n8n-nodes-base.mongoDb') assert.equal(node.parameters.operation, 'aggregate');
    assert.ok(workflow.connections[node.name]);
  }
  assert.equal(workflow.connections['Build Atomic Assignment Append'].main[0][0].node, 'Append Tags and Update AI Fields');
});

const localUri = process.env.TAGGING_TEST_MONGODB_URI;
test('MongoDB integration: real validators, typed references, idempotent append, concurrency, failures, and missing projects', { skip: !localUri }, async () => {
  // Integration tests may only write to an isolated database on a loopback server.
  assert.match(localUri, /^mongodb:\/\/(127\.0\.0\.1|localhost):\d+(?:\/|$)/);
  const client = new MongoClient(localUri, { serverSelectionTimeoutMS: 5000 });
  const databaseName = `tor_tagging_test_${randomUUID().replaceAll('-', '')}`;
  try {
    await client.connect();
    const db = client.db(databaseName);
    const setup = readFileSync(new URL('../scripts/setup-database.mjs', import.meta.url), 'utf8');
    const expected = vm.runInNewContext(setup.slice(setup.indexOf('const collectionDefinitions ='), setup.indexOf('function validatorFor(')) + '\n({collectionDefinitions,indexes})', { ingestionDefinitions, ingestionIndexes, retiredIdentityIndexes });
    for (const name of ['tags', 'tor_announcements']) {
      const def = expected.collectionDefinitions[name];
      await db.createCollection(name, { validator: { $jsonSchema: { bsonType: 'object', required: def.required, properties: def.properties } }, validationLevel: 'strict', validationAction: 'error' });
      for (const [key, options] of expected.indexes[name].filter(([,o]) => /tag|project_id/.test(o.name))) await db.collection(name).createIndex(key, options);
    }
    const now = new Date();
    await db.collection('tags').insertMany(catalog.map(t => ({ ...t, _id: new ObjectId(t._id), createdAt: now, updatedAt: now })));
    const approved = { tagId: new ObjectId(nodeId), requirementLevel: 'preferred', source: 'manual', confidence: 1, reviewStatus: 'approved', evidence: 'Reviewed evidence', reviewedByUserId: new ObjectId(), reviewedAt: now, assignedAt: now };
    const original = {
      projectId: '000123', scope: 'department', identityScope: 'project', title: 'Existing project', description: 'Official description', departmentId: '001', departmentName: 'Official owner',
      publishedAt: '2026-10-16', url: null, procurementMethod: 'Official method', channelParams: {}, itemParams: {}, firstSeenAt: now.toISOString(), lastSeenAt: now.toISOString(),
      status: 'invitation_published', statusPublishedAt: '2026-10-16', statusOrderAmbiguous: false, stageObservations: {}, biddingOpenVerified: false,
      tagAssignments: [approved], budget: { minAmount: 0 }, aiExtractedRequirements: ['Old requirement']
    };
    await db.collection('tor_announcements').insertOne(original);
    const extracted = payload({ departmentName: 'AI owner', procurementMethod: 'AI method', budgetAmount: 100000, projectStartAt: '2026-11-01', projectEndAt: '2026-12-01', requirements: [requirement()], tags: [tag('NodeJS'), tag()] });
    const parsed = parseAIResponses([response(extracted)], prompts(), catalog);
    const write = async result => {
      await db.collection('tags').aggregate(buildTagUpsertPipeline(result.candidates)).toArray();
      // Use tags as the input collection, not the target project collection.
      await db.collection('tags').aggregate(buildProjectUpdatePipeline(result.projects)).toArray();
    };
    await write(parsed);
    await write(parsed);
    let saved = await db.collection('tor_announcements').findOne({ projectId: '000123' });
    assert.equal(await db.collection('tags').countDocuments({}), 3);
    assert.equal(saved.tagAssignments.length, 2);
    assert.deepEqual(saved.tagAssignments[0], approved);
    assert.equal(saved.tagAssignments[1].reviewStatus, 'suggested');
    assert.equal(saved.tagAssignments[1].source, 'ai');
    const newCanonical = await db.collection('tags').findOne({ normalizedName: 'postgresql' });
    assert.equal(newCanonical.text, 'PostgreSQL');
    assert.equal(newCanonical.type, 'specification');
    assert.equal(Object.hasOwn(newCanonical, 'requirementLevel'), false);
    assert.equal(saved.tagAssignments[1].requirementLevel, 'required');
    assert.ok(saved.tagAssignments[1].tagId instanceof ObjectId);
    assert.ok(saved.tagAssignments[1].assignedAt instanceof Date);
    assert.equal(saved.departmentName, 'Official owner');
    assert.equal(saved.procurementMethod, 'Official method');
    assert.deepEqual(saved.budget, { minAmount: 0 });
    assert.equal(saved.projectStartAt, '2026-11-01');
    assert.deepEqual(saved.aiExtractedRequirements, [requirement()]);
    const verified = await db.collection('tags').aggregate(buildVerificationPipeline(parsed.projects)).toArray();
    assert.equal(verified[0].projectExists, true);
    assert.equal(verified[0].totalAssignments, 2);
    assert.equal(verified[0].aiProcessing.tagCountResolved, 2);
    // Separate concurrent writers append different tags without losing either.
    const moreCatalog = await db.collection('tags').find({}).toArray();
    const source2 = 'Use Redis and Kubernetes.';
    const morePrompts = buildPromptItems([{ projectId: '000123', aiPrompt: source2 }], moreCatalog);
    const writers = ['Redis', 'Kubernetes'].map(name => parseAIResponses([response(payload({ tags: [tag(name, name)] }))], morePrompts, moreCatalog));
    await Promise.all(writers.map(write));
    saved = await db.collection('tor_announcements').findOne({ projectId: '000123' });
    assert.equal(saved.tagAssignments.length, 4);
    assert.equal(new Set(saved.tagAssignments.map(t => String(t.tagId))).size, 4);
    // Failed AI calls cannot erase prior extraction or existing assignments.
    await write(parseAIResponses([{ error: 'timeout' }], prompts(), catalog));
    const failed = await db.collection('tor_announcements').findOne({ projectId: '000123' });
    assert.equal(failed.aiProcessing.status, 'failed');
    assert.equal(failed.tagAssignments.length, 4);
    assert.deepEqual(failed.aiExtractedRequirements, saved.aiExtractedRequirements);
    const missing = structuredClone(parsed.projects);
    missing[0].projectId = 'missing-project';
    await db.collection('tags').aggregate(buildProjectUpdatePipeline(missing)).toArray();
    assert.equal(await db.collection('tor_announcements').countDocuments({}), 1);
    assert.equal((await db.collection('tags').aggregate(buildVerificationPipeline(missing)).toArray())[0].projectExists, false);
    // Empty extraction does not stop later stages or clear previous assignments.
    await write(parseAIResponses([response(payload())], prompts(), catalog));
    assert.equal((await db.collection('tor_announcements').findOne({ projectId: '000123' })).tagAssignments.length, 4);
    // Execute the actual generated Code/aggregation nodes, with only Ollama mocked.
    // This also verifies batched item pairing and that every bundled helper exists.
    const { _id: discardedId, ...secondProject } = original;
    await db.collection('tor_announcements').insertOne({ ...secondProject, projectId: '000456', tagAssignments: [] });
    const workflow = JSON.parse(readFileSync(new URL('../../n8n-tor-ai-tags.json', import.meta.url)));
    const outputs = new Map();
    let items = [
      { json: { projectId: '000123', aiPrompt: source, aiModel: 'custom:model' } },
      { json: { projectId: '000456', aiPrompt: source } }
    ];
    const select = name => ({
      first: () => outputs.get(name)[0],
      itemMatching: index => outputs.get(name)[index]
    });
    for (const node of workflow.nodes) {
      if (node.type === 'n8n-nodes-base.stickyNote') continue;
      if (node.type === 'n8n-nodes-base.code') {
        items = new Function('$input', '$', node.parameters.jsCode)({ all: () => items, first: () => items[0] }, select);
      } else if (node.type === 'n8n-nodes-base.mongoDb') {
        const queryText = node.parameters.query.startsWith('=')
          ? new Function('$json', `return (${node.parameters.query.slice(3, -2)});`)(items[0].json)
          : node.parameters.query;
        const rows = await db.collection(node.parameters.collection).aggregate(JSON.parse(queryText)).toArray();
        // n8n exposes BSON ObjectIds/dates to Code nodes as JSON values.
        items = JSON.parse(JSON.stringify((rows.length ? rows : [{}]).map(json => ({ json }))));
      } else {
        items = items.map((item, index) => ({ json: index === 0
          ? { ...response(payload({ requirements: [requirement()], tags: [tag('NodeJS')] })), model: item.json.aiModel }
          : { error: 'Simulated second-item timeout' } }));
      }
      outputs.set(node.name, items);
    }
    assert.equal(items.length, 2);
    assert.equal(items[0].json.projectId, '000123');
    assert.equal(items[0].json.aiProcessing.model, 'custom:model');
    assert.equal(items[0].json.aiProcessing.status, 'completed');
    assert.equal(items[0].json.aiProcessing.version, 4);
    assert.deepEqual((await db.collection('tor_announcements').findOne({ projectId: '000123' })).aiExtractedRequirements, [requirement()]);
    assert.equal(items[1].json.projectId, '000456');
    assert.equal(items[1].json.aiProcessing.status, 'failed');
    assert.equal(items[1].json.totalAssignments, 0);
    // Empty catalog bootstraps correctly: the seed envelope is still emitted.
    await db.collection('tags').deleteMany({});
    await db.collection('tags').aggregate(buildTagUpsertPipeline(parsed.candidates)).toArray();
    assert.equal(await db.collection('tags').countDocuments({}), 1);
  } finally {
    await client.db(databaseName).dropDatabase();
    await client.close();
  }
});
