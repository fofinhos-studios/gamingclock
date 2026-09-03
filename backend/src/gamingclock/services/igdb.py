import logging
import os
import re
import time
from collections.abc import Iterable
from math import log1p
from typing import ClassVar

import httpx

from gamingclock.models.catalog import CatalogGame, release_year_from_epoch

logger = logging.getLogger(__name__)


class IGDBService:
    """Use IGDB in configured environments and a small catalog for local work."""

    _SEARCH_FETCH_LIMIT: ClassVar[int] = 40
    _ALLOWED_GAME_TYPES: ClassVar[frozenset[int]] = frozenset({0, 8, 9, 10})
    _GAME_TYPE_PREFERENCE: ClassVar[dict[int, float]] = {0: 1.0, 10: 0.95, 9: 0.9, 8: 0.85}

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
        self._access_token: str | None = None
        self._expires_at = 0.0

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
        body = (
            "fields id,name,summary,rating,total_rating_count,first_release_date,cover.url,genres.name,"
            "platforms.name,game_type,version_parent,ports,remasters,expanded_games;"
            f'search "{self._escape_search_query(normalized)}";'
            "where version_parent = null & game_type = (0,8,9,10);"
            f"limit {max(self._SEARCH_FETCH_LIMIT, limit)};"
        )
        response = await self._http_client.post(
            "https://api.igdb.com/v4/games",
            headers={"Client-ID": client_id, "Authorization": f"Bearer {token}"},
            content=body,
        )
        response.raise_for_status()
        results = self._clean_search_results(normalized, response.json(), limit)
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
            raise RuntimeError(f"IGDB game not found: {igdb_id}")

        client_id, token = await self._get_auth_headers()
        body = (
            "fields id,name,summary,rating,first_release_date,cover.url,genres.name,platforms.name;"
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
            raise RuntimeError(f"IGDB game not found: {igdb_id}")
        game = self._to_catalog_game(results[0])
        logger.info(
            "IGDB get-by-id complete source=remote duration_ms=%.1f",
            (time.perf_counter() - started_at) * 1000,
        )
        return game

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
    def _clean_search_results(cls, query: str, items: list[dict], limit: int) -> list[CatalogGame]:
        """Collapse related releases without letting popularity replace title relevance."""
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

        groups: dict[int, list[tuple[int, dict]]] = {}
        for index, item in enumerate(candidates):
            groups.setdefault(find(item["id"]), []).append((index, item))

        popularity_scale = max((log1p(item.get("total_rating_count") or 0) for item in candidates), default=1.0)
        popularity_scale = max(popularity_scale, 1.0)
        selected_groups = [
            cls._select_group_representative(query, group, len(candidates), popularity_scale)
            for group in groups.values()
        ]
        selected_groups.sort(key=lambda selection: selection[0], reverse=True)

        results = []
        for _, representative, grouped_items in selected_groups[:limit]:
            catalog_game = cls._to_catalog_game(representative)
            catalog_game.platforms = cls._merged_platforms(grouped_items)
            results.append(catalog_game)
        return results

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
        for field in ("ports", "remasters", "expanded_games"):
            yield from (game_id for game_id in item.get(field) or [] if isinstance(game_id, int))

    @classmethod
    def _select_group_representative(
        cls,
        query: str,
        group: list[tuple[int, dict]],
        candidate_count: int,
        popularity_scale: float,
    ) -> tuple[float, dict, list[dict]]:
        selected = max(
            group,
            key=lambda indexed_item: (
                cls._title_match_priority(query, indexed_item[1]["name"]),
                cls._search_score(query, indexed_item[0], indexed_item[1], candidate_count, popularity_scale),
            ),
        )
        score = cls._search_score(query, selected[0], selected[1], candidate_count, popularity_scale)
        return score, selected[1], [item for _, item in group]

    @classmethod
    def _search_score(cls, query: str, index: int, item: dict, candidate_count: int, popularity_scale: float) -> float:
        normalized_query = cls._normalize_title(query)
        normalized_name = cls._normalize_title(item["name"])
        relevance = 1 - index / max(candidate_count - 1, 1)
        popularity = log1p(item.get("total_rating_count") or 0) / popularity_scale
        game_type = item.get("game_type")
        type_preference = cls._GAME_TYPE_PREFERENCE.get(game_type, 0.0)
        exact_boost = 0.75 if normalized_name == normalized_query else 0.0
        prefix_boost = 0.2 if normalized_name.startswith(normalized_query) else 0.0
        return exact_boost + prefix_boost + 0.75 * relevance + 0.15 * popularity + 0.1 * type_preference

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

    @staticmethod
    def _merged_platforms(items: list[dict]) -> list[str]:
        return list(
            dict.fromkeys(
                platform["name"] for item in items for platform in item.get("platforms") or [] if platform.get("name")
            )
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
        )
