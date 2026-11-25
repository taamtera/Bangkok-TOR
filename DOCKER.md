# TOR Software Docker Workflow

Docker Compose builds and runs the Express API and Next.js frontend. MongoDB Atlas and the externally hosted n8n crawler remain separate services. Source documents are fetched through the backend; Compose does not host document storage.

## Start

1. Install and start Docker Desktop.
2. Configure `tor-backend/.env` with the Atlas connection and an `AUTH_ACCESS_SECRET` of at least 32 characters: Compose sets `NODE_ENV=production`.
3. Run `docker compose config --quiet` to validate configuration without printing environment values.
4. Run `docker compose up --build -d`.
5. Open `http://localhost:3000` and `http://localhost:4000/api/health`.
6. Run `docker compose ps` to confirm both services are healthy.

## Stop

- Run `docker compose down` to stop both services.
- No database data is removed because Atlas is external.

## Logs

- API: `docker compose logs -f api`
- Frontend: `docker compose logs -f frontend`

## Safety

- Frontend `.env` files are excluded by its `.dockerignore`. The backend Dockerfile copies explicit source paths and does not copy `.env`; Compose injects it at runtime. The backend ignore file does not currently exclude `.env` from its build context, so use a trusted builder.
- Compose does not start n8n or the crawler. Coordinate ingestion with the workflow owner.
- No MongoDB or PDF data is stored in a container volume.
- Do not place the Atlas URI in a Dockerfile, image, frontend variable, or Compose file.
- Production deployments should use the hosting platform's secret manager or Docker secrets instead of copying a developer `.env` file.

## Windows Requirement

Docker Desktop's Linux engine requires WSL2 virtualization. If `docker desktop status` reports `stopped` and WSL says virtualization is unsupported, enable CPU virtualization in BIOS and the Windows `Virtual Machine Platform` and `Windows Subsystem for Linux` features, restart Windows, then start Docker Desktop again.
