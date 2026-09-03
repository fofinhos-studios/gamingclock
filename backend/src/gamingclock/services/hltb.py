import asyncio
import logging
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from difflib import SequenceMatcher
from typing import Any, Protocol

import httpx
from pydantic import BaseModel, Field

from gamingclock.models.game import Game
from gamingclock.services.hltb_cache import UpstashHLTBCache


class HLTBResultCache(Protocol):
    async def get(self, normalized_query: str) -> list[Game] | None: ...

    async def set(self, normalized_query: str, results: list[Game]) -> None: ...


logger = logging.getLogger(__name__)


class HLTBSearchToken(BaseModel):
    token: str
    hp_key: str = Field(validation_alias="hpKey")
    hp_value: str = Field(validation_alias="hpVal")


class HLTBSearchResult(BaseModel):
    game_name: str
    game_image: str | None = None
    comp_main: float | None = None
    comp_plus: float | None = None
    comp_100: float | None = None


class HLTBSearchResponse(BaseModel):
    data: list[HLTBSearchResult] = Field(default_factory=list)


class HLTBWebClient:
    """Client for HowLongToBeat's current public search endpoints."""

    _base_url = "https://howlongtobeat.com"

    def __init__(
        self,
        http_client: httpx.AsyncClient | None = None,
        clock: Callable[[], int] | None = None,
    ) -> None:
        self._http_client = http_client or httpx.AsyncClient(timeout=4.0)
        self._owns_http_client = http_client is None
        self._clock = clock or _current_timestamp

    async def async_search(self, game_name: str, similarity_case_sensitive: bool = False) -> list[HLTBSearchResult]:
        del similarity_case_sensitive
        return await self._search(self._http_client, game_name)

    async def aclose(self) -> None:
        if self._owns_http_client:
            await self._http_client.aclose()

    async def _search(self, http_client: httpx.AsyncClient, game_name: str) -> list[HLTBSearchResult]:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
            ),
            "Referer": f"{self._base_url}/",
            "Origin": self._base_url,
        }
        token_response = await http_client.get(
            f"{self._base_url}/api/search/site/init",
            params={"t": self._clock()},
            headers=headers,
        )
        token_response.raise_for_status()
        token = HLTBSearchToken.model_validate(token_response.json())

        payload = {
            "searchType": "games",
            "searchTerms": game_name.split(),
            "searchPage": 1,
            "size": 20,
            "searchOptions": {
                "games": {
                    "userId": 0,
                    "platform": "",
                    "sortCategory": "popular",
                    "rangeCategory": "main",
                    "rangeTime": {"min": 0, "max": 0},
                    "gameplay": {"perspective": "", "flow": "", "genre": "", "difficulty": ""},
                    "rangeYear": {"max": "", "min": ""},
                    "modifier": "",
                },
                "users": {"sortCategory": "postcount"},
                "lists": {"sortCategory": "follows"},
                "filter": "",
                "sort": 0,
                "randomizer": 0,
            },
            "useCache": True,
            token.hp_key: token.hp_value,
        }
        search_response = await http_client.post(
            f"{self._base_url}/api/search/site",
            json=payload,
            headers={
                **headers,
                "x-auth-token": token.token,
                "x-hp-key": token.hp_key,
                "x-hp-val": token.hp_value,
            },
        )
        search_response.raise_for_status()
        return HLTBSearchResponse.model_validate(search_response.json()).data


def _current_timestamp() -> int:
    return int(time.time() * 1000)


