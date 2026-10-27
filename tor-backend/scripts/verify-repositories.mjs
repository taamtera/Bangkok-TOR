import assert from 'node:assert/strict';
import { closeDatabase, connectDatabase } from '../src/config/database.mjs';
import { listTors, findTorByProjectId } from '../src/repositories/tor.repository.mjs';
import { listControlledTags } from '../src/repositories/tag.repository.mjs';
import { listActiveTagsForMatching } from '../src/repositories/match.repository.mjs';

// Read-only checks against the configured database; no seed accounts or demo names required.
try {
  const db = await connectDatabase();
  const [result, tags, matchingTags, info] = await Promise.all([
    listTors({ limit: 5 }), listControlledTags(), listActiveTagsForMatching(),
    db.listCollections({ name: 'company_matches' }).next()
  ]);
  assert.ok(!info?.options?.validator?.$jsonSchema?.required?.includes('recommendation'),
    'company_matches still requires recommendation; run npm run schema:apply.');
  const tagInfo = await db.collection('tags').indexes();
  assert.ok(tagInfo.some(index => index.unique && JSON.stringify(index.key) === JSON.stringify({ category: 1, text: 1 })),
    'The canonical category + text unique tag index is missing.');
  for (const tor of result.items) {
    assert.equal(typeof tor.projectId, 'string');
    const read = await findTorByProjectId(tor.projectId);
    assert.equal(read.projectId, tor.projectId);
    assert.deepEqual(read.tagAssignments || [], tor.tagAssignments || []);
  }
  assert.ok(tags.every(tag => typeof tag.name === 'string' && tag.name.trim()));
  assert.ok(matchingTags.every(tag => typeof tag.name === 'string' && tag.name.trim()));
  console.log(JSON.stringify({ database: db.databaseName, projects: result.pagination.total,
    catalogTags: tags.length, matchingTags: matchingTags.length, status: 'passed', readOnly: true }));
} finally { await closeDatabase(); }
