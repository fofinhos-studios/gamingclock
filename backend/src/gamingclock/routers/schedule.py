import base64
import binascii
import zlib

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import ValidationError

from gamingclock.calendar.ical import generate_ical
from gamingclock.models.catalog import HLTBCategory, HLTBStatus
from gamingclock.models.game import Game
from gamingclock.models.schedule import (
    CalendarUrlRequest,
    IcalRequest,
    PlaySession,
    ScheduleRequest,
    ScheduleResponse,
)
from gamingclock.services.scheduler import DeadlineCapacityError, SchedulerService

router = APIRouter(prefix="/schedule", tags=["schedule"])

scheduler_service = SchedulerService()


def _build_schedule_games(request: ScheduleRequest) -> list[Game]:
    schedule_games: list[Game] = []
    for game in request.games:
        if game.hltb_status != HLTBStatus.RESOLVED or game.main_story_hours is None:
            continue
        selected_hours = {
            HLTBCategory.MAIN: game.main_story_hours,
            HLTBCategory.EXTRAS: game.main_extra_hours,
            HLTBCategory.COMPLETIONIST: game.completionist_hours,
        }[game.selected_hltb_category]
        schedule_games.append(
            Game(
                name=game.name,
                image_url=game.cover_url,
                main_story_hours=selected_hours if selected_hours is not None else game.main_story_hours,
                main_extra_hours=game.main_extra_hours,
                completionist_hours=game.completionist_hours,
            )
        )
    return schedule_games


def _generate_sessions(request: ScheduleRequest) -> list[PlaySession]:
    try:
        return scheduler_service.generate(
            games=_build_schedule_games(request),
            availability=request.availability,
            algorithm=request.algorithm,
            start_date=request.start_date,
            planning_mode=request.planning_mode,
            finish_by_date=request.finish_by_date,
            max_session_hours=request.max_session_hours,
        )
    except DeadlineCapacityError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/generate", response_model=ScheduleResponse)
async def generate_schedule(request: ScheduleRequest) -> ScheduleResponse:
    if not _build_schedule_games(request):
        return ScheduleResponse(sessions=[], total_hours=0, estimated_end_date=None)
    sessions = _generate_sessions(request)
    total_hours = sum(session.duration_hours for session in sessions)
    end_date = sessions[-1].date if sessions else None
    return ScheduleResponse(
        sessions=sessions,
        total_hours=total_hours,
        estimated_end_date=end_date,
    )


@router.post("/ical")
async def download_ical(request: IcalRequest) -> Response:
    sessions = request.sessions if request.sessions is not None else _generate_sessions(request)
    ical_content = generate_ical(sessions, calendar_name=request.game_list_name)
    return Response(
        content=ical_content,
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="{request.game_list_name}.ics"'},
    )


@router.get("/ical-url")
async def calendar_url(
    payload: str = Query(min_length=1),
    encoding: str = Query(default="deflate"),
) -> Response:
    """Serve an iCalendar document from a portable, client-generated payload."""
    try:
        padded_payload = payload + "=" * (-len(payload) % 4)
        decoded = base64.b64decode(padded_payload.encode("ascii"), altchars=b"-_", validate=True)
        if encoding == "deflate":
            decoded = zlib.decompress(decoded, wbits=-zlib.MAX_WBITS)
        elif encoding != "plain":
            raise ValueError("unsupported encoding")
        request = CalendarUrlRequest.model_validate_json(decoded)
    except (
        UnicodeEncodeError,
        binascii.Error,
        ValidationError,
        ValueError,
        zlib.error,
    ) as error:
        raise HTTPException(status_code=422, detail="Invalid calendar URL") from error

    return Response(
        content=generate_ical(request.sessions, calendar_name=request.game_list_name),
        media_type="text/calendar",
        headers={"Content-Disposition": "inline; filename=gaming-clock.ics"},
    )
