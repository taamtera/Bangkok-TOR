import test from 'node:test';
import assert from 'node:assert/strict';
import { detectTorTextTagMentions } from '../src/services/tor-text-matching.mjs';

const tags = [
  { _id: 'gis', name: 'GIS', aliases: [] },
  { _id: 'iso', name: 'ISO/IEC 27001', aliases: ['ISO 27001'] },
  { _id: 'react', name: 'React', aliases: [] },
  { _id: 'system', name: 'system', aliases: [] },
  { _id: 'hospital-system', name: 'hospital system', aliases: [] }
];

test('detects exact source text and aliases and returns a cited excerpt', () => {
  const tor = {
    title: 'GIS platform and hospital system procurement',
    description: 'ระบบนี้กำหนดมาตรฐาน ISO 27001',
    documentUrl: 'https://procurement.example/tor.pdf'
  };

  const mentions = detectTorTextTagMentions(tor, tags);

  assert.deepEqual(mentions.map(({ tagId }) => tagId), ['gis', 'iso', 'hospital-system']);
  assert.equal(mentions[0].requirementLevel, 'mentioned');
  assert.equal(mentions[0].reviewStatus, 'auto_detected');
  assert.equal(mentions[0].sourceDocumentUrl, tor.documentUrl);
  assert.match(mentions[0].evidence, /GIS platform/u);
  assert.match(mentions[1].evidence, /ISO 27001/u);
});

test('does not match partial Latin words or generic single-word catalog terms', () => {
  const mentions = detectTorTextTagMentions({ title: 'Reaction system design' }, tags);
  assert.deepEqual(mentions, []);
});
