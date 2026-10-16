import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCompanyTagAssignments, validateTorSuggestionReview, validateTorTagAssignments, validateTorTagSuggestions } from '../src/validators/tag.validators.mjs';

test('company assignments require evidence and accept self-reported levels', () => {
  const result = validateCompanyTagAssignments({ assignments: [
    { tagId: 'tag-1', verificationLevel: 'claimed', evidence: 'Listed in the company profile' },
    { tagId: 'tag-2', verificationLevel: 'experienced', evidence: 'Delivered project ABC' }
  ] });

  assert.equal(result.length, 2);
  assert.equal(result[0].verificationLevel, 'claimed');
});

test('company users cannot promote their own claims to verified', () => {
  assert.throws(
    () => validateCompanyTagAssignments({ assignments: [
      { tagId: 'tag-1', verificationLevel: 'verified', evidence: 'A claim without independent verification' }
    ] }),
    error => error.status === 400 && /verified status requires an authorized verification process/i.test(error.message)
  );
});

test('TOR requirement assignments require source evidence', () => {
  assert.throws(
    () => validateTorTagAssignments({ assignments: [
      { tagId: 'tag-1', requirementLevel: 'required', evidence: '   ' }
    ] }),
    error => error.status === 400 && /evidence is required/i.test(error.message)
  );
});

test('assignment evidence has a bounded length', () => {
  assert.throws(
    () => validateTorTagAssignments({ assignments: [
      { tagId: 'tag-1', requirementLevel: 'preferred', evidence: 'x'.repeat(2001) }
    ] }),
    error => error.status === 400 && /2000 characters or fewer/i.test(error.message)
  );
});

test('AI TOR suggestions require a cited source URL, evidence, and bounded confidence', () => {
  const valid = validateTorTagSuggestions({ suggestions: [{
    tagId: 'tag-1', requirementLevel: 'required', evidence: 'Section 3.2 requires a web application',
    sourceDocumentUrl: 'https://procurement.example/tor.pdf', sourcePage: '3', confidence: 0.91
  }] });
  assert.equal(valid[0].confidence, 0.91);
  assert.equal(valid[0].sourcePage, '3');

  assert.throws(() => validateTorTagSuggestions({ suggestions: [{
    tagId: 'tag-1', requirementLevel: 'required', evidence: 'Evidence', sourceDocumentUrl: 'file:///tor.pdf', confidence: 0.91
  }] }), error => error.status === 400 && /HTTP or HTTPS/i.test(error.message));
  assert.throws(() => validateTorTagSuggestions({ suggestions: [{
    tagId: 'tag-1', requirementLevel: 'required', evidence: 'Evidence', sourceDocumentUrl: 'https://procurement.example/tor.pdf', confidence: 1.1
  }] }), error => error.status === 400 && /between 0 and 1/i.test(error.message));
});

test('AI requirement decisions accept only approval or rejection', () => {
  assert.deepEqual(validateTorSuggestionReview({ reviewStatus: 'approved' }), { reviewStatus: 'approved' });
  assert.throws(() => validateTorSuggestionReview({ reviewStatus: 'suggested' }), error => error.status === 400);
});

test('duplicate TOR tags cannot inflate a match score', () => {
  assert.throws(() => validateTorTagAssignments({ assignments: [
    { tagId: 'tag-1', requirementLevel: 'required', evidence: 'Section 2' },
    { tagId: 'tag-1', requirementLevel: 'required', evidence: 'Section 3' }
  ] }), error => error.status === 400 && /same tag cannot be assigned more than once/i.test(error.message));
  assert.throws(() => validateTorTagSuggestions({ suggestions: [
    { tagId: 'tag-1', requirementLevel: 'required', evidence: 'Section 2', sourceDocumentUrl: 'https://example.test/tor.pdf', confidence: 0.9 },
    { tagId: 'tag-1', requirementLevel: 'required', evidence: 'Section 3', sourceDocumentUrl: 'https://example.test/tor.pdf', confidence: 0.8 }
  ] }), error => error.status === 400 && /more than once/i.test(error.message));
});
