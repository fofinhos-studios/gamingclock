# Backend SKILL.md

## Project

- **Framework**: FastAPI
- **Models**: Pydantic v2
- **HTTP client**: httpx
- **Type checker**: ty
- **Tests**: pytest + xdist + polyfactory

## How to run

```bash
cp ../.env.example ../.env  # once, then fill in IGDB credentials
cd backend
uv sync --group dev
uv run uvicorn gamingclock.main:app --reload --port 8000
```

## How to test

```bash
cd backend
uv run pytest -v
uv run pytest -n auto  # parallel with xdist
```

## How to lint

```bash
cd backend
uv run ruff check src/ tests/
uv run ruff format src/ tests/
uv run ty check
```

## Dependency Management

```bash
cd backend
uv lock
uv sync --group dev
uv audit --locked
```

- Keep Python dependencies in `pyproject.toml`.
- Commit `uv.lock` whenever backend dependencies change.
- Run `uv audit --locked` locally; CI rejects known vulnerabilities.
- Production services use `httpx`; FastAPI/Starlette tests use test-only `httpx2`.

## HLTB Service (`src/gamingclock/services/hltb.py`)

- **Library**: `howlongtobeatpy>=1.0.21`
- **Read**: `HLTBService.search()` wraps HLTB and always returns `Game` models. Game search treats HLTB enrichment as optional and returns unresolved IGDB results when HLTB fails.
- **Edit**: Keep `HowLongToBeat.async_search()` inside the service and convert all library entries through `_to_game()`.
- **Test**: Inject a mock API into `HLTBService` in `tests/test_services/test_hltb.py`; cover search fallback behavior in `tests/test_routers/test_games.py`.

## IGDB Service (`src/gamingclock/services/igdb.py`)

- **Read**: `IGDBService` provides a deterministic local catalog while the MVP has no IGDB credentials or live integration.
- **Edit**: Add representative `CatalogGame` entries to `_catalog`; keep `search()` case-insensitive and `get_by_id()` stable by `igdb_id`.
- **Test**: `uv run pytest tests/test_services/test_igdb.py -v`

## Scheduler Service (`src/gamingclock/services/scheduler.py`)

- **Read**: `generate()` dispatches to sequential or alternating scheduling.
- **Edit**: Schedule calculations should work from `Game.main_story_hours` and `WeeklyAvailability.days`. Each `DayAvailability` now carries both `hours` and `start_hour`, and generated `PlaySession.start_time` should come from the matching day rather than a hardcoded default.
- **Test**: `tests/test_services/test_scheduler.py` covers both algorithms and empty input behavior.

## Schedule Models (`src/gamingclock/models/schedule.py`)

- **Read**: `DayAvailability` is the API shape for weekly play cadence and now includes `start_hour` in addition to `day_of_week` and `hours`.
- **Edit**: Keep request/response compatibility between frontend and backend by treating `start_hour` as part of the persisted availability payload.
- **Test**: `uv run pytest tests/test_models/test_schedule.py -v`

## Calendar Export (`src/gamingclock/calendar/ical.py`)

- **Library**: `icalendar`
- **Read**: `generate_ical()` converts `PlaySession` entries into a downloadable `.ics` calendar string.
- **Edit**: Keep event timing derived from `PlaySession.date`, `start_time`, and `duration_hours`.
- **Test**: `pytest tests/test_calendar/test_ical.py -v`
- **Test**: `uv run pytest tests/test_calendar/test_ical.py -v`
