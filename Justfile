# Gaming Clock task runner

# Backend
backend-install:
    cd backend && uv sync --group dev

backend-dev:
    cd backend && uv run uvicorn gamingclock.main:app --reload --port 8000

backend-test:
    cd backend && uv run pytest -v

backend-test-parallel:
    cd backend && uv run pytest -n auto

backend-lint:
    cd backend && uv run ruff check src/ tests/ && uv run ty check

backend-format:
    cd backend && uv run ruff format src/ tests/

backend-audit:
    cd backend && uv audit --locked

# Frontend
frontend-install:
    cd frontend && bun install

frontend-dev:
    cd frontend && bun run dev

frontend-build:
    cd frontend && bun run build

frontend-lint:
    cd frontend && bunx @biomejs/biome check src/

frontend-format:
    cd frontend && bunx @biomejs/biome check --write src/

frontend-audit:
    cd frontend && bun audit

# Both
install: backend-install frontend-install

dev:
    just backend-dev & just frontend-dev

test: backend-test

lint: backend-lint frontend-lint

format: backend-format frontend-format

audit: backend-audit frontend-audit

# Docker
up:
    docker compose up --build

down:
    docker compose down
