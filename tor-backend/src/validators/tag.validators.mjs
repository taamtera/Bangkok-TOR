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

    return {
      tagId,
      [levelField]: assignment[levelField],
      evidence: optionalString(assignment.evidence, `assignments[${index}].evidence`)
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

  const aliases = input.aliases ?? [];
  if (!Array.isArray(aliases) || aliases.length > 20 || aliases.some((alias) => typeof alias !== 'string')) {
    invalid('aliases must be an array containing no more than 20 text values.');
  }

  return {
    name,
    type,
    category,
    aliases,
    description: optionalString(input.description, 'description')
  };
}

export function validateTorTagAssignments(body) {
  return validateAssignments(body, 'requirementLevel', TOR_REQUIREMENT_LEVELS);
}

export function validateCompanyTagAssignments(body) {
  return validateAssignments(body, 'verificationLevel', COMPANY_VERIFICATION_LEVELS);
}
