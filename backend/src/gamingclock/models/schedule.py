import datetime
from enum import StrEnum

from pydantic import BaseModel, computed_field

from gamingclock.models.catalog import ScheduleGameInput


class ScheduleAlgorithm(StrEnum):
    SEQUENTIAL = "sequential"
    ALTERNATING = "alternating"


class DayAvailability(BaseModel):
    day_of_week: int
    hours: float


class WeeklyAvailability(BaseModel):
    days: list[DayAvailability]

    @computed_field
    @property
    def total_weekly_hours(self) -> float:
        return sum(day.hours for day in self.days)


class ScheduleRequest(BaseModel):
    game_list_name: str
    games: list[ScheduleGameInput]
    availability: WeeklyAvailability
    algorithm: ScheduleAlgorithm = ScheduleAlgorithm.SEQUENTIAL
    start_date: datetime.date = datetime.date.today()


class PlaySession(BaseModel):
    game_name: str
    date: datetime.date
    start_time: datetime.time
    duration_hours: float
