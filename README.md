# TOR Software Platform (Bangkok-TOR)

**Bangkok-TOR** is an end-to-end web platform designed for discovering, tracking, and analyzing Thai Government Terms of Reference (TOR) and procurement announcements (from the Electronic Government Procurement / e-GP system). The platform automatically extracts technical criteria, evaluates contractor qualifications, and performs deterministic requirement matching between government opportunities and Thai software houses.

### Key Capabilities
- **Nationwide IT Procurement Monitoring**: Ingestion pipelines continuously track and filter Thai government procurement announcements focusing specifically on IT, software development, cloud infrastructure, and digital systems.
- **Deterministic Requirement Matching (Policy 3)**: Uses a standalone Python scoring engine that weighs mandatory clauses, preferred criteria, and vendor evidence levels (`claimed`, `experienced`, `verified`) to generate transparent, auditable match scores (0–100%) rather than speculative AI guesses.
- **AI-Powered Evaluation**: Integrates n8n workflows and large language models (Qwen) for automated criteria extraction from procurement PDFs and personalized contractor gap analysis.
- **Secure Document Proxy & WebP Thumbnails**: On-the-fly streaming of official government procurement PDFs and WebP first-page document previews, bypassing CORS limitations while preventing upstream document credential exposure.
- **Controlled Tagging Vocabulary**: Centralized taxonomy categorizing technical specifications and contractor requirements with alias resolution.

### Technology Stack
- **Frontend**: Next.js 15, React 19, TypeScript, TailwindCSS.
- **Backend API**: Node.js (>=24), Express 5, Native MongoDB Driver (7.x), JWT authentication (HMAC-SHA256) with refresh rotation.
- **Database**: MongoDB Atlas with strict JSON schema validators and unique indexes.
- **Matching Engine**: Python 3 subprocess (`tor-backend/matching/engine.py`), weighted clause policy over `stdin`/`stdout`.
- **Workflow Automation & AI**: n8n workflow engine (`https://n8n.actvee.com/`), Qwen LLM for requirement/tag extraction.
- **Containerization**: Docker & Docker Compose.

---

## Installation and Setup

### Prerequisites
- **Node.js**: Version 24 or newer
- **npm**: Version 10 or newer
- **Python**: Version 3.10 or newer (for local matching engine execution)
- **MongoDB**: MongoDB Atlas cluster or local MongoDB 7.0+
- **Docker & Docker Compose**: Optional, for containerized execution

### Step 1: Configure Environment Variables

#### Backend (`tor-backend/.env`)
Copy `tor-backend/.env.example` to `tor-backend/.env`:
```bash
cp tor-backend/.env.example tor-backend/.env
```

