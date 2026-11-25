# Thailand TOR Intelligence (Bangkok-TOR)

A web platform that helps software houses discover Thai government procurement announcements, review source documents, compare TOR requirements with company capabilities, and receive matching-opportunity alerts. Discovery supports nationwide software/IT procurement.

## Features and current status

| Capability | What the application supports |
| --- | --- |
| Accounts | Company registration, login, session refresh, logout, and email password reset |
| Company profiles | Description, services, technologies, qualifications, and certifications |
| Discovery | Keyword search, department/method/stage/date filters, pagination, and retained stages |
| Documents | Source document preview/download and stored thumbnails, when available |
| Tagging | Shared catalog, profile synchronization, and automatic eligibility checks for reviewed AI assignments |
| Requirement matching | Python rules compare available requirements and show coverage, evidence, and gaps |
| Notifications | In-app inbox, automatic database change checks, and optional SMTP email alerts |
| Dashboard | Database-backed aggregates for projects, matches, companies, ingestion, and tag demand |
| Company AI evaluation | Backend, results panel, and n8n workflow implemented; requires a configured, active hosted workflow |

A coverage percentage describes stored requirements, not a probability of winning or proof of eligibility. Company claims are self-reported. Missing source information limits both matching and AI analysis. The current supplied AI integration uses **Qwen/Ollama through n8n**; references to Vertex AI in earlier planning documents are historical.

## Architecture

```text
Government e-GP sources -> externally hosted n8n ingestion/extraction -> MongoDB Atlas
                                                                         ^
Browser -> Next.js frontend (3000) -> Express API (4000) -------------------+
                                         |-> Python requirement matcher
                                         |-> optional n8n company evaluation -> Qwen/Ollama
                                         |-> automatic match checks + SMTP email queue
```

The browser talks to the API. MongoDB and SMTP credentials belong in backend configuration. MongoDB Compass is an optional database viewer, not a service the application requires.

## Repository layout

| Path | Purpose |
| --- | --- |
| `frontend/` | Next.js interface and frontend tests |
| `tor-backend/` | API, authentication, matching, notifications, and AI integration |
| `database-design/` | Database validators, indexes, migration, and verification scripts |
| `tor-crawler/` | Pointer to the externally hosted n8n ingestion workflow |
| `documentation/` | Project SRS and reference documents |
| `postman/` | Evaluation simulation and mock configuration |
| `n8n-tor-ai-tags.json` | Importable AI tagging workflow |
| `n8n-tor-company-evaluation.json` | Importable company evaluation workflow |

## Quick start (Windows / PowerShell)

Prerequisites: Git, Node.js 24+, npm, Python 3.10+ available on PATH, and access to the team's approved MongoDB database. Docker is optional. Use the database name supplied by the database owner; do not create or seed a replacement shared database accidentally.

### 1. Get the source

```powershell
git clone https://github.com/taamtera/Bangkok-TOR.git
cd Bangkok-TOR
```

For an existing checkout, run `git status` and then `git pull origin main`. Resolve local changes before pulling if Git reports a conflict.

### 2. Configure the backend

If `tor-backend/.env` does not exist, copy the example:

```powershell
Copy-Item tor-backend/.env.example tor-backend/.env
```

Set `MONGODB_URI`, the approved `MONGODB_DB_NAME`, and your own `AUTH_ACCESS_SECRET`. Keep an existing working `.env` when updating. Set `FRONTEND_ORIGIN` to include `http://localhost:3000`; its first entry is also used for links in email.

Optional integrations:

- Password-reset email: configure SMTP using [email setup](tor-backend/docs/email-setup.md).
- Matching email: additionally set `MATCH_ALERT_EMAIL_ENABLED=true`; each user must opt in through the notification bell.
- Company AI evaluation: obtain the current production webhook URL from the workflow owner and set `TOR_EVALUATION_WEBHOOK_URL`. Importing the repository does not activate a hosted workflow.

### 3. Install dependencies

From the repository root:

```powershell
npm --prefix tor-backend ci
npm --prefix frontend ci
```

