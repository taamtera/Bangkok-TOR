import { httpError } from '../utils/http-error.mjs';

// Lightweight hand-rolled validation (keeps the backend dependency-free).
// Each validator returns a cleaned value object or throws VALIDATION_ERROR.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function invalid(message) {
  return httpError(400, 'VALIDATION_ERROR', message);
}

function requireString(value, label, { min = 1, max = 200 } = {}) {
  if (typeof value !== 'string') {
    throw invalid(`${label} is required.`);
  }

  const trimmed = value.trim();

  if (trimmed.length < min) {
    throw invalid(min > 1 ? `${label} must be at least ${min} characters.` : `${label} is required.`);
  }

  if (trimmed.length > max) {
    throw invalid(`${label} must be at most ${max} characters.`);
  }

  return trimmed;
}

function requireEmail(value) {
  const email = requireString(value, 'Email address', { max: 254 });

  if (!EMAIL_PATTERN.test(email)) {
    throw invalid('Email address is invalid.');
  }

  return email;
}

function requirePassword(value) {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
    throw invalid(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  if (value.length > MAX_PASSWORD_LENGTH) {
    throw invalid(`Password must be at most ${MAX_PASSWORD_LENGTH} characters.`);
  }

  return value;
}

function optionalString(value, label, { min = 1, max = 200 } = {}) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return requireString(value, label, { min, max });
}

export function validateRegister(body = {}) {
  const firstName = requireString(body.firstName, 'First name', { max: 80 });
  const lastName = requireString(body.lastName, 'Last name', { max: 80 });
  const email = requireEmail(body.email);
  const password = requirePassword(body.password);
  const phone = optionalString(body.phone, 'Phone number', { max: 32 });
  const jobTitle = optionalString(body.jobTitle, 'Job title', { max: 120 });

  if (body.termsAccepted !== true) {
    throw invalid('You must accept the terms to register.');
  }

  const company = body.company ?? {};
  const mode = company.mode === 'join' ? 'join' : 'create';

  if (mode === 'join') {
    const invitationToken = requireString(company.invitationToken, 'Company invitation token', { max: 256 });
    return {
      firstName,
      lastName,
      email,
      password,
      phone,
      jobTitle,
      company: { mode, invitationToken }
    };
  }

  const legalName = requireString(company.legalName, 'Company legal name', { min: 2, max: 200 });

  return {
    firstName,
    lastName,
    email,
    password,
    phone,
    jobTitle,
    company: {
      mode,
      legalName,
      displayName: optionalString(company.displayName, 'Company display name', { min: 2, max: 200 }),
      taxId: optionalString(company.taxId, 'Tax ID', { max: 32 }),
      companySize: optionalString(company.companySize, 'Company size', { max: 80 }),
      district: optionalString(company.district, 'District', { max: 120 })
    }
  };
}

export function validateLogin(body = {}) {
  return {
    email: requireEmail(body.email),
    password: requireString(body.password, 'Password', { max: MAX_PASSWORD_LENGTH })
  };
}

export function validateEmailOnly(body = {}) {
  return { email: requireEmail(body.email) };
}

export function validateResetPassword(body = {}) {
  return {
    token: requireString(body.token, 'Token', { max: 256 }),
    password: requirePassword(body.password)
  };
}
