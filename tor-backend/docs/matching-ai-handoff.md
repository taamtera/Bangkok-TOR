# Python matching and AI recommendations

## Ownership and user flow

Company Profile is the sole capability input. Ordinary `company_admin` and
`company_member` accounts open **Matching results** and receive comparisons
automatically. Neither administrator approval nor duplicate entry is required
for demo matching. Existing privileged tag maintenance APIs remain separate.

**Matching** compares requirements and profile capability wording. **AI
recommendation** evaluates overall project suitability using the profile,
project information, and matching output. The two stages have distinct APIs and
frontend components. No AI provider is configured by this change.

## Python engine

- `matching/engine.py`: Python 3.10+ standard library, JSON stdin/stdout, no
  database access, credentials, network, or third-party Python dependencies.
- `matching/concepts.json`: canonical concepts and bounded phrase aliases.
- `src/services/python-matching.mjs`: Node adapter with a fixed script path,
  UTF-8 input, no shell, output limit, and timeout.
- `src/services/requirement-input.mjs`: current-version requirement inputs.
- `src/services/requirement-matching.service.mjs`: authenticated company context,
  current calculation, and MongoDB persistence.

Policy version **3** separates coverage from evidence strength. Required clauses
have weight 3, preferred clauses 1, informational clauses 0. Within a requirement
every AND component is needed; alternatives in an `anyOf` component use OR.
Coverage is averaged over components, then weighted over requirements. Direct
concept matches give full wording coverage; explicitly related hospital-system
experience gives half coverage of EHR/large-scale-data experience. These aliases
are a limited rules policy, not arbitrary semantic inference.

`evidenceScore` applies claimed=0.5, experienced=0.75, verified=1 to that coverage
separately. A direct match marked `met` describes coverage, not independent
qualification verification. A profile string containing “experienced” or
“verified” cannot promote its evidence level. Unknown free-form requirements
remain `unassessed`; generic words do not satisfy them. Common negative claims
are excluded from concept detection. Typo `ISO 270001` does not match ISO 27001.

All saved technologies and qualification names are scanned automatically;
duplicate synonyms do not earn extra credit. Independently maintained approved
tag evidence remains supported. Profile fields and source requirement records
are not rewritten by the Python engine.

## Existing demo input

Set `MATCHING_DEMO_ENABLED=true` with `MONGODB_DB_NAME=tor_software_test`.
Repository Docker Compose enables this option; the API rejects demo use in any
other database. Only the existing `BMA-DHR-2026-001` seed evaluation is loaded,
and only when its `torVersion` equals the current TOR version and every evidence
excerpt is `Demo evidence text`. These three requirements are visibly marked
**Demo requirements** with no fabricated source page or official citation.

The existing reviewed real requirement tags are also supported. Announcement
title mentions are not promoted to official tender requirements. This change
adds a PDF source preparation and validated AI submission interface described in
[AI requirement extraction integration](ai-requirements-handoff.md). The AI
interpretation worker and n8n hookup remain the teammate's work.

## API contracts

All routes use the authenticated session's company ID; clients cannot select
another company's profile.

- `GET /api/matches?page=1&limit=20[&projectId=...]`: Python coverage results,
  requirement components, matched profile wording, missing/partial components,
  provenance, evidence score, TOR version, and policy version. Returns compared
  projects including zero coverage. Projects without stored requirements are
  unavailable, not fabricated matches.
- `GET /api/matches/ai-input`: versioned integration payload with only the
  caller's company capability data, project metadata, and current matching
  results. Unknown budget/deadline fields remain null. No account/password,
  session, database credentials, or primary contact email is returned.
- `GET /api/recommendations`: separate AI response. Currently returns
  `resultType: "ai_recommendation"`, `status: "not_configured"`, `items: []`.
  It never disguises coverage as an AI suitability verdict.

AI input schema: `schemaVersion`, `policyVersion`, `resultType`, `company`,
`projects`. Each project includes `projectId`, `torVersion`, source metadata, and
`matching` (`computedAt`, `dataMode`, `score`, `evidenceScore`, `requirementMatches`,
`companyCapabilities`). The company fields are self-reports unless explicit
independent assignment evidence says otherwise.

Future recommendation items expected by `aiRecommendationApi.ts`:

```json
{
  "projectId": "BMA-DHR-2026-001",
  "torVersion": 1,
  "title": "Project title",
  "suitability": "needs_review",
  "summary": "Model-generated suitability explanation",
  "reasons": [],
  "risks": [],
  "dataMode": "demo",
  "model": "actual-provider-and-model",
  "evaluatedAt": "ISO timestamp"
}
```

The response uses `status: "ready"` only after actual AI evaluation. Suitability
values are `suitable`, `needs_review`, `not_suitable`. Validate provider output,
preserve demo provenance, cite input evidence, and do not invent certifications,
budgets, deadlines, or eligibility decisions. Cache by company profile revision,
TOR version, matching policy, requirement revision, and model/prompt version;
discard stale output when any input changes. Store future company-specific AI
verdicts separately from `company_matches`.

## Storage and activation

Policy 3 stores `resultType: "requirement_match"` in `company_matches` with
`score` representing coverage. Legacy `recommendation` is removed from updated
policy-3 records, remains optional for historical records, and is never exposed
as AI output. Zero and unavailable results overwrite previously positive results
for the same company/TOR/version, preventing stale matches after profile edits.

For the existing test database, run `node src/matching-storage-migration.mjs`
from the backend folder or API container. This idempotent migration removes
only `recommendation` from that collection's required validator fields. It is
restricted to `tor_software_test` and preserves all other validation settings.
Fresh database setup uses the updated `setup-database.mjs` definition.

Docker includes Python and the matching directory. Local backend execution needs
Python available on PATH or `MATCHING_PYTHON_EXECUTABLE` set to its full path.
Profile saves refresh matching after persistence; if matching fails, the saved
profile succeeds and the next matching request retries calculation.
