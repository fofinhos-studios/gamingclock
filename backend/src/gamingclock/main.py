import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from gamingclock.routers.game_groups import close_group_services
from gamingclock.routers.game_groups import router as game_groups_router
from gamingclock.routers.games import close_services
from gamingclock.routers.games import router as games_router
from gamingclock.routers.schedule import router as schedule_router

load_dotenv(Path(__file__).resolve().parents[3] / ".env", override=False)

application_logger = logging.getLogger("gamingclock")
if not application_logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(levelname)s:%(name)s:%(message)s"))
    application_logger.addHandler(handler)
application_logger.setLevel(logging.INFO)
application_logger.propagate = False
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    await close_services()
    await close_group_services()


app = FastAPI(title="GamingClock", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(games_router)
app.include_router(game_groups_router)
app.include_router(schedule_router)


@app.middleware("http")
async def add_request_timing(request, call_next):
    started_at = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - started_at) * 1000
    response.headers["Server-Timing"] = f"app;dur={duration_ms:.1f}"
    response.headers["X-Process-Time-Ms"] = f"{duration_ms:.1f}"
    logger.info(
        "Request complete method=%s path=%s status=%d duration_ms=%.1f",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.get("/health")
async def health():
    return {"status": "ok"}
