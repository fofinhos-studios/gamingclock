import time
from difflib import SequenceMatcher
from typing import Any, ClassVar

import httpx

from gamingclock.models.game import Game


class HLTBService:
    BASE_URL: ClassVar[str] = "https://howlongtobeat.com"
    DEFAULT_HEADERS: ClassVar[dict[str, str]] = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Referer": f"{BASE_URL}/",
        "Accept": "application/json, text/plain, */*",
    }

    def __init__(
        self,
        similarity_threshold: float = 0.2,
        http_client: httpx.AsyncClient | None = None,
    ):
        self._threshold = similarity_threshold
        self._http_client = http_client or httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers=self.DEFAULT_HEADERS,
            timeout=20.0,
        )
        self._security: dict[str, str] | None = None
        self._security_expires_at = 0.0
        self._cache: dict[str, list[Game]] = {}

    async def search(self, query: str) -> list[Game]:
        normalized_query = query.strip()
        if not normalized_query:
            return []

        cache_key = normalized_query.lower()
        cached_results = self._cache.get(cache_key)
        if cached_results is not None:
            return cached_results

        security = await self._get_security()
        response = await self._post_search(normalized_query, security)
        if response.status_code == 403:
            security = await self._get_security(force_refresh=True)
            response = await self._post_search(normalized_query, security)
        response.raise_for_status()

        payload = response.json()
        scored_results: list[tuple[float, Game]] = []
        for item in payload.get("data", []):
            score = self._similarity_score(
                normalized_query,
                item.get("game_name"),
                item.get("game_alias"),
            )
            if score < self._threshold:
                continue
            scored_results.append((score, self._to_game(item)))

        scored_results.sort(key=lambda entry: entry[0], reverse=True)
        results = [game for _, game in scored_results]
        self._cache[cache_key] = results
        return results

    async def _get_security(self, force_refresh: bool = False) -> dict[str, str]:
        now = time.time()
        if not force_refresh and self._security is not None and now < self._security_expires_at:
            return self._security

        response = await self._http_client.get(
            "/api/find/init",
            params={"t": int(now * 1000)},
        )
        response.raise_for_status()
        payload = response.json()
        self._security = {
            "token": payload["token"],
            "hp_key": payload["hpKey"],
            "hp_val": payload["hpVal"],
        }
        self._security_expires_at = now + 900
        return self._security

    async def _post_search(
        self,
        query: str,
        security: dict[str, str],
    ) -> httpx.Response:
        return await self._http_client.post(
            "/api/find",
            headers={
                "Content-Type": "application/json",
                "x-auth-token": security["token"],
                "x-hp-key": security["hp_key"],
                "x-hp-val": security["hp_val"],
            },
            json={
                "searchType": "games",
                "searchTerms": query.split(),
                "searchPage": 1,
                "size": 20,
                "searchOptions": {
                    "games": {
                        "userId": 0,
                        "platform": "",
                        "sortCategory": "popular",
                        "rangeCategory": "main",
                        "rangeTime": {"min": 0, "max": 0},
                        "gameplay": {
                            "perspective": "",
                            "flow": "",
                            "genre": "",
                            "difficulty": "",
                        },
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
                security["hp_key"]: security["hp_val"],
            },
        )

    @staticmethod
    def _similarity_score(query: str, name: str | None, alias: str | None) -> float:
        normalized_query = query.lower()
        candidate_scores = []
        for candidate in [name, alias]:
            if not candidate:
                continue
            normalized_candidate = candidate.lower()
            if normalized_candidate == normalized_query:
                candidate_scores.append(2.0)
                continue
            score = SequenceMatcher(None, normalized_query, normalized_candidate).ratio()
            if normalized_candidate.startswith(normalized_query):
                score += 0.05
            if normalized_query in normalized_candidate:
                score += 0.02
            score = min(score, 0.99)
            candidate_scores.append(score)
        if not candidate_scores:
            return 0.0
        return max(candidate_scores)

    @staticmethod
    def _to_game(result: Any) -> Game:
        return Game(
            name=result.get("game_name") or "",
            image_url=(f"{HLTBService.BASE_URL}/games/{result['game_image']}" if result.get("game_image") else ""),
            main_story_hours=round((result.get("comp_main") or 0) / 3600, 2),
            main_extra_hours=(round(result["comp_plus"] / 3600, 2) if result.get("comp_plus") else None),
            completionist_hours=(round(result["comp_100"] / 3600, 2) if result.get("comp_100") else None),
        )
