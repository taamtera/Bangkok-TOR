import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCreateTag, validateUpdateTag, validateTorTagAssignments } from '../src/validators/tag.validators.mjs';
import { serializeTag } from '../src/serializers/tag.serializer.mjs';

test('canonical tag creation requires type and accepts text with legacy name compatibility', () => {
  assert.throws(() => validateCreateTag({ text: 'Node.js', category: 'technology' }), /type is required/);
  const input = validateCreateTag({ text: 'Node.js', category: 'technology', type: 'specification', requirementLevel: 'required' });
  assert.equal(input.name, 'Node.js');
  assert.equal(input.type, 'specification');
  assert.equal(Object.hasOwn(input, 'requirementLevel'), false);
  assert.equal(validateCreateTag({ name: 'ISO 27001', category: 'certification', type: 'contractor_requirement' }).type, 'contractor_requirement');
  // The application contract can introduce future types without a DB migration.
  assert.equal(validateCreateTag({ text: 'Future concept', category: 'capability', type: 'future_type' }).type, 'future_type');
});

test('requirementLevel remains per TOR assignment; canonical type is not copied onto the link', () => {
  const [assignment] = validateTorTagAssignments({ assignments: [{ tagId: '000000000000000000000001', requirementLevel: 'preferred', type: 'specification', evidence: 'Source TOR requires this capability.' }] });
  assert.equal(assignment.requirementLevel, 'preferred');
  assert.equal(Object.hasOwn(assignment, 'type'), false);
});

test('contractor labels are trimmed, optional for older clients, and editable independently', () => {
  const body = { text: 'Internet Service', category: 'technology', type: 'specification', contractorLabel: '  Internet Service Provider  ' };
  assert.equal(validateCreateTag(body).contractorLabel, 'Internet Service Provider');
  assert.equal(validateCreateTag({ ...body, contractorLabel: undefined }).contractorLabel, null);
  assert.deepEqual(validateUpdateTag({ contractorLabel: ' Internet Service Provider ' }), { contractorLabel: 'Internet Service Provider' });
  for (const value of ['', '  ', null]) assert.deepEqual(validateUpdateTag({ contractorLabel: value }), { contractorLabel: null });
  for (const value of [42, {}, [], 'x'.repeat(201)]) {
    assert.throws(() => validateCreateTag({ ...body, contractorLabel: value }), /contractorLabel/);
    assert.throws(() => validateUpdateTag({ contractorLabel: value }), /contractorLabel/);
  }
});

test('catalog responses expose contractorLabel without inventing values or changing identity', () => {
  const tag = { _id: 'existing_tag_id', text: 'Internet Service', category: 'technology', type: 'specification' };
  assert.deepEqual(serializeTag(tag), { ...tag, name: tag.text, contractorLabel: null });
  assert.equal(serializeTag({ ...tag, contractorLabel: 'Internet Service Provider' }).contractorLabel, 'Internet Service Provider');
  assert.equal(serializeTag(null), null);
  assert.equal(Object.hasOwn(tag, 'contractorLabel'), false);
});

test('PATCH accepts the simplified text/type fields and keeps legacy names consistent', () => {
  assert.deepEqual(validateUpdateTag({ text: 'Internet Service', type: 'specification' }), { name: 'Internet Service', type: 'specification' });
  assert.throws(() => validateUpdateTag({ text: 'Internet Service', name: 'Something else' }), /must match/);
});
