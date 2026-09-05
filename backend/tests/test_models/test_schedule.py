import datetime

import pytest
from pydantic import ValidationError

from gamingclock.models.catalog import HLTBStatus, ListGame
from gamingclock.models.schedule import (
    CalendarUrlRequest,
    DayAvailability,
    IcalRequest,
    PlanningMode,
    PlaySession,
    ScheduleAlgorithm,
    ScheduleRequest,
    ScheduleResponse,
    WeeklyAvailability,
)


def _game(igdb_id: int = 1) -> ListGame:
    return ListGame(
        igdb_id=igdb_id,
        name="Game",
        cover_url="",
        summary="",
        genres=[],
        platforms=[],
        hltb_status=HLTBStatus.UNRESOLVED,
    )


def _session() -> PlaySession:
    return PlaySession(
        game_name="Game",
        date=datetime.date(2026, 4, 1),
        start_time=datetime.time(20),
        duration_hours=2,
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


def test_finish_by_request_requires_a_valid_deadline():
    with pytest.raises(ValueError, match="finish_by_date is required"):
        ScheduleRequest(
            game_list_name="My List",
            games=[],
            availability=WeeklyAvailability(
                days=[DayAvailability(day_of_week=0, hours=2)]
            ),
            planning_mode=PlanningMode.FINISH_BY,
            start_date=datetime.date(2026, 4, 1),
        )
    with pytest.raises(ValueError, match="on or after"):
        ScheduleRequest(
            game_list_name="My List",
            games=[],
            availability=WeeklyAvailability(
                days=[DayAvailability(day_of_week=0, hours=2)]
            ),
            planning_mode=PlanningMode.FINISH_BY,
            start_date=datetime.date(2026, 4, 1),
            finish_by_date=datetime.date(2026, 3, 31),
        )


def test_play_session():
    session = PlaySession(
        game_name="FF7",
        date=datetime.date(2026, 4, 1),
        start_time=datetime.time(20, 0),
        duration_hours=2.0,
    )
    assert session.game_name == "FF7"
    assert session.duration_hours == 2.0


def test_schedule_response_is_a_pydantic_model():
    response = ScheduleResponse(
        sessions=[],
        total_hours=0,
        estimated_end_date=None,
    )
    assert response.model_dump() == {
        "sessions": [],
        "total_hours": 0,
        "estimated_end_date": None,
    }


def test_schedule_request_rejects_oversized_game_lists_and_names():
    with pytest.raises(ValidationError, match="game_list_name"):
        ScheduleRequest(
            game_list_name="x" * 201,
            games=[],
            availability=WeeklyAvailability(days=[DayAvailability(day_of_week=0, hours=2)]),
        )

    with pytest.raises(ValidationError, match="games"):
        ScheduleRequest(
            game_list_name="My List",
            games=[_game(index + 1) for index in range(501)],
            availability=WeeklyAvailability(days=[DayAvailability(day_of_week=0, hours=2)]),
        )


def test_calendar_url_request_rejects_oversized_session_lists():
    with pytest.raises(ValidationError, match="sessions"):
        CalendarUrlRequest(
            game_list_name="My List",
            sessions=[_session()] * 10_001,
        )


@pytest.mark.parametrize(
    ("model", "payload"),
    [
        (DayAvailability, {"day_of_week": 0, "hours": 2, "unexpected": True}),
        (
            ScheduleRequest,
            {
                "game_list_name": "My List",
                "games": [],
                "availability": {"days": [{"day_of_week": 0, "hours": 2}]},
                "unexpected": True,
            },
        ),
        (
            PlaySession,
            {
                "game_name": "Game",
                "date": "2026-04-01",
                "start_time": "20:00:00",
                "duration_hours": 2,
                "unexpected": True,
            },
        ),
        (
            CalendarUrlRequest,
            {
                "game_list_name": "My List",
                "sessions": [],
                "unexpected": True,
            },
        ),
        (
            IcalRequest,
            {
                "game_list_name": "My List",
                "games": [],
                "availability": {"days": [{"day_of_week": 0, "hours": 2}]},
                "unexpected": True,
            },
        ),
        (
            ScheduleRequest,
            {
                "game_list_name": "My List",
                "games": [
                    {
                        "igdb_id": 1,
                        "name": "Game",
                        "cover_url": "",
                        "summary": "",
                        "genres": [],
                        "platforms": [],
                        "hltb_status": "unresolved",
                        "unexpected": True,
                    }
                ],
                "availability": {"days": [{"day_of_week": 0, "hours": 2}]},
            },
        ),
    ],
)
def test_scheduling_models_reject_unknown_fields(model, payload):
    with pytest.raises(ValidationError, match="extra_forbidden"):
        model.model_validate(payload)


@pytest.mark.parametrize("hours", [0, -1, 24.1, float("inf"), float("nan")])
def test_day_availability_rejects_invalid_or_non_finite_hours(hours):
    with pytest.raises(ValidationError, match="hours"):
        DayAvailability(day_of_week=0, hours=hours)


@pytest.mark.parametrize("hours", [0, -1, 24.1, float("inf"), float("nan")])
def test_play_session_rejects_invalid_or_non_finite_durations(hours):
    with pytest.raises(ValidationError, match="duration_hours"):
        PlaySession(
            game_name="FF7",
            date=datetime.date(2026, 4, 1),
            start_time=datetime.time(20, 0),
            duration_hours=hours,
        )


@pytest.mark.parametrize("hours", [0, -1, 10_000.1, float("inf"), float("nan")])
def test_games_reject_invalid_or_non_finite_playtime(hours):
    with pytest.raises(ValidationError, match="main_story_hours"):
        ListGame(
            igdb_id=7,
            name="FF7",
            cover_url="",
            summary="Classic RPG",
            genres=["RPG"],
            platforms=["PlayStation"],
            hltb_status=HLTBStatus.RESOLVED,
            main_story_hours=hours,
        )
