# AGENTS.md — Gaming Clock

## What This Project Is

**Gaming Clock** is a web app that lets users create backlogs/lists of video games and calculates how long it will take to beat them. It pulls game duration data from How Long To Beat (HLTB) and game metadata from IGDB. Users can set their weekly availability (which days, how many hours per day) and the app generates a realistic play schedule — including exportable calendar files (iCal).

## Goals

1. **MVP**: Search games, add to lists, see total time, set weekly availability, generate play schedule, export to calendar
2. **No accounts for MVP** — but architecture must support adding auth/persistence later
3. **Two scheduling algorithms**: sequential (one game at a time) and alternating (rotate between games)
4. **IGDB**: use the live IGDB API in configured deployments; use the deterministic fallback catalog only without credentials, for local development and tests

## Tech Stack

- **Backend**: Python 3.14, FastAPI, Pydantic, httpx, howlongtobeatpy, ruff, ty, pytest + xdist + Polyfactory
- **Frontend**: Bun, Vite + Preact, Tailwind CSS (minimal styling for MVP — raw elements, focus on layout/functionality)
- **Infra**: Docker Compose, GitHub Actions, Justfile, hk (git hook manager)

## Project Structure

```
gamingclock/
├── backend/
│   ├── src/
│   │   └── gamingclock/
│   │       ├── __init__.py
│   │       ├── main.py          # FastAPI app
│   │       ├── models/          # Pydantic models
│   │       ├── services/        # HLTB, IGDB, scheduling
│   │       ├── routers/         # API route modules
│   │       └── calendar/        # iCal generation
│   ├── tests/
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── app.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.ts
├── docker-compose.yml
├── Justfile
├── hk.pkl
├── .github/workflows/ci.yml
├── AGENTS.md
└── README.md
```

## Instructions for AI Agents

### Working on Tasks

1. **Follow TDD**: write the failing test first, verify it fails, implement, verify it passes
2. **One task at a time**: complete it fully before moving on

### Committing Changes

Use **conventional commits** with pure git CLI. Stage specific files, never `git add -A`.

Push each successful commit to the tracked remote unless the user explicitly says not to push.

`hk` runs the same backend and frontend audit, lint, test, and build checks as GitHub Actions before every commit and push. Do not bypass it. Install the repository hooks with `hk install` and verify them with `hk run pre-commit`.

```bash
# Feature
git add backend/src/gamingclock/models/game.py backend/tests/test_models/test_game.py
git commit -m "feat(models): add Game pydantic model with HLTB fields"

# Fix
git commit -m "fix(hltb): handle missing duration in search results"

# Chore
git commit -m "chore: add ruff config to pyproject.toml"

# Test
git commit -m "test(scheduling): add tests for alternating algorithm"

# Docs
git commit -m "docs: update backend SKILL.md with service layer patterns"
```

**Commit prefixes**: `feat`, `fix`, `chore`, `test`, `docs`, `refactor`, `ci`, `style`

**Scope** (optional, in parentheses): the module or area, e.g. `models`, `hltb`, `scheduling`, `calendar`, `frontend`, `ci`

### General Rules

- **DRY, YAGNI**: Don't over-abstract. Don't build for hypothetical futures.
- **TDD**: Test first, always.
- **Small commits**: One logical change per commit.
- **No secrets**: Never commit `.env` files, API keys, or credentials.
- **Pydantic everywhere** on the backend: all data shapes are Pydantic models.
- **httpx** for HTTP requests (not requests).
- **Minimal frontend styling**: Raw HTML elements with basic Tailwind layout classes. No design system, no fancy components. Functionality first.
- **IGDB credentials**: never commit `IGDB_CLIENT_ID` or `IGDB_CLIENT_SECRET`. Preserve the live production path when credentials are available; do not substitute the fallback catalog in configured deployments.
