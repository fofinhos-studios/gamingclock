import asyncio

from fastapi import APIRouter

from gamingclock.models.catalog import CatalogGame, HLTBStatus, ListGame, ResolveGameRequest
from gamingclock.services.hltb import HLTBService
from gamingclock.services.igdb import IGDBService

router = APIRouter(prefix="/games", tags=["games"])

hltb_service = HLTBService()
igdb_service = IGDBService()
SEARCH_ENRICHMENT_LIMIT = 8


@router.get("/search", response_model=list[ListGame])
async def search_games(query: str) -> list[ListGame]:
    catalog_games = [
        game if isinstance(game, CatalogGame) else CatalogGame.model_validate(game)
        for game in await igdb_service.search(query, limit=SEARCH_ENRICHMENT_LIMIT)
    ]
    enriched_games = await asyncio.gather(*[_enrich_catalog_game(game) for game in catalog_games])
    return sorted(
        enriched_games,
        key=lambda game: game.hltb_status != HLTBStatus.RESOLVED,
    )


@router.post("/resolve", response_model=ListGame)
async def resolve_game(request: ResolveGameRequest) -> ListGame:
    if request.name:
        catalog_game = CatalogGame(
            igdb_id=request.igdb_id,
            name=request.name,
            cover_url=request.cover_url,
            summary=request.summary,
            genres=request.genres,
            platforms=request.platforms,
            release_year=request.release_year,
            rating=request.rating,
        )
    else:
        catalog_game = await igdb_service.get_by_id(request.igdb_id)
        if isinstance(catalog_game, dict):
            catalog_game = CatalogGame.model_validate(catalog_game)
    return await _enrich_catalog_game(catalog_game)


async def _enrich_catalog_game(catalog_game: CatalogGame) -> ListGame:
    hltb_results = await hltb_service.search(catalog_game.name)
    if not hltb_results:
        return ListGame(
            igdb_id=catalog_game.igdb_id,
            name=catalog_game.name,
            cover_url=catalog_game.cover_url,
            summary=catalog_game.summary,
            genres=catalog_game.genres,
            platforms=catalog_game.platforms,
            release_year=catalog_game.release_year,
            rating=catalog_game.rating,
            hltb_status=HLTBStatus.UNRESOLVED,
        )

    match = hltb_results[0]
    if isinstance(match, dict):
        match_name = match["name"]
        main_story_hours = match["main_story_hours"]
        main_extra_hours = match["main_extra_hours"]
        completionist_hours = match["completionist_hours"]
    else:
        match_name = match.name
        main_story_hours = match.main_story_hours
        main_extra_hours = match.main_extra_hours
        completionist_hours = match.completionist_hours

    return ListGame(
        igdb_id=catalog_game.igdb_id,
        name=catalog_game.name,
        cover_url=catalog_game.cover_url,
        summary=catalog_game.summary,
        genres=catalog_game.genres,
        platforms=catalog_game.platforms,
        release_year=catalog_game.release_year,
        rating=catalog_game.rating,
        hltb_status=HLTBStatus.RESOLVED,
        hltb_match_name=match_name,
        main_story_hours=main_story_hours,
        main_extra_hours=main_extra_hours,
        completionist_hours=completionist_hours,
    )
