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
```

- Keep Python dependencies in `pyproject.toml`.
- Commit `uv.lock` whenever backend dependencies change.

## HLTB Service (`src/gamingclock/services/hltb.py`)

- **Library**: `howlongtobeatpy`
- **Read**: `HLTBService.search()` is the wrapper around the library and always returns `Game` models.
- **Edit**: Keep the external library boundary inside the service and convert all results through `_to_game()`.
- **Test**: Mock `howlongtobeatpy.HowLongToBeat` in `tests/test_services/test_hltb.py` instead of hitting the network.

## IGDB Service (`src/gamingclock/services/igdb.py`)

- **Library**: `httpx`
- **Read**: `IGDBService` owns Twitch token exchange, in-memory token caching, autocomplete search, and single-game lookup.
- **Edit**: Keep credentials in `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` env vars only. The FastAPI app auto-loads the repo-root `.env` file on startup. Use IGDB filter queries like `where name ~ "query"*;` for autocomplete instead of the IGDB `search` operator.
- **Test**: Mock Twitch and IGDB with `httpx.MockTransport` in `tests/test_services/test_igdb.py` and `tests/test_services/test_igdb_real.py`.

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
