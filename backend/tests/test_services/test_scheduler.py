import datetime

import pytest

from gamingclock.models.game import Game
from gamingclock.models.schedule import DayAvailability, PlanningMode, ScheduleAlgorithm, WeeklyAvailability
from gamingclock.services.scheduler import DeadlineCapacityError, SchedulerService


def _make_game(name: str, hours: float) -> Game:
    return Game(name=name, image_url="https://example.com/img.png", main_story_hours=hours)


def test_sequential_single_game():
    games = [_make_game("Short Game", 4.0)]
    availability = WeeklyAvailability(
        days=[
            DayAvailability(day_of_week=0, hours=2.0, start_hour=18),
            DayAvailability(day_of_week=2, hours=2.0, start_hour=21),
        ],
    )
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
    assert sessions[0].date == datetime.date(2026, 3, 30)
    assert sessions[0].start_time == datetime.time(18, 0)
    assert sessions[0].duration_hours == 2.0
    assert sessions[1].date == datetime.date(2026, 4, 1)
    assert sessions[1].start_time == datetime.time(21, 0)


def test_sequential_multiple_games():
    games = [_make_game("Game A", 2.0), _make_game("Game B", 2.0)]
    availability = WeeklyAvailability(days=[DayAvailability(day_of_week=0, hours=2.0)])
    start = datetime.date(2026, 3, 30)
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
    assert sessions[1].date == datetime.date(2026, 4, 6)


def test_sequential_empty_list():
    availability = WeeklyAvailability(days=[DayAvailability(day_of_week=0, hours=2.0)])
    scheduler = SchedulerService()
    sessions = scheduler.generate(
        games=[],
        availability=availability,
        algorithm=ScheduleAlgorithm.SEQUENTIAL,
        start_date=datetime.date(2026, 3, 30),
    )
    assert sessions == []


def test_alternating_two_games():
    games = [_make_game("Game A", 2.0), _make_game("Game B", 2.0)]
    availability = WeeklyAvailability(
        days=[
            DayAvailability(day_of_week=0, hours=2.0),
            DayAvailability(day_of_week=2, hours=2.0),
        ],
    )
    start = datetime.date(2026, 3, 30)
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
    games = [_make_game("Short", 2.0), _make_game("Long", 6.0)]
    availability = WeeklyAvailability(
        days=[
            DayAvailability(day_of_week=0, hours=2.0),
            DayAvailability(day_of_week=2, hours=2.0),
        ],
    )
    start = datetime.date(2026, 3, 30)
    scheduler = SchedulerService()
    sessions = scheduler.generate(
        games=games,
        availability=availability,
        algorithm=ScheduleAlgorithm.ALTERNATING,
        start_date=start,
    )
    assert len(sessions) == 4
    assert sessions[0].game_name == "Short"
    assert sessions[1].game_name == "Long"
    assert sessions[2].game_name == "Long"
    assert sessions[3].game_name == "Long"


def test_alternating_duplicate_game_names_preserves_each_entry():
    games = [_make_game("Edition", 1.0), _make_game("Edition", 2.0)]
    availability = WeeklyAvailability(days=[DayAvailability(day_of_week=0, hours=1.0)])

    sessions = SchedulerService().generate(
        games=games,
        availability=availability,
        algorithm=ScheduleAlgorithm.ALTERNATING,
        start_date=datetime.date(2026, 3, 30),
    )

    assert [session.duration_hours for session in sessions] == [1.0, 1.0, 1.0]


def test_scheduler_uses_day_specific_start_hours():
    games = [_make_game("Game A", 4.0)]
    availability = WeeklyAvailability(
        days=[
            DayAvailability(day_of_week=0, hours=2.0, start_hour=17),
            DayAvailability(day_of_week=2, hours=2.0, start_hour=22),
        ],
    )
    scheduler = SchedulerService()

    sessions = scheduler.generate(
        games=games,
        availability=availability,
        algorithm=ScheduleAlgorithm.SEQUENTIAL,
        start_date=datetime.date(2026, 3, 30),
    )

    assert [session.start_time for session in sessions] == [
        datetime.time(17, 0),
        datetime.time(22, 0),
    ]