class HLTBService:
    def __init__(
        self,
        similarity_threshold: float = 0.2,
        max_cache_entries: int = 256,
        api: Any | None = None,
        shared_cache: HLTBResultCache | None = None,
        retry_attempts: int = 2,
        retry_backoff_seconds: float = 0.25,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ):
        self._max_cache_entries = max_cache_entries
        self._api = api or HLTBWebClient()
        self._similarity_threshold = similarity_threshold
        self._cache: OrderedDict[str, list[Game]] = OrderedDict()
        self._shared_cache = shared_cache if shared_cache is not None else UpstashHLTBCache.from_environment()
        self._retry_attempts = retry_attempts
        self._retry_backoff_seconds = retry_backoff_seconds
        self._sleep = sleep
        self._cache_write_tasks: set[asyncio.Task[None]] = set()

    async def search(self, query: str, *, write_shared_cache: bool = True) -> list[Game]:
        normalized_query = query.strip()
        if not normalized_query:
            return []

        cache_key = normalized_query.lower()
        started_at = time.perf_counter()
        cached_results = self._cache.get(cache_key)
        if cached_results is not None:
            self._cache.move_to_end(cache_key)
            logger.info("HLTB cache hit cache=memory query_length=%d", len(normalized_query))
            return cached_results

        if self._shared_cache is not None:
            try:
                shared_results = await self._shared_cache.get(cache_key)
            except Exception:
                logger.warning("Shared HLTB cache lookup failed", exc_info=True)
            else:
                if shared_results is not None:
                    self._remember(cache_key, shared_results)
                    logger.info("HLTB cache hit cache=shared query_length=%d", len(normalized_query))
                    return shared_results

        logger.info("HLTB cache miss query_length=%d", len(normalized_query))

        matches = await self._search_with_retries(normalized_query)
        sorted_matches = sorted(
            (
                match
                for match in matches or []
                if self._similarity(match, normalized_query) >= self._similarity_threshold
            ),
            key=lambda match: self._similarity(match, normalized_query),
            reverse=True,
        )
        results = [self._to_game(match) for match in sorted_matches]

        self._remember(cache_key, results)
        if write_shared_cache and self._shared_cache is not None:
            cache_write_task = asyncio.create_task(self._write_shared_cache(cache_key, results))
            self._cache_write_tasks.add(cache_write_task)
            cache_write_task.add_done_callback(self._cache_write_tasks.discard)
        logger.info(
            "HLTB lookup complete query_length=%d result_count=%d duration_ms=%.1f",
            len(normalized_query),
            len(results),
            (time.perf_counter() - started_at) * 1000,
        )
        return results

    async def warm(self, query: str) -> bool:
        """Persist a match to the shared cache and report whether that write succeeded."""
        normalized_query = query.strip()
        if not normalized_query or self._shared_cache is None:
            return False

        results = await self.search(normalized_query, write_shared_cache=False)
        try:
            await self._shared_cache.set(normalized_query.lower(), results)
        except Exception:
            logger.warning("Shared HLTB cache warming write failed", exc_info=True)
            return False
        return True

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

    async def _write_shared_cache(self, cache_key: str, results: list[Game]) -> None:
        if self._shared_cache is None:
            return
        try:
            await self._shared_cache.set(cache_key, results)
        except Exception:
            logger.warning("Shared HLTB cache write failed", exc_info=True)

    async def aclose(self) -> None:
        if self._cache_write_tasks:
            await asyncio.gather(*self._cache_write_tasks, return_exceptions=True)
        close = getattr(self._api, "aclose", None)
        if close is not None:
            await close()
        close_shared_cache = getattr(self._shared_cache, "aclose", None)
        if close_shared_cache is not None:
            await close_shared_cache()

    @staticmethod
    def _similarity(result: Any, query: str) -> float:
        similarity = getattr(result, "similarity", None)
        if similarity is not None:
            return float(similarity)
        return SequenceMatcher(None, query.casefold(), result.game_name.casefold()).ratio()

    @staticmethod
    def _to_game(result: Any) -> Game:
        main_story = getattr(result, "main_story", None)
        if main_story is not None:
            main_extra = result.main_extra
            completionist = result.completionist
            image_url = result.game_image_url or ""
        else:
            main_story = (result.comp_main or 0.0) / 3600
            main_extra = result.comp_plus / 3600 if result.comp_plus is not None else None
            completionist = result.comp_100 / 3600 if result.comp_100 is not None else None
            image_url = f"https://howlongtobeat.com/games/{result.game_image}" if result.game_image else ""
        return Game(
            name=result.game_name or "",
            image_url=image_url,
            main_story_hours=main_story,
            main_extra_hours=main_extra,
            completionist_hours=completionist,
        )
