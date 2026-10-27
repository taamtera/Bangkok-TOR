# TOR evaluation simulation

## Purpose

Local stand-in for the n8n evaluation contract in
`tor-backend/docs/company-evaluation.openapi.json`. Fixtures exercise the actual
backend HTTP client without calling n8n or Ollama.

## Execution

From the repository root, start:
`postman simulation run postman/simulations/tor-evaluation/tor-evaluation.sim.yaml --port 4905 --output ndjson --no-history`.
From `tor-backend`, set `TOR_EVALUATION_TEST_WEBHOOK_URL` to
`http://127.0.0.1:4905/n8n/webhook/eval` and run `npm run test:db`.
The normal backend configuration points at production, not this mock.

## Assumptions

- 2026-10-27: a Tailscale Ollama server is reachable from the user's n8n deployment;
  connectivity and model availability were not tested, at the user's request.
- The simulated response is a contract fixture, not evidence of AI quality or
  successful live n8n import. Database tests use disposable databases only.

## Observations

<!-- begin:observations -->
- 2026-10-27: the n8n member served real backend POST requests. Cached/concurrent
  requests reused jobs; separate companies got isolated results. Simulated 502,
  HTML, invalid scores and slow responses exercised failed/retry states.
<!-- end:observations -->

## What didn't work

The simulation does not execute an Ollama model. After the user requested no
further setup testing, it was stopped. The final insufficient-data branch was
added to both backend and flow, and the import artifact was rebuilt without
calling n8n or Ollama.
