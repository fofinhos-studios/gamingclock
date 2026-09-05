import datetime

from icalendar import Calendar, Event

from gamingclock.models.schedule import PlaySession


def generate_ical(
    sessions: list[PlaySession],
    calendar_name: str = "Gaming Clock Schedule",
) -> str:
    cal = Calendar()
    cal.add("prodid", "-//Gaming Clock//EN")
    cal.add("version", "2.0")
    cal.add("x-wr-calname", _calendar_text(calendar_name))

    for session in sessions:
        event = Event()
        event.add("summary", f"Gaming: {_calendar_text(session.game_name)}")
        start_dt = datetime.datetime.combine(session.date, session.start_time)
        end_dt = start_dt + datetime.timedelta(hours=session.duration_hours)
        event.add("dtstart", start_dt)
        event.add("dtend", end_dt)
        event.add(
            "description",
            f"Gaming session: {_calendar_text(session.game_name)} ({session.duration_hours}h)",
        )
        cal.add_component(event)

    return cal.to_ical().decode("utf-8")


def _calendar_text(value: str) -> str:
    """Prevent user-provided text from creating invalid iCalendar content lines."""
    return value.replace("\r", " ").replace("\n", " ")
