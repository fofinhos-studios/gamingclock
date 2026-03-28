# Backend SKILL.md

## Project

- **Framework**: FastAPI
- **Models**: Pydantic v2
- **HTTP client**: httpx
- **Tests**: pytest + xdist + polyfactory

## How to run

```bash
cd backend
pip install -e ".[dev]"
uvicorn gamingclock.main:app --reload --port 8000
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