def test_scheduler_preserves_start_minutes():
    games = [_make_game("Game A", 2.0)]
    availability = WeeklyAvailability(
        days=[
            DayAvailability(
                day_of_week=0,
                hours=2.0,
                start_hour=20,
                start_minute=30,
            ),
        ],
    )

    sessions = SchedulerService().generate(
        games=games,
        availability=availability,
        algorithm=ScheduleAlgorithm.SEQUENTIAL,
        start_date=datetime.date(2026, 3, 30),
    )

    assert sessions[0].start_time == datetime.time(20, 30)


def test_scheduler_uses_multiple_play_windows_on_the_same_day():
    games = [_make_game("Game A", 2.0)]
    availability = WeeklyAvailability(
        days=[
            DayAvailability(day_of_week=0, hours=1.0, start_hour=12),
            DayAvailability(day_of_week=0, hours=1.0, start_hour=20),
        ],
    )

    sessions = SchedulerService().generate(
        games=games,
        availability=availability,
        algorithm=ScheduleAlgorithm.SEQUENTIAL,
        start_date=datetime.date(2026, 3, 30),
    )

    assert [(session.date, session.start_time, session.duration_hours) for session in sessions] == [
        (datetime.date(2026, 3, 30), datetime.time(12, 0), 1.0),
        (datetime.date(2026, 3, 30), datetime.time(20, 0), 1.0),
    ]


def test_finish_by_uses_every_selected_date_and_respects_the_session_cap():
    sessions = SchedulerService().generate(
        games=[_make_game("Deadline game", 8.0)],
        availability=WeeklyAvailability(
            days=[
                DayAvailability(day_of_week=0, hours=1.0, start_hour=18),
                DayAvailability(day_of_week=2, hours=1.0, start_hour=18),
            ]
        ),
        algorithm=ScheduleAlgorithm.SEQUENTIAL,
        start_date=datetime.date(2026, 3, 30),
        planning_mode=PlanningMode.FINISH_BY,
        finish_by_date=datetime.date(2026, 4, 1),
        max_session_hours=4.0,
    )

    assert [(session.date, session.duration_hours) for session in sessions] == [
        (datetime.date(2026, 3, 30), 4.0),
        (datetime.date(2026, 4, 1), 4.0),
    ]


def test_finish_by_splits_game_boundaries_without_overlapping_sessions():
    sessions = SchedulerService().generate(
        games=[_make_game("First", 2.0), _make_game("Second", 6.0)],
        availability=WeeklyAvailability(
            days=[
                DayAvailability(day_of_week=0, hours=1.0, start_hour=18),
                DayAvailability(day_of_week=2, hours=1.0, start_hour=18),
            ]
        ),
        algorithm=ScheduleAlgorithm.SEQUENTIAL,
        start_date=datetime.date(2026, 3, 30),
        planning_mode=PlanningMode.FINISH_BY,
        finish_by_date=datetime.date(2026, 4, 1),
        max_session_hours=4.0,
    )

    assert [(session.game_name, session.start_time, session.duration_hours) for session in sessions] == [
        ("First", datetime.time(18, 0), 2.0),
        ("Second", datetime.time(20, 0), 2.0),
        ("Second", datetime.time(18, 0), 4.0),
    ]


def test_finish_by_rejects_deadlines_that_exceed_session_capacity():
    with pytest.raises(DeadlineCapacityError, match=r"requires 5\.0-hour sessions"):
        SchedulerService().generate(
            games=[_make_game("Too long", 10.0)],
            availability=WeeklyAvailability(
                days=[
                    DayAvailability(day_of_week=0, hours=1.0),
                    DayAvailability(day_of_week=2, hours=1.0),
                ]
            ),
            algorithm=ScheduleAlgorithm.SEQUENTIAL,
            start_date=datetime.date(2026, 3, 30),
            planning_mode=PlanningMode.FINISH_BY,
            finish_by_date=datetime.date(2026, 4, 1),
            max_session_hours=4.0,
        )
