import { httpError } from '../utils/http-error.mjs';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalid(message) {
  throw httpError(400, 'INVALID_COMPANY_PROFILE', message);
}

function requiredText(value, label, { min = 1, max = 200 } = {}) {
  if (typeof value !== 'string') invalid(`${label} must be text.`);
  const text = value.trim();
  if (text.length < min) invalid(`${label} is required.`);
  if (text.length > max) invalid(`${label} must be at most ${max} characters.`);
  return text;
}

function optionalText(value, label, max) {
  if (value === null || value === undefined || value === '') return '';
  return requiredText(value, label, { max });
}

function textList(value, label, maxItems, maxLength) {
  if (!Array.isArray(value) || value.length > maxItems) {
    invalid(`${label} must be a list with no more than ${maxItems} items.`);
  }
  const cleaned = value.map((item, index) => requiredText(item, `${label}[${index}]`, { max: maxLength }));
  const seen = new Set();
  return cleaned.filter((item) => {
    const key = item.toLocaleLowerCase('en-US');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tagLinks(value) {
  if (!Array.isArray(value) || value.length > 50) invalid('tags must be a list with no more than 50 catalog links.');
  const seen = new Set();
  return value.map((link) => {
    if (!link || typeof link !== 'object' || Array.isArray(link)
      || Object.keys(link).some((key) => key !== 'tagId')
      || typeof link.tagId !== 'string' || !/^[a-f\d]{24}$/i.test(link.tagId)) {
      invalid('Each profile tag must contain only a valid catalog tagId.');
    }
    return { tagId: link.tagId.toLowerCase() };
  }).filter(({ tagId }) => {
    if (seen.has(tagId)) return false;
    seen.add(tagId);
    return true;
  });
}

export function validateCompanyProfile(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    invalid('A company profile object is required.');
  }

  const allowed = new Set(['displayName', 'description', 'certifications', 'companySize', 'district', 'contactEmail', 'technologies', 'qualifications', 'tags']);
  const unsupported = Object.keys(body).find((field) => !allowed.has(field));
  if (unsupported) invalid(`Unsupported company profile field: ${unsupported}.`);

  const displayName = requiredText(body.displayName, 'Company name', { min: 2, max: 200 });
  const companySize = optionalText(body.companySize, 'Company size', 80) || 'Not specified';
  const district = optionalText(body.district, 'Office location', 120);
  const contactEmail = optionalText(body.contactEmail, 'Primary contact email', 254);
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) invalid('Primary contact email is invalid.');
  let description;
  if (Object.hasOwn(body, 'description')) {
    if (body.description != null && (typeof body.description !== 'string' || body.description.length > 2000)) {
      invalid('Company description must be text of at most 2000 characters.');
    }
    description = body.description?.trim() || '';
  }

  return {
    displayName,
    ...(description !== undefined ? { description } : {}),
    ...(Object.hasOwn(body, 'certifications') ? { certifications: textList(body.certifications, 'Certifications', 100, 200) } : {}),
    companySize,
    district: district || null,
    contactEmail: contactEmail || null,
    technologies: textList(body.technologies, 'Technologies', 50, 100),
    qualifications: textList(body.qualifications, 'Qualifications', 100, 200),
    ...(Object.hasOwn(body, 'tags') ? { tags: tagLinks(body.tags) } : {})
  };
}
