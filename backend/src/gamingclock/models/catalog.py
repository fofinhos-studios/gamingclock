import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class HLTBStatus(StrEnum):
    RESOLVED = "resolved"
    UNRESOLVED = "unresolved"


class HLTBCategory(StrEnum):
    MAIN = "main"
    EXTRAS = "extras"
    COMPLETIONIST = "completionist"


class CatalogGame(BaseModel):
    igdb_id: int
    name: str
    cover_url: str
    summary: str
    genres: list[str]
    platforms: list[str]
    release_year: int | None = None
    rating: float | None = None


class ListGame(BaseModel):
    igdb_id: int
    name: str
    cover_url: str
    summary: str
    genres: list[str]
    platforms: list[str]
    release_year: int | None = None
    rating: float | None = None
    hltb_status: HLTBStatus
    hltb_match_name: str | None = None
    main_story_hours: float | None = None
    main_extra_hours: float | None = None
    completionist_hours: float | None = None
    selected_hltb_category: HLTBCategory = HLTBCategory.MAIN


class ResolveGameRequest(BaseModel):
    igdb_id: int
    name: str | None = None
    cover_url: str = ""
    summary: str = ""
    genres: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(default_factory=list)
    release_year: int | None = None
    rating: float | None = None


class ScheduleErrorDetail(BaseModel):
    igdb_id: int
    name: str


def release_year_from_epoch(epoch_seconds: int | None) -> int | None:
    if epoch_seconds is None:
        return None
    return datetime.datetime.fromtimestamp(epoch_seconds, tz=datetime.UTC).year
