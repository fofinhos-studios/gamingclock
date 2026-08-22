# AGENTS.md — Gaming Clock

## What This Project Is

**Gaming Clock** is a web app that lets users create backlogs/lists of video games and calculates how long it will take to beat them. It pulls game duration data from How Long To Beat (HLTB) and game metadata from IGDB. Users can set their weekly availability (which days, how many hours per day) and the app generates a realistic play schedule — including exportable calendar files (iCal).

## Goals

1. **MVP**: Search games, add to lists, see total time, set weekly availability, generate play schedule, export to calendar
2. **No accounts for MVP** — but architecture must support adding auth/persistence later
3. **Two scheduling algorithms**: sequential (one game at a time) and alternating (rotate between games)
4. **IGDB**: use the live IGDB API in configured deployments; use the deterministic fallback catalog only without credentials, for local development and tests

## Tech Stack

- **Backend**: Python 3.14, FastAPI, Pydantic, httpx, howlongtobeatpy, ruff, ty, pytest + xdist
- **Frontend**: Node.js + Aube, Vite + Preact, Tailwind CSS (minimal styling for MVP — raw elements, focus on layout/functionality)
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
│   └── biome.json
├── docker-compose.yml
├── Justfile
├── hk.pkl
├── .github/workflows/ci.yml
├── AGENTS.md
└── README.md
```

## Instructions for AI Agents

### Working on Tasks

1. **Use tests proportionally**: add or update tests for behavior changes, bugs, data handling, APIs, and algorithms. Do not write regression tests for small visual, copy, spacing, or styling-only edits unless they carry meaningful behavioral risk.
2. **Batch related edits before validating**: avoid running the test suite after every small edit. Use focused checks only when they meaningfully reduce risk; let the required commit hooks provide the full validation gate.
3. **One task at a time**: complete it fully before moving on

### Committing Changes

Commit often, using small atomic commits that each contain one logical change. Use pure git CLI, stage specific files, and never use `git add -A`.

Every commit must be signed and use a conventional commit message with a scope: `type(scope): description`. Use `git commit -S`.

Push small, self-contained changes directly to `main`. For larger changes, create a pull request. If a change is too large for one pull request, split it into a stack of pull requests using GitHub's stacked PR functionality.

For any self-contained change, agents must commit and push directly to `main` after successful validation unless the user explicitly says not to. Do not wait for a separate request to push.

`hk` runs the same backend and frontend audit, lint, test, and build checks as GitHub Actions before every commit and push. Do not bypass it. Install the repository hooks with `hk install` and verify them with `hk run pre-commit`.

```bash
# Feature
git add backend/src/gamingclock/models/game.py backend/tests/test_models/test_game.py
git commit -S -m "feat(models): add Game pydantic model with HLTB fields"

# Fix
git commit -S -m "fix(hltb): handle missing duration in search results"

# Chore
git commit -S -m "chore(ci): add ruff config to pyproject.toml"

# Test
git commit -S -m "test(scheduling): add tests for alternating algorithm"

# Docs
git commit -S -m "docs(backend): update service layer patterns"
```

**Commit prefixes**: `feat`, `fix`, `chore`, `test`, `docs`, `refactor`, `ci`, `style`

**Scope** (required, in parentheses): the module or area, e.g. `models`, `hltb`, `scheduling`, `calendar`, `frontend`, `ci`

### General Rules

- **DRY, YAGNI**: Don't over-abstract. Don't build for hypothetical futures.
- **Tests**: Cover meaningful behavior and regressions; keep visual-only changes lean.
- **Small commits**: One logical change per commit.
- **No secrets**: Never commit `.env` files, API keys, or credentials.
- **Pydantic everywhere** on the backend: all data shapes are Pydantic models.
- **httpx** for HTTP requests (not requests).
- **Minimal frontend styling**: Raw HTML elements with basic Tailwind layout classes. No design system, no fancy components. Functionality first.
- **IGDB credentials**: never commit `IGDB_CLIENT_ID` or `IGDB_CLIENT_SECRET`. Preserve the live production path when credentials are available; do not substitute the fallback catalog in configured deployments.
