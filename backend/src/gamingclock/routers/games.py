import asyncio
import logging
import os
import secrets

import httpx
from fastapi import APIRouter, HTTPException, Request, Response

from gamingclock.models.catalog import (
    CacheWarmResult,
    CatalogGame,
    GameArtwork,
    HLTBStatus,
    ListGame,
    ResolveGameRequest,
)
from gamingclock.models.game_groups import ResolveGamesRequest, ResolveGamesResponse
from gamingclock.services.cache_warmer import PopularCacheWarmer
from gamingclock.services.hltb import HLTBService
from gamingclock.services.igdb import IGDBService
from gamingclock.services.steamgriddb import SteamGridDBService

router = APIRouter(prefix="/games", tags=["games"])

hltb_service = HLTBService()
igdb_service = IGDBService()
steamgriddb_service = SteamGridDBService()
SEARCH_ENRICHMENT_LIMIT = 8
RESOLVE_BATCH_CONCURRENCY = 4
DEFAULT_WARM_CACHE_GAME_LIMIT = 20
MAX_WARM_CACHE_GAME_LIMIT = 50
logger = logging.getLogger(__name__)
popular_cache_warmer = PopularCacheWarmer(igdb_service.popular_games, hltb_service.warm)


@router.get("/search", response_model=list[CatalogGame], response_model_exclude_defaults=True)
async def search_games(response: Response, query: str) -> list[CatalogGame]:
    response.headers["Cache-Control"] = "public, s-maxage=300, stale-while-revalidate=86400"
    catalog_games = [
        game if isinstance(game, CatalogGame) else CatalogGame.model_validate(game)
        for game in await igdb_service.search(query, limit=SEARCH_ENRICHMENT_LIMIT)
    ]
    return catalog_games


@router.post("/resolve", response_model=ListGame)
async def resolve_game(request: ResolveGameRequest) -> ListGame:
    return await _resolve_request(request)


@router.post("/resolve-batch", response_model=ResolveGamesResponse)
async def resolve_games(request: ResolveGamesRequest) -> ResolveGamesResponse:
    semaphore = asyncio.Semaphore(RESOLVE_BATCH_CONCURRENCY)

    async def resolve_one(game: ResolveGameRequest) -> ListGame:
        async with semaphore:
            return await _resolve_request(game)

    return ResolveGamesResponse(games=list(await asyncio.gather(*(resolve_one(game) for game in request.games))))


@router.get("/artwork", response_model=GameArtwork)
async def get_game_artwork(response: Response, igdb_id: int, name: str) -> GameArtwork:
    """Return card artwork through a cacheable, game-specific URL."""
    response.headers["Cache-Control"] = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
    return await _get_steamgriddb_artwork(name)


@router.post("/artwork", response_model=GameArtwork)
async def get_game_artwork_legacy(request: ResolveGameRequest) -> GameArtwork:
    """Keep the original endpoint available while clients migrate to cacheable GETs."""
    if not request.name:
        return GameArtwork()
    return await _get_steamgriddb_artwork(request.name)


@router.get("/internal/warm-popular", response_model=CacheWarmResult)
async def warm_popular_cache(request: Request) -> CacheWarmResult:
    """Warm shared HLTB matches for IGDB's most-visited games via Vercel Cron."""
    _validate_cron_request(request)
    return await popular_cache_warmer.warm(_warm_cache_game_limit())


async def _enrich_catalog_game(catalog_game: CatalogGame) -> ListGame:
    artwork, hltb_results = await asyncio.gather(
        _get_steamgriddb_artwork(catalog_game.name),
        hltb_service.search(catalog_game.name),
    )
    if not hltb_results:
        return _unresolved_game(catalog_game, artwork)

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
        cover_url=artwork.cover_url or catalog_game.cover_url,
        logo_url=artwork.logo_url,
        hero_url=artwork.hero_url,
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


async def _resolve_request(request: ResolveGameRequest) -> ListGame:
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


async def _get_steamgriddb_artwork(game_name: str) -> GameArtwork:
    started_at = asyncio.get_running_loop().time()
    try:
        artwork = await steamgriddb_service.get_artwork(game_name)
    except httpx.HTTPError, KeyError, TypeError, ValueError:
        logger.warning("SteamGridDB artwork lookup failed", exc_info=True)
        return GameArtwork()
    logger.info(
        "SteamGridDB artwork lookup complete query_length=%d duration_ms=%.1f",
        len(game_name),
        (asyncio.get_running_loop().time() - started_at) * 1000,
    )
    return artwork


async def close_services() -> None:
    await hltb_service.aclose()


def _unresolved_game(catalog_game: CatalogGame, artwork: GameArtwork) -> ListGame:
    return ListGame(
        igdb_id=catalog_game.igdb_id,
        name=catalog_game.name,
        cover_url=artwork.cover_url or catalog_game.cover_url,
        logo_url=artwork.logo_url,
        hero_url=artwork.hero_url,
        summary=catalog_game.summary,
        genres=catalog_game.genres,
        platforms=catalog_game.platforms,
        release_year=catalog_game.release_year,
        rating=catalog_game.rating,
        hltb_status=HLTBStatus.UNRESOLVED,
    )


def _validate_cron_request(request: Request) -> None:
    cron_secret = os.getenv("CRON_SECRET")
    authorization = request.headers.get("authorization", "")
    if not cron_secret:
        raise HTTPException(status_code=503, detail="Cron jobs are not configured")
    if not secrets.compare_digest(authorization, f"Bearer {cron_secret}"):
        raise HTTPException(status_code=401, detail="Unauthorized")


def _warm_cache_game_limit() -> int:
    raw_limit = os.getenv("WARM_CACHE_GAME_LIMIT")
    if raw_limit is None:
        return DEFAULT_WARM_CACHE_GAME_LIMIT
    try:
        limit = int(raw_limit)
    except ValueError:
        return DEFAULT_WARM_CACHE_GAME_LIMIT
    return min(max(limit, 1), MAX_WARM_CACHE_GAME_LIMIT)
