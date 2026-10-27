# Backend and database compatibility audit

Checked on 2026-10-27 against the schema documentation and live metadata in
`bangkok_tor_db`. Source data was inspected read-only. Route write tests used
generated disposable databases with copied validators and unique indexes.

## Fixes

- Catalog APIs, profile synchronization and AI ingestion use canonical
  `text`, `category`, `type` records and the `category + text` unique key.
  Simplified tags without legacy metadata can be searched, reused and scored.
  `name` remains a client compatibility alias. New writes no longer generate
  `slug` or `normalizedName`; renamed tags are checked for duplicates.
- New companies store `ownerUserId` and `memberUserIds`, matching the schema.
- Protected APIs require an active user and database session. Current roles and
  company membership are read from the user document. Logout/revocation takes
  effect immediately even if the access cookie has not expired.
- Budget bounds use the same effective amount as the UI (`maxAmount`, falling
  back to `minAmount`). Invalid pagination, dates and budget ranges return 400.
- TOR review stage does not gate display or matching. Duplicate annotations of
  the same tag count once, using the strongest requirement level.
- Matching responses resolve tag labels and omit internal prepared-input fields.
- Database error numbers are no longer returned as public API error codes.
- The existing frontend tag creation request now includes the required `type`.

## Database alignment applied

The backed-up, idempotent `schema:apply` command removed the obsolete required
`recommendation` field from `company_matches` and added the unique source snapshot
index. It preserved all records and other validators. A subsequent `schema:check`
reported no pending changes. The catalog still has its canonical unique index.

## Removed obsolete code

Removed the policy-2 JavaScript scoring engine, compatibility facade, unused title
mention heuristic, their retired tests, test-only catalog merge/matching migrations,
Docker-specific verification script, and unused repository functions for retired
email verification, token revocation and legacy matching reads. Current policy-3
Python tests replace the retired scoring tests. Verification no longer requires
the old demonstration user or a particular database name.

## Verification and limits

- `npm run check`: 67 backend modules pass syntax validation.
- `npm test`: 57 checks pass; four opt-in database checks are skipped by default.
- `npm run test:db`: registration and full database-backed API checks pass.
  Covers catalog creation/reuse and duplicate protection, discovery, AI ingestion/idempotency, profiles, matching,
  notification creation, current-role authorization and logout/session invalidation.
- Python policy-3 suite: 21 checks pass.
- Frontend TypeScript check passes.
- Live health, discovery, catalog, TOR detail and anonymous session checks pass;
  invalid filters return 400 and protected endpoints reject anonymous requests.
- Live repository verification passes for 76 projects and 43 catalog tags.

Real SMTP delivery and a live external AI worker were not invoked. Document
format/proxy handling is covered by the existing local tests. The separate
`/api/recommendations` endpoint intentionally reports `not_configured`; it is
retained because the frontend uses that contract. Existing old catalog metadata
and historical company fields were not bulk-rewritten.
