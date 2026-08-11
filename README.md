# Gaming Clock

Gaming Clock is a monorepo MVP for planning video game backlogs. It lets you search games, organize them into lists, define weekly play availability, generate a schedule, and export that schedule as an iCal file.

## Stack

- Backend: FastAPI, Pydantic, pytest, Ruff, Ty
- Frontend: Preact, Vite, Tailwind CSS, Biome
- Tooling: Bun, Docker Compose, Just, Prek

## Prerequisites

- Python 3.14
- `uv`
- Bun
- Docker with Docker Compose
- `just` if you want to use the task runner

## Local Setup

### Backend

```bash
cd backend
uv sync --group dev
```

Production search uses IGDB when `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` are configured. Without both credentials (for local development and tests), it uses a small deterministic catalog instead.

### Vercel HLTB cache

Search responses are edge-cached for five minutes. To share resolved HLTB matches between Vercel function instances, install **Upstash Redis** from the Vercel Marketplace and expose its injected `KV_REST_API_URL` and `KV_REST_API_TOKEN` variables to the Production environment. The backend also accepts the standard `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` names. Resolved matches are cached for seven days; if Redis is unavailable, the app safely falls back to a live HLTB lookup.

Run the backend locally:

```bash
cd backend
uv run uvicorn gamingclock.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
bun install
```

Run the frontend locally:

```bash
cd frontend
bun run dev
```

The Vite dev server runs on `http://localhost:5173` and proxies `/api` to the backend on `http://localhost:8000`.

## Build

### Backend checks

```bash
cd backend
uv run pytest -v --tb=short
uv run ruff check src/ tests/
uv run ruff format --check src/ tests/
uv run ty check
```

Refresh the backend lockfile after dependency changes:

```bash
cd backend
uv lock
```

### Frontend build and lint

```bash
cd frontend
bun run build
bunx @biomejs/biome check src/
```

## Run With Just

If you have `just` installed, the most common commands are:

```bash
just backend-dev
just frontend-dev
just backend-test
just frontend-build
just up
just down
```

## Run With Docker Compose

Build and start the full stack:

```bash
docker compose build
docker compose up -d
```

Backend health check:

```bash
curl http://localhost:8000/health
```

Stop the stack:

```bash
docker compose down
```
