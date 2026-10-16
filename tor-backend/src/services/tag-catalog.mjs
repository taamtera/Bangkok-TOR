import { readFileSync } from 'node:fs';

export function normalizeTagName(value) {
  return String(value).normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ');
}
const concepts = JSON.parse(readFileSync(new URL('../../matching/concepts.json', import.meta.url), 'utf8'));
const categories = { 'iso-27001': 'certification', ehr: 'capability', 'large-scale-data': 'capability',
  'hospital-system': 'capability', microservices: 'skill', docker: 'technology', kubernetes: 'technology',
  gis: 'capability', 'web-development': 'capability', backend: 'capability', 'end-to-end': 'capability', 'government-system': 'capability' };
export const coreTags = Object.entries(concepts).map(([conceptKey, value]) => ({
  conceptKey, name: value.name, category: categories[conceptKey], aliases: [...new Set([value.name, ...value.aliases])]
})).concat(['Flutter', 'PostgreSQL', 'MySQL', 'Python', 'C++'].map((name) => ({
  name, category: 'technology', aliases: [name], conceptKey: `catalog:${normalizeTagName(name)}`
})));

export function phraseInText(text, phrase) {
  const term = normalizeTagName(phrase);
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'u').test(normalizeTagName(text));
}
export function coreTagForName(name, { profile = false } = {}) {
  const normalized = normalizeTagName(name);
  if (/\b(?:not|no|without|never)\b/iu.test(normalized)) return null;
  return coreTags.find((tag) => tag.aliases.some((alias) => normalizeTagName(alias) === normalized))
    || (profile ? coreTags.find((tag) => tag.aliases.some((alias) => phraseInText(name, alias))) : null) || null;
}
export function conceptForTag(tag) {
  return tag.conceptKey || coreTagForName(tag.name)?.conceptKey || `catalog:${normalizeTagName(tag.name)}`;
}
export function isFlaggedTagName(name) { return /\biso[\s/-]*(?:iec[\s/-]*)?270001\b/iu.test(name); }

// Remap only tag-reference fields, leaving account IDs, source text and evidence untouched.
export function remapTagReferences(value, mapping, key = '') {
  if (key === 'tagId' && mapping.has(String(value))) return mapping.get(String(value));
  if (['tagIds', 'anyOfTagIds'].includes(key) && Array.isArray(value)) return [...new Map(value.map((id) => {
    const replacement = mapping.get(String(id)) || id; return [String(replacement), replacement];
  })).values()];
  if (Array.isArray(value)) return value.map((entry) => remapTagReferences(entry, mapping));
  if (value && typeof value === 'object' && !value._bsontype && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([field, entry]) => [field, remapTagReferences(entry, mapping, field)]));
  }
  return value;
}