| Variable | Required | Description | Example / Default |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | Runtime environment (`development` or `production`) | `development` |
| `PORT` | Yes | Express API listening port | `4000` |
| `FRONTEND_ORIGIN` | Yes | Allowed CORS frontend origins | `http://localhost:3000,http://127.0.0.1:3000` |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string | `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/` |
| `MONGODB_DB_NAME` | Yes | Target database name | `tor_software` |
| `AUTH_ACCESS_SECRET` | Yes | HMAC-SHA256 secret (min 32 characters) | Generated via `crypto.randomBytes(48).toString('hex')` |
| `AUTH_ACCESS_TTL_SECONDS` | No | JWT access token lifespan | `900` (15 mins) |
| `AUTH_REFRESH_TTL_DAYS` | No | Session refresh token lifespan | `7` |
| `AUTH_PASSWORD_RESET_TTL_MINUTES` | No | Password reset token expiration | `30` |
| `LOGIN_MAX_ATTEMPTS` | No | Failed attempts before lockout | `5` |
| `LOGIN_LOCK_MINUTES` | No | Account lockout duration | `15` |
| `AI_REQUIREMENTS_TOKEN` | Optional | Shared token for AI worker endpoints (32+ chars) | `<token>` |
| `TOR_EVALUATION_WEBHOOK_URL` | Optional | n8n webhook URL for company evaluation | `https://n8n.taamtera.com/webhook/eval` |
| `TOR_EVALUATION_WEBHOOK_TOKEN` | Optional | Shared auth token for the n8n evaluation webhook | `<token>` |
| `TOR_EVALUATION_TIMEOUT_MS` | No | Timeout for evaluation webhook (ms) | `1920000` |
| `MATCH_ALERT_WORKER_ENABLED` | No | Background worker that evaluates new matches | `true` |
| `MATCH_ALERT_INTERVAL_MS` | No | Worker polling interval | `60000` |
| `MATCH_ALERT_EMAIL_ENABLED` | No | Send match emails (users must also opt in) | `false` |
| `EMAIL_DELIVERY` | No | `smtp` for Gmail or `console` for local dev | `smtp` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | If smtp | SMTP server settings | `smtp.gmail.com` / `465` / `true` |
| `SMTP_USER` / `SMTP_PASSWORD` / `EMAIL_FROM` | If smtp | Google App Password credentials | `<email>` / `<app-password>` |
| `MATCHING_PYTHON_EXECUTABLE` | No | Path to Python 3 binary (defaults to system PATH) | `python3` |
| `MATCHING_DEMO_ENABLED` | No | Demo-data scoring (`tor_software_test` only) | `false` |

> Never commit `.env` files or put `MONGODB_URI` / secrets in frontend variables.

#### Frontend (`frontend/.env.local`, optional)
```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

### Step 2: Install Dependencies
```bash
cd tor-backend && npm install
cd ../frontend && npm install
cd ../database-design && npm install
```

### Step 3: Initialize and Verify Database
```bash
cd database-design
npm run db:check                       # Test MongoDB connectivity
npm run db:setup                       # Create schema validators and unique indexes
npm run db:verify                      # Verify collections match contracts
npm run db:verify-enrichment-removed   # Confirm no legacy enrichment fields remain
```
`db:migrate` is a read-only preview by default; keep a backup before using `--apply`. See [`database-design/README.md`](./database-design/README.md).

### Step 4: Run the Application

**Option A: Local development (separate terminals)**
```bash
cd tor-backend && npm run dev     # API on http://localhost:4000
cd frontend && npm run dev        # UI on http://localhost:3000
```

**Option B: Docker Compose**
```bash
docker compose config --quiet
docker compose up --build -d
docker compose ps
docker compose down
```
Health check: <http://localhost:4000/api/health>. See [`DOCKER.md`](./DOCKER.md) for more.

---

## High-Level Container & Dataflow Diagram

### 1. High-Level Container Diagram

```mermaid
flowchart TB
    user["👤 Software House / Project Owner<br/>(Web Browser)"]

    subgraph ext["☁️ External systems"]
        egp["Thai Gov e-GP portal<br/>RSS feeds + TOR documents"]
        n8n["n8n workflows<br/>RSS crawler · AI tagging · company evaluation"]
        qwen["Qwen LLM"]
    end

    subgraph docker["🐳 Docker Compose"]
        fe["<b>frontend</b> :3000<br/>Next.js 15 · React 19"]
        api["<b>api</b> :4000<br/>Express 5 REST API<br/>auth · document proxy · thumbnails · tags"]
        py["Python matching engine<br/>Policy 3 scoring<br/>child process of api"]
    end

    db[("🍃 MongoDB Atlas<br/><br/>Ingestion: tor_announcements, thumbnails, ingestion_runs<br/>Application: companies, tags, company_matches,<br/>ai_evaluations, requirement_sources<br/>Auth and activity: users, sessions, auth_tokens,<br/>audit_logs, notifications, saved_tors")]

    user -->|"HTTPS"| fe
    fe -->|"REST / JSON"| api
    api -->|"spawn, stdin/stdout JSON"| py
    api <-->|"read / write"| db

    egp -->|"RSS poll"| n8n
    n8n <-->|"prompts"| qwen
    n8n -->|"upsert TORs, thumbnails, run logs"| db
    api -->|"proxy PDF fetch"| egp
    api <-->|"evaluation webhook"| n8n
