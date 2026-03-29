# Gaming Clock — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web app where users create game backlogs, see total time-to-beat, set weekly availability, and generate exportable play schedules.

**Architecture:** Monorepo with `backend/` (FastAPI + Pydantic) and `frontend/` (Vite + Preact). Backend exposes a REST API consumed by the frontend SPA. Docker Compose runs both services. HLTB data is fetched live; IGDB is mocked for MVP.

**Tech Stack:** Python 3.14 / FastAPI / Pydantic / httpx / howlongtobeatpy / pytest+xdist+Polyfactory | Bun / Vite / Preact / Tailwind CSS | Docker Compose / GitHub Actions / Justfile / Prek

---

## Phase 1: Project Scaffolding

### Task 1.1: Create backend project structure

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/src/gamingclock/__init__.py`
- Create: `backend/src/gamingclock/main.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/SKILL.md`

**Step 1: Create `backend/pyproject.toml`**

```toml
[project]
name = "gamingclock"
version = "0.1.0"
description = "Gaming backlog clock - estimate how long to beat your game lists"
requires-python = ">=3.14"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.34",
    "pydantic>=2.11",
    "httpx>=0.28",
    "howlongtobeatpy>=1.2",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3",
    "pytest-xdist>=3.5",
    "pytest-asyncio>=0.25",
    "polyfactory>=2.19",
    "httpx",  # for TestClient
    "ruff>=0.11",
]

[tool.ruff]
target-version = "py314"
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "SIM", "RUF"]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
```

**Step 2: Create `backend/src/gamingclock/__init__.py`**

```python
```

(Empty file)

**Step 3: Create `backend/src/gamingclock/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="GamingClock", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

**Step 4: Create `backend/tests/__init__.py` and `backend/tests/conftest.py`**

`conftest.py`:
```python
import pytest
from fastapi.testclient import TestClient

from gamingclock.main import app


@pytest.fixture
def client():
    return TestClient(app)
```

**Step 5: Create `backend/SKILL.md`**

```markdown
# Backend SKILL.md

## Project

- **Framework**: FastAPI
- **Models**: Pydantic v2
- **HTTP client**: httpx
- **Tests**: pytest + xdist + polyfactory

## How to run

```bash
cd backend
uv sync --group dev
uv run uvicorn gamingclock.main:app --reload --port 8000
```

## How to test

```bash
cd backend
pytest -v
pytest -n auto  # parallel with xdist
```

## How to lint

```bash
cd backend
ruff check src/ tests/
ruff format src/ tests/
```
```

**Step 6: Write a smoke test**

`backend/tests/test_health.py`:
```python
def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

**Step 7: Install deps and run the test**

```bash
cd backend
uv sync --group dev
uv run pytest tests/test_health.py -v
```

Expected: PASS

**Step 8: Commit**

```bash
git add backend/
git commit -m "feat: scaffold backend project with FastAPI, pytest, and health endpoint"
```

---

### Task 1.2: Create frontend project structure

> **Partial progress:** `bun init -y` ran, all deps installed (`preact`, `@preact/preset-vite`, `vite`, `tailwindcss`, `@tailwindcss/vite`), `bun.lock` and `node_modules` present. **Still needed:** `vite.config.ts`, `index.html`, `src/main.tsx`, `src/app.tsx`, `src/index.css`, `SKILL.md`, add `scripts` to `package.json`, replace `tsconfig.json` with spec version (needs `jsxImportSource: "preact"`).

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/app.tsx`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/src/index.css`
- Create: `frontend/SKILL.md`

**Step 1: Initialize with Bun**

```bash
cd frontend
bun init -y
```

**Step 2: Install dependencies**

```bash
cd frontend
bun add preact @preact/preset-vite
bun add -d vite typescript @types/node tailwindcss @tailwindcss/vite
```

**Step 3: Create `vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	plugins: [preact(), tailwindcss()],
	server: {
		port: 5173,
		proxy: {
			"/api": {
				target: "http://localhost:8000",
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, ""),
			},
		},
	},
});
```

**Step 4: Create `tsconfig.json`**

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "jsx": "react-jsx",
        "jsxImportSource": "preact",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noEmit": true,
        "paths": {
            "react": ["./node_modules/preact/compat/"],
            "react-dom": ["./node_modules/preact/compat/"]
        }
    },
    "include": ["src"]
}
```

**Step 5: Create `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gaming Clock</title>
</head>
<body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**Step 6: Create `frontend/src/index.css`**

```css
@import "tailwindcss";
```

**Step 7: Create `frontend/src/main.tsx`**

```tsx
import { render } from "preact";
import { App } from "./app";
import "./index.css";

render(<App />, document.getElementById("app")!);
```

**Step 8: Create `frontend/src/app.tsx`**

```tsx
export function App() {
    return (
        <div>
            <h1>Gaming Clock</h1>
            <p>Plan your gaming backlog.</p>
        </div>
    );
}
```

**Step 9: Create `frontend/SKILL.md`**

```markdown
# Frontend SKILL.md

## Project

- **Framework**: Preact (lightweight React alternative)
- **Bundler**: Vite
- **Styling**: Tailwind CSS (minimal for MVP — raw elements, layout only)
- **Package manager**: Bun
- **Linter**: biome

## How to run

```bash
cd frontend
bun install
bun run dev
```

## How to build

```bash
cd frontend
bun run build
```

## How to lint

```bash
cd frontend
bunx @biomejs/biome check src/
bunx @biomejs/biome check --write src/
```

## Conventions

- Use `.tsx` for all component files
- Functional components only, use Preact hooks
- API calls go in `src/services/`
- Shared types go in `src/types.ts`
- Pages (routed views) go in `src/pages/`
- Reusable components go in `src/components/`
```

**Step 10: Verify it builds**

```bash
cd frontend
bun run build
```

Expected: Build succeeds

**Step 11: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold frontend with Vite, Preact, and Tailwind CSS"
```

---

### Task 1.3: Create Justfile

**Files:**
- Create: `Justfile`

**Step 1: Write the Justfile**

```just
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
    cd backend && uv run ruff check src/ tests/

backend-format:
    cd backend && uv run ruff format src/ tests/

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

# Both
install: backend-install frontend-install

dev:
    just backend-dev & just frontend-dev

test: backend-test

lint: backend-lint frontend-lint

format: backend-format frontend-format

# Docker
up:
    docker compose up --build

down:
    docker compose down
```

**Step 2: Verify**

```bash
just --list
```

**Step 3: Commit**

```bash
git add Justfile
git commit -m "chore: add Justfile with backend, frontend, and docker commands"
```

---

### Task 1.4: Create Docker Compose setup

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `docker-compose.yml`

**Step 1: Create `backend/Dockerfile`**

```dockerfile
FROM python:3.14-slim

WORKDIR /app

COPY pyproject.toml .
COPY src/ src/

RUN uv sync --locked --no-dev

EXPOSE 8000

CMD ["uvicorn", "gamingclock.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 2: Create `frontend/Dockerfile`**

```dockerfile
FROM oven/bun:latest AS build

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

**Step 3: Create `frontend/nginx.conf`**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Step 4: Create `docker-compose.yml`**

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - PYTHONUNBUFFERED=1

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
```

**Step 5: Verify**

```bash
docker compose config
```

**Step 6: Commit**

```bash
git add backend/Dockerfile frontend/Dockerfile frontend/nginx.conf docker-compose.yml
git commit -m "chore: add Docker Compose setup for backend and frontend"
```

---

### Task 1.5: Create GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Write CI workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.14"
          allow-prereleases: true

      - name: Install dependencies
        run: cd backend && uv sync --group dev

      - name: Lint
        run: cd backend && ruff check src/ tests/

      - name: Test
        run: cd backend && pytest -n auto -v

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: cd frontend && bun install

      - name: Lint
        run: cd frontend && bunx @biomejs/biome check src/

      - name: Build
        run: cd frontend && bun run build
```

**Step 2: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions workflow for backend and frontend"
```

---

### Task 1.6: Set up Prek pre-commit hooks

Prek is a Rust-based pre-commit framework (`brew install prek`). It supports workspace mode — place configs in subdirectories and they auto-discover. Use `orphan = true` in subproject configs to isolate them.

**Files:**
- Create: `prek.toml` (root)
- Create: `backend/prek.toml`
- Create: `frontend/prek.toml`

**Step 1: Install Prek**

```bash
brew install prek
```

**Step 2: Create root `prek.toml`**

```toml
fail_fast = false

