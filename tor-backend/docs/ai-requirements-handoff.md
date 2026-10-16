# AI requirement extraction integration

## Responsibilities

The backend prepares PDF text, stores source snapshots, validates submitted
quotations and tags, and recalculates Python requirement coverage. The AI worker
must interpret the PDF, identify actual requirements and their importance, and
preserve AND/OR meaning. AI project suitability recommendations remain a separate
stage. Ordinary company users save their profile once and open Matching results;
they do not approve tags or need a system administrator account.

## Worker flow

1. Read announcements through `GET /api/tors` (paginated).
2. Call `GET /api/ai/tors/:projectId/source` using the worker bearer key. The backend
   fetches the project's stored e-GP document, parses PDF text, and returns
   `sourceId`, `torVersion`, `sourceUrl`, `documentHash`, `fetchedAt`, and
   `pages: [{page, text}]`. Only the two existing e-GP hosts and their allowed
   redirects are supported. HTML documents and scanned PDFs without usable text
   need an additional extraction/OCR adapter. The AI cannot upload arbitrary text
   and declare it to be an official source.
3. Query `GET /api/tags?search=Docker&category=technology`. This read API returns
   active tag IDs, names, categories and aliases. Reuse those IDs where possible.
4. Interpret the document and submit the complete current set to
   `POST /api/ai/tors/:projectId/requirements` with the same bearer key.
5. Check `matchingRefreshed`. If false, requirements are still saved; company
   matching reads retry calculation. A later extraction for the same TOR/version
   replaces this pipeline's previous requirement set. An empty set removes its
   obsolete requirements. Repeated identical submissions are idempotent.

The JSON request below illustrates structure; its quotation is an example and
must be replaced with a quotation returned by the source endpoint:

```json
{
  "sourceId": "24-character-source-snapshot-id",
  "torVersion": 1,
  "model": {
    "provider": "actual-provider",
    "name": "actual-model",
    "version": "actual-version",
    "promptVersion": "requirements-v1"
  },
  "requirements": [{
    "key": "deployment-1",
    "text": "Microservices using Docker or Kubernetes",
    "importance": "required",
    "confidence": 0.95,
    "evidence": {
      "page": 3,
      "quote": "The contractor must deliver microservices using Docker or Kubernetes."
    },
    "clauses": [
      {"anyOf": [{"name": "Microservices", "category": "skill"}]},
      {"anyOf": [
        {"name": "Docker", "category": "technology"},
        {"name": "Kubernetes", "category": "technology"}
      ]}
    ]
  }]
}
```

Every clause is an AND component; the alternatives within one `anyOf` are OR.
An existing alternative may instead be `{"tagId": "24-character-tag-id"}`.
New tag names need literal support in the quotation and an allowed category:
`technology`, `skill`, `certification`, `industry`, `project_type`, `capability`,
or `requirement`. Missing tags are created transactionally and shared aliases are
reused automatically. There is no separate create-tag action or manual approval
step for this worker flow.

## Automatic validation and its limits

The backend rejects stale source/version IDs, absent quotations, incorrect PDF
pages, inactive or unsupported tags, malformed clauses, and confidence below 0.8.
It accepts at most 100 requirements, 20 clauses per requirement, 10 alternatives
per clause, and 2,000 characters of requirement/quotation text. Partial writes
are rolled back. Unknown or deactivated scoring concepts stay unassessed rather
than silently disappearing from the coverage denominator.

Validation proves that the cited text and tag wording occur in the backend's PDF
snapshot. It does **not** prove that the AI interpreted the quotation correctly,
that a phrase is mandatory rather than optional/negated, or that a submitted
confidence is calibrated. The AI worker must handle those distinctions, exclude
examples and prohibited technologies, and preserve qualifications, numbers,
dates and logical relationships. Evaluate it against manually checked real PDFs
before claiming extraction accuracy. Demo tests prove plumbing and scoring only.

## Storage

- `requirement_sources`: source PDF hash, TOR version, URL and page text.
- `ai_evaluations.requirements`: requirement text, importance, confidence,
  clauses and source/page quotation. `model` identifies the extractor and prompt.
- `tor_announcements.tagAssignments`: automatically validated source tag links;
  `requirementSource` and `requirementExtraction` identify their current inputs.
- `companies`: saved technologies/qualifications and automatic claimed tag links.
- `tags`: shared vocabulary and aliases with unique category/name and slug indexes.
- `company_matches`: Python coverage, evidence strength and requirement results.

These are MongoDB collections, not local JSON files. A PDF hash or source URL
change invalidates the previous extraction once the source is prepared again.
Existing independently maintained assignments remain available. The existing BMA
demo evaluation is protected from worker overwrites.

## Local activation and deployment

Node 24+ and Python 3.10+ are required; the Docker API image includes both.
`AI_REQUIREMENTS_TOKEN` is a random backend/worker secret of at least 32 characters.
It is configured locally in the gitignored backend `.env`, never in the browser,
request body, repository or logs. Send it as `Authorization: Bearer <key>` over
HTTPS outside localhost. Give the teammate a deployment secret through a private
channel, not this document. This key grants extraction routes only; it is not a
human administrator account or a company-data credential.

Before activating against the existing test database, run the backend's
`node src/tag-catalog-migration.mjs` to preview, then append `--apply` to merge.
The migration is restricted to `tor_software_test`, saves a BSON-preserving backup,
archives duplicates and remaps tag references before adding unique indexes and
the shared catalog. Set `CATALOG_BACKUP_DIR` to a durable private backup folder.
Use the normal database setup script for a fresh deployment; do not run this
test-only migration against the original database.

Your teammate still needs to add: the AI PDF interpretation worker, its queue and
retry policy, extraction accuracy evaluation, OCR/other-source adapters if needed,
and the separate AI suitability evaluation/publishing flow. No AI model or n8n
worker call has been added by this backend integration.
