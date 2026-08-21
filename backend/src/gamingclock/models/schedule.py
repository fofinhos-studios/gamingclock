import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, computed_field

from gamingclock.models.catalog import ListGame, ScheduleErrorDetail


class ScheduleAlgorithm(StrEnum):
    SEQUENTIAL = "sequential"
    ALTERNATING = "alternating"


class DayAvailability(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    hours: float = Field(gt=0)
    start_hour: int = Field(default=20, ge=0, le=23)
    start_minute: int = Field(default=0, ge=0, le=59)


class WeeklyAvailability(BaseModel):
    days: list[DayAvailability] = Field(min_length=1)

    @computed_field
    @property
    def total_weekly_hours(self) -> float:
        return sum(day.hours for day in self.days)


class ScheduleRequest(BaseModel):
    game_list_name: str
    games: list[ListGame]
    availability: WeeklyAvailability
    algorithm: ScheduleAlgorithm = ScheduleAlgorithm.SEQUENTIAL
    start_date: datetime.date = datetime.date.today()


class PlaySession(BaseModel):
    game_name: str
    date: datetime.date
    start_time: datetime.time
    duration_hours: float


class ScheduleResponse(BaseModel):
    """Stable JSON contract returned by schedule generation."""

    sessions: list[PlaySession]
    total_hours: float
    estimated_end_date: datetime.date | None


class ScheduleErrorResponse(BaseModel):
    """Actionable schedule failure details returned for unresolved games."""

    message: str
    unresolved_games: list[ScheduleErrorDetail]