[[repos]]
repo = "builtin"
hooks = [
  { id = "trailing-whitespace" },
  { id = "end-of-file-fixer" },
  { id = "check-yaml" },
  { id = "check-toml" },
]
```

**Step 3: Create `backend/prek.toml`**

```toml
orphan = true

[[repos]]
repo = "https://github.com/astral-sh/ruff-pre-commit"
rev = "v0.15.8"
hooks = [
  { id = "ruff-check", args = ["--fix"] },
  { id = "ruff-format" },
]

[[repos]]
repo = "local"
hooks = [
  { id = "ty", name = "ty type check", language = "system", entry = "ty check", files = "\\.py$", pass_filenames = false },
]
```

> **Note:** The `rev` for ruff-pre-commit should be pinned to the latest available version at the time of implementation. Check https://github.com/astral-sh/ruff-pre-commit/releases for the latest tag.

**Step 4: Create `frontend/prek.toml`**

```toml
orphan = true

[[repos]]
repo = "local"
hooks = [
  { id = "biome-check", name = "biome check", language = "system", entry = "bun run biome check --write --files-ignore-unknown=true --no-errors-on-unmatched", files = "\\.(js|jsx|ts|tsx|json|css)$" },
]
```

**Step 5: Install hooks and verify**

```bash
prek install
prek run --all-files
```

**Step 6: Commit**

```bash
git add prek.toml backend/prek.toml frontend/prek.toml
git commit -m "chore: add Prek pre-commit hooks for ruff, ty, and biome"
```

---

## Phase 2: Backend — Pydantic Models

### Task 2.1: Create Game model

**Files:**
- Create: `backend/src/gamingclock/models/__init__.py`
- Create: `backend/src/gamingclock/models/game.py`
- Create: `backend/tests/test_models/__init__.py`
- Create: `backend/tests/test_models/test_game.py`

**Step 1: Write failing test**

`backend/tests/test_models/test_game.py`:
```python
from gamingclock.models.game import Game


def test_game_model():
    game = Game(
        name="Final Fantasy VII",
        image_url="https://howlongtobeat.com/games/ff7.png",
        main_story_hours=36.5,
        main_extra_hours=52.0,
        completionist_hours=82.0,
    )
    assert game.name == "Final Fantasy VII"
    assert game.main_story_hours == 36.5


def test_game_total_defaults_to_main_story():
    game = Game(
        name="Test",
        image_url="https://example.com/img.png",
        main_story_hours=10.0,
    )
    assert game.main_extra_hours is None
    assert game.completionist_hours is None
```

**Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_models/test_game.py -v
```

Expected: FAIL — `ModuleNotFoundError`

**Step 3: Implement**

`backend/src/gamingclock/models/__init__.py`:
```python
from gamingclock.models.game import Game
from gamingclock.models.game_list import GameList

__all__ = ["Game", "GameList"]
```

> Note: `GameList` import will fail until Task 2.2. For now, just export `Game`:

```python
from gamingclock.models.game import Game

__all__ = ["Game"]
```

`backend/src/gamingclock/models/game.py`:
```python
from pydantic import BaseModel


class Game(BaseModel):
    name: str
    image_url: str
    main_story_hours: float
    main_extra_hours: float | None = None
    completionist_hours: float | None = None
```

**Step 4: Run test to verify it passes**

```bash
cd backend && pytest tests/test_models/test_game.py -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/gamingclock/models/ backend/tests/test_models/
git commit -m "feat(models): add Game pydantic model with HLTB duration fields"
```

---

### Task 2.2: Create GameList model

**Files:**
- Create: `backend/src/gamingclock/models/game_list.py`
- Create: `backend/tests/test_models/test_game_list.py`

**Step 1: Write failing test**

`backend/tests/test_models/test_game_list.py`:
```python
from gamingclock.models.game import Game
from gamingclock.models.game_list import GameList


def _make_game(name: str, hours: float) -> Game:
    return Game(name=name, image_url="https://example.com/img.png", main_story_hours=hours)


def test_game_list_total_hours():
    gl = GameList(
        name="Final Fantasy Series",
        games=[_make_game("FF7", 36.5), _make_game("FF8", 40.0)],
    )
    assert gl.total_main_story_hours == 76.5


def test_empty_game_list():
    gl = GameList(name="Empty", games=[])
    assert gl.total_main_story_hours == 0.0
```

**Step 2: Run test — expect FAIL**

```bash
cd backend && pytest tests/test_models/test_game_list.py -v
```

**Step 3: Implement**

`backend/src/gamingclock/models/game_list.py`:
```python
from pydantic import BaseModel, computed_field

from gamingclock.models.game import Game


class GameList(BaseModel):
    name: str
    games: list[Game] = []

    @computed_field
    @property
    def total_main_story_hours(self) -> float:
        return sum(g.main_story_hours for g in self.games)
```

Update `backend/src/gamingclock/models/__init__.py` to export both:
```python
from gamingclock.models.game import Game
from gamingclock.models.game_list import GameList

__all__ = ["Game", "GameList"]
```

**Step 4: Run test — expect PASS**

```bash
cd backend && pytest tests/test_models/test_game_list.py -v
```

**Step 5: Commit**

```bash
git add backend/src/gamingclock/models/ backend/tests/test_models/
git commit -m "feat(models): add GameList model with total hours computation"
```

---

### Task 2.3: Create Schedule and Availability models

**Files:**
- Create: `backend/src/gamingclock/models/schedule.py`
- Create: `backend/tests/test_models/test_schedule.py`

**Step 1: Write failing test**

`backend/tests/test_models/test_schedule.py`:
```python
from gamingclock.models.schedule import WeeklyAvailability, DayAvailability, ScheduleRequest, PlaySession, ScheduleAlgorithm
import datetime


def test_weekly_availability_uniform():
    """User plays 2 hours every day they selected."""
    avail = WeeklyAvailability(
        days=[DayAvailability(day_of_week=0, hours=2.0), DayAvailability(day_of_week=2, hours=2.0)],
    )
    assert len(avail.days) == 2
    assert avail.days[0].hours == 2.0


def test_weekly_availability_total_weekly_hours():
    avail = WeeklyAvailability(
        days=[
            DayAvailability(day_of_week=0, hours=2.0),
            DayAvailability(day_of_week=5, hours=4.0),
            DayAvailability(day_of_week=6, hours=4.0),
        ],
    )
    assert avail.total_weekly_hours == 10.0


def test_schedule_request():
    req = ScheduleRequest(
        game_list_name="My List",
        game_names=["FF7", "FF8"],
        availability=WeeklyAvailability(
            days=[DayAvailability(day_of_week=0, hours=2.0)],
        ),
        algorithm=ScheduleAlgorithm.SEQUENTIAL,
        start_date=datetime.date(2026, 4, 1),
    )
    assert req.algorithm == ScheduleAlgorithm.SEQUENTIAL


def test_play_session():
    session = PlaySession(
        game_name="FF7",
        date=datetime.date(2026, 4, 1),
        start_time=datetime.time(20, 0),
        duration_hours=2.0,
    )
    assert session.game_name == "FF7"
    assert session.duration_hours == 2.0
```

**Step 2: Run test — expect FAIL**

```bash
cd backend && pytest tests/test_models/test_schedule.py -v
```

**Step 3: Implement**

`backend/src/gamingclock/models/schedule.py`:
```python
import datetime
from enum import StrEnum

from pydantic import BaseModel, computed_field


class ScheduleAlgorithm(StrEnum):
    SEQUENTIAL = "sequential"
    ALTERNATING = "alternating"


class DayAvailability(BaseModel):
    day_of_week: int  # 0=Monday, 6=Sunday
    hours: float


class WeeklyAvailability(BaseModel):
    days: list[DayAvailability]

    @computed_field
    @property
    def total_weekly_hours(self) -> float:
        return sum(d.hours for d in self.days)


class ScheduleRequest(BaseModel):
    game_list_name: str
    game_names: list[str]
    availability: WeeklyAvailability
    algorithm: ScheduleAlgorithm = ScheduleAlgorithm.SEQUENTIAL
    start_date: datetime.date = datetime.date.today()


class PlaySession(BaseModel):
    game_name: str
    date: datetime.date
    start_time: datetime.time
    duration_hours: float
```

