import datetime
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

MAX_GAME_NAME_LENGTH = 500
MAX_GAME_URL_LENGTH = 2_048
MAX_SUMMARY_LENGTH = 10_000
MAX_METADATA_VALUES = 100
MAX_METADATA_VALUE_LENGTH = 100
MAX_GAME_HOURS = 10_000.0

MetadataValue = Annotated[str, Field(min_length=1, max_length=MAX_METADATA_VALUE_LENGTH)]


class HLTBStatus(StrEnum):
    RESOLVED = "resolved"
    UNRESOLVED = "unresolved"


class HLTBCategory(StrEnum):
    MAIN = "main"
    EXTRAS = "extras"
    COMPLETIONIST = "completionist"


class IGDBGameType(StrEnum):
    """The game kinds Gaming Clock can present as selectable versions."""

    MAIN_GAME = "main_game"
    REMAKE = "remake"
    REMASTER = "remaster"
    EXPANDED_GAME = "expanded_game"
    PORT = "port"


class GameArtwork(BaseModel):
    cover_url: str = ""
    logo_url: str = ""
    hero_url: str = ""


class CacheWarmResult(BaseModel):
    requested_games: int
    warmed_games: int
    failed_games: int


class CatalogGameVariant(BaseModel):
    """A related IGDB release a player may choose instead of the default game."""

    igdb_id: int
    name: str
    cover_url: str
    summary: str
    genres: list[str]
    platforms: list[str]
    release_year: int | None = None
    rating: float | None = None
    game_type: IGDBGameType | None = None
    version_parent: int | None = None
    parent_game: int | None = None
    version_title: str | None = None


class CatalogGame(BaseModel):
    igdb_id: int
    name: str
    cover_url: str
    summary: str
    genres: list[str]
    platforms: list[str]
    release_year: int | None = None
    rating: float | None = None
    game_type: IGDBGameType | None = None
    version_parent: int | None = None
    parent_game: int | None = None
    version_title: str | None = None
    ports: list[int] = Field(default_factory=list)
    remakes: list[int] = Field(default_factory=list)
    remasters: list[int] = Field(default_factory=list)
    expanded_games: list[int] = Field(default_factory=list)
    variants: list[CatalogGameVariant] = Field(default_factory=list)


class ListGame(BaseModel):
    """A catalog game accepted by the scheduling endpoints."""

    model_config = ConfigDict(extra="forbid")

    igdb_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=MAX_GAME_NAME_LENGTH)
    cover_url: str = Field(max_length=MAX_GAME_URL_LENGTH)
    logo_url: str = Field(default="", max_length=MAX_GAME_URL_LENGTH)
    hero_url: str = Field(default="", max_length=MAX_GAME_URL_LENGTH)
    summary: str = Field(max_length=MAX_SUMMARY_LENGTH)
    genres: list[MetadataValue] = Field(max_length=MAX_METADATA_VALUES)
    platforms: list[MetadataValue] = Field(max_length=MAX_METADATA_VALUES)
    release_year: int | None = Field(default=None, ge=1, le=3000)
    rating: float | None = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    hltb_status: HLTBStatus
    hltb_match_name: str | None = Field(default=None, min_length=1, max_length=MAX_GAME_NAME_LENGTH)
    main_story_hours: float | None = Field(default=None, gt=0, le=MAX_GAME_HOURS, allow_inf_nan=False)
    main_extra_hours: float | None = Field(default=None, gt=0, le=MAX_GAME_HOURS, allow_inf_nan=False)
    completionist_hours: float | None = Field(default=None, gt=0, le=MAX_GAME_HOURS, allow_inf_nan=False)
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


def release_year_from_epoch(epoch_seconds: int | None) -> int | None:
    if epoch_seconds is None:
        return None
    return datetime.datetime.fromtimestamp(epoch_seconds, tz=datetime.UTC).year
