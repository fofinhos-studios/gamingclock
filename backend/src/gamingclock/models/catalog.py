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
    igdb_id: int
    name: str
    cover_url: str
    logo_url: str = ""
    hero_url: str = ""
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


def release_year_from_epoch(epoch_seconds: int | None) -> int | None:
    if epoch_seconds is None:
        return None
    return datetime.datetime.fromtimestamp(epoch_seconds, tz=datetime.UTC).year