**Step 4: Run test — expect PASS**

```bash
cd backend && pytest tests/test_models/test_schedule.py -v
```

**Step 5: Commit**

```bash
git add backend/src/gamingclock/models/schedule.py backend/tests/test_models/test_schedule.py
git commit -m "feat(models): add Schedule, Availability, and PlaySession models"
```

---

### Task 2.4: Create Polyfactory factories for all models

**Files:**
- Create: `backend/tests/factories.py`
- Create: `backend/tests/test_factories.py`

**Step 1: Write failing test**

`backend/tests/test_factories.py`:
```python
from tests.factories import GameFactory, GameListFactory, PlaySessionFactory


def test_game_factory():
    game = GameFactory.build()
    assert game.name
    assert game.main_story_hours > 0


def test_game_list_factory():
    gl = GameListFactory.build()
    assert gl.name
    assert isinstance(gl.games, list)


def test_play_session_factory():
    session = PlaySessionFactory.build()
    assert session.game_name
    assert session.duration_hours > 0
```

**Step 2: Run test — expect FAIL**

```bash
cd backend && pytest tests/test_factories.py -v
```

**Step 3: Implement**

`backend/tests/factories.py`:
```python
from polyfactory.factories.pydantic_factory import ModelFactory

from gamingclock.models.game import Game
from gamingclock.models.game_list import GameList
from gamingclock.models.schedule import PlaySession


class GameFactory(ModelFactory):
    __model__ = Game


class GameListFactory(ModelFactory):
    __model__ = GameList


class PlaySessionFactory(ModelFactory):
    __model__ = PlaySession
```

**Step 4: Run test — expect PASS**

```bash
cd backend && pytest tests/test_factories.py -v
```

**Step 5: Commit**

```bash
git add backend/tests/factories.py backend/tests/test_factories.py
git commit -m "test: add Polyfactory factories for Game, GameList, and PlaySession"
```

---

## Phase 3: Backend — Services

### Task 3.1: Create HLTB service

**Files:**
- Create: `backend/src/gamingclock/services/__init__.py`
- Create: `backend/src/gamingclock/services/hltb.py`
- Create: `backend/tests/test_services/__init__.py`
- Create: `backend/tests/test_services/test_hltb.py`

**Step 1: Write failing test**

`backend/tests/test_services/test_hltb.py`:
```python
import pytest

from gamingclock.models.game import Game
from gamingclock.services.hltb import HLTBService


@pytest.mark.asyncio
async def test_search_returns_games():
    service = HLTBService()
    results = await service.search("Grand Theft Auto V")
    assert len(results) > 0
    assert isinstance(results[0], Game)
    assert results[0].name  # has a name
    assert results[0].main_story_hours > 0  # has duration


@pytest.mark.asyncio
async def test_search_no_results():
    service = HLTBService()
    results = await service.search("xyznonexistentgame12345")
    assert results == []
```

**Step 2: Run test — expect FAIL**

```bash
cd backend && pytest tests/test_services/test_hltb.py -v
```

**Step 3: Implement**

The existing codebase uses `howlongtobeatpy`. The library has `HowLongToBeat().search()` which returns result objects with attributes like `game_name`, `game_image_url`, `main_story`, `main_extra`, `completionist`.

`backend/src/gamingclock/services/__init__.py`:
```python
```

`backend/src/gamingclock/services/hltb.py`:
```python
from howlongtobeatpy import HowLongToBeat

from gamingclock.models.game import Game


class HLTBService:
    def __init__(self, similarity_threshold: float = 0.2):
        self._threshold = similarity_threshold

    async def search(self, query: str) -> list[Game]:
        results = await HowLongToBeat(self._threshold).async_search(query, similarity_case_sensitive=False)
        if not results:
            return []
        return [self._to_game(r) for r in results]

    @staticmethod
    def _to_game(result) -> Game:
        """Convert a howlongtobeatpy result to our Game model."""
        return Game(
            name=result.game_name,
            image_url=f"https://www.howlongtobeat.com{result.game_image_url}" if result.game_image_url else "",
            main_story_hours=result.main_story or 0.0,
            main_extra_hours=result.main_extra or None,
            completionist_hours=result.completionist or None,
        )
```

> **Note:** The `howlongtobeatpy` library may have changed its attribute names. The agent MUST check the library's actual API by inspecting the result object if tests fail. The existing code in `main.py` used `gameplay_main` and `gameplay_main_unit` — the library may have been updated since. Check with `dir(result)` or the library source.

**Step 4: Run test — expect PASS**

```bash
cd backend && pytest tests/test_services/test_hltb.py -v
```

> These are integration tests hitting the real HLTB API. They may be slow. Mark them with `@pytest.mark.integration` if needed and skip in CI with `-m "not integration"`.

**Step 5: Commit**

```bash
git add backend/src/gamingclock/services/ backend/tests/test_services/
git commit -m "feat(hltb): add HLTB service with async search returning Game models"
```

**Step 6: Update `backend/SKILL.md`**

Add HLTB service section explaining the library wrapper pattern.

```bash
git add backend/SKILL.md
git commit -m "docs: update backend SKILL.md with HLTB service documentation"
```

---

### Task 3.2: Create IGDB mock service

**Files:**
- Create: `backend/src/gamingclock/services/igdb.py`
- Create: `backend/tests/test_services/test_igdb.py`

**Step 1: Write failing test**

`backend/tests/test_services/test_igdb.py`:
```python
import pytest

from gamingclock.services.igdb import IGDBService


@pytest.mark.asyncio
async def test_igdb_search_returns_metadata():
    """For MVP, IGDB returns mocked data. Just verify the shape."""
    service = IGDBService()
    results = await service.search("Final Fantasy VII")
    assert len(results) > 0
    result = results[0]
    assert result.name
    assert result.igdb_id
    assert result.summary


@pytest.mark.asyncio
async def test_igdb_get_by_id():
    service = IGDBService()
    result = await service.get_by_id(1234)
    assert result is not None
    assert result.igdb_id == 1234
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement**

`backend/src/gamingclock/services/igdb.py`:
```python
from pydantic import BaseModel


class IGDBGameMetadata(BaseModel):
    igdb_id: int
    name: str
    summary: str
    cover_url: str
    genres: list[str] = []
    platforms: list[str] = []
    release_year: int | None = None


class IGDBService:
    """Mock IGDB service for MVP. Returns fake data.

    TODO: Replace with real IGDB API calls using httpx when ready.
    """

    async def search(self, query: str) -> list[IGDBGameMetadata]:
        return [
            IGDBGameMetadata(
                igdb_id=9999,
                name=query,
                summary=f"A great game matching '{query}'.",
                cover_url="https://images.igdb.com/placeholder.jpg",
                genres=["RPG"],
                platforms=["PC", "PlayStation"],
                release_year=2024,
            )
        ]

    async def get_by_id(self, igdb_id: int) -> IGDBGameMetadata:
        return IGDBGameMetadata(
            igdb_id=igdb_id,
            name=f"Game {igdb_id}",
            summary=f"Metadata for game {igdb_id}.",
            cover_url="https://images.igdb.com/placeholder.jpg",
            genres=["Action"],
            platforms=["PC"],
            release_year=2023,
        )
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add backend/src/gamingclock/services/igdb.py backend/tests/test_services/test_igdb.py
git commit -m "feat(igdb): add mock IGDB service for MVP with fake metadata"
```

---

### Task 3.3: Create scheduling service — sequential algorithm

**Files:**
- Create: `backend/src/gamingclock/services/scheduler.py`
- Create: `backend/tests/test_services/test_scheduler.py`

**Step 1: Write failing test**

`backend/tests/test_services/test_scheduler.py`:
```python
import datetime

from gamingclock.models.game import Game
from gamingclock.models.schedule import (
    DayAvailability,
    PlaySession,
    ScheduleAlgorithm,
    WeeklyAvailability,
)
from gamingclock.services.scheduler import SchedulerService


def _make_game(name: str, hours: float) -> Game:
    return Game(name=name, image_url="https://example.com/img.png", main_story_hours=hours)


