import asyncio
import logging
import os
import re
import time
from collections.abc import Iterable
from math import log1p
from typing import ClassVar

import httpx

from gamingclock.models.catalog import CatalogGame, CatalogGameVariant, IGDBGameType, release_year_from_epoch

logger = logging.getLogger(__name__)


class IGDBNotFoundError(LookupError):
    """Raised when IGDB has no game for a requested ID."""


class IGDBUpstreamError(RuntimeError):
    """Raised when IGDB cannot provide a requested game."""


class IGDBService:
    """Use IGDB in configured environments and a small catalog for local work."""

    _SEARCH_FETCH_LIMIT: ClassVar[int] = 40
    _SEARCH_VISIT_POPULARITY_TTL_SECONDS: ClassVar[int] = 30 * 24 * 60 * 60
    _SEARCH_VISIT_POPULARITY_CACHE_LIMIT: ClassVar[int] = 512
    _RELATION_HYDRATION_LIMIT: ClassVar[int] = 120
    _POPULARITY_CANDIDATE_MULTIPLIER: ClassVar[int] = 2
    _VISITS_POPULARITY_TYPE: ClassVar[int] = 1
    _TOTAL_REVIEWS_POPULARITY_TYPE: ClassVar[int] = 8
    _RECENT_RELEASE_SECONDS: ClassVar[int] = 365 * 24 * 60 * 60
    _ALLOWED_GAME_TYPES: ClassVar[frozenset[int]] = frozenset({0, 8, 9, 10, 11})
    _GAME_TYPE_PREFERENCE: ClassVar[dict[int, float]] = {0: 1.0, 10: 0.95, 9: 0.9, 8: 0.85, 11: 0.8}
    _GAME_TYPES: ClassVar[dict[int, IGDBGameType]] = {
        0: IGDBGameType.MAIN_GAME,
        8: IGDBGameType.REMAKE,
        9: IGDBGameType.REMASTER,
        10: IGDBGameType.EXPANDED_GAME,
        11: IGDBGameType.PORT,
    }
    _GAME_FIELDS: ClassVar[str] = (
        "id,name,summary,rating,total_rating_count,first_release_date,cover.url,genres.name,platforms.name,"
        "game_type,version_parent,parent_game,version_title,ports,remakes,remasters,expanded_games"
    )

    _local_catalog: ClassVar[list[CatalogGame]] = [
        CatalogGame(
            igdb_id=7,
            name="Final Fantasy VII",
            cover_url="",
            summary="A mercenary joins a group fighting to save the planet.",
            genres=["RPG"],
            platforms=["PlayStation"],
            release_year=1997,
            rating=91.2,
        ),
        CatalogGame(
            igdb_id=22,
            name="Chrono Trigger",
            cover_url="",
            summary="A time-travelling role-playing adventure.",
            genres=["RPG"],
            platforms=["Super Nintendo"],
            release_year=1995,
            rating=96.0,
        ),
    ]

    def __init__(
        self,
        http_client: httpx.AsyncClient | None = None,
        token_client: httpx.AsyncClient | None = None,
    ):
        self._http_client = http_client or httpx.AsyncClient()
        self._token_client = token_client or httpx.AsyncClient()
        self._owns_http_client = http_client is None
        self._owns_token_client = token_client is None
        self._access_token: str | None = None
        self._expires_at = 0.0
        self._search_visit_popularity_cache: dict[int, tuple[float, float]] = {}

    async def search(self, query: str, limit: int = 10) -> list[CatalogGame]:
        started_at = time.perf_counter()
        normalized = query.strip()
        if not normalized:
            return []
        if not self._is_configured():
            results = self._search_local_catalog(normalized, limit)
            logger.info(
                "IGDB search complete source=local query_length=%d result_count=%d duration_ms=%.1f",
                len(normalized),
                len(results),
                (time.perf_counter() - started_at) * 1000,
            )
            return results

        client_id, token = await self._get_auth_headers()
        headers = {"Client-ID": client_id, "Authorization": f"Bearer {token}"}
        body = (
            f"fields {self._GAME_FIELDS};"
            f'search "{self._escape_search_query(normalized)}";'
            "where version_parent = null & game_type = (0,8,9,10,11);"
            f"limit {max(self._SEARCH_FETCH_LIMIT, limit)};"
        )
        response = await self._http_client.post(
            "https://api.igdb.com/v4/games",
            headers=headers,
            content=body,
        )
        response.raise_for_status()
        search_items = response.json()
        search_game_ids = [item["id"] for item in search_items if isinstance(item.get("id"), int)]
        items, visit_popularity = await asyncio.gather(
            self._hydrate_related_search_items(headers, search_items),
            self._search_visit_popularity(headers, search_game_ids),
        )
        results = self._clean_search_results(normalized, items, limit, visit_popularity)
        logger.info(
            "IGDB search complete source=remote query_length=%d result_count=%d duration_ms=%.1f",
            len(normalized),
            len(results),
            (time.perf_counter() - started_at) * 1000,
        )
        return results

    async def get_by_id(self, igdb_id: int) -> CatalogGame:
        started_at = time.perf_counter()
        if not self._is_configured():
            for game in self._local_catalog:
                if game.igdb_id == igdb_id:
                    logger.info(
                        "IGDB get-by-id complete source=local duration_ms=%.1f",
                        (time.perf_counter() - started_at) * 1000,
                    )
                    return game
            raise IGDBNotFoundError(f"IGDB game not found: {igdb_id}")

        try:
            client_id, token = await self._get_auth_headers()
            body = (
                f"fields {self._GAME_FIELDS};"
                f"where id = {igdb_id};"
                "limit 1;"
            )
            response = await self._http_client.post(
                "https://api.igdb.com/v4/games",
                headers={"Client-ID": client_id, "Authorization": f"Bearer {token}"},
                content=body,
            )
            response.raise_for_status()
            results = response.json()
            if not results:
                raise IGDBNotFoundError(f"IGDB game not found: {igdb_id}")
            game = self._to_catalog_game(results[0])
        except IGDBNotFoundError:
            raise
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as error:
            raise IGDBUpstreamError("IGDB game lookup failed") from error
        logger.info(
            "IGDB get-by-id complete source=remote duration_ms=%.1f",
            (time.perf_counter() - started_at) * 1000,
        )
        return game

    async def aclose(self) -> None:
        """Close clients created by this service, but never injected clients."""
        clients = []
        if self._owns_http_client:
            clients.append(self._http_client.aclose())
        if self._owns_token_client:
            clients.append(self._token_client.aclose())
        if clients:
            await asyncio.gather(*clients)

    async def popular_games(self, limit: int = 20) -> list[CatalogGame]:
        """Blend current, recent-release, and all-time games for cache warming."""
        if limit <= 0:
            return []
        if not self._is_configured():
            return self._local_catalog[:limit]

        client_id, token = await self._get_auth_headers()
        headers = {"Client-ID": client_id, "Authorization": f"Bearer {token}"}
        candidate_limit = limit * self._POPULARITY_CANDIDATE_MULTIPLIER
        current_ids, recent_release_ids, all_time_ids = await asyncio.gather(
            self._popularity_game_ids(headers, self._VISITS_POPULARITY_TYPE, candidate_limit),
            self._recent_release_game_ids(headers, candidate_limit),
            self._popularity_game_ids(headers, self._TOTAL_REVIEWS_POPULARITY_TYPE, candidate_limit),
        )
        game_ids = self._interleave_unique_game_ids(current_ids, recent_release_ids, all_time_ids)
        if not game_ids:
            return []

        games_response = await self._http_client.post(
            "https://api.igdb.com/v4/games",
            headers=headers,
            content=(
                "fields id,name,summary,rating,first_release_date,cover.url,genres.name,platforms.name,"
                "game_type,version_parent;"
                f"where id = ({','.join(map(str, game_ids))});"
                f"limit {len(game_ids)};"
            ),
        )
        games_response.raise_for_status()
        games_by_id = {
            item["id"]: self._to_catalog_game(item)
            for item in games_response.json()
            if self._is_search_candidate(item)
        }
        return [games_by_id[game_id] for game_id in game_ids if game_id in games_by_id][:limit]

    async def _popularity_game_ids(
        self, headers: dict[str, str], popularity_type: int, limit: int
    ) -> list[int]:
        response = await self._http_client.post(
            "https://api.igdb.com/v4/popularity_primitives",
            headers=headers,
            content=(
                "fields game_id,value;"
                f"where popularity_type = {popularity_type};"
                "sort value desc;"
                f"limit {limit};"
            ),
        )
        response.raise_for_status()
        return [item["game_id"] for item in response.json() if isinstance(item.get("game_id"), int)]

    async def _recent_release_game_ids(self, headers: dict[str, str], limit: int) -> list[int]:
        cutoff = int(time.time()) - self._RECENT_RELEASE_SECONDS
        response = await self._http_client.post(
            "https://api.igdb.com/v4/games",
            headers=headers,
            content=(
                "fields id;"
                "where version_parent = null & game_type = (0,8,9,10)"
                f" & first_release_date > {cutoff};"
                "sort total_rating_count desc;"
                f"limit {limit};"
            ),
        )
        response.raise_for_status()
        return [item["id"] for item in response.json() if isinstance(item.get("id"), int)]

    @staticmethod
    def _interleave_unique_game_ids(*game_id_lists: list[int]) -> list[int]:
        game_ids: list[int] = []
        seen_game_ids: set[int] = set()
        for index in range(max((len(game_ids) for game_ids in game_id_lists), default=0)):
            for game_id_list in game_id_lists:
                if index >= len(game_id_list):
                    continue
                game_id = game_id_list[index]
                if game_id not in seen_game_ids:
                    seen_game_ids.add(game_id)
                    game_ids.append(game_id)
        return game_ids

    @staticmethod
    def _is_configured() -> bool:
        return bool(os.getenv("IGDB_CLIENT_ID") and os.getenv("IGDB_CLIENT_SECRET"))

    @staticmethod
    def _search_local_catalog(query: str, limit: int) -> list[CatalogGame]:
        normalized_query = query.strip().casefold()
        if not normalized_query:
            return []
        return [game for game in IGDBService._local_catalog if normalized_query in game.name.casefold()][:limit]

    @staticmethod
    def _escape_search_query(query: str) -> str:
        return query.replace("\\", "\\\\").replace('"', '\\"')

    @classmethod
    def _clean_search_results(
        cls, query: str, items: list[dict], limit: int, visit_popularity: dict[int, float]
    ) -> list[CatalogGame]:
        """Return one default release per related IGDB family, with selectable variants."""
        candidates = [item for item in items if cls._is_search_candidate(item)]
        if not candidates or limit <= 0:
            return []

        candidates_by_id = {item["id"]: item for item in candidates}
        parents = {game_id: game_id for game_id in candidates_by_id}

        def find(game_id: int) -> int:
            while parents[game_id] != game_id:
                parents[game_id] = parents[parents[game_id]]
                game_id = parents[game_id]
            return game_id

        def union(left: int, right: int) -> None:
            left_root, right_root = find(left), find(right)
            if left_root != right_root:
                parents[right_root] = left_root

        for item in candidates:
            for related_id in cls._related_game_ids(item):
                if related_id in candidates_by_id:
                    union(item["id"], related_id)

        groups: dict[int, list[dict]] = {}
        for item in candidates:
            groups.setdefault(find(item["id"]), []).append(item)

        rating_count_scale = max((log1p(item.get("total_rating_count") or 0) for item in candidates), default=1.0)
        rating_count_scale = max(rating_count_scale, 1.0)
        visit_popularity_scale = max((log1p(value) for value in visit_popularity.values()), default=0.0)
        visit_popularity_scale = max(visit_popularity_scale, 1e-9)
        selected_groups = [
            cls._select_group_representative(query, group, rating_count_scale, visit_popularity, visit_popularity_scale)
            for group in groups.values()
        ]
        selected_groups.sort(
            key=lambda selection: (
                selection[0],
                selection[1].get("total_rating_count") or 0,
                selection[1]["id"],
            ),
            reverse=True,
        )

        results = []
        for _, representative, grouped_items in selected_groups[:limit]:
            catalog_game = cls._to_catalog_game(representative)
            catalog_game.variants = [
                cls._to_catalog_variant(item)
                for item in cls._ordered_variants(grouped_items, representative["id"])
            ]
            results.append(catalog_game)
        return results

    async def _search_visit_popularity(self, headers: dict[str, str], game_ids: list[int]) -> dict[int, float]:
        """Return cached IGDB visit scores without making search depend on them."""
        now = time.monotonic()
        scores: dict[int, float] = {}
        missing_ids: list[int] = []
        for game_id in sorted(set(game_ids)):
            cached = self._search_visit_popularity_cache.get(game_id)
            if cached and cached[0] > now:
                scores[game_id] = cached[1]
            else:
                missing_ids.append(game_id)

        if not missing_ids:
            return scores

        try:
            response = await self._http_client.post(
                "https://api.igdb.com/v4/popularity_primitives",
                headers=headers,
                content=(
                    "fields game_id,value;"
                    f"where game_id = ({','.join(map(str, missing_ids))})"
                    f" & popularity_type = {self._VISITS_POPULARITY_TYPE};"
                    f"limit {len(missing_ids)};"
                ),
            )
            response.raise_for_status()
        except (httpx.HTTPError, TypeError, ValueError):
            logger.info("IGDB search popularity lookup failed", exc_info=True)
            return scores

        found_scores = {
            item["game_id"]: float(item["value"])
            for item in response.json()
            if isinstance(item.get("game_id"), int)
            and isinstance(item.get("value"), int | float)
            and item["value"] >= 0
        }
        if len(self._search_visit_popularity_cache) + len(missing_ids) > self._SEARCH_VISIT_POPULARITY_CACHE_LIMIT:
            self._search_visit_popularity_cache.clear()
        expires_at = now + self._SEARCH_VISIT_POPULARITY_TTL_SECONDS
        for game_id in missing_ids:
            score = found_scores.get(game_id, 0.0)
            self._search_visit_popularity_cache[game_id] = (expires_at, score)
            scores[game_id] = score
        return scores

    async def _hydrate_related_search_items(self, headers: dict[str, str], items: list[dict]) -> list[dict]:
        """Fetch a bounded relationship closure so a search page is not its own identity boundary."""
        items_by_id = {item["id"]: item for item in items if isinstance(item.get("id"), int)}
        pending = set().union(*(self._related_game_ids(item) for item in items_by_id.values())) - set(items_by_id)

        while pending and len(items_by_id) < self._RELATION_HYDRATION_LIMIT:
            remaining = self._RELATION_HYDRATION_LIMIT - len(items_by_id)
            batch = sorted(pending)[:remaining]
            pending.difference_update(batch)
            response = await self._http_client.post(
                "https://api.igdb.com/v4/games",
                headers=headers,
                content=(
                    f"fields {self._GAME_FIELDS};"
                    f"where id = ({','.join(map(str, batch))});"
                    f"limit {len(batch)};"
                ),
            )
            response.raise_for_status()
            for item in response.json():
                game_id = item.get("id")
                if not isinstance(game_id, int) or game_id in items_by_id:
                    continue
                items_by_id[game_id] = item
                pending.update(
                    related_id for related_id in self._related_game_ids(item) if related_id not in items_by_id
                )

        return list(items_by_id.values())

    @classmethod
    def _is_search_candidate(cls, item: dict) -> bool:
        game_type = item.get("game_type")
        return (
            item.get("id") is not None
            and bool(item.get("name"))
            and item.get("version_parent") is None
            and (game_type is None or game_type in cls._ALLOWED_GAME_TYPES)
        )

    @staticmethod
    def _related_game_ids(item: dict) -> Iterable[int]:
        for field in ("version_parent", "parent_game"):
            related_id = item.get(field)
            if isinstance(related_id, int):
                yield related_id
        for field in ("ports", "remakes", "remasters", "expanded_games"):
            yield from (game_id for game_id in item.get(field) or [] if isinstance(game_id, int))

    @classmethod
    def _select_group_representative(
        cls,
        query: str,
        group: list[dict],
        rating_count_scale: float,
        visit_popularity: dict[int, float],
        visit_popularity_scale: float,
    ) -> tuple[float, dict, list[dict]]:
        main_games = [item for item in group if item.get("game_type", 0) == 0]
        selected = (
            min(
                main_games,
                key=lambda item: (
                    item.get("first_release_date") or float("inf"),
                    item["id"],
                ),
            )
            if main_games
            else max(
                group,
                key=lambda item: (
                    cls._title_match_priority(query, item["name"]),
                    cls._search_score(query, item, rating_count_scale, visit_popularity, visit_popularity_scale),
                ),
            )
        )
        score = cls._search_score(query, selected, rating_count_scale, visit_popularity, visit_popularity_scale)
        return score, selected, group

    @classmethod
    def _search_score(
        cls,
        query: str,
        item: dict,
        rating_count_scale: float,
        visit_popularity: dict[int, float],
        visit_popularity_scale: float,
    ) -> float:
        normalized_query = cls._normalize_title(query)
        normalized_name = cls._normalize_title(item["name"])
        rating_count = log1p(item.get("total_rating_count") or 0) / rating_count_scale
        visits = log1p(visit_popularity.get(item["id"], 0.0)) / visit_popularity_scale
        game_type = item.get("game_type")
        type_preference = cls._GAME_TYPE_PREFERENCE.get(game_type, 0.0)
        title_match = (
            1.0
            if normalized_name == normalized_query
            else 0.8
            if normalized_name.startswith(normalized_query)
            else 0.45
        )
        return title_match + 0.35 * rating_count + 0.35 * visits + 0.1 * type_preference

    @classmethod
    def _title_match_priority(cls, query: str, name: str) -> int:
        normalized_query = cls._normalize_title(query)
        normalized_name = cls._normalize_title(name)
        if normalized_name == normalized_query:
            return 2
        if normalized_name.startswith(normalized_query):
            return 1
        return 0

    @staticmethod
    def _normalize_title(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()

    @classmethod
    def _ordered_variants(cls, items: list[dict], representative_id: int) -> list[dict]:
        return sorted(
            (item for item in items if item["id"] != representative_id),
            key=lambda item: (
                cls._GAME_TYPE_PREFERENCE.get(item.get("game_type"), 0.0) * -1,
                item.get("first_release_date") or float("inf"),
                item["id"],
            ),
        )

    async def _get_auth_headers(self) -> tuple[str, str]:
        client_id = os.getenv("IGDB_CLIENT_ID")
        client_secret = os.getenv("IGDB_CLIENT_SECRET")
        if not client_id or not client_secret:
            raise RuntimeError("IGDB credentials are not configured")

        if self._access_token and time.time() < self._expires_at:
            return client_id, self._access_token

        started_at = time.perf_counter()
        response = await self._token_client.post(
            "https://id.twitch.tv/oauth2/token",
            params={
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "client_credentials",
            },
        )
        response.raise_for_status()
        payload = response.json()
        self._access_token = payload["access_token"]
        self._expires_at = time.time() + max(payload.get("expires_in", 0) - 60, 0)
        logger.info("IGDB token refresh complete duration_ms=%.1f", (time.perf_counter() - started_at) * 1000)
        return client_id, self._access_token

    @staticmethod
    def _to_catalog_game(item: dict) -> CatalogGame:
        cover_url = item.get("cover", {}).get("url") or ""
        if cover_url.startswith("//"):
            cover_url = f"https:{cover_url}"
        return CatalogGame(
            igdb_id=item["id"],
            name=item["name"],
            cover_url=cover_url,
            summary=item.get("summary") or "",
            genres=[genre["name"] for genre in item.get("genres") or []],
            platforms=[platform["name"] for platform in item.get("platforms") or []],
            release_year=release_year_from_epoch(item.get("first_release_date")),
            rating=item.get("rating"),
            game_type=IGDBService._GAME_TYPES.get(item.get("game_type")),
            version_parent=item.get("version_parent"),
            parent_game=item.get("parent_game"),
            version_title=item.get("version_title"),
            ports=[game_id for game_id in item.get("ports") or [] if isinstance(game_id, int)],
            remakes=[game_id for game_id in item.get("remakes") or [] if isinstance(game_id, int)],
            remasters=[game_id for game_id in item.get("remasters") or [] if isinstance(game_id, int)],
            expanded_games=[game_id for game_id in item.get("expanded_games") or [] if isinstance(game_id, int)],
        )

    @staticmethod
    def _to_catalog_variant(item: dict) -> CatalogGameVariant:
        catalog_game = IGDBService._to_catalog_game(item)
        return CatalogGameVariant(
            igdb_id=catalog_game.igdb_id,
            name=catalog_game.name,
            cover_url=catalog_game.cover_url,
            summary=catalog_game.summary,
            genres=catalog_game.genres,
            platforms=catalog_game.platforms,
            release_year=catalog_game.release_year,
            rating=catalog_game.rating,
            game_type=catalog_game.game_type,
            version_parent=catalog_game.version_parent,
            parent_game=catalog_game.parent_game,
            version_title=catalog_game.version_title,
        )
