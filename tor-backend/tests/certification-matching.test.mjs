import test from 'node:test';
import assert from 'node:assert/strict';
import { companyInput } from '../src/services/requirement-matching.service.mjs';
import { runPythonMatching } from '../src/services/python-matching.mjs';

const requirement = { key: 'security', text: 'ISO 27001 information security certification',
  importance: 'required', clauses: [{ anyOf: ['iso-27001'] }], sourceType: 'stored_tag_requirement' };
async function match(certifications) {
  return (await runPythonMatching({ companies: [companyInput({ _id: 'company', certifications })],
    activeTags: [], tors: [{ _id: 'tor', matchingVersion: 1, matchingRequirements: [requirement] }] })).items[0];
}
test('certifications reach the worker and remain self-reported evidence', async () => {
  const result = await match(['ISO/IEC 27001']);
  assert.equal(result.score, 100);
  assert.equal(result.evidenceScore, 50);
  assert.equal(result.requirementMatches[0].verificationLevel, 'claimed');
  assert.equal(result.companyCapabilities[0].field, 'certifications');
});
test('absent, misspelled and negative certification claims do not satisfy a requirement', async () => {
  for (const values of [undefined, [], ['ISO 270001'], ['Not ISO 27001 certified']]) {
    assert.equal((await match(values)).score, 0);
  }
});
test('duplicate certificates do not inflate coverage or evidence', async () => {
  const result = await match(['ISO 27001', 'ISO/IEC 27001']);
  assert.equal(result.score, 100);
  assert.equal(result.evidenceScore, 50);
  assert.equal(result.companyCapabilities.length, 1);
});
