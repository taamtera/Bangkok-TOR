# TOR document flow

The workflow exports are [data-collection.json](../tor-crawler/data-collection.json) and [ai-eval.json](../tor-crawler/ai-eval.json). The crawler README points to the team's [hosted n8n instance](https://n8n.actvee.com/). These flows communicate through MongoDB: collection creates or refreshes announcements, and AI evaluation later selects an announcement to enrich. There is no direct trigger from the collection flow to the AI flow.

Here, **AI evaluation means extracting TOR facts and reviewing proposed tags**. Company-versus-TOR evaluation is a separate integration in `n8n-tor-company-evaluation.json`, configured through `TOR_EVALUATION_WEBHOOK_URL`.

```text
data-collection.json
  Schedule -> e-GP RSS -> Thai decoding -> software/IT title filter
    |-> ingestion_runs: fetch coverage summary
    |-> tor_announcements: merge stages and upsert project
          -> download source -> render preview -> thumbnails

ai-eval.json
  Schedule -> select one unprocessed tor_announcements record
    |-> download -> HTML / PDF / ZIP-PDF text extraction --+
    |-> wake Qwen and check readiness ---------------------+
      -> no text: save source-review marker
      -> text: save documents -> load active tags -> Qwen extraction
           -> schema validation -> separate Qwen tag review
                |-> rejected: retry, up to four generator attempts
                |-> approved: insert new canonical tags
                     -> save linked tags, requirements and facts -> verify
```

## Data collection: `tor-crawler/data-collection.json`

The schedule's cron expression is `10 1 * * *` (01:10 daily in the configured n8n timezone). The node is named `Daily 01:10 Bangkok`; set the hosted workflow timezone to `Asia/Bangkok` to match that intent. The request date is explicitly **yesterday in Bangkok**, regardless of the scheduler timezone.

1. **Build requests.** Cross 12 configured departments with nine announcement stages, producing 108 RSS requests for the selected date. Stages are `P0` (plan), `15` (reference price), `B0` (draft tender), `D0` (invitation), `W0` (award), `D1`/`W1` (cancellations), and `D2`/`W2` (amendments). Requests run one at a time with a 20-second batch interval.
2. **Decode and filter.** Fetch e-GP RSS, decode Windows-874/TIS-620 or UTF-8, and parse XML. Retain titles matching the Thai/English software and IT keyword lists, recording `titleMatchedKeywords`. This is title screening; relevant documents with unrelated titles can be missed.
3. **Record coverage.** Compare received item counts before keyword filtering with RSS `countbyday`, validate request/date consistency, and insert a run summary. The feed has no pagination in this flow; a count mismatch is recorded as incomplete coverage (`rss_latest_20_only`). A complete run means complete for the configured requests, not nationwide coverage.
4. **Normalize and merge projects.** Extract project IDs, source/document URLs, dates, procurement method and stage information. Skip items without a verified project ID; conflicting non-plan project IDs cause an error. Read existing projects in a batch and retain one observation per stage in `stageObservations`, choosing the newer publication or a deterministic URL/description tie-breaker. Preserve earlier stages and `firstSeenAt`, and refresh `lastSeenAt`. Duplicate stored project IDs cause an error.
5. **Choose display status.** Use the latest publication date. When several stages share that latest date, store `status: multiple_announcements_same_day` and `statusOrderAmbiguous: true`; the representative display record does not prove stage order. Always set `biddingOpenVerified: false`.
6. **Generate previews.** After announcement upsert, fetch each project's document URL and detect HTML, PDF or image content. HTML uses Browserless screenshots; PDF/image previews use wsrv.nl. Validate the returned WebP and size (maximum 8 MiB), then save its base64 data. Unavailable or unsupported sources and invalid previews are skipped, leaving any previous thumbnail stored.

| Collection changed | Write behavior and data |
| --- | --- |
| `ingestion_runs` | Insert one fetch summary: source/execution/time, requested dates/departments/stages, reported and received counts, keyword matches/rejections, completeness/missing counts, coverage, filter versions, and department/stage breakdowns. This logs RSS fetch coverage, not successful completion of all later project/thumbnail writes. |
| `tor_announcements` | Upsert by `projectId`. Write `sourceId`, `scope`, `departmentId`, `departmentName`, `projectId`, `linkedProjectId`, `identityScope`, `title`, `description`, `publishedAt`, `url`, `documentUrl`, `thumbnail`, `thumbnailSourceUrl`, `procurementMethod`, `status`, `statusPublishedAt`, `statusOrderAmbiguous`, `stageObservations`, `biddingOpenVerified`, `channelParams`, `itemParams`, `firstSeenAt`, `lastSeenAt`, and `titleMatchedKeywords`. Existing fields outside this write list, including AI enrichment, remain stored. |
| `thumbnails` | Upsert by `projectId`: `contentType: image/webp`, base64 `data`, `sourceUrl`, `sourcePublishedAt`, `width`, `quality`, byte `size`, and `updatedAt`. Jobs request width 600 and quality 80; the HTML screenshot uses a 1000-by-1200 viewport, so the saved width metadata is not a measurement of the returned image. |

## AI evaluation: `tor-crawler/ai-eval.json`

**Schedule and selection.** The actual cron expression is `*/10 4-12 * * *`: every ten minutes from 04:00 through 12:50 in the configured n8n timezone. The node label says `04:00-10:00 Every 10 Minutes`, which differs from the cron. Neither export includes workflow timezone settings, so verify these in the hosted configuration.

Each execution selects at most one record, oldest `firstSeenAt` then `_id`, with nonempty string `projectId` and `documentUrl`. It requires `aiProcessing.version != 3` or status `pending`, while excluding statuses `completed`, `processing`, `failed`, `no_extractable_text`, and `needs_ocr_or_source_review`. Thus, a completed record is excluded even with an older version. The flow does not claim the record by writing `processing`, and collection does not reset AI status when source data changes; reruns or concurrent executions need operational care.

