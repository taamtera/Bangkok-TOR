# TOR Software Express Backend

This service is the private connection between the Next.js frontend and MongoDB Atlas.

```text
Next.js frontend -> Express API -> MongoDB Atlas
```

The frontend must never receive `MONGODB_URI` or connect directly to Atlas.

## Local Setup

1. Copy `.env.example` to `tor-backend/.env` and set `MONGODB_URI` and `MONGODB_DB_NAME`.
2. Install Node 24 or newer and run `npm install` from `tor-backend`.
3. Run `npm run check`.
4. Run `npm run dev`.
5. Open `http://localhost:4000/api/health`.

The backend loads its own `tor-backend/.env` automatically. Shell or deployment environment variables take precedence. Install Python 3.10 or newer for the matching engine; the Docker image includes Python. Demo requirement matching is opt-in with `MATCHING_DEMO_ENABLED=true` and is restricted to `MONGODB_DB_NAME=tor_software_test`.

## Current Foundation

- Secure HTTP response headers with Helmet
- Restricted frontend origins with credential support
- One-megabyte JSON request limit
- Request IDs for troubleshooting and audit logs
- Shared MongoDB connection pool
- Database health endpoint
- Safe 404 and server-error responses
- Graceful server and database shutdown
- Reusable repositories for users, secure tokens, sessions, audit logs, companies, and TOR discovery
- Controlled tag catalog and reviewed TOR/company tag assignments

## TOR API

The frontend reads projects through the Express API. RSS stage dates use `YYYY-MM-DD`; contract dates preserve the source API?s original Thai strings.

- `GET /api/tors`: list TOR announcements. Supports `search`, `status`, `category`, `tagIds`, `sourceId`, `organizationId`, `minBudget`, `maxBudget`, `deadlineAfter`, `page`, and `limit` query parameters. `tagIds` accepts either a comma-separated list or repeated query parameters.
- `GET /api/tors/:projectId`: read one project by its exact string project ID.
- `GET /api/tors/documents/:projectId`: proxy the real e-GP document inline for browser preview.
- `GET /api/tors/documents/:projectId/download`: proxy the real e-GP document as a forced download.

Document preview supports PDF and HTML. PDF bytes are served unchanged with `application/pdf`; HTML is decoded using its declared encoding and returned as UTF-8 with a base URL so relative assets and document links resolve against the source. Downloads use `.pdf` or `.html` according to the response. HTML responses are sandboxed without scripts or access to the application's origin; PDF responses retain compatibility with the browser's native viewer. Legacy HTTP links on the allowed e-GP hosts are upgraded to HTTPS before fetching. Every redirect must remain on those hosts. Unavailable upstream documents return `502`; unsupported formats return `415`. The popup offers an original-document link for source applications that need JavaScript or cannot be previewed.
- `PATCH /api/tors/:projectId`: update editable TOR fields. Requires `project_manager` or `system_admin` authentication.
- `GET /api/thumbnail/:projectId`: stream a stored WebP thumbnail from the `thumbnails` collection. Returns `404` when no current image exists and never returns the stored Base64 value as JSON.

The TOR list/detail responses identify projects using string `projectId`. MongoDB `_id` and retired top-level `templateId`, `projectKey`, and `announcementType` are omitted. Responses include display fields, RSS status/date, unordered latest stage observations, and first/last sighting timestamps. Plan IDs remain separate from linked numeric projects. Invitation publication does not verify that bidding is open.

The removed enrichment fields are omitted entirely from API responses, even if a legacy input document contains them: `opend`, `opendLookup`, `province`, `district`, `subdistrict`, `projectLocation`, `projectMoney`, `referencePrice`, `totalContractValue`, `contractProjectStatus`, `contracts`, `opendUpdatedAt`, and `locationFilter`. They are not returned as nulls, empty objects, or empty arrays. The frontend no longer maps or displays them. Optional application `budget` data is separate from the retired opend fields.

Document, detail, update, and thumbnail routes now take string project identities. `GET /api/thumbnail/:projectId` checks the stored image's `sourceUrl` against the current project's `documentUrl`, returns decoded WebP bytes, and returns `404` for a missing or stale image. Responses disable cache retention so independently arriving thumbnail updates become visible. Coverage is nationwide; ingestion retains its software/IT title filter.

The update body may contain `title`, `description`, `summary`, `category`, `departmentName`, `publishedAt`, `submissionDeadline`, `projectStartAt`, `projectEndAt`, `sourceUrl`, `url`, `documentUrl`, `thumbnail`, `status`, and `budget`. Publication dates must be `YYYY-MM-DD`; other editable application dates use ISO strings. `status` accepts the RSS stage statuses documented in the database schema, including `multiple_announcements_same_day`. Unknown fields are rejected. The API records `updatedAt` and `updatedByUserId` automatically.

Successful list responses use this shape:

```json
{
	"items": [],
	"pagination": {
		"page": 1,
		"limit": 20,
		"total": 0,
		"totalPages": 0
	}
}
```

Successful detail and update responses use `{ "tor": {} }`. Invalid update fields, missing records, and authentication failures return the standard `{ "error": { "code", "message", "requestId" } }` error shape.

## Tagging API

Project discovery accepts `search` (all whitespace-separated terms, literal case-insensitive substrings across project ID, title, description, department ID and name), `departmentId`, `procurementMethod`, `stage`, `stageScope=latest|retained`, `fromDate`, `toDate`, and `sort=latest|oldest|relevance`. Dates use inclusive `YYYY-MM-DD` bounds on `statusPublishedAt`. Latest-stage filtering includes each stage tied on the latest publication day. Retained-stage filtering considers the latest stored observation of each stage, not a complete announcement history. `__unknown__` selects missing departments or methods. Project and department IDs remain strings.