For the existing shared database, normal application startup does not require setup, migration, or demo seeding. Database owners should follow [database setup and migration](database-design/README.md) when creating a new database or changing its schema. `db:setup` writes validators/indexes; it is not a read-only startup check.

### 4. Run two terminals

Backend, from the repository root:

```powershell
cd tor-backend
npm run dev
```

Frontend, in a second terminal from the repository root:

```powershell
cd frontend
npm run dev
```

Open **http://localhost:3000**. Verify the API at **http://localhost:4000/api/health**. Keep both terminals running. Starting the frontend alone does not start the backend or crawler.

## Troubleshooting

- **MongoDB `querySrv ECONNREFUSED`:** DNS discovery failed before database authentication. Stop the backend with Ctrl+C and try this process-only DNS workaround from `tor-backend`:

  ```powershell
  node --input-type=module -e "import dns from 'node:dns'; dns.setServers(['1.1.1.1','8.8.8.8']); await import('./src/server.mjs');"
  ```

  This command has no automatic file restart. Do not combine `--watch` with `-e`. If the network blocks these DNS servers too, check DNS/network access with the database owner.
- **Frontend says Failed to fetch:** check the API health URL, then use `localhost:3000` rather than an arbitrary network IP. For another host or port, align `NEXT_PUBLIC_API_BASE_URL` and backend `FRONTEND_ORIGIN`, then restart the affected services.
- **Port 3000 is occupied:** use `npm run dev -- --port 3001` from `frontend`, and allow that origin in backend configuration. Set the intended email-link origin first.
- **No AI evaluation:** check extracted document text, substantive company profile information, and the hosted evaluation configuration. Ordinary rules-based matching does not require the evaluation webhook.
- **No new email after opting in:** opting in is not a test-send action. Alerts require a qualifying match event, configured SMTP, and the running backend. See [automatic alerts](tor-backend/docs/automatic-match-alerts.md).

## Documentation map

| Document | Purpose |
| --- | --- |
| [Backend README](tor-backend/README.md) | API and application behavior |
| [Database README](database-design/README.md) | Setup, validators, verification, and migration |
| [Source of truth / SRS](documentation/Bangkok%20Tor%20SRS.md) | Requirements and project scope; compare planned provider wording with current implementation |
| [Database schema](database-design/docs/schema.md) | Schema used by the database package |
| [Company AI evaluation](tor-backend/docs/company-tor-evaluation.md) | Evaluation contract and hosted integration |
| [AI extraction handoff](tor-backend/docs/ai-requirements-handoff.md) | Source validation and requirement ingestion |
| [Notifications](tor-backend/docs/notifications.md) | Inbox, preference endpoints, and alert policy |
| [Automatic alerts](tor-backend/docs/automatic-match-alerts.md) | Background scans, email queue, and configuration |
| [Docker](DOCKER.md) | Optional container startup |

`documentation/` also contains schema and handoff references. The database package README links the schema and handoff used with its operating scripts; consult the database owner if the documents disagree.

## Verification

From the repository root:

```powershell
npm --prefix tor-backend run check
npm --prefix tor-backend test
npm --prefix frontend test
npm --prefix frontend run build
```

Some integration tests are opt-in and require configured database access. See the relevant test/docs before enabling them. A passing local build does not verify the hosted n8n model or upstream government availability.

Database-owner checks (install that package first with `npm --prefix database-design ci`):

```powershell
npm --prefix database-design test
npm --prefix database-design run handoff:verify
npm --prefix database-design run db:check
npm --prefix database-design run db:verify
```

The last two commands require the database package's own connection configuration. Migration previews, backups, and apply procedures remain documented in [the database README](database-design/README.md).

## Docker and credentials

Compose defines `api` and `frontend` services; Atlas and hosted n8n remain external. See [Docker setup](DOCKER.md). Credentials stay in ignored `.env` files or deployment secrets. Never include environment-file screenshots in presentation material.

Report security issues privately to the project maintainers. Keep database backups and source-data exports private; never commit credentials, authentication keys, or production data into the repository or frontend variables.
