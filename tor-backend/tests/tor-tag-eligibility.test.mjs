import test from 'node:test';
import assert from 'node:assert/strict';
import { usableTorTagAssignment } from '../src/services/tor-tag-eligibility.mjs';
import { prepareMatchingTors } from '../src/services/requirement-input.mjs';
import { buildEvaluationInput } from '../src/services/company-tor-evaluation.mjs';
import { ObjectId } from 'mongodb';
const tor = { aiProcessing: { status: 'completed', tagReviewStatus: 'approved' } };
const assignment = { tagId: new ObjectId(), source: 'ai', reviewStatus: 'suggested', confidence: 0.9,
  requirementLevel: 'required', evidence: 'Internet Service' };
test('automatic eligibility requires AI completion and passed review without changing provenance', () => {
  const original = JSON.stringify(assignment);
  assert.equal(usableTorTagAssignment(tor, assignment), true);
  for (const aiProcessing of [undefined, {}, { status: 'processing', tagReviewStatus: 'approved' },
    { status: 'failed', tagReviewStatus: 'approved' }, { status: 'completed', tagReviewStatus: 'rejected' }]) {
    assert.equal(usableTorTagAssignment({ aiProcessing }, assignment), false);
  }
  assert.equal(JSON.stringify(assignment), original);
});
test('rejected, malformed, inactive and excluded assignments never become usable', () => {
  for (const change of [{ reviewStatus: 'rejected' }, { reviewStatus: 'unknown' }, { tagId: null },
    { evidence: ' ' }, { requirementLevel: 'invalid' }, { source: 'manual' }, { confidence: undefined },
    { confidence: -1 }, { confidence: 2 }, { confidence: NaN }, { tagStatus: 'inactive' },
    { tagStatus: null }, { tagMatchingExcluded: true }]) {
    assert.equal(usableTorTagAssignment(tor, { ...assignment, ...change }), false);
  }
});
test('approved and validated assignments require no human approval step for suggestions', () => {
  for (const reviewStatus of ['approved', 'validated']) {
    assert.equal(usableTorTagAssignment({}, { ...assignment, reviewStatus }), true);
  }
});
test('inactive or missing catalog IDs cannot contribute to matching', () => {
  const source = { ...tor, _id: new ObjectId(), tagAssignments: [assignment] };
  for (const tags of [[], [{ _id: assignment.tagId, text: 'Internet Service', status: 'inactive' }],
    [{ _id: assignment.tagId, text: 'Internet Service', status: 'active', matchingExcluded: true }]]) {
    assert.equal(prepareMatchingTors([source], tags, new Map(), [])[0].matchingRequirements.length, 0);
  }
});
test('AI evaluation receives eligible tag assignments only', () => {
  const result = buildEvaluationInput({ _id: 'company' }, { ...tor, tagAssignments: [assignment,
    { ...assignment, tagId: new ObjectId(), reviewStatus: 'rejected' }] });
  assert.equal(result.tor.tags.length, 1);
  assert.equal(result.tor.tags[0].tagId, String(assignment.tagId));
});