`page` and `limit` select a result page. Responses also include `totalAllProjects` and global `facets.departments` (`value`, `name`, `count`) and `facets.methods` (`value`, `count`). Facet counts describe the whole collection, rather than the filtered page. Relevance prioritizes exact IDs, followed by title and department matches; it is not an AI compatibility score.

- `GET /api/tags`: list active tags; accepts `category` and `search` query parameters
- `POST /api/tags`: create a controlled tag; system administrator only
- `GET /api/tags/:tagId`: read a tag, including inactive tags; system administrator only
- `PATCH /api/tags/:tagId`: update a tag's name, category, aliases, description, or active status; system administrator only. The tag slug remains stable.
- `DELETE /api/tags/:tagId`: deactivate a tag; system administrator only. Tags are not physically deleted because companies and TORs may reference them.
- `PUT /api/tags/companies/:companyId`: replace a company's approved tags; company member or system administrator
- `PUT /api/tags/tors/:projectId`: replace a TOR's approved tags; project manager or system administrator
- `PUT /api/tags/tors/:projectId/suggestions`: replace pending AI TOR requirement suggestions; project manager or system administrator. Each suggestion requires an active tag, confidence, cited evidence, and a URL matching the TOR's stored announcement or source-document URL; pending suggestions never affect matching.
- `GET /api/tags/tors/:projectId/suggestions`: list AI suggestions and review history; project manager or system administrator
- `PATCH /api/tags/tors/:projectId/suggestions/:suggestionId`: approve or reject a suggestion; project manager or system administrator. The submitting account cannot review its own suggestion.

The AI suggestion payload contains a `suggestions` array with `tagId`, `requirementLevel`, `evidence`, `sourceDocumentUrl`, optional `sourcePage`, and `confidence` from 0 to 1.

Company updates are restricted to the authenticated user's own company unless the user is a system administrator. Manual company assignments are approved as company self-reports; TOR AI suggestions are stored separately as unapproved records.

Human catalog maintenance routes require an authenticated `system_admin`. The separate scoped AI worker routes automatically validate PDF quotations and apply supported tags. Legacy pending suggestions continue to require review and do not affect scoring.

Company users (`company_admin` and `company_member`) access matches without a system-administrator role. The saved company profile supplies technologies and qualifications automatically; the matching page does not ask users to re-enter them or approve tags. Profile claims are not independently verified. Matching uses source-validated AI extractions, reviewed requirement assignments, or the explicitly enabled existing demo requirements. Announcement title mentions alone do not become contract requirements. The backend prepares PDF text and accepts evidence-validated AI submissions; the teammate still needs to implement AI interpretation. Privileged maintenance APIs remain available.

## AI requirement integration

- `GET /api/ai/tors/:projectId/source`: prepare current source PDF pages and hash.
- `POST /api/ai/tors/:projectId/requirements`: validate quotations, reuse/create tags, store requirements and refresh Python matching.

These routes require a scoped `AI_REQUIREMENTS_TOKEN` bearer key, not a human administrator account. See [AI requirements handoff](docs/ai-requirements-handoff.md) for the exact payload, validation limits, deployment and remaining teammate work.

## Rules-based matching API

### Company profile API

- `GET /api/companies/me`: return the authenticated user's linked company profile.
- `PUT /api/companies/me`: update the linked company's display name, size, district, primary contact email, technologies, and qualification names. Qualification names are stored as objects in `companies.qualifications`; unchanged entries retain existing evidence metadata. Exact profile entries are linked as self-reported `claimed` capabilities and are never marked verified.
- `POST /api/companies/me/matching-tags/sync`: link the current profile's exact technology and qualification entries to active tags as self-reported `claimed` capabilities. The operation is idempotent and does not create TOR requirements.

All endpoints require a company account and derive the company ID from the authenticated session. Profile saves and explicit syncs link company profile values; the profile remains the only company-facing place to edit those values.

- `GET /api/matches?page=1&limit=20`: compare the signed-in company's saved profile with available contract requirements. Returns coverage, matched/partial/missing clauses, profile evidence, and a demo/source label. Zero-score comparisons remain visible. Requires a linked `company_admin` or `company_member` account.
- `GET /api/matches/ai-input`: return the profile, projects, and current matching output for the separate AI suitability stage, without contact email or authentication data.
- `GET /api/recommendations`: reserved for AI project suitability. It currently returns `status: "not_configured"` with no recommendation items until an AI provider is connected.

The live matcher is the Python engine under `matching/`. Policy 3 recognizes explicit aliases and supported requirement clauses, including AND/OR alternatives. Required requirements carry weight 3, preferred requirements weight 1, and informational requirements weight 0. `score` measures requirement coverage; `evidenceScore` separately weights claimed (0.5), experienced (0.75), and verified (1.0) evidence. A high coverage score does not establish certification or overall project suitability. Unsupported free-form clauses remain unassessed rather than guessed. Results are saved in `company_matches`; reads recalculate them, and company/TOR changes refresh saved matches. Profile saves remain successful if matching is temporarily unavailable.

See [Matching and AI handoff](docs/matching-ai-handoff.md) for the demo safeguards, storage migration, API contracts, scoring details, and the remaining AI integration work.

## Authentication Ownership

The authentication teammate should add controllers and routes under `src/routes` and use the shared database repositories. Authentication logic must not be placed in the Next.js browser code.

Planned route prefix: `/api/auth`.

The exact registration fields, statuses, endpoint names, token policy, and team responsibilities are defined in `docs/authentication-contract.md`.

## Docker

The backend image installs production dependencies only, runs as a non-root user, and contains no `.env` file or database credentials. Start it through the repository-level `docker-compose.yml` so health checks and the crawler worker are configured together.