def test_sequential_single_game():
    """A 4-hour game with 2h/day on Mon+Wed should take 2 sessions."""
    games = [_make_game("Short Game", 4.0)]
    availability = WeeklyAvailability(
        days=[
            DayAvailability(day_of_week=0, hours=2.0),  # Monday
            DayAvailability(day_of_week=2, hours=2.0),  # Wednesday
        ],
    )
    # Start on Monday 2026-03-30
    start = datetime.date(2026, 3, 30)
    scheduler = SchedulerService()
    sessions = scheduler.generate(
        games=games,
        availability=availability,
        algorithm=ScheduleAlgorithm.SEQUENTIAL,
        start_date=start,
    )
    assert len(sessions) == 2
    assert sessions[0].game_name == "Short Game"
    assert sessions[0].date == datetime.date(2026, 3, 30)  # Monday
    assert sessions[0].duration_hours == 2.0
    assert sessions[1].date == datetime.date(2026, 4, 1)  # Wednesday


def test_sequential_multiple_games():
    """Two games played sequentially: finish first, then start second."""
    games = [_make_game("Game A", 2.0), _make_game("Game B", 2.0)]
    availability = WeeklyAvailability(
        days=[DayAvailability(day_of_week=0, hours=2.0)],  # Monday only
    )
    start = datetime.date(2026, 3, 30)  # Monday
    scheduler = SchedulerService()
    sessions = scheduler.generate(
        games=games,
        availability=availability,
        algorithm=ScheduleAlgorithm.SEQUENTIAL,
        start_date=start,
    )
    assert len(sessions) == 2
    assert sessions[0].game_name == "Game A"
    assert sessions[0].date == datetime.date(2026, 3, 30)
    assert sessions[1].game_name == "Game B"
    assert sessions[1].date == datetime.date(2026, 4, 6)  # Next Monday


def test_sequential_empty_list():
    games = []
    availability = WeeklyAvailability(days=[DayAvailability(day_of_week=0, hours=2.0)])
    scheduler = SchedulerService()
    sessions = scheduler.generate(
        games=games,
        availability=availability,
        algorithm=ScheduleAlgorithm.SEQUENTIAL,
        start_date=datetime.date(2026, 3, 30),
    )
    assert sessions == []
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement**

`backend/src/gamingclock/services/scheduler.py`:
```python
import datetime

from gamingclock.models.game import Game
from gamingclock.models.schedule import (
    DayAvailability,
    PlaySession,
    ScheduleAlgorithm,
    WeeklyAvailability,
)


class SchedulerService:
    def generate(
        self,
        games: list[Game],
        availability: WeeklyAvailability,
        algorithm: ScheduleAlgorithm,
        start_date: datetime.date,
        default_start_time: datetime.time = datetime.time(20, 0),
    ) -> list[PlaySession]:
        if not games:
            return []

        if algorithm == ScheduleAlgorithm.SEQUENTIAL:
            return self._sequential(games, availability, start_date, default_start_time)
        elif algorithm == ScheduleAlgorithm.ALTERNATING:
            return self._alternating(games, availability, start_date, default_start_time)
        else:
            raise ValueError(f"Unknown algorithm: {algorithm}")

    def _get_available_days_map(self, availability: WeeklyAvailability) -> dict[int, float]:
        """Map day_of_week -> hours available."""
        return {d.day_of_week: d.hours for d in availability.days}

    def _iter_play_dates(
        self, start_date: datetime.date, available_days: dict[int, float]
    ):
        """Yield (date, hours) for each available play day from start_date onwards."""
        current = start_date
        while True:
            weekday = current.weekday()
            if weekday in available_days:
                yield current, available_days[weekday]
            current += datetime.timedelta(days=1)

    def _sequential(
        self,
        games: list[Game],
        availability: WeeklyAvailability,
        start_date: datetime.date,
        default_start_time: datetime.time,
    ) -> list[PlaySession]:
        sessions: list[PlaySession] = []
        available_days = self._get_available_days_map(availability)
        date_iter = self._iter_play_dates(start_date, available_days)

        for game in games:
            remaining = game.main_story_hours
            while remaining > 0:
                date, hours = next(date_iter)
                session_hours = min(hours, remaining)
                sessions.append(
                    PlaySession(
                        game_name=game.name,
                        date=date,
                        start_time=default_start_time,
                        duration_hours=session_hours,
                    )
                )
                remaining -= session_hours

        return sessions

    def _alternating(
        self,
        games: list[Game],
        availability: WeeklyAvailability,
        start_date: datetime.date,
        default_start_time: datetime.time,
    ) -> list[PlaySession]:
        """Rotate between games each session for variety."""
        sessions: list[PlaySession] = []
        available_days = self._get_available_days_map(availability)
        date_iter = self._iter_play_dates(start_date, available_days)

        remaining = {game.name: game.main_story_hours for game in games}
        game_order = [g.name for g in games]
        game_idx = 0

        while any(r > 0 for r in remaining.values()):
            # Find next game that still has hours remaining
            attempts = 0
            while remaining[game_order[game_idx]] <= 0:
                game_idx = (game_idx + 1) % len(game_order)
                attempts += 1
                if attempts > len(game_order):
                    break

            if attempts > len(game_order):
                break

            current_game = game_order[game_idx]
            date, hours = next(date_iter)
            session_hours = min(hours, remaining[current_game])
            sessions.append(
                PlaySession(
                    game_name=current_game,
                    date=date,
                    start_time=default_start_time,
                    duration_hours=session_hours,
                )
            )
            remaining[current_game] -= session_hours
            game_idx = (game_idx + 1) % len(game_order)

        return sessions
```

**Step 4: Run test — expect PASS**

```bash
cd backend && pytest tests/test_services/test_scheduler.py -v
```

**Step 5: Commit**

```bash
git add backend/src/gamingclock/services/scheduler.py backend/tests/test_services/test_scheduler.py
git commit -m "feat(scheduling): add sequential scheduling algorithm"
```

---

### Task 3.4: Test alternating scheduling algorithm

**Files:**
- Modify: `backend/tests/test_services/test_scheduler.py`

**Step 1: Add alternating tests**

Append to `backend/tests/test_services/test_scheduler.py`:

```python
def test_alternating_two_games():
    """Two games should alternate sessions."""
    games = [_make_game("Game A", 2.0), _make_game("Game B", 2.0)]
    availability = WeeklyAvailability(
        days=[
            DayAvailability(day_of_week=0, hours=2.0),
            DayAvailability(day_of_week=2, hours=2.0),
        ],
    )
    start = datetime.date(2026, 3, 30)  # Monday
    scheduler = SchedulerService()
    sessions = scheduler.generate(
        games=games,
        availability=availability,
        algorithm=ScheduleAlgorithm.ALTERNATING,
        start_date=start,
    )
    assert len(sessions) == 2
    assert sessions[0].game_name == "Game A"
    assert sessions[1].game_name == "Game B"


def test_alternating_uneven_games():
    """Longer game gets more sessions after shorter one finishes."""
    games = [_make_game("Short", 2.0), _make_game("Long", 6.0)]
    availability = WeeklyAvailability(
        days=[DayAvailability(day_of_week=0, hours=2.0), DayAvailability(day_of_week=2, hours=2.0)],
    )
    start = datetime.date(2026, 3, 30)
    scheduler = SchedulerService()
    sessions = scheduler.generate(
        games=games,
        availability=availability,
        algorithm=ScheduleAlgorithm.ALTERNATING,
        start_date=start,
    )
    # Short: 1 session (2h), Long: 3 sessions (6h) = 4 total
    assert len(sessions) == 4
    assert sessions[0].game_name == "Short"
    assert sessions[1].game_name == "Long"
    # After Short is done, Long takes remaining sessions
    assert sessions[2].game_name == "Long"
    assert sessions[3].game_name == "Long"
```

**Step 2: Run tests — expect PASS** (implementation already done in 3.3)

```bash
cd backend && pytest tests/test_services/test_scheduler.py -v
```

**Step 3: Commit**

```bash
git add backend/tests/test_services/test_scheduler.py
git commit -m "test(scheduling): add tests for alternating scheduling algorithm"
```

---

### Task 3.5: Create iCal export service

