import datetime

from gamingclock.models.game import Game
from gamingclock.models.schedule import DayAvailability, ScheduleAlgorithm, WeeklyAvailability
from gamingclock.services.scheduler import SchedulerService


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
