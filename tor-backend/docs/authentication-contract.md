# Authentication and Registration Contract

This document is the agreed boundary between the database/backend foundation and the teammate implementing authentication and its frontend.

## Registration Request

`POST /api/auth/register`

```json
{
  "firstName": "Somchai",
  "lastName": "Jaidee",
  "email": "somchai@example.com",
  "password": "user-entered password",
  "phone": null,
  "jobTitle": "Company Administrator",
  "company": {
    "mode": "create",
    "legalName": "TechBangkok Solutions Co., Ltd.",
    "displayName": "TechBangkok Solutions",
    "companySize": "25-50 Employees",
    "district": "Chatuchak"
  },
  "termsAccepted": true
}
```

Company legal names and non-empty display names must contain at least 2 characters after trimming, matching the database validator. Omitted company size is stored as `Not specified`. Invalid names return HTTP 400 with `VALIDATION_ERROR` before any account or company is created.

When `company.mode` is `create`, the first user becomes `company_admin` and the company starts as `unverified`. Joining an existing company must use a valid company invitation token instead of accepting an arbitrary `companyId` from the browser.

The backend normalizes email addresses, hashes the password, creates the company and user, activates the account immediately, records registration, and issues HTTP-only access/refresh cookies. Email verification is disabled. Company ownership uses `ownerUserId` and `memberUserIds`; user membership uses `users.companyId`.

## Safe User Response

```json
{
  "id": "MongoDB ObjectId as a string",
  "email": "somchai@example.com",
  "profile": {
    "firstName": "Somchai",
    "lastName": "Jaidee",
    "phone": null,
    "avatarUrl": null,
    "jobTitle": "Company Administrator"
  },
  "companyId": "MongoDB ObjectId as a string",
  "role": "company_admin",
  "status": "active",
  "emailVerifiedAt": null
}
```

Never return `passwordHash`, token hashes, failed-login counters, lock details, or database credentials to the frontend.

## Account States

| Current state | Event | New state |
| --- | --- | --- |
| New registration | User record created | `pending_verification` |
| `pending_verification` | Email token accepted | `active` |
| `active` | Administrator temporarily blocks account | `suspended` |
| `suspended` | Administrator restores account | `active` |
| Any non-deleted state | Account permanently closed | `disabled` |

Company verification is independent of user status. A user may be active while their company remains `unverified` or `pending`.

## Roles

| Role | Intended permission |
| --- | --- |
| `company_admin` | Manage company profile, members, saved TORs, and company recommendations |
| `company_member` | View company recommendations and work with permitted TOR records |
| `project_manager` | Review companies, monitor ingestion, and manage operational data |
| `system_admin` | System configuration and emergency administration |

The frontend may hide unavailable actions, but Express must enforce every permission again on the server.

## Authentication Endpoints

| Method and path | Purpose |
| --- | --- |
| `POST /api/auth/register` | Register user and create or join a company |
| `POST /api/auth/login` | Verify credentials and create a session |
| `POST /api/auth/refresh` | Rotate the refresh session and access token |
| `POST /api/auth/logout` | Revoke the current session and clear cookies |
| `POST /api/auth/logout-all` | Revoke every session belonging to the user |
| `POST /api/auth/forgot-password` | Create and email a password-reset token |
| `POST /api/auth/reset-password` | Change the password and revoke all sessions |
| `GET /api/auth/me` | Return the safe current-user response |
| `GET /api/auth/session` | Return the current user, or null when no active session exists |

Forgot-password requests must return the same response whether the email exists or not.

## Recommended Token Policy

| Item | Lifetime | Storage |
| --- | --- | --- |
| Access token | 15 minutes | Secure HTTP-only cookie |
| Refresh session | 7 days | Raw value in HTTP-only cookie; hash in `sessions` |
| Email-verification token | 24 hours | Raw value in email; hash in `auth_tokens` |
| Password-reset token | 30 minutes | Raw value in email; hash in `auth_tokens` |
| Company invitation | 72 hours | Raw value in email; hash in `auth_tokens` |

Use cookie names such as `tor_access` and `tor_refresh`, with `httpOnly`, `secure` in production, and `sameSite=lax`. Password reset, account suspension, account disabling, and password changes must revoke active sessions.

## Error Response

Every authentication error should use the shared API shape:

```json
{
  "error": {
    "code": "EMAIL_ALREADY_REGISTERED",
    "message": "This email is already registered.",
    "requestId": "request tracking identifier"
  }
}
```

Expected codes include `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, and `FORBIDDEN`.

## Responsibility Split

### Database/backend foundation owner

- Atlas connection, validation rules, indexes, and collection design
- Shared Express configuration and database repositories
- TOR, company, recommendation, saved-TOR, and notification data access
- Database documentation, backup planning, and query performance

### Authentication teammate

- Request validation and password hashing
- Access-token creation and verification
- Refresh-token rotation using the session repository
- Verification, invitation, and password-reset email delivery
- Authentication controllers, middleware, and frontend forms
- Authentication tests

### Shared review

- Registration response and error messages
- Role permissions and status transitions
- Cookie names and frontend URL configuration
- Acceptance tests for registration, login, reset, logout, and suspended accounts


Protected routes verify the signed access cookie, active database session, and active user record. Roles and company membership come from the current user record, so revocation and suspension take effect immediately.