```

### 2. High-Level Dataflow Architecture

```mermaid
flowchart LR
    subgraph Flow1["Pipeline 1: RSS Ingestion"]
        direction TB
        eGP_1["e-GP RSS Feeds"] -->|"Raw items"| n8n_1["n8n Crawler"]
        n8n_1 --> Filter_1{"Software/IT keyword match?"}
        Filter_1 -- Yes --> DB_Tors_1[("tor_announcements<br/>+ thumbnails")]
        Filter_1 -- No --> DB_Runs_1[("ingestion_runs<br/>(rejected counts)")]
    end

    subgraph Flow2["Pipeline 2: Discovery & Document Proxy"]
        direction TB
        User_2["Web Browser"] -->|"1. View TOR"| Next_2["Next.js Frontend"]
        Next_2 -->|"2. GET /api/tors"| API_2["Express API"]
        API_2 -->|"3. Read"| DB_Tors_2[("tor_announcements")]
        API_2 -->|"4. Fetch PDF"| eGP_2["e-GP host"]
        API_2 -->|"5. Stream PDF"| User_2
    end

    subgraph Flow3["Pipeline 3: Deterministic Matching"]
        direction TB
        Comp_3["Company profile"] --> API_3["Express API"]
        TOR_3["TOR requirements"] --> API_3
        API_3 -->|"stdin JSON"| Py_3["Python engine (Policy 3)"]
        Py_3 -->|"stdout JSON, score 0-100%"| API_3
        API_3 -->|"Save"| DB_Matches_3[("company_matches")]
    end
```

#### Pipeline Descriptions
1. **RSS Ingestion**: n8n polls e-GP RSS feeds, filters by software/IT title keywords, logs counts in `ingestion_runs`, and upserts matches into `tor_announcements` (keyed by string `projectId`) plus WebP previews in `thumbnails`.
2. **Authentication & Profile**: Software houses authenticate against `users` (hashed passwords); sessions live in `sessions`. Company capabilities in `companies` link to controlled `tags` with evidence levels (`claimed`, `experienced`, `verified`).
3. **Discovery & Document Proxy**: `/api/tors` serves metadata; `/api/thumbnail/:projectId` serves a thumbnail only when its `sourceUrl` matches the project's current `documentUrl`; `/api/tors/documents/:projectId` streams the remote PDF/HTML through the backend.
4. **Deterministic Matching (Policy 3)**: Express runs `matching/engine.py` over stdin/stdout. Clause weights: `required` 3, `preferred` 1, `informational` 0. Evidence multipliers: `claimed` 0.5, `experienced` 0.75, `verified` 1.0. Results are stored in `company_matches`.
5. **Grounded AI Evaluation**: Document pages are hashed (SHA-256) into `requirement_sources`; n8n asks Qwen for tags/requirements, stored as `suggested` until a reviewer approves.

---

## N8N Workflow and Document Flow

### 1. N8N Workflows

Two exported workflows live in this repository and run on n8n (`https://n8n.actvee.com/`).

#### A. AI Tag Extraction (`n8n-tor-ai-tags.json`)
1. **Capture AI Inputs**: receives parsed text from ingested TOR documents.
2. **Read Canonical Tag Catalog**: reads active tags from MongoDB `tags`.
3. **Build Tag-Aware AI Prompts**: builds prompts containing the known taxonomy.
4. **Qwen Structured Tag Extraction**: HTTP call to Qwen for technologies, certifications, capabilities.
5. **Parse AI and Build Tag Writes**: validates the JSON response and prepares writes.
6. **Upsert Missing Canonical Tags**: adds newly discovered tags to `tags`.
7. **Build Atomic Assignment Append** / **Append Tags and Update AI Fields**: atomically appends assignments to `tor_announcements.tagAssignments` as `suggested`.
8. **Build Verification Query** / **Verify Updated Project Tags**: re-reads the project to confirm the write.

