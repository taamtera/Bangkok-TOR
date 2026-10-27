# Company-specific TOR evaluation

The popup's AI Evaluation button mounts `AIEvaluationPanel`. It reads
`GET /api/tors/:projectId/evaluation`, then posts to the same path if the current
company/project has no saved result. While processing, the browser polls every
2.5 seconds. Closing the popup stops polling; the server keeps the job running.
Failures show a retry button. Anonymous users are asked to sign in.

Before any model request, both the backend and the n8n flow check for substantive
company information and nonblank extracted document text. Company name, size and
location alone do not qualify as substantive profile information. If either side
is missing, the popup shows `insufficient_data` and lists what is needed. The
workflow's false branch returns HTTP 422 and never reaches the Ollama node.

## Production flow

1. Import the root `n8n-tor-company-evaluation.json` into the existing eval
   workflow, replacing its old nodes. Only one active workflow can own `/eval`.
2. Activate the workflow. The production URL is
   `https://n8n.taamtera.com/webhook/eval`, not `/webhook-test/eval`.
3. The backend's gitignored `.env` is configured with that URL. The optional
   `TOR_EVALUATION_WEBHOOK_TOKEN` sends an `x-evaluation-token` header; if used,
   configure a matching Header Auth credential on the n8n Webhook node.
4. The workflow calls `http://100.77.43.106:11434/api/chat` from n8n. The n8n host
   must have Tailscale access and the `qwen3.5:9bu` model installed. It uses JSON
   Schema output, non-streaming responses, thinking enabled, context 32000,
   temperature 0.2, and prediction limit 8192. The model HTTP node allows 30
   minutes, the n8n workflow allows 31 minutes, and the backend allows 32 minutes.
   The job lease lasts one additional minute. Any reverse proxy in front of n8n
   must also allow this long-running response; application settings cannot
   override an earlier proxy timeout. The browser continues polling throughout.

The import file is generated from the two Code node sources under
`workflows/company-evaluation/`. Rebuild it with
`node scripts/build-company-evaluation-flow.mjs` from `tor-backend`.

## Data contract

The authenticated backend reads the current company's database record. Caller
JSON cannot choose another company's profile. It sends company name, overview,
size, district, qualifications, certifications, technologies and resolved service
tags. Login credentials, contact email and authentication tokens are excluded.

TOR input includes title/description, department, procurement method, stage,
publication dates, optional budget/contract dates, document link, tag requirements,
stored `aiExtractedRequirements`, and extracted text in `documents`. Document text
is bounded to 12,000 characters total, and truncation is explicit. Missing budget,
text and dates remain missing; the model must identify the limitation. Source
extraction completion in `aiProcessing` is not a company suitability evaluation.

Observed on 2026-10-27: 76 TOR records, 63 with `documents`, 64 with extracted
requirement lists, 54 with budget fields, and 9 companies. Only one company had
the newly added description/certification fields. Existing `ai_evaluations` was
empty; that collection belongs to source requirement extraction and is not reused.

The webhook response schema is in `company-evaluation.openapi.json`. The required
fields match the popup: summary, nullable budget/qualification scores,
explanations, risk level/analysis, extracted requirements, strengths, gaps and
missing information. The workflow validates model JSON before responding. The
backend validates it again and supplies the evaluation timestamp.

## Cache and isolation

`company_tor_evaluations` stores one job/result for each
`companyId + projectId + inputHash`, with a unique index. Input hashes cover the
profile and relevant TOR data, including hashes of full extracted document text.
Changing inputs creates a fresh evaluation; ingestion sighting timestamps do not
invalidate results. Concurrent clicks reuse the same job. Expired jobs can be
retried after their lease expires, including after a backend restart. Old results
remain stored and are not returned for different inputs or companies.

The current API creates the unique cache index on first use. Fresh database setup
also declares the collection validator and index. No existing source extraction
records or company profiles are rewritten by an evaluation.

## Verification

No request was sent to the production n8n or Ollama servers during implementation.
The Postman simulation uses the supplied flow's contract and fixture responses;
it does not call the real model or grade model accuracy. In PowerShell:

```powershell
postman simulation run postman/simulations/tor-evaluation/tor-evaluation.sim.yaml --port 4905 --output ndjson --no-history
```

In another terminal, from `tor-backend`:

```powershell
$env:TOR_EVALUATION_TEST_WEBHOOK_URL='http://127.0.0.1:4905/n8n/webhook/eval'
npm run test:db
```

Database tests create disposable databases. They exercise real HTTP calls,
processing/completion, cache hits, duplicate clicks, company isolation, input
invalidation, 502 responses, invalid scores/JSON, timeouts and retry. Unit tests
execute both n8n Code nodes and validate their output against the backend parser.
Live n8n/Ollama execution requires importing/activating the revised flow; the
existing production workflow is not automatically overwritten.

References: [n8n Webhook production/test URLs](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
and [Ollama structured outputs](https://ollama.com/blog/structured-outputs).
