# TOR Software Platform

TOR Software is a web platform for discovering, reviewing, and managing Thai
government Terms of Reference (TOR) and procurement announcements. The
application provides a Next.js web interface, an Express API, MongoDB-backed
storage, document preview/download support, controlled tagging, and
requirement matching.

## Architecture

```text
Next.js frontend (port 3000)
              |
              v
Express API (port 4000) -----> MongoDB Atlas
              |
              +--------------> Python requirement-matching engine

TOR ingestion workflow ------> MongoDB Atlas
        (external n8n workflow)
```

The browser communicates only with the Express API. MongoDB credentials and
other private secrets must remain on the backend or in the deployment
platform's secret manager.

## Repository layout

| Directory or file | Purpose |
| --- | --- |
| [`frontend/`](./frontend/) | Next.js and React user interface |
| [`tor-backend/`](./tor-backend/) | Express API, authentication, repositories, document proxy, and matching integration |
| [`database-design/`](./database-design/) | MongoDB validators, indexes, migrations, verification, and schema documentation |
| [`tor-crawler/`](./tor-crawler/) | Handoff marker for the crawler workflow, which currently runs in n8n |
| [`docker-compose.yml`](./docker-compose.yml) | Local container orchestration for the frontend and API |
| [`DOCKER.md`](./DOCKER.md) | Docker-specific setup, safety, and troubleshooting notes |

## Prerequisites

- Node.js 24 or newer for the backend
- npm
- MongoDB Atlas access, or another MongoDB deployment
- Python 3.10 or newer when running requirement matching outside Docker
- Docker Desktop with WSL2/virtualization enabled when using Docker

## Local development

### 1. Configure the backend

Copy [`tor-backend/.env.example`](./tor-backend/.env.example) to
`tor-backend/.env` and set at least:

```dotenv
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=tor_software
```

Set a long random `AUTH_ACCESS_SECRET` for anything other than local
development. Do not commit `.env` files or share MongoDB connection strings.

### 2. Install dependencies

Run the following from the repository root:

```powershell
cd tor-backend
npm install

cd ..\frontend
npm install

cd ..\database-design
npm install
```

### 3. Prepare and verify the database

Run these commands from `database-design`:

```powershell
npm run db:check
npm run db:setup
npm run db:verify
```

`db:migrate` performs a read-only preview by default. Review its output before
using `--apply`; keep writers paused and create a new backup when applying a
migration. See [`database-design/README.md`](./database-design/README.md) for
the migration procedure and schema details.

### 4. Start the services

In separate terminals:

```powershell
cd tor-backend
npm run dev
```

```powershell
cd frontend
npm run dev
```

The frontend is available at <http://localhost:3000>. The API health endpoint
is <http://localhost:4000/api/health>. The frontend defaults to the API at
`http://localhost:4000`; override it with
`NEXT_PUBLIC_API_BASE_URL` when required.

## Docker

Docker starts the frontend and API together while MongoDB Atlas remains the
external data store:

```powershell
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Open <http://localhost:3000> and verify
<http://localhost:4000/api/health>. Stop the services with:

```powershell
docker compose down
```

For logs, health checks, Windows requirements, and deployment safety guidance,
see [`DOCKER.md`](./DOCKER.md).

## Useful commands

### Frontend

Run from `frontend`:

```powershell
npm run dev
npm run build
npm run start
npm test
npm run lint
```

### Backend

Run from `tor-backend`:

```powershell
npm run dev
npm run check
npm test
npm run verify:repositories
```

### Database package

Run from `database-design`:

```powershell
npm test
npm run handoff:verify
npm run db:verify-enrichment-removed
```

## Data and ingestion notes

- Projects and thumbnails use the string `projectId` as their application
  identity; MongoDB `_id` values are not exposed as project identities.
- The ingestion flow retains software/IT title filtering and supports
  nationwide coverage.
- The crawler code in this repository is currently represented by a handoff
  README; the active workflow runs in n8n.
- PDFs and other source documents are proxied by the backend and are not
  stored in container volumes.
- Database backups and source documents can contain sensitive data. Keep them
  private and never commit them.

## Security

Report security issues privately to the project maintainers rather than
opening a public issue. Never put `MONGODB_URI`, authentication secrets, AI
worker tokens, or other credentials in frontend environment variables,
Dockerfiles, images, or committed files.

