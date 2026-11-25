# TOR Software Database — Team Handoff

Author: taam

## What Is Ready

- MongoDB Atlas connection and environment configuration
- three ingestion collections with string project identities, validation rules, and unique indexes
- separate application collections for authentication, profiles, tags, and AI
- controlled TOR and company profile tagging with aliases and review metadata
- schema and indexes ready for live ingestion
- optional non-RSS demo seed data
- department/stage request logs and completeness
- optional legacy staging and version collections outside the crawler flow
- repositories in the Express backend for database access
- Docker services for the backend and crawler

## Responsibility Boundary

The database owner maintains the schema, validators, indexes, safe sample data, cleanup tools, and this documentation.

The backend/authentication developer owns HTTP routes, password hashing, token generation, login behavior, email delivery, and frontend integration. Application code must follow the field names and allowed values documented here and in `schema.md`.

## Teammate Setup

1. Extract the handoff ZIP into a new folder.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Ask the database owner to create or approve a separate Atlas database user. Do not reuse another person's password.
5. Put that user's Atlas URI in `MONGODB_URI` inside `.env`.
6. Keep `MONGODB_DB_NAME` set to the approved database.
7. Run `npm run db:check`.
8. For existing data, preview and apply `db:migrate` with a backup as described in the README, then run `npm run db:setup`.
9. Run `npm run db:seed` for non-RSS application sample data only.
10. Run `npm run db:verify`.

Do not run `db:setup` against a database unless the team intends to create or update its validators and indexes.

## Authentication Contract

### `users`

- Store `emailNormalized` in lowercase for unique lookup.
- Store only `passwordHash`; never store a plain password.
- Allowed `status` values: `pending_verification`, `active`, `suspended`, `disabled`.
- Allowed `role` values: `company_admin`, `company_member`, `project_manager`, `system_admin`.
- `notificationPreferences.channels` contains `in_app` and/or `email`.
- `notificationPreferences.alertTypes` contains `new_match`, `tor_updated`, and/or `deadline_reminder`.
- `notificationPreferences.deadlineReminderDays` is an optional integer from 1–30.
- Use `deletedAt` for soft deletion instead of immediately removing the user.

### `auth_tokens`

- Allowed `type` values: `email_verification`, `password_reset`, `company_invitation`.
- Store only `tokenHash`; the usable token belongs only in the link sent to the user.
- Set `expiresAt` so MongoDB can automatically remove expired records.
- Set `usedAt` or `revokedAt` when a token must no longer work.

### `sessions`

- Store only a hashed refresh token.
- Allowed `status` values: `active`, `revoked`.
- Set `expiresAt` and revoke sessions after password changes when required.

### `audit_logs`

Record important events such as registration, email verification, login success/failure, password reset, status changes, and role changes. Never place passwords or raw tokens in audit metadata.

Set `expiresAt` only when the team has approved a retention date. Omit it for records that must not expire automatically.

## TOR and Crawler Contract

- The final workflow writes only `tor_announcements`, `thumbnails`, and `ingestion_runs`.
- Upsert projects and thumbnails by string `projectId`. Keep department IDs with leading zeros intact.
- Keep plan IDs separate from numeric project IDs, even when `linkedProjectId` links them.
- Retain raw template/document identifiers in `itemParams`; omit top-level `templateId`, `projectKey`, and `announcementType` from projects.
- Preserve `firstSeenAt`; refresh `lastSeenAt` on ingestion.
- Keep the latest observation per stage, not a full event history. Latest-date ties use `multiple_announcements_same_day` and `statusOrderAmbiguous: true`; display each tied stage separately.
- Omit all 13 retired enrichment fields listed in `schema.md`. Do not write nulls, empty arrays, or default objects for them; the API, migration, and revised validator enforce their removal.
- Keep `biddingOpenVerified: false` until there is independent verification.
- Omit `locationFilter` entirely. Coverage is nationwide; the software/IT title filter still applies. Keep external opend enrichment disabled.
- Log department/stage requests with raw feed counts, keyword matched/rejected outcomes, and completeness. `announcementType` is allowed request metadata in these logs.
- The workflow does not migrate documents or create indexes. The database owner runs the backup-first migration and then setup/verification.
- Serve thumbnails through `/api/thumbnail/:projectId` only when their `sourceUrl` matches the project's current `documentUrl`.
- Frontend projects and thumbnails refresh independently so a later image can appear after the project.

## AI and Notification Queue Contract

- Initialize AI evaluations with `retryCount: 0` and set `nextAttemptAt` when the job is ready.
- Update `lastAttemptAt` after every AI attempt and store a structured `lastError` after failures.
- Initialize notifications with `attemptCount: 0`, `nextAttemptAt`, and `deliveryError: null`.
- Store notification delivery failures as `deliveryError.code`, `deliveryError.message`, and `deliveryError.lastAttemptAt`.
- Query ready work using `status + nextAttemptAt`; do not scan the complete collection.

## Tagging Contract

- Canonical tag fields are `text`, `category`, and required `type`. Current types
  are `contractor_requirement` and `specification`; extend the vocabulary when
  adding future types. `name` is retained for compatibility.
- `requirementLevel` is a TOR-to-tag assignment field, never a canonical tag field.
- No additional MongoDB validation is imposed by this change. Tags/assignments
  may omit other optional metadata; do not insert guessed placeholder values.
- Run `npm run db:sync-tag-metadata` for a preview; append `-- --apply` to backfill
  the six known catalog entries. The command backs up changed tags and leaves
  existing validators and TOR/company assignments untouched.

- Use only active records from `tags`; do not save arbitrary free-text tags on TORs or companies.
- Normalize aliases to their canonical `tagId` before assigning them.
- TOR tags use `required`, `preferred`, or `informational` requirement levels.
- Company tags use `claimed`, `experienced`, or `verified` verification levels.
- Keep AI/crawler suggestions as `suggested` until a permitted user approves them.
- Never delete a tag that is referenced by records; set its status to `inactive`.

## Environment Safety

| Environment | Database | Purpose |
| --- | --- | --- |
| Shared class/demo | `tor_software` | Stable data used by the team and presentation demo |
| Approved database | Value of `MONGODB_DB_NAME` | Live database for approved ingestion |

## Commands

| Command | Purpose |
| --- | --- |
| `npm run handoff:verify` | Verify that the shareable package contains required safe files |
| `npm run db:check` | Confirm Atlas connectivity |
| `npm run db:setup` | Create or update validators and indexes |
| `npm run db:migrate` | Preview project identity migration; apply explicitly with a backup |
| `npm run db:verify-enrichment-removed` | Read-only field absence check across all projects |
| `npm run db:verify` | Check collections, validators, and indexes without deleting data |
| `npm run db:seed` | Seed sources, organizations, companies, users, and audit data only |

## Files to Share

- `README.md`
- `.env.example`
- `.gitignore`
- `package.json` and `package-lock.json`
- `docs/`
- `scripts/`
- `tests/`

Never share `.env`, `node_modules/`, personal Atlas passwords, raw access tokens, or a ZIP containing those files.

## Acceptance Checklist

- `npm run handoff:verify` passes.
- `npm run db:check` connects using the teammate's own credentials.
- `npm run db:verify` passes, including both full unique `projectId` indexes and the three ingestion schemas.
- Authentication code uses hashes and the documented status values.
- AI and notification workers use the documented retry fields and ready-work indexes.
- Ingestion writes only to the approved database configured by `MONGODB_DB_NAME`.
- The frontend/backend developer can identify the collection for every product feature using `schema.md`.
