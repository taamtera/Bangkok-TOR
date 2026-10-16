import { httpError } from '../utils/http-error.mjs';

export const TAG_CATEGORIES = ['technology', 'skill', 'certification', 'industry', 'project_type', 'capability', 'requirement'];
const TOR_REQUIREMENT_LEVELS = ['required', 'preferred', 'informational'];
const COMPANY_VERIFICATION_LEVELS = ['claimed', 'experienced', 'verified'];

function invalid(message) {
  throw httpError(400, 'INVALID_TAG_INPUT', message);
}

function requiredString(value, fieldName, minimumLength = 1) {
  if (typeof value !== 'string' || value.trim().length < minimumLength) {
    invalid(`${fieldName} is required.`);
  }
  return value.trim();
}

function optionalString(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    invalid(`${fieldName} must be text.`);
  }
  return value.trim();
}

function contractorLabel(value) {
  const label = optionalString(value, 'contractorLabel');
  if (label && label.length > 200) invalid('contractorLabel must be 200 characters or fewer.');
  return label || null;
}

function validateAliases(value) {
  if (!Array.isArray(value) || value.length > 20 || value.some((alias) => typeof alias !== 'string')) {
    invalid('aliases must be an array containing no more than 20 text values.');
  }

  const aliases = value.map((alias) => alias.trim()).filter(Boolean);
  return [...new Map(aliases.map((alias) => [alias.toLocaleLowerCase('en-US'), alias])).values()];
}

function validateAssignments(body, levelField, allowedLevels) {
  if (!body || !Array.isArray(body.assignments) || body.assignments.length > 50) {
    invalid('assignments must be an array containing no more than 50 tags.');
  }

  const seenTagIds = new Set();
  return body.assignments.map((assignment, index) => {
    if (!assignment || typeof assignment !== 'object' || Array.isArray(assignment)) {
      invalid(`assignments[${index}] must be an object.`);
    }

    const tagId = requiredString(assignment.tagId, `assignments[${index}].tagId`);
    if (seenTagIds.has(tagId)) {
      invalid('The same tag cannot be assigned more than once.');
    }
    seenTagIds.add(tagId);

    if (!allowedLevels.includes(assignment[levelField])) {
      invalid(`assignments[${index}].${levelField} is invalid.`);
    }

    const evidence = requiredString(assignment.evidence, `assignments[${index}].evidence`);
    if (evidence.length > 2000) {
      invalid(`assignments[${index}].evidence must be 2000 characters or fewer.`);
    }

    return {
      tagId,
      [levelField]: assignment[levelField],
      evidence
    };
  });
}

export function validateCreateTag(body) {
  const input = body ?? {};
  const name = requiredString(input.text ?? input.name, 'text', 2);
  const category = requiredString(input.category, 'category');
  const type = requiredString(input.type, 'type');
  if (!TAG_CATEGORIES.includes(category)) {
    invalid('category is invalid.');
  }

  return {
    name,
    type,
    category,
    contractorLabel: contractorLabel(input.contractorLabel),
    aliases: validateAliases(input.aliases ?? []),
    description: optionalString(input.description, 'description')
  };
}

