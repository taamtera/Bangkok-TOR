import { httpError } from '../utils/http-error.mjs';
import { normalizeTorDocuments } from '../models/tor-document.mjs';

const TOR_STATUSES = ['procurement_planned', 'reference_price_published', 'draft_tender_published', 'invitation_published', 'award_published', 'invitation_cancelled', 'award_cancelled', 'invitation_amended', 'award_amended', 'multiple_announcements_same_day'];
const UPDATE_FIELDS = [
  'title',
  'description',
  'summary',
  'category',
  'departmentName',
  'publishedAt',
  'submissionDeadline',
  'projectStartAt',
  'projectEndAt',
  'sourceUrl',
  'url',
  'documentUrl',
  'thumbnail',
  'status',
  'budget',
  'documents'
];

function invalid(message) {
  throw httpError(400, 'INVALID_TOR_INPUT', message);
}

function optionalText(value, fieldName) {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    invalid(`${fieldName} must be text or null.`);
  }
  return value.trim();
}

function optionalDate(value, fieldName) {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    invalid(`${fieldName} must be a valid ISO date or null.`);
  }
  return new Date(value);
}

function validateBudget(value) {
  if (value === null) {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid('budget must be an object or null.');
  }

  const allowedFields = ['minAmount', 'maxAmount', 'currency', 'sourceText'];
  const unknownField = Object.keys(value).find((field) => !allowedFields.includes(field));
  if (unknownField) {
    invalid(`budget.${unknownField} cannot be updated.`);
  }

  const budget = {};
  for (const field of allowedFields) {
    if (value[field] === undefined) {
      continue;
    }
    if (['minAmount', 'maxAmount'].includes(field)) {
      if (value[field] === null) { budget[field] = null; continue; }
      if (typeof value[field] !== 'number' || !Number.isFinite(value[field]) || value[field] < 0) {
        invalid(`budget.${field} must be a non-negative number.`);
      }
      budget[field] = value[field];
      continue;
    }
    budget[field] = optionalText(value[field], `budget.${field}`);
  }
  if (budget.minAmount != null && budget.maxAmount != null && budget.minAmount > budget.maxAmount) invalid('budget.minAmount must not exceed budget.maxAmount.');
  return budget;
}

export function validateTorUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    invalid('The request body must be an object.');
  }

  const unknownField = Object.keys(body).find((field) => !UPDATE_FIELDS.includes(field));
  if (unknownField) {
    invalid(`${unknownField} cannot be updated.`);
  }
  if (Object.keys(body).length === 0) {
    invalid('At least one TOR field is required.');
  }

  const update = {};
  for (const field of ['title', 'description', 'summary', 'category', 'departmentName', 'sourceUrl', 'url', 'documentUrl', 'thumbnail']) {
    if (body[field] !== undefined) {
      update[field] = optionalText(body[field], field);
    }
  }
  if (body.publishedAt !== undefined) {
    if (typeof body.publishedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.publishedAt) || Number.isNaN(Date.parse(body.publishedAt)) || new Date(body.publishedAt).toISOString().slice(0, 10) !== body.publishedAt) invalid('publishedAt must be YYYY-MM-DD.');
    update.publishedAt = body.publishedAt;
  }
  for (const field of ['submissionDeadline', 'projectStartAt', 'projectEndAt']) {
    if (body[field] !== undefined) {
      update[field] = optionalDate(body[field], field);
    }
  }
  if (body.status !== undefined) {
    if (!TOR_STATUSES.includes(body.status)) {
      invalid('status is invalid.');
    }
    update.status = body.status;
  }
  if (body.budget !== undefined) {
    update.budget = validateBudget(body.budget);
  }
  if (body.documents !== undefined) {
    if (!Array.isArray(body.documents)) invalid('documents must be an array.');
    for (const document of body.documents) {
      if (!document || typeof document !== 'object' || Array.isArray(document)) invalid('Each document must be an object.');
      if (document.filename != null && typeof document.filename !== 'string') invalid('documents.filename must be text or null.');
      for (const field of ['sourceFormat', 'extractionStatus', 'extractedText']) {
        if (document[field] !== undefined && typeof document[field] !== 'string') invalid(`documents.${field} must be text.`);
      }
      if (document.pages != null && !Array.isArray(document.pages)
        && !(Number.isSafeInteger(document.pages) && document.pages >= 0)) invalid('documents.pages must be a non-negative page count, an extractor page array, or null.');
    }
    // Preserve full text, whitespace, empty extraction results, and extra attachment metadata.
    // The repository uses $set, replacing this project's entire grouped array.
    update.documents = normalizeTorDocuments(body.documents);
  }

  return update;
}
