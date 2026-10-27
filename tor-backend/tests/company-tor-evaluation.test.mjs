import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildEvaluationInput, validateEvaluationResponse } from '../src/services/company-tor-evaluation.mjs';

const company = { _id: 'company', displayName: 'Example', description: 'Company overview',
  qualifications: [{ name: 'Delivered government projects' }], certifications: ['ISO 9001'],
  tags: [{ tagId: 'tag', text: 'Internet Service', contractorLabel: 'Internet Service Provider' }],
  passwordHash: 'must-not-be-sent', contact: { email: 'private@example.com' } };
const tor = { projectId: '001', title: 'Tender', documents: [{ extractedText: 'x'.repeat(15000) }],
  aiExtractedRequirements: [{ text: 'Provide Internet', requirementLevel: 'required' }] };

test('evaluation payload includes saved source/profile data, marks truncation and excludes private fields', () => {
  const result = buildEvaluationInput(company, tor);
  assert.equal(result.company.description, 'Company overview');
  assert.deepEqual(result.company.certifications, ['ISO 9001']);
  assert.deepEqual(result.company.qualifications, ['Delivered government projects']);
  assert.equal(result.tor.extractedRequirements[0].text, 'Provide Internet');
  assert.equal(result.tor.documents[0].extractedText.length, 12000);
  assert.equal(result.limitations.documentTextTruncated, true);
  assert.equal(result.limitations.budgetAvailable, false);
  assert.doesNotMatch(JSON.stringify(result), /passwordHash|private@example.com/);
  const changed = buildEvaluationInput(company, { ...tor, documents: [{ extractedText: 'x'.repeat(14999) + 'y' }] });
  assert.notEqual(changed.tor.documents[0].documentHash, result.tor.documents[0].documentHash);
});

test('importable n8n flow accepts the backend payload and returns the validated frontend fields', () => {
  const workflow = JSON.parse(readFileSync(new URL('../../n8n-tor-company-evaluation.json', import.meta.url)));
  const build = workflow.nodes.find(node => node.name === 'Build Evaluation Prompt').parameters.jsCode;
  const normalize = workflow.nodes.find(node => node.name === 'Validate Evaluation Response').parameters.jsCode;
  const payload = { ...buildEvaluationInput(company, tor), inputHash: 'a'.repeat(64), requestId: 'request' };
  const prepared = new Function('$json', build)({ body: payload })[0].json;
  assert.match(prepared.requestPrompt, /Company overview/);
  assert.match(prepared.requestPrompt, /Provide Internet/);
  const evaluation = { summary: 'Summary', priceScore: null, priceAssessment: 'Budget unknown', qualificationMatchScore: 70,
    qualificationAnalysis: 'Profile overlap', riskLevel: 'Unknown', riskAnalysis: 'Missing evidence',
    keyRequirementsExtracted: ['Internet'], strengths: [], gaps: [], missingInformation: ['Budget'] };
  const invoke = message => new Function('$json', '$', normalize)({ message, model: 'qwen3.5:9bu' },
    () => ({ first: () => ({ json: prepared }) }))[0].json;
  const response = invoke({ content: JSON.stringify(evaluation) });
  assert.equal(response.statusCode, 200);
  assert.equal(validateEvaluationResponse(response.body, payload.inputHash).priceScore, null);
  assert.equal(invoke({ content: '{bad JSON' }).statusCode, 502);
  assert.throws(() => validateEvaluationResponse(response.body, 'b'.repeat(64)));
  assert.throws(() => validateEvaluationResponse({ ...response.body, evaluation: { ...evaluation, priceScore: 101 } }, payload.inputHash));
});
