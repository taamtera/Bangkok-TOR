import { httpError } from '../utils/http-error.mjs';
import { normalizeTagName, phraseInText, isFlaggedTagName } from './tag-catalog.mjs';
import { TAG_CATEGORIES } from '../validators/tag.validators.mjs';

function invalid(message, code = 'INVALID_AI_REQUIREMENTS') { throw httpError(422, code, message); }
function text(value, label, max = 2000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) invalid(`${label} must be non-empty text of at most ${max} characters.`);
  return value.trim();
}
export function validateAiRequirements(body, source) {
  if (!body || body.sourceId !== String(source._id) || body.torVersion !== source.torVersion) invalid('The source snapshot or TOR version does not match.', 'AI_SOURCE_MISMATCH');
  const model = Object.fromEntries(['provider', 'name', 'version', 'promptVersion'].map((field) => [field, text(body.model?.[field], `model.${field}`, 150)]));
  if (!Array.isArray(body.requirements) || body.requirements.length > 100) invalid('requirements must be an array of at most 100 entries.');
  const keys = new Set();
  const requirements = body.requirements.map((item, index) => {
    const key = text(item?.key, 'requirement key', 100);
    if (keys.has(key)) invalid('Requirement keys must be unique.'); keys.add(key);
    const requirementText = text(item.text, 'requirement text');
    if (!['required', 'preferred', 'informational'].includes(item.importance)) invalid('Requirement importance is invalid.');
    if (!Number.isFinite(item.confidence) || item.confidence < 0.8 || item.confidence > 1) invalid('Only extraction confidence from 0.8 to 1 can be applied automatically.', 'AI_LOW_CONFIDENCE');
    const page = item.evidence?.page;
    const quote = text(item.evidence?.quote, 'evidence quote');
    const pageText = source.pages.find((entry) => entry.page === page)?.text;
    if (!Number.isInteger(page) || !pageText || normalizeTagName(quote).length < 15
      || !normalizeTagName(pageText).includes(normalizeTagName(quote))) invalid(`Requirement ${index + 1} has no matching quotation on its cited page.`, 'AI_QUOTE_MISMATCH');
    if (!Array.isArray(item.clauses) || !item.clauses.length || item.clauses.length > 20) invalid('Each requirement needs 1–20 AND clauses.');
    const clauses = item.clauses.map((clause) => {
      if (!Array.isArray(clause?.anyOf) || !clause.anyOf.length || clause.anyOf.length > 10) invalid('Each clause needs 1–10 OR alternatives.');
      return { anyOf: clause.anyOf.map((tag) => {
        if (tag?.tagId) return { tagId: text(tag.tagId, 'tagId', 24) };
        const name = text(tag?.name, 'tag name', 120);
        if (name.length < 3 || !TAG_CATEGORIES.includes(tag?.category) || isFlaggedTagName(name)) invalid('A new tag needs a valid name and category.');
        if (!phraseInText(quote, name)) invalid('A new tag name must appear in the cited quotation.', 'AI_TAG_EVIDENCE_MISMATCH');
        return { name, category: tag.category };
      }) };
    });
    return { key, text: requirementText, importance: item.importance, confidence: item.confidence, evidence: { page, quote }, clauses };
  });
  return { model, requirements };
}

export function validateTagEvidence(tag, quote) {
  if (!tag || tag.status !== 'active' || tag.matchingExcluded || isFlaggedTagName(tag.name)) invalid('The selected tag is not active or is flagged.', 'AI_TAG_NOT_AVAILABLE');
  if (![tag.name, ...(tag.aliases || [])].some((name) => phraseInText(quote, name))) invalid(`The quotation does not support tag ${tag.name}.`, 'AI_TAG_EVIDENCE_MISMATCH');
}
