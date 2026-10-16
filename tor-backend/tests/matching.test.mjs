import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCompanyMatch } from '../src/services/matching.service.mjs';

const tags = new Map([
  ['required-verified', { name: 'Verified requirement' }],
  ['required-missing', { name: 'Missing requirement' }],
  ['preferred-claimed', { name: 'Claimed preference' }],
  ['context-only', { name: 'Informational context' }],
  ['inactive-tag', { name: 'Inactive tag' }]
]);

function assignment(tagId, fields = {}) {
  return { tagId, reviewStatus: 'approved', evidence: 'Evidence from the source or company profile', ...fields };
}

function score(companyTagAssignments, torTagAssignments, activeTags = tags) {
  return computeCompanyMatch(
    { _id: 'company-1', legalName: 'Example Co', profileCompleteness: 60, tagAssignments: companyTagAssignments },
    { _id: 'tor-1', tagAssignments: torTagAssignments },
    activeTags,
    2
  );
}

test('weights required and preferred tags by importance and company evidence', () => {
  const match = score(
    [assignment('required-verified', { verificationLevel: 'verified' }), assignment('preferred-claimed', { verificationLevel: 'claimed' })],
    [
      assignment('required-verified', { requirementLevel: 'required', evidence: 'TOR says required' }),
      assignment('required-missing', { requirementLevel: 'required' }),
      assignment('preferred-claimed', { requirementLevel: 'preferred' })
    ]
  );

  assert.equal(match.score, 50);
  assert.equal(match.recommendation, 'possible_match');
  assert.equal(match.torVersion, 2);
  assert.deepEqual(match.requirementMatches.map(({ status }) => status), ['met', 'missing', 'partial']);
  assert.equal(match.requirementMatches[0].requirementEvidence, 'TOR says required');
  assert.equal(match.profileCompleteness, 60);
  assert.equal(match.policyVersion, 2);
  assert.equal(match.gaps.length, 1);
});

test('informational tags are returned as context and do not change the score', () => {
  const required = [assignment('required-verified', { requirementLevel: 'required' })];
  const company = [assignment('required-verified', { verificationLevel: 'verified' })];
  const base = score(company, required);
  const withContext = score(company, [...required, assignment('context-only', { requirementLevel: 'informational' })]);

  assert.equal(base.score, 100);
  assert.equal(withContext.score, base.score);
  assert.equal(withContext.requirementMatches[1].status, 'informational');
});

test('suggested company or TOR assignments and inactive tags do not affect scoring', () => {
  const match = score(
    [
      assignment('required-verified', { verificationLevel: 'verified', reviewStatus: 'suggested' }),
      assignment('inactive-tag', { verificationLevel: 'verified' })
    ],
    [
      assignment('required-verified', { requirementLevel: 'required' }),
      assignment('inactive-tag', { requirementLevel: 'required' }),
      assignment('required-missing', { requirementLevel: 'required', reviewStatus: 'suggested' })
    ],
    new Map([['required-verified', tags.get('required-verified')]])
  );

  assert.equal(match.score, 0);
  assert.equal(match.requirementMatches.length, 1);
  assert.equal(match.requirementMatches[0].status, 'missing');
});

test('duplicate historical company assignments use the strongest approved evidence', () => {
  const match = score(
    [
      assignment('required-verified', { verificationLevel: 'claimed' }),
      assignment('required-verified', { verificationLevel: 'verified' })
    ],
    [assignment('required-verified', { requirementLevel: 'required' })]
  );

  assert.equal(match.score, 100);
  assert.equal(match.requirementMatches[0].verificationLevel, 'verified');
});

test('assignments without evidence cannot affect a score', () => {
  const match = score(
    [assignment('required-verified', { verificationLevel: 'verified', evidence: '   ' })],
    [assignment('required-verified', { requirementLevel: 'required', evidence: null })]
  );

  assert.equal(match.score, 0);
  assert.deepEqual(match.requirementMatches, []);
  assert.deepEqual(match.strengths, []);
});

test('profile claims match exact capability mentions in crawled TOR text without a TOR reviewer assignment', () => {
  const activeTags = new Map([['flutter-tag', { _id: 'flutter-tag', name: 'Flutter', aliases: [] }]]);
  const match = computeCompanyMatch(
    { _id: 'company-1', tagAssignments: [assignment('flutter-tag', { verificationLevel: 'claimed' })] },
    { _id: 'tor-1', title: 'Build a Flutter mobile application', description: 'Public project notice', url: 'https://example.test/tor.pdf' },
    activeTags,
    1
  );

  assert.equal(match.score, 50);
  assert.equal(match.requirementMatches[0].requirementLevel, 'mentioned');
  assert.equal(match.requirementMatches[0].status, 'partial');
  assert.match(match.requirementMatches[0].requirementEvidence, /Announcement title:.*Flutter/u);
  assert.equal(match.requirementMatches[0].requirementSourceUrl, 'https://example.test/tor.pdf');
});
