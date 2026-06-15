from collections import OrderedDict
from typing import Any

from howlongtobeatpy import HowLongToBeat

from gamingclock.models.game import Game


class HLTBService:
    def __init__(
        self,
        similarity_threshold: float = 0.2,
        max_cache_entries: int = 256,
        api: Any | None = None,
    ):
        self._max_cache_entries = max_cache_entries
        self._api = api or HowLongToBeat(input_minimum_similarity=similarity_threshold)
        self._cache: OrderedDict[str, list[Game]] = OrderedDict()

    async def search(self, query: str) -> list[Game]:
        normalized_query = query.strip()
        if not normalized_query:
            return []

        cache_key = normalized_query.lower()
        cached_results = self._cache.get(cache_key)
        if cached_results is not None:
            self._cache.move_to_end(cache_key)
            return cached_results

        matches = await self._api.async_search(normalized_query, similarity_case_sensitive=False)
        sorted_matches = sorted(matches or [], key=lambda match: match.similarity, reverse=True)
        results = [self._to_game(match) for match in sorted_matches]

        self._cache[cache_key] = results
        self._cache.move_to_end(cache_key)
        if len(self._cache) > self._max_cache_entries:
            self._cache.popitem(last=False)
        return results

    @staticmethod
    def _to_game(result: Any) -> Game:
        return Game(
            name=result.game_name or "",
            image_url=result.game_image_url or "",
            main_story_hours=result.main_story or 0.0,
            main_extra_hours=result.main_extra,
            completionist_hours=result.completionist,
        )