#### B. Company Evaluation (`n8n-tor-company-evaluation.json`)
1. **Webhook**: Express posts the company profile and TOR requirements.
2. **Build Evaluation Prompt**: assembles the prompt.
3. **Enough Data?**: stops early when the input is insufficient.
4. **Qwen Company Evaluation**: LLM assessment of strengths and gaps.
5. **Validate Evaluation Response**: validates the structure.
6. **Respond to Webhook**: returns JSON to the backend.

### 2. Document Flow (Document Stages)

Each project stores the latest observation per stage in `tor_announcements.stageObservations`.

```mermaid
stateDiagram-v2
    [*] --> P0 : procurement_planned
    P0 --> 15 : reference_price_published
    15 --> B0 : draft_tender_published
    B0 --> D0 : invitation_published
    D0 --> D2 : invitation_amended
    D0 --> D1 : invitation_cancelled
    D0 --> W0 : award_published
    W0 --> W2 : award_amended
    W0 --> W1 : award_cancelled
    W0 --> [*]
```

| Code | Status | Meaning |
| :---: | :--- | :--- |
| `P0` | `procurement_planned` | Procurement plan announced |
| `15` | `reference_price_published` | Reference price published |
| `B0` | `draft_tender_published` | Draft tender documents published |
| `D0` | `invitation_published` | Invitation to bid published |
| `D1` | `invitation_cancelled` | Invitation cancelled |
| `D2` | `invitation_amended` | Invitation amended |
| `W0` | `award_published` | Winner announced |
| `W1` | `award_cancelled` | Award cancelled |
| `W2` | `award_amended` | Award amended |

> The diagram shows the typical order. The database keeps only the latest observation per stage, not a full history.
> When different stages share the latest publication date, `status` is `multiple_announcements_same_day` and `statusOrderAmbiguous: true`; each stage is displayed separately. An invitation does not verify that bidding is open (`biddingOpenVerified` is always `false`).
> Retired enrichment fields (`opend`, `province`, `district`, `projectMoney`, `locationFilter`, etc.) are forbidden by the validator and omitted from API responses.

---

## Database Schema

MongoDB Atlas is the only data store. The crawler writes exactly three collections (`tor_announcements`, `thumbnails`, `ingestion_runs`); the others support the application. Full details: [`database-design/docs/schema.md`](./database-design/docs/schema.md).

### Entity Relationship Diagram

```mermaid
erDiagram
    SOURCES ||--o{ ORGANIZATIONS : publishes
    SOURCES ||--o{ PROCUREMENT_PROJECTS : identifies
    ORGANIZATIONS ||--o{ PROCUREMENT_PROJECTS : owns
    PROCUREMENT_PROJECTS ||--o{ TOR_ANNOUNCEMENTS : publishes
    TOR_ANNOUNCEMENTS ||--o| THUMBNAILS : "projectId"
    TOR_ANNOUNCEMENTS ||--o{ TOR_VERSIONS : preserves
    TOR_ANNOUNCEMENTS ||--o{ AI_EVALUATIONS : analyzed_by
    TOR_ANNOUNCEMENTS ||--o{ COMPANY_MATCHES : matched_to
    TOR_ANNOUNCEMENTS ||--o{ SAVED_TORS : bookmarked_as
    TOR_ANNOUNCEMENTS ||--o{ NOTIFICATIONS : triggers
    TAGS ||--o{ TOR_ANNOUNCEMENTS : classifies
    TAGS ||--o{ COMPANIES : classifies
    COMPANIES ||--o{ USERS : includes
    COMPANIES ||--o{ COMPANY_MATCHES : receives
    USERS ||--o{ AUTH_TOKENS : receives
    USERS ||--o{ SESSIONS : opens
    USERS ||--o{ AUDIT_LOGS : generates
    USERS ||--o{ SAVED_TORS : saves
    USERS ||--o{ NOTIFICATIONS : receives
```

