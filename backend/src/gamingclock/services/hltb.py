import asyncio
import logging
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from typing import Any, Protocol

from howlongtobeatpy import HowLongToBeat

from gamingclock.models.game import Game
from gamingclock.services.hltb_cache import UpstashHLTBCache


class HLTBResultCache(Protocol):
    async def get(self, normalized_query: str) -> list[Game] | None: ...

    async def set(self, normalized_query: str, results: list[Game]) -> None: ...


logger = logging.getLogger(__name__)


class HLTBService:
    def __init__(
        self,
        similarity_threshold: float = 0.2,
        max_cache_entries: int = 256,
        api: Any | None = None,
        shared_cache: HLTBResultCache | None = None,
        retry_attempts: int = 4,
        retry_backoff_seconds: float = 0.5,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ):
        self._max_cache_entries = max_cache_entries
        self._api = api or HowLongToBeat(input_minimum_similarity=similarity_threshold)
        self._cache: OrderedDict[str, list[Game]] = OrderedDict()
        self._shared_cache = shared_cache if shared_cache is not None else UpstashHLTBCache.from_environment()
        self._retry_attempts = retry_attempts
        self._retry_backoff_seconds = retry_backoff_seconds
        self._sleep = sleep

    async def search(self, query: str) -> list[Game]:
        normalized_query = query.strip()
        if not normalized_query:
            return []

        cache_key = normalized_query.lower()
        cached_results = self._cache.get(cache_key)
        if cached_results is not None:
            self._cache.move_to_end(cache_key)
            return cached_results

        if self._shared_cache is not None:
            try:
                shared_results = await self._shared_cache.get(cache_key)
            except Exception:
                logger.warning("Shared HLTB cache lookup failed", exc_info=True)
            else:
                if shared_results is not None:
                    self._remember(cache_key, shared_results)
                    return shared_results

        matches = await self._search_with_retries(normalized_query)
        sorted_matches = sorted(matches or [], key=lambda match: match.similarity, reverse=True)
        results = [self._to_game(match) for match in sorted_matches]

        self._remember(cache_key, results)
        if self._shared_cache is not None:
            try:
                await self._shared_cache.set(cache_key, results)
            except Exception:
                logger.warning("Shared HLTB cache write failed", exc_info=True)
        return results

    async def _search_with_retries(self, query: str) -> list[Any] | None:
        for attempt in range(self._retry_attempts):
            try:
                matches = await self._api.async_search(query, similarity_case_sensitive=False)
            except Exception:
                if attempt == self._retry_attempts - 1:
                    raise
                logger.warning("HLTB search failed; retrying", exc_info=True)
            else:
                if matches is not None:
                    return matches
                if attempt == self._retry_attempts - 1:
                    return None
                logger.warning("HLTB search returned no response; retrying")

            await self._sleep(self._retry_backoff_seconds * (2**attempt))

        return None

    def _remember(self, cache_key: str, results: list[Game]) -> None:
        self._cache[cache_key] = results
        self._cache.move_to_end(cache_key)
        if len(self._cache) > self._max_cache_entries:
            self._cache.popitem(last=False)

    @staticmethod
    def _to_game(result: Any) -> Game:
        return Game(
            name=result.game_name or "",
            image_url=result.game_image_url or "",
            main_story_hours=result.main_story or 0.0,
            main_extra_hours=result.main_extra,
            completionist_hours=result.completionist,
        )
