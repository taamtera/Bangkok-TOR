import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscoveryQuery, VALID_PROJECT_ID_FILTER } from '../src/repositories/tor-query.mjs';

test('discovery excludes records without a non-blank string project identity', () => {
  assert.deepEqual(buildDiscoveryQuery().filter.projectId, VALID_PROJECT_ID_FILTER.projectId);
  assert.deepEqual(VALID_PROJECT_ID_FILTER.projectId, { $type: 'string', $regex: /\S/ });
});

test('search requires each literal word across project and department fields', () => {
  const query = buildDiscoveryQuery({ search: '  software   0001 .*  ', departmentId: '0001' });
  assert.equal(query.filter.$and.length, 4);
  assert.deepEqual(query.filter.$and[3], { departmentId: '0001' });
  assert.equal(query.filter.$and[2].$or[0].projectId.$regex, '\\.\\*');
  assert.equal(query.sort._searchRank, -1);
});
test('latest stage includes same-day observations and retained mode uses any retained stage', () => {
  const latest = buildDiscoveryQuery({ stage: 'W1' }).filter.$and[0];
  assert.equal(latest.$or[0].status, 'award_cancelled');
  assert.deepEqual(latest.$or[1].$and[1].$expr.$eq, ['$stageObservations.W1.publishedAt', '$statusPublishedAt']);
  assert.deepEqual(buildDiscoveryQuery({ stage: 'B0', stageScope: 'retained' }).filter.$and[0], { 'stageObservations.B0': { $type: 'object' } });
});
test('invalid dates, scopes, oversized queries, and stages are rejected', () => {
  for (const options of [{ fromDate: '2026-02-30' }, { fromDate: '2026-10-09', toDate: '2026-10-08' },
    { stage: 'constructor' }, { stageScope: 'all_history' }, { sort: 'random' }, { search: 'a'.repeat(161) }, { search: ['value'] }]) {
    assert.throws(() => buildDiscoveryQuery(options));
  }
});