MongoDB does not enforce foreign keys; relationships show ownership. Projects are identified by the string `projectId`; MongoDB `_id` stays internal.

### Ingestion Collections
| Collection | Purpose | Key fields |
| :--- | :--- | :--- |
| `tor_announcements` | One document per project, upserted by `projectId` (unique index `uq_tors_project_id`) | `projectId`, `identityScope`, `linkedProjectId`, `title`, `departmentId`, `departmentName`, `procurementMethod`, `publishedAt`, `url`, `documentUrl`, `status`, `statusPublishedAt`, `statusOrderAmbiguous`, `stageObservations`, `titleMatchedKeywords`, `tagAssignments`, `firstSeenAt`, `lastSeenAt` |
| `thumbnails` | One WebP thumbnail per project (unique index `uq_thumbnails_project_id`) | `projectId`, `contentType`, `data` (base64), `sourceUrl`, `sourcePublishedAt`, `width`, `quality`, `size`, `updatedAt` |
| `ingestion_runs` | Per department/stage RSS request logs | `fetchedAt`, `request`, `reportedCount`, `itemsReceived`, `complete`, keyword matched/rejected counts |

### Application Collections
| Collection | Purpose | Key fields |
| :--- | :--- | :--- |
| `tags` | Canonical vocabulary (unique `{category, text}`) | `text`, `category`, `type` (`contractor_requirement` / `specification`), `contractorLabel`, `aliases`, `status` |
| `companies` | Software house profile | `legalName`, `district`, `description`, `technologies`, `certifications`, `qualifications`, `verificationStatus`, `tagAssignments`, `tags` |
| `company_matches` | Company ↔ TOR version comparison | `companyId`, `torId`, `torVersion`, `score`, `evidenceScore`, `status`, `requirementMatches`, `policyVersion`, `computedAt` |
| `ai_evaluations` | AI-derived analysis, kept separate from source facts | `torId`, `torVersion`, `status`, `retryCount`, `requirements`, `summary`, `model` |
| `requirement_sources` | Hashed page-text snapshots used to ground AI citations | `torId`, `torVersion`, `sourceUrl`, `documentHash`, pages, `fetchedAt` |
| `tor_versions` | Immutable TOR snapshots (optional extension) | `torId`, `version`, `contentHash`, `changeType`, `snapshot` |
| `saved_tors` | User bookmarks | `userId`, `torId`, `note`, `followUpStatus` |
| `notifications` | In-app and email alert queue | `eventKey`, `userId`, `type`, `channel`, `status`, `attemptCount`, `nextAttemptAt` |

### Authentication Collections
| Collection | Purpose | Key fields |
| :--- | :--- | :--- |
| `users` | Identity and access | `emailNormalized`, `passwordHash`, `role` (`company_admin`, `company_member`, `project_manager`, `system_admin`), `status`, `companyId`, `notificationPreferences` |
| `sessions` | Refresh sessions | `userId`, hashed refresh token, `status`, `expiresAt` |
| `auth_tokens` | Email verification / password reset / invitations | `type`, `tokenHash`, `expiresAt`, `usedAt`, `revokedAt` |
| `audit_logs` | Security events | actor, event, outcome, request ID, safe metadata |

Optional crawler-support collections (`sources`, `organizations`, `procurement_projects`, `raw_ingestion_items`, `rss_query_state`) are described in the full schema document.

---

## API Routes

All routes are prefixed with `/api`. Protected routes require a valid access token. "Company" means `company_admin` or `company_member`; "PM" means `project_manager`.

