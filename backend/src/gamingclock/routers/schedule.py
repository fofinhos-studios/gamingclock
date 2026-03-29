from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from gamingclock.calendar.ical import generate_ical
from gamingclock.models.catalog import HLTBStatus, ScheduleErrorDetail
from gamingclock.models.game import Game
from gamingclock.models.schedule import PlaySession, ScheduleRequest
from gamingclock.services.scheduler import SchedulerService

router = APIRouter(prefix="/schedule", tags=["schedule"])

scheduler_service = SchedulerService()


class ScheduleResponse(BaseModel):
    sessions: list[PlaySession]
    total_hours: float
    estimated_end_date: str | None


class ScheduleErrorResponse(BaseModel):
    message: str
    unresolved_games: list[ScheduleErrorDetail]


def _build_schedule_games(request: ScheduleRequest) -> list[Game]:
    unresolved_games = [
        ScheduleErrorDetail(igdb_id=game.igdb_id, name=game.name)
        for game in request.games
        if game.hltb_status != HLTBStatus.RESOLVED or game.main_story_hours is None
    ]
    if unresolved_games:
        raise HTTPException(
            status_code=400,
            detail=ScheduleErrorResponse(
                message="Cannot generate schedule with unresolved games",
                unresolved_games=unresolved_games,
            ).model_dump(),
        )

    schedule_games: list[Game] = []
    for game in request.games:
        if game.main_story_hours is None:
            continue
        schedule_games.append(
            Game(
                name=game.name,
                image_url=game.cover_url,
                main_story_hours=game.main_story_hours,
                main_extra_hours=game.main_extra_hours,
                completionist_hours=game.completionist_hours,
            )
        )
    return schedule_games


@router.post("/generate", response_model=ScheduleResponse)
async def generate_schedule(request: ScheduleRequest) -> ScheduleResponse:
    games = _build_schedule_games(request)
    if not games:
        return ScheduleResponse(sessions=[], total_hours=0, estimated_end_date=None)

    sessions = scheduler_service.generate(
        games=games,
        availability=request.availability,
        algorithm=request.algorithm,
        start_date=request.start_date,
    )
    total_hours = sum(session.duration_hours for session in sessions)
    end_date = sessions[-1].date.isoformat() if sessions else None
    return ScheduleResponse(
        sessions=sessions,
        total_hours=total_hours,
        estimated_end_date=end_date,
    )


@router.post("/ical")
async def download_ical(request: ScheduleRequest) -> Response:
    games = _build_schedule_games(request)
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