**Files:**
- Create: `backend/src/gamingclock/calendar/__init__.py`
- Create: `backend/src/gamingclock/calendar/ical.py`
- Create: `backend/tests/test_calendar/__init__.py`
- Create: `backend/tests/test_calendar/test_ical.py`

**Step 1: Add icalendar dependency**

Add `icalendar>=6.1` to `pyproject.toml` dependencies.

**Step 2: Write failing test**

`backend/tests/test_calendar/test_ical.py`:
```python
import datetime

from gamingclock.calendar.ical import generate_ical
from gamingclock.models.schedule import PlaySession


def test_generate_ical_basic():
    sessions = [
        PlaySession(
            game_name="FF7",
            date=datetime.date(2026, 4, 1),
            start_time=datetime.time(20, 0),
            duration_hours=2.0,
        ),
        PlaySession(
            game_name="FF8",
            date=datetime.date(2026, 4, 3),
            start_time=datetime.time(20, 0),
            duration_hours=3.0,
        ),
    ]
    ical_str = generate_ical(sessions, calendar_name="My Gaming Schedule")
    assert "BEGIN:VCALENDAR" in ical_str
    assert "FF7" in ical_str
    assert "FF8" in ical_str
    assert "BEGIN:VEVENT" in ical_str


def test_generate_ical_empty():
    ical_str = generate_ical([], calendar_name="Empty")
    assert "BEGIN:VCALENDAR" in ical_str
    assert "VEVENT" not in ical_str
```

**Step 3: Run test — expect FAIL**

**Step 4: Implement**

`backend/src/gamingclock/calendar/__init__.py`:
```python
```

`backend/src/gamingclock/calendar/ical.py`:
```python
import datetime

from icalendar import Calendar, Event

from gamingclock.models.schedule import PlaySession


def generate_ical(sessions: list[PlaySession], calendar_name: str = "Gaming Clock Schedule") -> str:
    cal = Calendar()
    cal.add("prodid", "-//Gaming Clock//EN")
    cal.add("version", "2.0")
    cal.add("x-wr-calname", calendar_name)

    for session in sessions:
        event = Event()
        event.add("summary", f"🎮 {session.game_name}")
        start_dt = datetime.datetime.combine(session.date, session.start_time)
        end_dt = start_dt + datetime.timedelta(hours=session.duration_hours)
        event.add("dtstart", start_dt)
        event.add("dtend", end_dt)
        event.add("description", f"Gaming session: {session.game_name} ({session.duration_hours}h)")
        cal.add_component(event)

    return cal.to_ical().decode("utf-8")
```

**Step 5: Run test — expect PASS**

```bash
cd backend && pytest tests/test_calendar/test_ical.py -v
```

**Step 6: Commit**

```bash
git add backend/src/gamingclock/calendar/ backend/tests/test_calendar/ backend/pyproject.toml
git commit -m "feat(calendar): add iCal export from play sessions"
```

---

## Phase 4: Backend — API Routes

### Task 4.1: Create game search endpoint

**Files:**
- Create: `backend/src/gamingclock/routers/__init__.py`
- Create: `backend/src/gamingclock/routers/games.py`
- Create: `backend/tests/test_routers/__init__.py`
- Create: `backend/tests/test_routers/test_games.py`

**Step 1: Write failing test**

`backend/tests/test_routers/test_games.py`:
```python
from unittest.mock import AsyncMock, patch

from gamingclock.models.game import Game


def test_search_games(client):
    mock_games = [
        Game(name="Final Fantasy VII", image_url="https://example.com/ff7.png", main_story_hours=36.5),
    ]
    with patch("gamingclock.routers.games.hltb_service") as mock_service:
        mock_service.search = AsyncMock(return_value=mock_games)
        response = client.get("/games/search", params={"query": "Final Fantasy VII"})

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Final Fantasy VII"


def test_search_games_empty(client):
    with patch("gamingclock.routers.games.hltb_service") as mock_service:
        mock_service.search = AsyncMock(return_value=[])
        response = client.get("/games/search", params={"query": "nonexistent"})

    assert response.status_code == 200
    assert response.json() == []


def test_search_games_missing_query(client):
    response = client.get("/games/search")
    assert response.status_code == 422
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement**

`backend/src/gamingclock/routers/__init__.py`:
```python
```

`backend/src/gamingclock/routers/games.py`:
```python
from fastapi import APIRouter

from gamingclock.models.game import Game
from gamingclock.services.hltb import HLTBService

router = APIRouter(prefix="/games", tags=["games"])

hltb_service = HLTBService()


@router.get("/search", response_model=list[Game])
async def search_games(query: str) -> list[Game]:
    return await hltb_service.search(query)
```

Register the router in `backend/src/gamingclock/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from gamingclock.routers.games import router as games_router