### System
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api` | Public | Service status and request ID |
| `GET` | `/api/health` | Public | Database ping and uptime |
| `GET` | `/api/dashboard/stats` | Public | Aggregate dashboard statistics |

### Authentication
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register user and company |
| `POST` | `/api/auth/login` | Public | Log in; issues access token and refresh cookie |
| `POST` | `/api/auth/refresh` | Public | Refresh access token |
| `POST` | `/api/auth/logout` | Public | End current session |
| `POST` | `/api/auth/logout-all` | Authenticated | End all sessions |
| `POST` | `/api/auth/forgot-password` | Public | Send password reset link |
| `POST` | `/api/auth/reset-password` | Public | Reset password with token |
| `GET` | `/api/auth/session` | Public | Inspect current session |
| `GET` | `/api/auth/me` | Authenticated | Current user profile |

### TOR Announcements
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tors` | Public | Paginated list; supports `search`, `departmentId`, `procurementMethod`, `stage`, `stageScope`, `fromDate`, `toDate`, `sort`, `page`, `limit` |
| `GET` | `/api/tors/:projectId` | Public | Project detail with stage observations |
| `PATCH` | `/api/tors/:projectId` | PM / system admin | Update editable fields |
| `GET` | `/api/tors/documents/:projectId` | Public | Inline document preview (proxied) |
| `GET` | `/api/tors/documents/:projectId/download` | Public | Document download (proxied) |
| `GET` | `/api/tors/:projectId/evaluation` | Company | Read company-specific AI evaluation |
| `POST` | `/api/tors/:projectId/evaluation` | Company | Request evaluation via n8n |
| `GET` | `/api/thumbnail/:projectId` | Public | WebP thumbnail (`404` if missing or stale) |

### Companies, Matching & Recommendations
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/companies/me` | Company | Read own company profile |
| `PUT` | `/api/companies/me` | Company | Update own company profile |
| `POST` | `/api/companies/me/matching-tags/sync` | Company | Sync profile entries to controlled tags |
| `GET` | `/api/matches` | Company | Requirement matches for own company |
| `GET` | `/api/matches/ai-input` | Company | Structured input for AI review |
| `GET` | `/api/recommendations` | Company | Recommendation status (`not_configured` until connected) |

### Tags
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tags` | Public | List active tags (`category`, `search`) |
| `POST` | `/api/tags` | System admin | Create tag |
| `GET` | `/api/tags/:tagId` | System admin | Read tag |
| `PATCH` | `/api/tags/:tagId` | System admin | Update tag |
| `DELETE` | `/api/tags/:tagId` | System admin | Deactivate tag (soft delete) |
| `GET` | `/api/tags/companies/:companyId` | Authenticated | Company tag assignments |
| `PUT` | `/api/tags/companies/:companyId` | Authenticated | Replace company tag assignments |
| `PUT` | `/api/tags/tors/:projectId` | PM / system admin | Replace TOR tag assignments |
| `GET` | `/api/tags/tors/:projectId/suggestions` | PM / system admin | List AI tag suggestions |
| `PUT` | `/api/tags/tors/:projectId/suggestions` | PM / system admin | Submit AI tag suggestions |
| `PATCH` | `/api/tags/tors/:projectId/suggestions/:suggestionId` | PM / system admin | Approve or reject a suggestion |

### AI Worker
Requires the scoped `AI_REQUIREMENTS_TOKEN`.

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/ai/tors/:projectId/source` | AI worker | Numbered page text for requirement extraction |
| `POST` | `/api/ai/tors/:projectId/requirements` | AI worker | Submit extracted requirements with citations |

### Notifications
Defined in `tor-backend/src/routes/notification.routes.mjs`. Preference routes also live in this router; check that file for the exact preference endpoints.

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications` | Authenticated | List notifications |
| `PATCH` | `/api/notifications/read-all` | Authenticated | Mark all as read |
| `PATCH` | `/api/notifications/:id/read` | Authenticated | Mark one as read |
