from enum import StrEnum

from pydantic import BaseModel, Field

from gamingclock.models.catalog import CatalogGame, ListGame, ResolveGameRequest


class GameGroupKind(StrEnum):
    SERIES = "series"
    FRANCHISE = "franchise"


class GameGroupSource(StrEnum):
    IGDB = "igdb"
    RAWG = "rawg"
    WIKIDATA = "wikidata"


class GameGroupEvidence(BaseModel):
    source: GameGroupSource
    label: str


class GameGroupSearchResult(BaseModel):
    group_key: str
    display_name: str
    scope_name: str
    card_kind: GameGroupKind
    candidate_count: int
    sources: list[GameGroupEvidence]
    warning: str | None = None


class GameGroupPreviewRequest(BaseModel):
    group_key: str = Field(min_length=1, max_length=200)
    existing_igdb_ids: list[int] = Field(default_factory=list, max_length=5000)
    edition_policy: str = "canonical_releases"


class GameGroupPreviewEvidence(BaseModel):
    source: GameGroupSource
    relation: str
    label: str


class GameGroupEdition(BaseModel):
    state: str
    label: str


class GameGroupPreviewItem(BaseModel):
    """A provider-native member. It has not yet been accepted by IGDB."""

    source_id: str
    name: str
    release_year: int | None = None
    igdb_id: int | None = None
    order: int
    initially_selected: bool
    already_in_backlog: bool
    evidence: list[GameGroupPreviewEvidence]
    edition: GameGroupEdition


class GameGroupExcludedItem(BaseModel):
    label: str
    reason: str


class GameGroupPossibleMatch(BaseModel):
    source: GameGroupSource
    source_id: str
    name: str
    release_year: int | None = None
    reason: str
    igdb_id: int | None = None


class GameGroupPreview(BaseModel):
    group: GameGroupSearchResult
    items: list[GameGroupPreviewItem]
    excluded_items: list[GameGroupExcludedItem] = Field(default_factory=list)
    possible_matches: list[GameGroupPossibleMatch] = Field(default_factory=list)
    unavailable_sources: list[GameGroupSource] = Field(default_factory=list)
    rawg_attribution_required: bool = False
    rawg_attribution_url: str | None = None


class ResolveGameGroupSelectionRequest(BaseModel):
    """Only checked source members are reconciled with the canonical catalog."""

    group_key: str = Field(min_length=1, max_length=200)
    source_member_ids: list[str] = Field(min_length=1, max_length=50)


class GameGroupSelectionResolution(BaseModel):
    source_id: str
    name: str
    game: CatalogGame | None = None
    reason: str | None = None


class ResolveGameGroupSelectionResponse(BaseModel):
    resolutions: list[GameGroupSelectionResolution]


class ResolveGamesRequest(BaseModel):
    games: list[ResolveGameRequest] = Field(min_length=1, max_length=50)


class ResolveGamesResponse(BaseModel):
    games: list[ListGame]
