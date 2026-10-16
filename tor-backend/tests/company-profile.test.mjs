import test from 'node:test';
import assert from 'node:assert/strict';
import { toCompanyProfile } from '../src/serializers/company.serializer.mjs';
import { validateCompanyProfile } from '../src/validators/company.validators.mjs';
import { companyProfileTagEntries, mergeQualifications } from '../src/utils/company-profile.mjs';

test('company profile validation trims fields, normalizes lists, and keeps empty size compatible with schema', () => {
  assert.deepEqual(validateCompanyProfile({
    displayName: '  Example Software  ',
    companySize: '',
    district: '  Pathum Wan ',
    contactEmail: ' contact@example.com ',
    technologies: [' Docker ', 'docker', 'PostgreSQL'],
    qualifications: [' GIS ', 'ISO 27001']
  }), {
    displayName: 'Example Software',
    companySize: 'Not specified',
    district: 'Pathum Wan',
    contactEmail: 'contact@example.com',
    technologies: ['Docker', 'PostgreSQL'],
    qualifications: ['GIS', 'ISO 27001']
  });
});

test('company profile validation rejects malformed emails, oversized lists, and attempts to edit protected fields', () => {
  const valid = {
    displayName: 'Example Software', companySize: '1-10', district: '', contactEmail: '',
    technologies: [], qualifications: []
  };
  for (const input of [
    { ...valid, contactEmail: 'bad-address' },
    { ...valid, technologies: Array.from({ length: 51 }, (_, index) => `T${index}`) },
    { ...valid, companyId: 'another-company' },
    { ...valid, qualifications: [null] }
  ]) assert.throws(() => validateCompanyProfile(input), { code: 'INVALID_COMPANY_PROFILE' });
});

test('company serialization exposes profile values without leaking tag or ownership fields', () => {
  assert.deepEqual(toCompanyProfile({
    legalName: 'Legal Name', displayName: 'Display Name', companySize: 'Not specified', district: null,
    contact: { email: 'contact@example.com', phone: 'private' },
    technologies: ['Docker'], qualifications: [{ code: 'ISO', category: 'certification' }],
    tagAssignments: [{ tagId: 'internal' }], ownerUserId: 'internal'
  }), {
    displayName: 'Display Name', companySize: '', district: '', contactEmail: 'contact@example.com',
    technologies: ['Docker'], qualifications: ['ISO']
  });
});

test('qualification updates retain existing evidence and do not mark new text as verified', () => {
  const previous = [{ name: 'GIS', category: 'capability', evidenceUrl: 'https://example.test/evidence', verified: true }];
  assert.deepEqual(mergeQualifications(previous, ['gis', 'Hospital systems']), [
    { name: 'gis', category: 'capability', evidenceUrl: 'https://example.test/evidence', verified: true },
    { name: 'Hospital systems', category: 'capability' }
  ]);
});

test('profile technologies and qualifications become exact, self-reported tag entries', () => {
  assert.deepEqual(companyProfileTagEntries([' Docker ', 'docker', 'PostgreSQL'], ['GIS', { name: 'ISO 27001' }, '']), [
    { name: 'Docker', category: 'technology', evidence: 'Self-reported company profile technology: Docker' },
    { name: 'PostgreSQL', category: 'technology', evidence: 'Self-reported company profile technology: PostgreSQL' },
    { name: 'GIS', category: 'capability', evidence: 'Self-reported company profile qualification: GIS' },
    { name: 'ISO 27001', category: 'capability', evidence: 'Self-reported company profile qualification: ISO 27001' }
  ]);
});
