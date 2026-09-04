import os
import secrets

from fastapi import APIRouter, HTTPException, Request, Response

from gamingclock.models.catalog import CacheWarmResult
from gamingclock.models.game_groups import (
    GameGroupPreview,
    GameGroupPreviewRequest,
    GameGroupSearchResult,
    ResolveGameGroupSelectionRequest,
    ResolveGameGroupSelectionResponse,
)
from gamingclock.services.game_groups import GameGroupExplorer

router = APIRouter(prefix="/game-groups", tags=["game-groups"])
game_group_explorer = GameGroupExplorer()
DEFAULT_WARM_GROUP_LIMIT = 5
MAX_WARM_GROUP_LIMIT = 10


def _require_game_groups_enabled() -> None:
    if os.getenv("ENABLE_GAME_GROUPS", "true").lower() != "true":
        raise HTTPException(status_code=404, detail="Game groups are unavailable")


@router.get("/search", response_model=list[GameGroupSearchResult])
async def search_game_groups(response: Response, query: str) -> list[GameGroupSearchResult]:
    _require_game_groups_enabled()
    response.headers["Cache-Control"] = "public, s-maxage=2592000, stale-while-revalidate=7776000"
    return await game_group_explorer.search(query)


@router.get("/for-game/{igdb_id}", response_model=list[GameGroupSearchResult])
async def groups_for_game(igdb_id: int) -> list[GameGroupSearchResult]:
    _require_game_groups_enabled()
    try:
        return await game_group_explorer.for_game(igdb_id)
    except LookupError as error:
        raise HTTPException(status_code=404, detail="Game not found") from error


@router.post("/preview", response_model=GameGroupPreview)
async def preview_game_group(request: GameGroupPreviewRequest) -> GameGroupPreview:
    _require_game_groups_enabled()
    try:
        return await game_group_explorer.preview(request)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=404, detail="Game group not found") from error
    except (TimeoutError, RuntimeError) as error:
        raise HTTPException(status_code=503, detail="Game group preview is unavailable") from error


@router.post("/resolve-selection", response_model=ResolveGameGroupSelectionResponse)
async def resolve_game_group_selection(
    request: ResolveGameGroupSelectionRequest,
) -> ResolveGameGroupSelectionResponse:
    _require_game_groups_enabled()
    try:
        return await game_group_explorer.resolve_selection(request)
    except LookupError as error:
        raise HTTPException(status_code=404, detail="Game group not found") from error


@router.get("/internal/warm-popular", response_model=CacheWarmResult)
async def warm_popular_game_groups(request: Request) -> CacheWarmResult:
    _require_game_groups_enabled()
    _validate_cron_request(request)
    return await game_group_explorer.warm_rawg_popular(_warm_group_limit())


async def close_group_services() -> None:
    await game_group_explorer.aclose()


def _validate_cron_request(request: Request) -> None:
    secret = os.getenv("CRON_SECRET")
    authorization = request.headers.get("authorization", "")
    if not secret or not secrets.compare_digest(authorization, f"Bearer {secret}"):
        raise HTTPException(status_code=401, detail="Unauthorized")


def _warm_group_limit() -> int:
    value = os.getenv("WARM_GAME_GROUP_LIMIT", str(DEFAULT_WARM_GROUP_LIMIT))
    try:
        return min(max(int(value), 1), MAX_WARM_GROUP_LIMIT)
    except ValueError:
        return DEFAULT_WARM_GROUP_LIMIT
