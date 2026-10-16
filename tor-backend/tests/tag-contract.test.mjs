import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCreateTag, validateTorTagAssignments } from '../src/validators/tag.validators.mjs';

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
  const [assignment] = validateTorTagAssignments({ assignments: [{ tagId: '000000000000000000000001', requirementLevel: 'preferred', type: 'specification' }] });
  assert.equal(assignment.requirementLevel, 'preferred');
  assert.equal(Object.hasOwn(assignment, 'type'), false);
});
