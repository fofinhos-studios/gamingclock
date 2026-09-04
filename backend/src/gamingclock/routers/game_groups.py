from fastapi import APIRouter, HTTPException, Response

from gamingclock.models.game_groups import (
    GameGroupPreview,
    GameGroupPreviewRequest,
    GameGroupSearchResult,
)
from gamingclock.services.game_groups import GameGroupExplorer

router = APIRouter(prefix="/game-groups", tags=["game-groups"])
game_group_explorer = GameGroupExplorer()


@router.get("/search", response_model=list[GameGroupSearchResult])
async def search_game_groups(response: Response, query: str) -> list[GameGroupSearchResult]:
    response.headers["Cache-Control"] = "public, s-maxage=300, stale-while-revalidate=86400"
    return await game_group_explorer.search(query)


@router.get("/for-game/{igdb_id}", response_model=list[GameGroupSearchResult])
async def groups_for_game(igdb_id: int) -> list[GameGroupSearchResult]:
    try:
        return await game_group_explorer.for_game(igdb_id)
    except LookupError as error:
        raise HTTPException(status_code=404, detail="Game not found") from error


@router.post("/preview", response_model=GameGroupPreview)
async def preview_game_group(request: GameGroupPreviewRequest) -> GameGroupPreview:
    try:
        return await game_group_explorer.preview(request)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=404, detail="Game group not found") from error
    except (TimeoutError, RuntimeError) as error:
        raise HTTPException(status_code=503, detail="Game group preview is unavailable") from error


async def close_group_services() -> None:
    await game_group_explorer.aclose()
