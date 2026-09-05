import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from gamingclock.models.catalog import ListGame

MAX_GAME_LIST_NAME_LENGTH = 200
MAX_GAMES_PER_SCHEDULE = 500
MAX_SESSIONS_PER_CALENDAR = 10_000
MAX_SESSION_GAME_NAME_LENGTH = 500
MAX_PLAY_HOURS = 24.0


class ScheduleAlgorithm(StrEnum):
    SEQUENTIAL = "sequential"
    ALTERNATING = "alternating"


class PlanningMode(StrEnum):
    WEEKLY = "weekly"
    FINISH_BY = "finish_by"


class DayAvailability(BaseModel):
    model_config = ConfigDict(extra="forbid")

    day_of_week: int = Field(ge=0, le=6)
    hours: float = Field(gt=0, le=MAX_PLAY_HOURS, allow_inf_nan=False)
    start_hour: int = Field(default=20, ge=0, le=23)
    start_minute: int = Field(default=0, ge=0, le=59)


class WeeklyAvailability(BaseModel):
    model_config = ConfigDict(extra="forbid")

    days: list[DayAvailability] = Field(min_length=1, max_length=7)

    @computed_field
    @property
    def total_weekly_hours(self) -> float:
        return sum(day.hours for day in self.days)


class ScheduleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    game_list_name: str = Field(min_length=1, max_length=MAX_GAME_LIST_NAME_LENGTH)
    games: list[ListGame] = Field(max_length=MAX_GAMES_PER_SCHEDULE)
    availability: WeeklyAvailability
    algorithm: ScheduleAlgorithm = ScheduleAlgorithm.SEQUENTIAL
    start_date: datetime.date = Field(default_factory=datetime.date.today)
    planning_mode: PlanningMode = PlanningMode.WEEKLY
    finish_by_date: datetime.date | None = None
    max_session_hours: float = Field(default=4.0, gt=0, le=MAX_PLAY_HOURS, allow_inf_nan=False)

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
    model_config = ConfigDict(extra="forbid")

    game_name: str = Field(min_length=1, max_length=MAX_SESSION_GAME_NAME_LENGTH)
    date: datetime.date
    start_time: datetime.time
    duration_hours: float = Field(gt=0, le=MAX_PLAY_HOURS, allow_inf_nan=False)


class ScheduleResponse(BaseModel):
    """Stable JSON contract returned by schedule generation."""

    sessions: list[PlaySession]
    total_hours: float
    estimated_end_date: datetime.date | None


class IcalRequest(ScheduleRequest):
    """Schedule export contract; accepts user-adjusted sessions when supplied."""

    sessions: list[PlaySession] | None = Field(default=None, max_length=MAX_SESSIONS_PER_CALENDAR)


class CalendarUrlRequest(BaseModel):
    """Portable calendar export payload embedded in a shareable URL."""

    model_config = ConfigDict(extra="forbid")

    game_list_name: str = Field(min_length=1, max_length=MAX_GAME_LIST_NAME_LENGTH)
    sessions: list[PlaySession] = Field(max_length=MAX_SESSIONS_PER_CALENDAR)
