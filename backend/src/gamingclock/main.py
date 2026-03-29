from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from gamingclock.routers.games import router as games_router
from gamingclock.routers.schedule import router as schedule_router

load_dotenv(Path(__file__).resolve().parents[3] / ".env", override=False)

app = FastAPI(title="GamingClock", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(games_router)
app.include_router(schedule_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