1. **Extract source text and check the model.** Download the document while a parallel branch wakes Ollama/Qwen and requires an exact `OK` response with `done_reason: stop`. Detect format from bytes/content and file metadata. Decode Thai HTML and extract its form content (falling back to the body); extract embedded PDF text; or decompress ZIP files and extract their PDF attachments. Images and other formats take the unsupported path. No OCR service is called. A ZIP without PDF attachments produces no extraction items and can stop that branch without saving a no-text marker.
2. **Group and save documents.** Group extraction results by project. Any nonempty extracted text passes the text gate, including `low_text` results; extraction labels alone do not block AI use. Save the grouped `documents` array before model generation. If grouped documents contain no text, update only `aiProcessing` to `needs_ocr_or_source_review`; that branch does not save `documents`. Its marker currently uses legacy `version: 1` and `model: qwen3.5:4b`.
3. **Build a catalog-aware prompt.** Load active `tags` with valid IDs, labels, categories and types. Include the project identity, title, status, catalog and extracted text. For plan IDs starting with `P` followed by a digit, require the ID in the text and focus on its surrounding row plus the document opening. Documents without that ID are skipped; if nothing remains, prompt preparation emits no item. When combined text exceeds 16,000 characters, send its first 11,500 and last 3,500 characters with an omission marker.
4. **Generate facts and tag proposals.** Call Ollama `/api/chat` using the configured model **`qwen3.5:9bu`**, JSON output, thinking enabled, temperature 0.4 and a 16,000-token context setting. The node's `Qwen 3.5 4B HTTP` label is stale. Request department, procurement method, budget, explicit contract start/end dates, up to eight detailed requirements, and reusable tag proposals. Unknown facts should be null. Reuse proposals reference existing catalog IDs; create proposals need both a project concept `text` and a supplier capability/qualification `contractorLabel`. Tags distinguish deliverables (`specification`) from bidder eligibility (`contractor_requirement`); quantities and generic contract conditions belong in detailed requirements.
5. **Validate structure locally.** Parse JSON and check requirement/tag arrays, allowed categories and requirement levels, nonempty evidence, confidence from 0 to 1, valid catalog IDs, duplicate proposals, required new-tag labels, nonnegative budget and date format. Existing tag labels come from the catalog. These checks validate structure and selected constraints; they do not prove every extracted fact or requirement against the source.
6. **Review tags in a separate model call.** Use the same `qwen3.5:9bu` model with thinking disabled and temperature 0. The reviewer checks reuse versus creation, overlap, classification, labels and evidential support, returning `approve` or `revise` with specific corrections. Local evidence checks normalize case, Unicode, punctuation and whitespace and test whether each tag quote occurs in the supplied source. The reviewer receives the catalog, proposals and evidence-check results, **not the full source text**. A failed evidence check is supplied to the reviewer rather than enforced as a separate hard rejection. Detailed requirements are not independently reviewed by this call.
7. **Retry rejected output.** Schema failures or reviewer revisions feed errors back to the generator, for a maximum of four generator attempts. When errors concern only tags and a validated extraction exists, the retry prompt asks to preserve the other extraction fields. Exhausting attempts throws an execution error before canonical tag/final TOR writes. Extracted `documents` were already saved, and this failure path does not persist an `aiProcessing: failed` marker, so the project may be selected again.
8. **Save approved enrichment and verify links.** Insert proposed new tags, reload the active catalog, resolve each proposal to a real tag ID, and store links as BSON ObjectIds. Retain non-AI assignments and AI assignments already approved or rejected; replace other AI suggestions without duplicating retained IDs. Reload the TOR and verify processing version/status and every expected tag link. This read-back checks persistence, not factual accuracy.

| Collection changed | Write behavior and data |
| --- | --- |
| `tor_announcements` (text available) | Update the existing project by `projectId`, replacing `documents` with objects containing `filename`, `sourceFormat`, `extractionStatus`, `pages`, and `extractedText`. This happens before generator/reviewer approval. |
| `tor_announcements` (no text) | Update only `aiProcessing`: `status: needs_ocr_or_source_review`, legacy version/model, and `processedAt`. No AI requirements or tags are written. |
| `tags` (approved output) | Merge new canonical tags by `(category, text)`, inserting `text`, `contractorLabel`, `category`, `type`, empty `aliases`, and `status: active`. Existing matching tags are kept unchanged. Requires a unique compound index on `{ category: 1, text: 1 }`. Reused tags are read and linked. |
| `tor_announcements` (approved output) | Merge into the existing TOR: `tagAssignments` (BSON `tagId`, level, evidence, source, confidence and review status), raw `aiTagSuggestions`, `aiExtractedRequirements`, and `aiProcessing` (`completed`, version 3, model, timestamp, attempts, catalog size and `tagReviewStatus: approved`). New assignments still have `reviewStatus: suggested`; model review does not turn them into human-approved assignments. |
| `tor_announcements` (supported optional facts) | Nonempty generated `departmentName` and `procurementMethod` overwrite those fields. A valid budget becomes `budget.maxAmount`, preserving other budget properties. Valid date strings update `projectStartAt`/`projectEndAt`. Null/missing values leave existing facts unchanged. |

The two flows do not write company profiles, company evaluation results, match scores or notifications. Their writes occur across separate nodes and collections without a transaction, so an execution error can leave earlier writes committed (for example, extracted documents or newly inserted tags). Importing these exports requires configured MongoDB credentials, Browserless credentials for HTML previews, reachable Ollama hosting with the configured model, and activation in n8n; local application startup does not execute them.
