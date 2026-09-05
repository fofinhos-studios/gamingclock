import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, computed_field, model_validator

from gamingclock.models.catalog import ListGame


class ScheduleAlgorithm(StrEnum):
    SEQUENTIAL = "sequential"
    ALTERNATING = "alternating"


class PlanningMode(StrEnum):
    WEEKLY = "weekly"
    FINISH_BY = "finish_by"


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
    planning_mode: PlanningMode = PlanningMode.WEEKLY
    finish_by_date: datetime.date | None = None
    max_session_hours: float = Field(default=4.0, gt=0)

    @model_validator(mode="after")
    def validate_finish_by_settings(self) -> ScheduleRequest:
        if self.planning_mode != PlanningMode.FINISH_BY:
            return self
        if self.finish_by_date is None:
            raise ValueError("finish_by_date is required when planning_mode is finish_by")
        if self.finish_by_date < self.start_date:
            raise ValueError("finish_by_date must be on or after start_date")
        return self


class PlaySession(BaseModel):
    game_name: str = Field(min_length=1, max_length=200)
    date: datetime.date
    start_time: datetime.time
    duration_hours: float = Field(gt=0)


class ScheduleResponse(BaseModel):
    """Stable JSON contract returned by schedule generation."""

    sessions: list[PlaySession]
    total_hours: float
    estimated_end_date: datetime.date | None


class IcalRequest(ScheduleRequest):
    """Schedule export contract; accepts user-adjusted sessions when supplied."""

    sessions: list[PlaySession] | None = None


class CalendarUrlRequest(BaseModel):
    """Portable calendar export payload embedded in a shareable URL."""

    game_list_name: str = Field(min_length=1, max_length=200)
    sessions: list[PlaySession] = Field(max_length=500)