export function validateUpdateTag(body) {
  const input = body ?? {};
  const allowedFields = new Set(['name', 'text', 'category', 'type', 'contractorLabel', 'aliases', 'description', 'status']);
  const unknownFields = Object.keys(input).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    invalid(`Unsupported tag field: ${unknownFields[0]}.`);
  }
  if (Object.keys(input).length === 0) {
    invalid('At least one tag field must be provided.');
  }

  const update = {};
  if (Object.hasOwn(input, 'text') || Object.hasOwn(input, 'name')) {
    update.name = requiredString(input.text ?? input.name, 'text', 2);
    if (Object.hasOwn(input, 'text') && Object.hasOwn(input, 'name') && input.name !== input.text) {
      invalid('text and name must match when both are supplied.');
    }
  }
  if (Object.hasOwn(input, 'type')) {
    update.type = requiredString(input.type, 'type');
  }
  if (Object.hasOwn(input, 'contractorLabel')) {
    update.contractorLabel = contractorLabel(input.contractorLabel);
  }
  if (Object.hasOwn(input, 'category')) {
    update.category = requiredString(input.category, 'category');
    if (!TAG_CATEGORIES.includes(update.category)) invalid('category is invalid.');
  }
  if (Object.hasOwn(input, 'aliases')) {
    update.aliases = validateAliases(input.aliases);
  }
  if (Object.hasOwn(input, 'description')) {
    update.description = optionalString(input.description, 'description');
  }
  if (Object.hasOwn(input, 'status')) {
    if (!['active', 'inactive'].includes(input.status)) invalid('status must be active or inactive.');
    update.status = input.status;
  }

  return update;
}

export function validateTorTagAssignments(body) {
  return validateAssignments(body, 'requirementLevel', TOR_REQUIREMENT_LEVELS);
}

export function validateTorTagSuggestions(body) {
  if (!body || !Array.isArray(body.suggestions) || body.suggestions.length > 50) {
    invalid('suggestions must be a list containing no more than 50 requirements.');
  }

  const seen = new Set();
  return body.suggestions.map((suggestion, index) => {
    if (!suggestion || typeof suggestion !== 'object' || Array.isArray(suggestion)) {
      invalid(`suggestions[${index}] must be an object.`);
    }
    const tagId = requiredString(suggestion.tagId, `suggestions[${index}].tagId`);
    const requirementLevel = suggestion.requirementLevel;
    if (!TOR_REQUIREMENT_LEVELS.includes(requirementLevel)) {
      invalid(`suggestions[${index}].requirementLevel is invalid.`);
    }
    const evidence = requiredString(suggestion.evidence, `suggestions[${index}].evidence`);
    if (evidence.length > 2000) invalid(`suggestions[${index}].evidence must be 2000 characters or fewer.`);
    const sourceDocumentUrl = requiredString(suggestion.sourceDocumentUrl, `suggestions[${index}].sourceDocumentUrl`);
    let parsedUrl;
    try { parsedUrl = new URL(sourceDocumentUrl); } catch { invalid(`suggestions[${index}].sourceDocumentUrl must be a valid HTTP or HTTPS URL.`); }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) invalid(`suggestions[${index}].sourceDocumentUrl must use HTTP or HTTPS.`);
    const sourcePage = suggestion.sourcePage == null ? null : requiredString(suggestion.sourcePage, `suggestions[${index}].sourcePage`);
    if (sourcePage && sourcePage.length > 100) invalid(`suggestions[${index}].sourcePage must be 100 characters or fewer.`);
    const confidence = suggestion.confidence;
    if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      invalid(`suggestions[${index}].confidence must be between 0 and 1.`);
    }
    const key = tagId;
    if (seen.has(key)) invalid('The same TOR requirement suggestion cannot be included more than once.');
    seen.add(key);
    return { tagId, requirementLevel, evidence, sourceDocumentUrl, sourcePage, confidence };
  });
}

export function validateTorSuggestionReview(body) {
  if (!body || !['approved', 'rejected'].includes(body.reviewStatus)) {
    invalid('reviewStatus must be approved or rejected.');
  }
  return { reviewStatus: body.reviewStatus };
}

export function validateCompanyTagAssignments(body, { allowVerified = false } = {}) {
  if (!allowVerified && Array.isArray(body?.assignments)
    && body.assignments.some(assignment => assignment?.verificationLevel === 'verified')) {
    invalid('Company accounts may report claimed or experienced capabilities; verified status requires an authorized verification process.');
  }
  const allowedLevels = allowVerified
    ? COMPANY_VERIFICATION_LEVELS
    : COMPANY_VERIFICATION_LEVELS.filter(level => level !== 'verified');
  return validateAssignments(body, 'verificationLevel', allowedLevels);
}
