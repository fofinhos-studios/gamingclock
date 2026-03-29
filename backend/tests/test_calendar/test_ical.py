import datetime

from gamingclock.calendar.ical import generate_ical
from gamingclock.models.schedule import PlaySession


def test_generate_ical_basic():
    sessions = [
        PlaySession(
            game_name="FF7",
            date=datetime.date(2026, 4, 1),
            start_time=datetime.time(20, 0),
            duration_hours=2.0,
        ),
        PlaySession(
            game_name="FF8",
            date=datetime.date(2026, 4, 3),
            start_time=datetime.time(20, 0),
            duration_hours=3.0,
        ),
    ]
    ical_str = generate_ical(sessions, calendar_name="My Gaming Schedule")
    assert "BEGIN:VCALENDAR" in ical_str
    assert "FF7" in ical_str
    assert "FF8" in ical_str
    assert "BEGIN:VEVENT" in ical_str


def test_generate_ical_empty():
    ical_str = generate_ical([], calendar_name="Empty")
    assert "BEGIN:VCALENDAR" in ical_str
    assert "VEVENT" not in ical_str
