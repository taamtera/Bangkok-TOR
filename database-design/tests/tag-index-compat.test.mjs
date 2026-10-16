import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { buildPromptItems, parseAIResponses, buildTagUpsertPipeline, buildProjectUpdatePipeline } from '../scripts/tag-workflow-helpers.mjs';

const uri = process.env.TAGGING_TEST_MONGODB_URI;
test('category/text merge supports simplified tags without legacy fields and appends ObjectId links', { skip: !uri }, async () => {
  assert.match(uri, /^mongodb:\/\/(127\.0\.0\.1|localhost):\d+(?:\/|$)/);
  const client = new MongoClient(uri);
  const db = client.db(`tag_index_compat_${randomUUID().replaceAll('-', '')}`);
  try {
    await client.connect();
    await db.collection('tags').createIndex({ category: 1, text: 1 }, { unique: true, name: 'uq_tags_category_text' });
    await db.collection('tor_announcements').createIndex({ projectId: 1 }, { unique: true });
    await db.collection('tags').insertOne({ text: 'Node.js', category: 'technology', type: 'specification' });
    await db.collection('tor_announcements').insertOne({ projectId: '000123' });
    const catalog = await db.collection('tags').find({}).toArray();
    const prompts = buildPromptItems([{ projectId: '000123', sourceText: 'Node.js and Domain Service. ราคาที่เสนอ 30,000 บาท' }], catalog);
    assert.match(prompts[0].aiRequest.messages[0].content, /winning bid/);
    const tags = ['Node.js', 'Domain Service'].map(text => ({ text, category: 'technology', type: 'specification', requirementLevel: 'required', evidence: text, confidence: 0.9 }));
    const parsed = parseAIResponses([{ message: { content: JSON.stringify({ departmentName: null, procurementMethod: null, budgetAmount: null, projectStartAt: null, projectEndAt: null, requirements: [], tags, extractionWarnings: [] }) } }], prompts, catalog);
    assert.equal(parsed.projects[0].aiProcessing.status, 'completed');
    assert.equal(parsed.candidates.length, 1);
    for (let attempt = 0; attempt < 2; attempt++) {
      await db.collection('tags').aggregate(buildTagUpsertPipeline(parsed.candidates)).toArray();
      await db.collection('tags').aggregate(buildProjectUpdatePipeline(parsed.projects)).toArray();
    }
    assert.equal(await db.collection('tags').countDocuments({}), 2);
    const saved = await db.collection('tor_announcements').findOne({ projectId: '000123' });
    assert.equal(saved.tagAssignments.length, 2);
    assert.ok(saved.tagAssignments.every(a => a.tagId instanceof ObjectId));
    assert.equal(Object.hasOwn(saved, 'budget'), false);
  } finally { await db.dropDatabase(); await client.close(); }
});
