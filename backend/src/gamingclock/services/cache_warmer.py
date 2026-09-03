"""Background cache warming for games likely to be selected by visitors."""

import asyncio
import logging
from collections.abc import Awaitable, Callable

from gamingclock.models.catalog import CacheWarmResult, CatalogGame

logger = logging.getLogger(__name__)


class PopularCacheWarmer:
    """Seed the shared HLTB cache from IGDB's most-visited games."""

    def __init__(
        self,
        popular_games: Callable[[int], Awaitable[list[CatalogGame]]],
        warm_hltb: Callable[[str], Awaitable[bool]],
        concurrency: int = 4,
        timeout_seconds: float = 20.0,
    ) -> None:
        self._popular_games = popular_games
        self._warm_hltb = warm_hltb
        self._concurrency = max(concurrency, 1)
        self._timeout_seconds = max(timeout_seconds, 1.0)

    async def warm(self, limit: int) -> CacheWarmResult:
        games = await self._popular_games(limit)
        semaphore = asyncio.Semaphore(self._concurrency)

        async def warm_game(game: CatalogGame) -> bool:
            async with semaphore:
                try:
                    async with asyncio.timeout(self._timeout_seconds):
                        if not await self._warm_hltb(game.name):
                            logger.warning("HLTB cache warming was not persisted for %s", game.name)
                            return False
                except Exception:
                    logger.warning("HLTB cache warming failed for %s", game.name, exc_info=True)
                    return False
                return True

        warmed = await asyncio.gather(*(warm_game(game) for game in games))
        warmed_games = sum(warmed)
        return CacheWarmResult(
            requested_games=len(games),
            warmed_games=warmed_games,
            failed_games=len(games) - warmed_games,
        )