app = FastAPI(title="GamingClock", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(games_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

**Step 4: Run test — expect PASS**

```bash
cd backend && pytest tests/test_routers/test_games.py -v
```

**Step 5: Commit**

```bash
git add backend/src/gamingclock/routers/ backend/src/gamingclock/main.py backend/tests/test_routers/
git commit -m "feat(api): add GET /games/search endpoint with HLTB integration"
```

---

### Task 4.2: Create schedule generation endpoint

**Files:**
- Create: `backend/src/gamingclock/routers/schedule.py`
- Create: `backend/tests/test_routers/test_schedule.py`

**Step 1: Write failing test**

`backend/tests/test_routers/test_schedule.py`:
```python
from unittest.mock import AsyncMock, patch

from gamingclock.models.game import Game


def test_generate_schedule(client):
    mock_games = [
        Game(name="FF7", image_url="https://example.com/ff7.png", main_story_hours=4.0),
    ]
    with patch("gamingclock.routers.schedule.hltb_service") as mock_hltb:
        mock_hltb.search = AsyncMock(return_value=mock_games)
        response = client.post(
            "/schedule/generate",
            json={
                "game_list_name": "Test",
                "game_names": ["FF7"],
                "availability": {
                    "days": [{"day_of_week": 0, "hours": 2.0}]
                },
                "algorithm": "sequential",
                "start_date": "2026-03-30",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert "sessions" in data
    assert "total_hours" in data
    assert "estimated_end_date" in data
    assert len(data["sessions"]) > 0


def test_generate_schedule_empty_games(client):
    response = client.post(
        "/schedule/generate",
        json={
            "game_list_name": "Empty",
            "game_names": [],
            "availability": {
                "days": [{"day_of_week": 0, "hours": 2.0}]
            },
            "algorithm": "sequential",
            "start_date": "2026-03-30",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["sessions"] == []
    assert data["total_hours"] == 0
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement**

`backend/src/gamingclock/routers/schedule.py`:
```python
from fastapi import APIRouter
from pydantic import BaseModel

from gamingclock.models.schedule import PlaySession, ScheduleRequest
from gamingclock.services.hltb import HLTBService
from gamingclock.services.scheduler import SchedulerService

router = APIRouter(prefix="/schedule", tags=["schedule"])

hltb_service = HLTBService()
scheduler_service = SchedulerService()


class ScheduleResponse(BaseModel):
    sessions: list[PlaySession]
    total_hours: float
    estimated_end_date: str | None


@router.post("/generate", response_model=ScheduleResponse)
async def generate_schedule(request: ScheduleRequest) -> ScheduleResponse:
    # Look up each game from HLTB
    games = []
    for name in request.game_names:
        results = await hltb_service.search(name)
        if results:
            games.append(results[0])

    if not games:
        return ScheduleResponse(sessions=[], total_hours=0, estimated_end_date=None)

    sessions = scheduler_service.generate(
        games=games,
        availability=request.availability,
        algorithm=request.algorithm,
        start_date=request.start_date,
    )

    total_hours = sum(s.duration_hours for s in sessions)
    end_date = sessions[-1].date.isoformat() if sessions else None

    return ScheduleResponse(sessions=sessions, total_hours=total_hours, estimated_end_date=end_date)
```

Register in `main.py`:
```python
from gamingclock.routers.schedule import router as schedule_router
# ... after games_router
app.include_router(schedule_router)
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add backend/src/gamingclock/routers/schedule.py backend/src/gamingclock/main.py backend/tests/test_routers/test_schedule.py
git commit -m "feat(api): add POST /schedule/generate endpoint"
```

---

### Task 4.3: Create iCal download endpoint

**Files:**
- Modify: `backend/src/gamingclock/routers/schedule.py`
- Create: `backend/tests/test_routers/test_ical_download.py`

**Step 1: Write failing test**

`backend/tests/test_routers/test_ical_download.py`:
```python
from unittest.mock import AsyncMock, patch

from gamingclock.models.game import Game


def test_download_ical(client):
    mock_games = [
        Game(name="FF7", image_url="https://example.com/ff7.png", main_story_hours=2.0),
    ]
    with patch("gamingclock.routers.schedule.hltb_service") as mock_hltb:
        mock_hltb.search = AsyncMock(return_value=mock_games)
        response = client.post(
            "/schedule/ical",
            json={
                "game_list_name": "Test",
                "game_names": ["FF7"],
                "availability": {
                    "days": [{"day_of_week": 0, "hours": 2.0}]
                },
                "algorithm": "sequential",
                "start_date": "2026-03-30",
            },
        )

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/calendar; charset=utf-8"
    body = response.text
    assert "BEGIN:VCALENDAR" in body
    assert "FF7" in body
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement**

Add to `backend/src/gamingclock/routers/schedule.py`:

```python
from fastapi.responses import Response
from gamingclock.calendar.ical import generate_ical

@router.post("/ical")
async def download_ical(request: ScheduleRequest) -> Response:
    games = []
    for name in request.game_names:
        results = await hltb_service.search(name)
        if results:
            games.append(results[0])

    sessions = scheduler_service.generate(
        games=games,
        availability=request.availability,
        algorithm=request.algorithm,
        start_date=request.start_date,
    )

    ical_content = generate_ical(sessions, calendar_name=request.game_list_name)
    return Response(
        content=ical_content,
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="{request.game_list_name}.ics"'},
    )
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add backend/src/gamingclock/routers/schedule.py backend/tests/test_routers/test_ical_download.py
git commit -m "feat(api): add POST /schedule/ical endpoint for calendar download"
```

---

## Phase 5: Frontend — Core Components

### Task 5.1: Set up routing and page structure

**Files:**
- Install: `preact-router` (`bun add preact-router`)
- Create: `frontend/src/pages/home.tsx`
- Create: `frontend/src/types.ts`
- Modify: `frontend/src/app.tsx`

**Step 1: Install router**

```bash
cd frontend && bun add preact-router
```

**Step 2: Create `frontend/src/types.ts`**

```typescript
export interface Game {
    name: string;
    image_url: string;
    main_story_hours: number;
    main_extra_hours: number | null;
    completionist_hours: number | null;
}

export interface GameList {
    name: string;
    games: Game[];
}

export interface DayAvailability {
    day_of_week: number;
    hours: number;
}

export interface WeeklyAvailability {
    days: DayAvailability[];
}

export type ScheduleAlgorithm = "sequential" | "alternating";

export interface PlaySession {
    game_name: string;
    date: string;
    start_time: string;
    duration_hours: number;
}

export interface ScheduleResponse {
    sessions: PlaySession[];
    total_hours: number;
    estimated_end_date: string | null;
}
```

**Step 3: Create `frontend/src/pages/home.tsx`**

```tsx
export function HomePage() {
    return (
        <div>
            <h1>Gaming Clock</h1>
            <p>Plan your gaming backlog. Know exactly when you'll finish.</p>
        </div>
    );
}
```

**Step 4: Update `frontend/src/app.tsx`**

```tsx
import Router from "preact-router";
import { HomePage } from "./pages/home";

export function App() {
    return (
        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1rem" }}>
            <Router>
                <HomePage path="/" />
            </Router>
        </div>
    );
}
```

**Step 5: Verify build**

```bash
cd frontend && bun run build
```

**Step 6: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): add routing, types, and home page skeleton"
```

---

### Task 5.2: Create API service layer

**Files:**
- Create: `frontend/src/services/api.ts`

**Step 1: Create `frontend/src/services/api.ts`**

```typescript
import type {
    Game,
    WeeklyAvailability,
    ScheduleAlgorithm,
    ScheduleResponse,
} from "../types";

const API_BASE = "/api";

export async function searchGames(query: string): Promise<Game[]> {
    const params = new URLSearchParams({ query });
    const response = await fetch(`${API_BASE}/games/search?${params}`);
    if (!response.ok) throw new Error("Search failed");
    return response.json();
}

export async function generateSchedule(
    gameListName: string,
    gameNames: string[],
    availability: WeeklyAvailability,
    algorithm: ScheduleAlgorithm,
    startDate: string,
): Promise<ScheduleResponse> {
    const response = await fetch(`${API_BASE}/schedule/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            game_list_name: gameListName,
            game_names: gameNames,
            availability,
            algorithm,
            start_date: startDate,
        }),
    });
    if (!response.ok) throw new Error("Schedule generation failed");
    return response.json();
}

export async function downloadIcal(
    gameListName: string,
    gameNames: string[],
    availability: WeeklyAvailability,
    algorithm: ScheduleAlgorithm,
    startDate: string,
): Promise<Blob> {
    const response = await fetch(`${API_BASE}/schedule/ical`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            game_list_name: gameListName,
            game_names: gameNames,
            availability,
            algorithm,
            start_date: startDate,
        }),
    });
    if (!response.ok) throw new Error("iCal download failed");
    return response.blob();
}
```

**Step 2: Commit**

```bash
git add frontend/src/services/
git commit -m "feat(frontend): add API service layer for games, schedule, and iCal"
```

---

### Task 5.3: Create GameSearch component

**Files:**
- Create: `frontend/src/components/game-search.tsx`

**Step 1: Implement**

```tsx
import { useState } from "preact/hooks";
import type { Game } from "../types";
import { searchGames } from "../services/api";

interface Props {
    onAddGame: (game: Game) => void;
}

export function GameSearch({ onAddGame }: Props) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Game[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        try {
            const games = await searchGames(query);
            setResults(games);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h2>Search Games</h2>
            <div>
                <input
                    type="text"
                    value={query}
                    onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Search for a game..."
                />
                <button onClick={handleSearch} disabled={loading}>
                    {loading ? "Searching..." : "Search"}
                </button>
            </div>
            {results.length > 0 && (
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Main Story</th>
                            <th>Main + Extra</th>
                            <th>Completionist</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((game) => (
                            <tr key={game.name}>
                                <td>{game.name}</td>
                                <td>{game.main_story_hours}h</td>
                                <td>{game.main_extra_hours ?? "-"}h</td>
                                <td>{game.completionist_hours ?? "-"}h</td>
                                <td>
                                    <button onClick={() => onAddGame(game)}>Add</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/game-search.tsx
git commit -m "feat(frontend): add GameSearch component with search and add"
```

---

### Task 5.4: Create GameListView component

**Files:**
- Create: `frontend/src/components/game-list-view.tsx`

**Step 1: Implement**

```tsx
import type { Game } from "../types";

interface Props {
    name: string;
    games: Game[];
    onRemoveGame: (index: number) => void;
    onRenameList: (name: string) => void;
}

export function GameListView({ name, games, onRemoveGame, onRenameList }: Props) {
    const totalHours = games.reduce((sum, g) => sum + g.main_story_hours, 0);

    return (
        <div>
            <h2>
                <input
                    type="text"
                    value={name}
                    onInput={(e) => onRenameList((e.target as HTMLInputElement).value)}
                />
            </h2>
            {games.length === 0 ? (
                <p>No games yet. Search and add some!</p>
            ) : (
                <>
                    <table>
                        <thead>
                            <tr>
                                <th>Game</th>
                                <th>Hours</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {games.map((game, i) => (
                                <tr key={`${game.name}-${i}`}>
                                    <td>{game.name}</td>
                                    <td>{game.main_story_hours}h</td>
                                    <td>
                                        <button onClick={() => onRemoveGame(i)}>Remove</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p>
                        <strong>Total: {totalHours.toFixed(1)} hours</strong>
                    </p>
                </>
            )}
        </div>
    );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/game-list-view.tsx
git commit -m "feat(frontend): add GameListView component with total hours"
```

---

### Task 5.5: Create AvailabilityForm component

**Files:**
- Create: `frontend/src/components/availability-form.tsx`

**Step 1: Implement**

```tsx
import { useState } from "preact/hooks";
import type { DayAvailability, WeeklyAvailability } from "../types";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface Props {
    onSubmit: (availability: WeeklyAvailability) => void;
}

export function AvailabilityForm({ onSubmit }: Props) {
    const [mode, setMode] = useState<"uniform" | "custom">("uniform");
    const [uniformHours, setUniformHours] = useState(2);
    const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
    const [customHours, setCustomHours] = useState<Record<number, number>>({});

    const toggleDay = (day: number) => {
        const next = new Set(selectedDays);
        if (next.has(day)) {
            next.delete(day);
        } else {
            next.add(day);
        }
        setSelectedDays(next);
    };

    const handleSubmit = () => {
        const days: DayAvailability[] = [...selectedDays].sort().map((day) => ({
            day_of_week: day,
            hours: mode === "uniform" ? uniformHours : (customHours[day] ?? 1),
        }));
        onSubmit({ days });
    };

    return (
        <div>
            <h2>Weekly Availability</h2>
            <p>
                <em>
                    This is an estimation to help you plan your gaming sessions. Real play
                    times may vary.
                </em>
            </p>
            <div>
                <label>
                    <input
                        type="radio"
                        checked={mode === "uniform"}
                        onChange={() => setMode("uniform")}
                    />{" "}
                    Same hours every day
                </label>
                <label>
                    <input
                        type="radio"
                        checked={mode === "custom"}
                        onChange={() => setMode("custom")}
                    />{" "}
                    Different hours per day
                </label>
            </div>
            {mode === "uniform" && (
                <div>
                    <label>
                        Hours per day:{" "}
                        <input
                            type="number"
                            min={0.5}
                            max={16}
                            step={0.5}
                            value={uniformHours}
                            onInput={(e) =>
                                setUniformHours(Number((e.target as HTMLInputElement).value))
                            }
                        />
                    </label>
                </div>
            )}
            <div>
                <p>Select days you can play:</p>
                {DAY_NAMES.map((name, i) => (
                    <div key={i}>
                        <label>
                            <input
                                type="checkbox"
                                checked={selectedDays.has(i)}
                                onChange={() => toggleDay(i)}
                            />{" "}
                            {name}
                        </label>
                        {mode === "custom" && selectedDays.has(i) && (
                            <input
                                type="number"
                                min={0.5}
                                max={16}
                                step={0.5}
                                value={customHours[i] ?? 1}
                                onInput={(e) =>
                                    setCustomHours({
                                        ...customHours,
                                        [i]: Number((e.target as HTMLInputElement).value),
                                    })
                                }
                            />
                        )}
                    </div>
                ))}
            </div>
            <button onClick={handleSubmit} disabled={selectedDays.size === 0}>
                Set Availability
            </button>
        </div>
    );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/availability-form.tsx
git commit -m "feat(frontend): add AvailabilityForm with uniform and custom hours modes"
```

---

### Task 5.6: Create ScheduleView component

**Files:**
- Create: `frontend/src/components/schedule-view.tsx`

**Step 1: Implement**

```tsx
import type { ScheduleResponse } from "../types";

interface Props {
    schedule: ScheduleResponse;
    onDownloadIcal: () => void;
}

export function ScheduleView({ schedule, onDownloadIcal }: Props) {
    if (schedule.sessions.length === 0) {
        return <p>No sessions generated.</p>;
    }

    return (
        <div>
            <h2>Your Gaming Schedule</h2>
            <p>
                <strong>Total: {schedule.total_hours.toFixed(1)} hours</strong>
                {schedule.estimated_end_date && (
                    <> — Estimated finish: {schedule.estimated_end_date}</>
                )}
            </p>
            <button onClick={onDownloadIcal}>Download .ics (add to Google Calendar)</button>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Game</th>
                        <th>Start</th>
                        <th>Duration</th>
                    </tr>
                </thead>
                <tbody>
                    {schedule.sessions.map((s, i) => (
                        <tr key={i}>
                            <td>{s.date}</td>
                            <td>{s.game_name}</td>
                            <td>{s.start_time}</td>
                            <td>{s.duration_hours}h</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/schedule-view.tsx
git commit -m "feat(frontend): add ScheduleView component with iCal download button"
```

---

## Phase 6: Frontend — Page Assembly & Multi-List Support

### Task 6.1: Build the HomePage with full flow

**Files:**
- Modify: `frontend/src/pages/home.tsx`

**Step 1: Implement full page**

```tsx
import { useState } from "preact/hooks";
import { GameSearch } from "../components/game-search";
import { GameListView } from "../components/game-list-view";
import { AvailabilityForm } from "../components/availability-form";
import { ScheduleView } from "../components/schedule-view";
import { generateSchedule, downloadIcal } from "../services/api";
import type {
    Game,
    GameList,
    WeeklyAvailability,
    ScheduleAlgorithm,
    ScheduleResponse,
} from "../types";

export function HomePage() {
    const [lists, setLists] = useState<GameList[]>([{ name: "My Games", games: [] }]);
    const [activeListIndex, setActiveListIndex] = useState(0);
    const [availability, setAvailability] = useState<WeeklyAvailability | null>(null);
    const [algorithm, setAlgorithm] = useState<ScheduleAlgorithm>("sequential");
    const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
    const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);

    const activeList = lists[activeListIndex];
    const allGames = lists.flatMap((l) => l.games);
    const totalAllHours = allGames.reduce((sum, g) => sum + g.main_story_hours, 0);

    const addGame = (game: Game) => {
        const updated = [...lists];
        updated[activeListIndex] = {
            ...updated[activeListIndex],
            games: [...updated[activeListIndex].games, game],
        };
        setLists(updated);
    };

    const removeGame = (index: number) => {
        const updated = [...lists];
        updated[activeListIndex] = {
            ...updated[activeListIndex],
            games: updated[activeListIndex].games.filter((_, i) => i !== index),
        };
        setLists(updated);
    };

    const renameList = (name: string) => {
        const updated = [...lists];
        updated[activeListIndex] = { ...updated[activeListIndex], name };
        setLists(updated);
    };

    const addList = () => {
        setLists([...lists, { name: `List ${lists.length + 1}`, games: [] }]);
        setActiveListIndex(lists.length);
    };

    const handleGenerateSchedule = async () => {
        if (!availability || allGames.length === 0) return;
        const result = await generateSchedule(
            "All Lists",
            allGames.map((g) => g.name),
            availability,
            algorithm,
            startDate,
        );
        setSchedule(result);
    };

    const handleDownloadIcal = async () => {
        if (!availability || allGames.length === 0) return;
        const blob = await downloadIcal(
            "Gaming Clock Schedule",
            allGames.map((g) => g.name),
            availability,
            algorithm,
            startDate,
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "gaming-clock.ics";
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <h1>Gaming Clock</h1>
            <p>Plan your gaming backlog. Know exactly when you'll finish.</p>

            <hr />

            <GameSearch onAddGame={addGame} />

            <hr />

            <div>
                <h2>Your Lists</h2>
                <div>
                    {lists.map((list, i) => (
                        <button
                            key={i}
                            onClick={() => setActiveListIndex(i)}
                            style={{ fontWeight: i === activeListIndex ? "bold" : "normal" }}
                        >
                            {list.name} ({list.games.length})
                        </button>
                    ))}
                    <button onClick={addList}>+ New List</button>
                </div>
                <p>Total across all lists: {totalAllHours.toFixed(1)} hours</p>
            </div>

            <GameListView
                name={activeList.name}
                games={activeList.games}
                onRemoveGame={removeGame}
                onRenameList={renameList}
            />

            <hr />

            <AvailabilityForm onSubmit={setAvailability} />

            {availability && (
                <div>
                    <h2>Generate Schedule</h2>
                    <div>
                        <label>
                            Start date:{" "}
                            <input
                                type="date"
                                value={startDate}
                                onInput={(e) =>
                                    setStartDate((e.target as HTMLInputElement).value)
                                }
                            />
                        </label>
                    </div>
                    <div>
                        <label>
                            Algorithm:{" "}
                            <select
                                value={algorithm}
                                onChange={(e) =>
                                    setAlgorithm(
                                        (e.target as HTMLSelectElement).value as ScheduleAlgorithm,
                                    )
                                }
                            >
                                <option value="sequential">
                                    Sequential (finish one game, start next)
                                </option>
                                <option value="alternating">
                                    Alternating (rotate between games)
                                </option>
                            </select>
                        </label>
                    </div>
                    <button onClick={handleGenerateSchedule} disabled={allGames.length === 0}>
                        Generate Schedule
                    </button>
                </div>
            )}

            {schedule && (
                <>
                    <hr />
                    <ScheduleView schedule={schedule} onDownloadIcal={handleDownloadIcal} />
                </>
            )}
        </div>
    );
}
```

**Step 2: Verify build**

```bash
cd frontend && bun run build
```

**Step 3: Commit**

```bash
git add frontend/src/pages/home.tsx
git commit -m "feat(frontend): assemble HomePage with full game search, lists, availability, and schedule flow"
```

---

## Phase 7: Integration & Polish

### Task 7.1: Add biome config for frontend

**Files:**
- Create: `frontend/biome.json`

**Step 1: Create biome config**

```bash
cd frontend && bunx @biomejs/biome init
```

This generates `biome.json`. Ensure it has:
```json
{
    "formatter": {
        "indentStyle": "tab"
    },
    "linter": {
        "enabled": true
    },
    "javascript": {
        "formatter": {
            "quoteStyle": "double"
        }
    }
}
```

**Step 2: Run biome and fix issues**

```bash
cd frontend && bunx @biomejs/biome check --write src/
```

**Step 3: Commit**

```bash
git add frontend/biome.json frontend/src/
git commit -m "chore(frontend): add biome config and fix linting issues"
```

---

### Task 7.2: Add `build` and `dev` scripts to frontend package.json

**Files:**
- Modify: `frontend/package.json`

**Step 1: Ensure scripts exist in `package.json`**

```json
{
    "scripts": {
        "dev": "vite",
        "build": "vite build",
        "preview": "vite preview"
    }
}
```

**Step 2: Commit**

```bash
git add frontend/package.json
git commit -m "chore(frontend): add vite dev/build/preview scripts"
```

---

### Task 7.3: End-to-end smoke test

**Files:**
- Create: `backend/tests/test_e2e.py`

**Step 1: Write test**

`backend/tests/test_e2e.py`:
```python
"""End-to-end test: search -> schedule -> iCal download.

This test mocks the HLTB service to avoid external API calls
but exercises the full request flow through FastAPI.
"""

from unittest.mock import AsyncMock, patch

from gamingclock.models.game import Game


def test_full_flow(client):
    mock_games = [
        Game(name="Final Fantasy VII", image_url="https://example.com/ff7.png", main_story_hours=36.5),
        Game(name="Final Fantasy VIII", image_url="https://example.com/ff8.png", main_story_hours=40.0),
    ]

    # 1. Search
    with patch("gamingclock.routers.games.hltb_service") as mock:
        mock.search = AsyncMock(return_value=mock_games)
        search_resp = client.get("/games/search", params={"query": "Final Fantasy"})
    assert search_resp.status_code == 200
    assert len(search_resp.json()) == 2

    # 2. Generate schedule
    schedule_body = {
        "game_list_name": "FF Series",
        "game_names": ["Final Fantasy VII", "Final Fantasy VIII"],
        "availability": {"days": [{"day_of_week": 5, "hours": 4.0}, {"day_of_week": 6, "hours": 4.0}]},
        "algorithm": "sequential",
        "start_date": "2026-04-04",
    }

    with patch("gamingclock.routers.schedule.hltb_service") as mock:
        mock.search = AsyncMock(side_effect=lambda q: [g for g in mock_games if g.name == q][:1])
        schedule_resp = client.post("/schedule/generate", json=schedule_body)
    assert schedule_resp.status_code == 200
    data = schedule_resp.json()
    assert data["total_hours"] > 0
    assert len(data["sessions"]) > 0

    # 3. Download iCal
    with patch("gamingclock.routers.schedule.hltb_service") as mock:
        mock.search = AsyncMock(side_effect=lambda q: [g for g in mock_games if g.name == q][:1])
        ical_resp = client.post("/schedule/ical", json=schedule_body)
    assert ical_resp.status_code == 200
    assert "BEGIN:VCALENDAR" in ical_resp.text
```

**Step 2: Run test**

```bash
cd backend && pytest tests/test_e2e.py -v
```

**Step 3: Commit**

```bash
git add backend/tests/test_e2e.py
git commit -m "test: add end-to-end smoke test for search -> schedule -> iCal flow"
```

---

### Task 7.4: Run all backend tests and fix any issues

**Step 1: Run full test suite**

```bash
cd backend && pytest -v --tb=short
```

**Step 2: Fix any failures**

**Step 3: Run linting**

```bash
cd backend && ruff check src/ tests/ && ruff format --check src/ tests/
```

**Step 4: Fix any linting issues**

```bash
cd backend && ruff format src/ tests/
```

**Step 5: Commit fixes if any**

```bash
git add backend/
git commit -m "fix: resolve test and linting issues across backend"
```

---

### Task 7.5: Verify frontend builds and lint passes

**Step 1: Build**

```bash
cd frontend && bun run build
```

**Step 2: Lint**

```bash
cd frontend && bunx @biomejs/biome check src/
```

**Step 3: Fix any issues and commit**

```bash
git add frontend/
git commit -m "fix(frontend): resolve build and lint issues"
```

---

### Task 7.6: Verify Docker Compose works

**Step 1: Build images**

```bash
docker compose build
```

**Step 2: Run and verify health**

```bash
docker compose up -d
curl http://localhost:8000/health
docker compose down
```

**Step 3: Fix any issues and commit**

---

### Task 7.7: Clean up legacy files

**Files:**
- Delete: `index.html` (root — replaced by `frontend/index.html`)
- Delete: `style.css` (replaced by Tailwind)
- Delete: `curl.py` (dev script, no longer needed)
- Delete: `main.py` (root — replaced by `backend/src/gamingclock/main.py`)
- Delete: `schedule.py` (root — replaced by `backend/src/gamingclock/services/scheduler.py`)
- Delete: `game.json` (sample data, no longer needed)
- Delete: `cursor.mp3` (not part of the app)
- Delete: `todo.todo` (replaced by PLAN.md)

**Step 1: Remove old files**

```bash
git rm index.html style.css curl.py main.py schedule.py game.json cursor.mp3 todo.todo
```

**Step 2: Commit**

```bash
git commit -m "chore: remove legacy v0.1 files replaced by monorepo structure"
```

---

## Task Summary Checklist

### Phase 1: Scaffolding
- [x] Task 1.1: Backend project structure
- [x] Task 1.2: Frontend project structure
- [x] Task 1.3: Justfile
- [x] Task 1.4: Docker Compose
- [x] Task 1.5: GitHub Actions CI
- [x] Task 1.6: Prek pre-commit hooks

### Phase 2: Backend Models
- [x] Task 2.1: Game model
- [x] Task 2.2: GameList model
- [x] Task 2.3: Schedule and Availability models
- [x] Task 2.4: Polyfactory factories

### Phase 3: Backend Services
- [x] Task 3.1: HLTB service
- [x] Task 3.2: IGDB mock service
- [x] Task 3.3: Scheduler — sequential algorithm
- [x] Task 3.4: Scheduler — alternating algorithm tests
- [x] Task 3.5: iCal export service

### Phase 4: Backend API Routes
- [x] Task 4.1: Game search endpoint
- [x] Task 4.2: Schedule generation endpoint
- [x] Task 4.3: iCal download endpoint

### Phase 5: Frontend Components
- [x] Task 5.1: Routing and page structure
- [x] Task 5.2: API service layer
- [x] Task 5.3: GameSearch component
- [x] Task 5.4: GameListView component
- [x] Task 5.5: AvailabilityForm component
- [x] Task 5.6: ScheduleView component

### Phase 6: Page Assembly
- [x] Task 6.1: HomePage full flow and centered planner shell

### Phase 7: Integration & Polish
- [x] Task 7.1: Biome config
- [x] Task 7.2: Frontend package.json scripts
- [x] Task 7.3: E2E smoke test
- [x] Task 7.4: Backend test suite + lint pass
- [x] Task 7.5: Frontend build + lint pass
- [x] Task 7.6: Docker Compose verification
- [x] Task 7.7: Clean up legacy files
