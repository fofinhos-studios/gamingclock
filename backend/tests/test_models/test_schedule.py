import datetime

import pytest

from gamingclock.models.catalog import HLTBStatus, ListGame, ScheduleErrorDetail
from gamingclock.models.schedule import (
    DayAvailability,
    PlaySession,
    ScheduleAlgorithm,
    ScheduleErrorResponse,
    ScheduleRequest,
    ScheduleResponse,
    WeeklyAvailability,
)


def test_weekly_availability_uniform():
    """User plays 2 hours every day they selected."""
    avail = WeeklyAvailability(
        days=[
            DayAvailability(day_of_week=0, hours=2.0, start_hour=19),
            DayAvailability(day_of_week=2, hours=2.0, start_hour=21),
        ],
    )
    assert len(avail.days) == 2
    assert avail.days[0].hours == 2.0
    assert avail.days[0].start_hour == 19


def test_day_availability_accepts_start_minutes():
    availability = DayAvailability(
        day_of_week=0,
        hours=2.0,
        start_hour=20,
        start_minute=30,
    )

    assert availability.start_minute == 30


def test_weekly_availability_total_weekly_hours():
    avail = WeeklyAvailability(
        days=[
            DayAvailability(day_of_week=0, hours=2.0),
            DayAvailability(day_of_week=5, hours=4.0),
            DayAvailability(day_of_week=6, hours=4.0),
        ],
    )
    assert avail.total_weekly_hours == 10.0


@pytest.mark.parametrize(
    ("days", "error_field"),
    [([], "days"), ([{"day_of_week": 7, "hours": 2}], "day_of_week"), ([{"day_of_week": 0, "hours": 0}], "hours")],
)
def test_weekly_availability_rejects_unschedulable_days(days, error_field):
    with pytest.raises(ValueError, match=error_field):
        WeeklyAvailability(days=days)


def test_schedule_request():
    req = ScheduleRequest(
        game_list_name="My List",
        games=[
            ListGame(
                igdb_id=7,
                name="FF7",
                cover_url="https://example.com/ff7.png",
                summary="Classic RPG",
                genres=["RPG"],
                platforms=["PlayStation"],
                release_year=1997,
                rating=95.0,
                hltb_status=HLTBStatus.RESOLVED,
                hltb_match_name="Final Fantasy VII",
                main_story_hours=36.0,
                main_extra_hours=52.0,
                completionist_hours=80.0,
            )
        ],
        availability=WeeklyAvailability(
            days=[DayAvailability(day_of_week=0, hours=2.0)],
        ),
        algorithm=ScheduleAlgorithm.SEQUENTIAL,
        start_date=datetime.date(2026, 4, 1),
    )
    assert req.algorithm == ScheduleAlgorithm.SEQUENTIAL
    assert req.availability.days[0].start_hour == 20


def test_play_session():
    session = PlaySession(
        game_name="FF7",
        date=datetime.date(2026, 4, 1),
        start_time=datetime.time(20, 0),
        duration_hours=2.0,
    )
    assert session.game_name == "FF7"
    assert session.duration_hours == 2.0


def test_schedule_response_and_error_contracts_are_pydantic_models():
    response = ScheduleResponse(
        sessions=[],
        total_hours=0,
        estimated_end_date=None,
    )
    error = ScheduleErrorResponse(
        message="Cannot generate schedule with unresolved games",
        unresolved_games=[ScheduleErrorDetail(igdb_id=7, name="FF7")],
    )

    assert response.model_dump() == {
        "sessions": [],
        "total_hours": 0,
        "estimated_end_date": None,
    }
    assert error.model_dump() == {
        "message": "Cannot generate schedule with unresolved games",
        "unresolved_games": [{"igdb_id": 7, "name": "FF7"}],
    }
