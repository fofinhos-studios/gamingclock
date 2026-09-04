"""Discover provider-native game groups and resolve checked members into IGDB."""

import asyncio
import logging
import os
import re
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

from gamingclock.models.catalog import CacheWarmResult, CatalogGame
from gamingclock.models.game_groups import (
    GameGroupEdition,
    GameGroupEvidence,
    GameGroupExcludedItem,
    GameGroupKind,
    GameGroupPossibleMatch,
    GameGroupPreview,
    GameGroupPreviewEvidence,
    GameGroupPreviewItem,
    GameGroupPreviewRequest,
    GameGroupSearchResult,
    GameGroupSelectionResolution,
    GameGroupSource,
    ResolveGameGroupSelectionRequest,
    ResolveGameGroupSelectionResponse,
)
from gamingclock.services.game_group_cache import CachedPayload, UpstashGameGroupCache
from gamingclock.services.igdb import IGDBService

logger = logging.getLogger(__name__)
_ALLOWED_GAME_TYPES = frozenset({0, 8, 9, 10})
_CACHE_SECONDS = 300
_CACHE_MAX_ENTRIES = 100
_OPTIONAL_SOURCE_TIMEOUT_SECONDS = 0.75
_RAWG_ATTRIBUTION_URL = "https://rawg.io/"
_RAWG_SEARCH_FRESH_SECONDS = 60 * 60 * 24 * 45
_RAWG_SEARCH_STALE_SECONDS = 60 * 60 * 24 * 15
_RAWG_GROUP_FRESH_SECONDS = 60 * 60 * 24 * 60
_RAWG_GROUP_STALE_SECONDS = 60 * 60 * 24 * 30
_RAWG_FAILURE_SECONDS = 60 * 60


@dataclass
class _ExternalGame:
    source_id: str
    name: str
    release_year: int | None = None
    igdb_slug: str | None = None


@dataclass
class _Candidate:
    group_key: str
    title: str
    kind: GameGroupKind
    source_keys: dict[GameGroupSource, str] = field(default_factory=dict)
    member_ids: set[int] = field(default_factory=set)
    members: list[_ExternalGame] = field(default_factory=list)
    possible_matches: list[GameGroupPossibleMatch] = field(default_factory=list)
    unavailable_sources: set[GameGroupSource] = field(default_factory=set)

    def merge(self, other: _Candidate) -> None:
        self.source_keys.update(other.source_keys)
        self.member_ids.update(other.member_ids)
        self.members.extend(other.members)
        self.possible_matches.extend(other.possible_matches)
        self.unavailable_sources.update(other.unavailable_sources)


class _GameGroupCache(Protocol):
    async def get(self, key: str) -> CachedPayload | None: ...

    async def set(self, key: str, value: Any, *, fresh_seconds: int, stale_seconds: int = 0) -> None: ...

    async def try_acquire_refresh_lock(self, key: str, *, seconds: int = 30) -> bool: ...

    async def aclose(self) -> None: ...


class RAWGAdapter:
    def __init__(
        self,
        client: httpx.AsyncClient | None = None,
        shared_cache: _GameGroupCache | None = None,
    ):
        self._client = client or httpx.AsyncClient(timeout=10)
        self._shared_cache = shared_cache if shared_cache is not None else UpstashGameGroupCache.from_environment()
        self._refresh_tasks: set[asyncio.Task[None]] = set()

    @property
    def configured(self) -> bool:
        return bool(os.getenv("RAWG_API_KEY"))

    async def search(self, query: str) -> list[tuple[str, str, list[_ExternalGame]]]:
        if not self.configured:
            return []
        cache_key = f"rawg:search:{_normalize(query)}"
        cached = await self._get_cached(cache_key)
        if cached is not None:
            groups, is_fresh = cached
            if not is_fresh:
                self._schedule_refresh(cache_key, lambda: self._fetch_search(query))
            return groups
        try:
            return await self._fetch_search(query)
        except httpx.HTTPError:
            await self._set_cached(cache_key, [], fresh_seconds=_RAWG_FAILURE_SECONDS)
            raise

    async def warm_search_if_needed(self, query: str) -> bool:
        """Refresh a cold seed once across all serverless instances."""
        cache_key = f"rawg:search:{_normalize(query)}"
        cached = await self._get_cached(cache_key)
        if cached is not None and cached[1]:
            return False
        if self._shared_cache is not None and not await self._try_lock(cache_key):
            return False
        try:
            await self._fetch_search(query)
        except httpx.HTTPError:
            if cached is None:
                await self._set_cached(cache_key, [], fresh_seconds=_RAWG_FAILURE_SECONDS)
            return False
        return True

    async def warm_seed_if_needed(self, query: str) -> bool:
        """Warm one search record and its one selected group, if either is cold."""
        search_key = f"rawg:search:{_normalize(query)}"
        cached = await self._get_cached(search_key)
        if cached is not None and cached[1]:
            groups = cached[0]
            search_warmed = False
        else:
            search_warmed = await self.warm_search_if_needed(query)
            refreshed = await self._get_cached(search_key)
            groups = refreshed[0] if refreshed is not None else []
        if not groups:
            return search_warmed
        group_key = groups[0][0]
        group_warmed = await self._warm_group_if_needed(group_key)
        return search_warmed or group_warmed

    async def is_seed_cold(self, query: str) -> bool:
        """Check both RAWG tiers without spending a provider request."""
        cached = await self._get_cached(f"rawg:search:{_normalize(query)}")
        if cached is None or not cached[1]:
            return True
        groups = cached[0]
        if not groups:
            return False
        _, _, raw_id = groups[0][0].partition("rawg:related:")
        if not raw_id.isdigit():
            return False
        group = await self._get_cached(f"rawg:group:{raw_id}")
        return group is None or not group[1]

    async def _warm_group_if_needed(self, group_key: str) -> bool:
        _, _, raw_id = group_key.partition("rawg:related:")
        if not raw_id.isdigit():
            return False
        cache_key = f"rawg:group:{raw_id}"
        cached = await self._get_cached(cache_key)
        if cached is not None and cached[1]:
            return False
        if self._shared_cache is not None and not await self._try_lock(cache_key):
            return False
        try:
            await self._fetch_group(group_key, int(raw_id))
        except httpx.HTTPError, LookupError:
            if cached is None:
                await self._set_cached(cache_key, [], fresh_seconds=_RAWG_FAILURE_SECONDS)
            return False
        return True

    async def get_warm_cursor(self) -> int:
        if self._shared_cache is None:
            return 0
        try:
            cached = await self._shared_cache.get("rawg:warm:cursor")
            return cached.value if cached and isinstance(cached.value, int) else 0
        except Exception:
            logger.info("RAWG warm cursor read failed")
            return 0

    async def set_warm_cursor(self, cursor: int) -> None:
        if self._shared_cache is None:
            return
        try:
            await self._shared_cache.set(
                "rawg:warm:cursor",
                cursor,
                fresh_seconds=60 * 60 * 24 * 365,
            )
        except Exception:
            logger.info("RAWG warm cursor write failed")

    async def _fetch_search(self, query: str) -> list[tuple[str, str, list[_ExternalGame]]]:
        response = await self._client.get(
            "https://api.rawg.io/api/games",
            params={"key": os.environ["RAWG_API_KEY"], "search": query, "page_size": 1},
        )
        response.raise_for_status()
        source_games = [
            game
            for game in response.json().get("results", [])
            if isinstance(game.get("id"), int) and isinstance(game.get("name"), str)
        ]
        candidates: list[tuple[str, str, list[_ExternalGame]]] = []
        for game in source_games[:1]:
            game_id = game.get("id")
            name = game.get("name")
            if not isinstance(game_id, int) or not isinstance(name, str):
                continue
            # A search card is just an invitation to explore. Its membership is
            # fetched only after expansion (one detail and two related calls).
            candidates.append((f"rawg:related:{game_id}", name, []))
        await self._set_cached(
            f"rawg:search:{_normalize(query)}",
            candidates,
            fresh_seconds=_RAWG_SEARCH_FRESH_SECONDS if candidates else _RAWG_FAILURE_SECONDS,
            stale_seconds=_RAWG_SEARCH_STALE_SECONDS if candidates else 0,
        )
        return candidates

    async def by_key(self, group_key: str) -> tuple[str, list[_ExternalGame]]:
        _, _, raw_id = group_key.partition("rawg:related:")
        if not raw_id.isdigit() or not self.configured:
            raise LookupError(group_key)
        cache_key = f"rawg:group:{raw_id}"
        cached = await self._get_cached(cache_key)
        if cached is not None and cached[0]:
            groups, is_fresh = cached
            if not is_fresh:
                self._schedule_refresh(cache_key, lambda: self._fetch_group(group_key, int(raw_id)))
            _, name, members = groups[0]
            return name, members
        if cached is not None:
            raise LookupError(group_key)
        try:
            return await self._fetch_group(group_key, int(raw_id))
        except httpx.HTTPError, LookupError:
            await self._set_cached(cache_key, [], fresh_seconds=_RAWG_FAILURE_SECONDS)
            raise

    async def _fetch_group(self, group_key: str, raw_id: int) -> tuple[str, list[_ExternalGame]]:
        response = await self._client.get(
            f"https://api.rawg.io/api/games/{raw_id}", params={"key": os.environ["RAWG_API_KEY"]}
        )
        response.raise_for_status()
        game = response.json()
        name = game.get("name")
        if not isinstance(name, str):
            raise LookupError(group_key)
        seed = _ExternalGame(str(raw_id), name, _rawg_year(game.get("released")))
        members = [seed, *await self._related_games(raw_id)]
        await self._set_cached(
            f"rawg:group:{raw_id}",
            [(group_key, name, members)],
            fresh_seconds=_RAWG_GROUP_FRESH_SECONDS,
            stale_seconds=_RAWG_GROUP_STALE_SECONDS,
        )
        return name, members

    async def _related_games(self, game_id: int) -> list[_ExternalGame]:
        members: dict[str, _ExternalGame] = {}
        responses = await asyncio.gather(
            *(
                self._client.get(
                    f"https://api.rawg.io/api/games/{game_id}/{suffix}",
                    params={"key": os.environ["RAWG_API_KEY"], "page_size": 40},
                )
                for suffix in ("game-series", "parent-games")
            )
        )
        for response in responses:
            response.raise_for_status()
            for game in response.json().get("results", []):
                raw_id = game.get("id")
                name = game.get("name")
                if isinstance(raw_id, int) and isinstance(name, str):
                    members[str(raw_id)] = _ExternalGame(str(raw_id), name, _rawg_year(game.get("released")))
        return list(members.values())

    async def aclose(self) -> None:
        if self._refresh_tasks:
            await asyncio.gather(*self._refresh_tasks, return_exceptions=True)
        await self._client.aclose()
        if self._shared_cache is not None:
            await self._shared_cache.aclose()

    async def _get_cached(self, key: str) -> tuple[list[tuple[str, str, list[_ExternalGame]]], bool] | None:
        if self._shared_cache is None:
            return None
        try:
            cached = await self._shared_cache.get(key)
            if cached is None or not isinstance(cached.value, list):
                return None
            return [
                (
                    item["key"],
                    item["title"],
                    [_ExternalGame(**member) for member in item["members"]],
                )
                for item in cached.value
                if isinstance(item, dict)
                and isinstance(item.get("key"), str)
                and isinstance(item.get("title"), str)
                and isinstance(item.get("members"), list)
            ], cached.is_fresh
        except Exception:
            logger.info("RAWG shared cache read failed")
            return None

    async def _set_cached(
        self,
        key: str,
        groups: list[tuple[str, str, list[_ExternalGame]]],
        *,
        fresh_seconds: int,
        stale_seconds: int = 0,
    ) -> None:
        if self._shared_cache is None:
            return
        try:
            await self._shared_cache.set(
                key,
                [
                    {"key": group_key, "title": title, "members": [member.__dict__ for member in members]}
                    for group_key, title, members in groups
                ],
                fresh_seconds=fresh_seconds,
                stale_seconds=stale_seconds,
            )
        except Exception:
            logger.info("RAWG shared cache write failed")

    async def _try_lock(self, key: str) -> bool:
        try:
            return await self._shared_cache.try_acquire_refresh_lock(key) if self._shared_cache else True
        except Exception:
            logger.info("RAWG shared cache lock failed")
            return False

    def _schedule_refresh(self, key: str, refresh: Callable[[], Awaitable[Any]]) -> None:
        async def run() -> None:
            if not await self._try_lock(key):
                return
            try:
                await refresh()
            except httpx.HTTPError:
                logger.info("RAWG stale cache refresh failed")

        task = asyncio.create_task(run())
        self._refresh_tasks.add(task)
        task.add_done_callback(self._refresh_tasks.discard)


class WikidataAdapter:
    def __init__(self, client: httpx.AsyncClient | None = None):
        self._client = client or httpx.AsyncClient(timeout=12, headers={"User-Agent": "GamingClock/0.1"})

    async def search(self, query: str) -> list[tuple[str, str, list[_ExternalGame]]]:
        response = await self._client.get(
            "https://www.wikidata.org/w/api.php",
            params={"action": "wbsearchentities", "search": query, "language": "en", "format": "json", "limit": 5},
        )
        response.raise_for_status()
        source_groups = [
            result
            for result in response.json().get("search", [])
            if isinstance(result.get("id"), str) and isinstance(result.get("label"), str)
        ]
        candidates: list[tuple[str, str, list[_ExternalGame]]] = []
        for result in source_groups:
            qid = result.get("id")
            label = result.get("label")
            if not isinstance(qid, str) or not isinstance(label, str):
                continue
            candidates.append((f"wikidata:series:{qid}", label, []))
        return candidates

    async def by_key(self, group_key: str) -> tuple[str, list[_ExternalGame]]:
        _, _, qid = group_key.partition("wikidata:series:")
        if not re.fullmatch(r"Q\d+", qid):
            raise LookupError(group_key)
        members = await self._members(qid)
        if not members:
            raise LookupError(group_key)
        return qid, members

    async def _members(self, qid: str) -> list[_ExternalGame]:
        query = f"""
        SELECT ?item ?itemLabel ?date ?slug WHERE {{
          ?item wdt:P179 wd:{qid}.
          OPTIONAL {{ ?item wdt:P577 ?date. }}
          OPTIONAL {{ ?item wdt:P5794 ?slug. }}
          SERVICE wikibase:label {{ bd:serviceParam wikibase:language \"en\". }}
        }} LIMIT 500
        """
        response = await self._client.get(
            "https://query.wikidata.org/sparql", params={"query": query, "format": "json"}
        )
        response.raise_for_status()
        members = []
        for item in response.json().get("results", {}).get("bindings", []):
            name = item.get("itemLabel", {}).get("value")
            identifier = item.get("item", {}).get("value", "").rsplit("/", 1)[-1]
            if not isinstance(name, str) or not identifier:
                continue
            date = item.get("date", {}).get("value")
            year = int(date[:4]) if isinstance(date, str) and date[:4].isdigit() else None
            members.append(_ExternalGame(identifier, name, year, item.get("slug", {}).get("value")))
        return members

    async def aclose(self) -> None:
        await self._client.aclose()


class GameGroupExplorer:
    """Discover provider-native groups; resolve into IGDB only after selection."""

    def __init__(
        self,
        igdb: IGDBService | None = None,
        rawg: RAWGAdapter | None = None,
        wikidata: WikidataAdapter | None = None,
    ):
        self._igdb = igdb or IGDBService()
        self._rawg = rawg or RAWGAdapter()
        self._wikidata = wikidata or WikidataAdapter()
        self._search_cache: dict[str, tuple[float, list[GameGroupSearchResult]]] = {}
        self._preview_cache: dict[str, tuple[float, GameGroupPreview]] = {}

    async def search(self, query: str) -> list[GameGroupSearchResult]:
        normalized = _normalize(query)
        cached = self._search_cache.get(normalized)
        if cached and cached[0] > time.monotonic():
            return [item.model_copy(deep=True) for item in cached[1]]
        candidates = await self._discover(query)
        results = [self._to_result(candidate) for candidate in candidates][:4]
        self._search_cache[normalized] = (time.monotonic() + _CACHE_SECONDS, results)
        self._trim_cache(self._search_cache)
        return [item.model_copy(deep=True) for item in results]

    async def for_game(self, igdb_id: int) -> list[GameGroupSearchResult]:
        await self._igdb.get_by_id(igdb_id)
        groups = await asyncio.gather(
            self._igdb_groups_for_game("collections", igdb_id),
            self._igdb_groups_for_game("franchises", igdb_id),
        )
        candidates: list[_Candidate] = []
        for endpoint, source_groups in zip(("collections", "franchises"), groups, strict=True):
            kind = GameGroupKind.SERIES if endpoint == "collections" else GameGroupKind.FRANCHISE
            singular = endpoint.removesuffix("s")
            candidates.extend(
                _Candidate(
                    group_key=f"igdb:{singular}:{identifier}",
                    title=name,
                    kind=kind,
                    source_keys={GameGroupSource.IGDB: f"igdb:{singular}:{identifier}"},
                )
                for identifier, name in source_groups
            )
        return [self._to_result(candidate) for candidate in _merge_candidates(candidates)][:4]

    async def warm_rawg_popular(self, limit: int) -> CacheWarmResult:
        """Rotate through a dynamic popular set, spending at most ``limit`` cold seeds."""
        if not self._rawg.configured:
            return CacheWarmResult(requested_games=0, warmed_games=0, failed_games=0)
        games = await self._igdb.popular_games(min(limit * 4, 20))
        if not games:
            return CacheWarmResult(requested_games=0, warmed_games=0, failed_games=0)
        cursor = await self._rawg.get_warm_cursor()
        start = cursor % len(games)
        rotating_seeds = [*games[start:], *games[:start]]
        warmed_games = 0
        failed_games = 0
        cold_attempts = 0
        inspected = 0
        for game in rotating_seeds:
            inspected += 1
            if not await self._rawg.is_seed_cold(game.name):
                continue
            if cold_attempts >= limit:
                break
            cold_attempts += 1
            try:
                if await self._rawg.warm_seed_if_needed(game.name):
                    warmed_games += 1
                else:
                    failed_games += 1
            except Exception:
                logger.info("RAWG group warm failed game_id=%s", game.igdb_id)
                failed_games += 1
        await self._rawg.set_warm_cursor(cursor + max(inspected, 1))
        return CacheWarmResult(
            requested_games=inspected,
            warmed_games=warmed_games,
            failed_games=failed_games,
        )

    async def preview(self, request: GameGroupPreviewRequest) -> GameGroupPreview:
        existing_key = ",".join(str(identifier) for identifier in sorted(set(request.existing_igdb_ids)))
        cache_key = f"{request.group_key}:{existing_key}"
        cached = self._preview_cache.get(cache_key)
        if cached and cached[0] > time.monotonic():
            return cached[1].model_copy(deep=True)
        if request.edition_policy != "canonical_releases":
            raise ValueError("edition_policy must be canonical_releases")
        candidate = await self._candidate_for_key(request.group_key)
        result = self._to_result(candidate)
        existing = set(request.existing_igdb_ids)
        excluded = []
        primary_source = _primary_source(candidate)
        items = [
            GameGroupPreviewItem(
                source_id=member.source_id,
                name=member.name,
                release_year=member.release_year,
                igdb_id=int(member.source_id) if primary_source is GameGroupSource.IGDB else None,
                order=index,
                initially_selected=True,
                already_in_backlog=member.source_id.isdigit() and int(member.source_id) in existing,
                evidence=[
                    GameGroupPreviewEvidence(source=source, relation="membership", label=_source_label(source))
                    for source in candidate.source_keys
                ],
                edition=GameGroupEdition(state="source", label="Resolved when added"),
            )
            for index, member in enumerate(candidate.members, start=1)
        ]
        preview_result = GameGroupPreview(
            group=result,
            items=items,
            excluded_items=excluded,
            possible_matches=candidate.possible_matches,
            unavailable_sources=sorted(candidate.unavailable_sources, key=lambda source: source.value),
            rawg_attribution_required=GameGroupSource.RAWG in candidate.source_keys,
            rawg_attribution_url=_RAWG_ATTRIBUTION_URL if GameGroupSource.RAWG in candidate.source_keys else None,
        )
        self._preview_cache[cache_key] = (time.monotonic() + _CACHE_SECONDS, preview_result)
        self._trim_cache(self._preview_cache)
        return preview_result.model_copy(deep=True)

    async def resolve_selection(self, request: ResolveGameGroupSelectionRequest) -> ResolveGameGroupSelectionResponse:
        """Reconcile the checked members only, preserving every unresolved selection."""
        candidate = await self._candidate_for_key(request.group_key)
        requested = set(request.source_member_ids)
        if GameGroupSource.IGDB in candidate.source_keys:
            members = [
                _ExternalGame(str(identifier), str(identifier))
                for identifier in candidate.member_ids
                if str(identifier) in requested
            ]
        else:
            members = [member for member in candidate.members if member.source_id in requested]
        found = {member.source_id for member in members}
        resolutions: list[GameGroupSelectionResolution | None] = [None] * len(request.source_member_ids)

        async def resolve(member: _ExternalGame) -> GameGroupSelectionResolution:
            try:
                if GameGroupSource.IGDB in candidate.source_keys and member.source_id.isdigit():
                    game = await self._igdb.get_by_id(int(member.source_id))
                else:
                    game = await self._reconcile(member)
            except Exception:
                logger.info("game group selection reconciliation failed source_id=%s", member.source_id)
                game = None
            return GameGroupSelectionResolution(
                source_id=member.source_id,
                name=member.name,
                game=game,
                reason=None if game else "No confident IGDB match",
            )

        semaphore = asyncio.Semaphore(4)

        async def bounded(member: _ExternalGame) -> GameGroupSelectionResolution:
            async with semaphore:
                return await resolve(member)

        resolved = {entry.source_id: entry for entry in await asyncio.gather(*(bounded(member) for member in members))}
        for index, source_id in enumerate(request.source_member_ids):
            resolutions[index] = resolved.get(source_id) or GameGroupSelectionResolution(
                source_id=source_id,
                name=source_id,
                reason="This title is no longer in the source group"
                if source_id not in found
                else "No confident IGDB match",
            )
        return ResolveGameGroupSelectionResponse(resolutions=[item for item in resolutions if item])

    async def _discover(self, query: str) -> list[_Candidate]:
        if not query.strip():
            return []
        # Group discovery is supplemental to ordinary game search. No provider is
        # allowed to hold its result open after the initial latency budget.
        tasks = {
            asyncio.create_task(
                asyncio.wait_for(self._igdb_candidates(query), timeout=_OPTIONAL_SOURCE_TIMEOUT_SECONDS)
            ): GameGroupSource.IGDB,
            asyncio.create_task(
                asyncio.wait_for(self._rawg_candidates(query), timeout=_OPTIONAL_SOURCE_TIMEOUT_SECONDS)
            ): GameGroupSource.RAWG,
            asyncio.create_task(
                asyncio.wait_for(self._wikidata_candidates(query), timeout=_OPTIONAL_SOURCE_TIMEOUT_SECONDS)
            ): GameGroupSource.WIKIDATA,
        }
        started_at = time.perf_counter()
        candidates: list[_Candidate] = []
        unavailable_sources: set[GameGroupSource] = set()
        pending = set(tasks)
        try:
            while pending and not candidates:
                completed, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
                for task in completed:
                    source = tasks[task]
                    try:
                        result = task.result()
                    except Exception as error:
                        logger.info("game group source failed source=%s error=%s", source, type(error).__name__)
                        unavailable_sources.add(source)
                        continue
                    if result:
                        candidates.extend(result)
        finally:
            for task in pending:
                task.cancel()
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)
        for candidate in candidates:
            candidate.unavailable_sources.update(unavailable_sources)
        # Source cards are deliberately independent. We never make discovery wait
        # for IGDB reconciliation or infer that differently scoped groups match.
        merged = _merge_candidates(candidates)
        logger.info(
            "game group discovery complete query_length=%d groups=%d duration_ms=%.1f",
            len(query),
            len(merged),
            (time.perf_counter() - started_at) * 1000,
        )
        return merged

    async def _candidate_for_key(self, group_key: str) -> _Candidate:
        if group_key.startswith("igdb:"):
            kind, endpoint, raw_id = group_key.split(":", 2)
            if kind != "igdb" or not raw_id.isdigit():
                raise LookupError(group_key)
            if endpoint not in {"collection", "franchise"}:
                raise LookupError(group_key)
            title, members = await self._igdb_group(endpoint, int(raw_id))
            return _Candidate(
                group_key=group_key,
                title=title,
                kind=GameGroupKind.SERIES if endpoint == "collection" else GameGroupKind.FRANCHISE,
                source_keys={GameGroupSource.IGDB: group_key},
                member_ids={int(member.source_id) for member in members},
                members=members,
            )
        if group_key.startswith("rawg:related:"):
            title, members = await self._rawg.by_key(group_key)
            return self._external_candidate(group_key, title, members, GameGroupSource.RAWG)
        if group_key.startswith("wikidata:series:"):
            title, members = await self._wikidata.by_key(group_key)
            return self._external_candidate(group_key, title, members, GameGroupSource.WIKIDATA)
        raise LookupError(group_key)

    async def _igdb_candidates(self, query: str) -> list[_Candidate]:
        groups = await asyncio.gather(self._igdb_groups("collections", query), self._igdb_groups("franchises", query))
        candidates = []
        for endpoint, items in zip(("collections", "franchises"), groups, strict=True):
            kind = GameGroupKind.SERIES if endpoint == "collections" else GameGroupKind.FRANCHISE
            singular = endpoint.removesuffix("s")
            for item in items:
                identifier, name, members = item
                candidates.append(
                    _Candidate(
                        group_key=f"igdb:{singular}:{identifier}",
                        title=name,
                        kind=kind,
                        source_keys={GameGroupSource.IGDB: f"igdb:{singular}:{identifier}"},
                        member_ids={int(member.source_id) for member in members},
                        members=members,
                    )
                )
        return candidates

    async def _rawg_candidates(self, query: str) -> list[_Candidate]:
        return [
            self._external_candidate(key, title, members, GameGroupSource.RAWG)
            for key, title, members in await self._rawg.search(query)
        ]

    async def _wikidata_candidates(self, query: str) -> list[_Candidate]:
        return [
            self._external_candidate(key, title, members, GameGroupSource.WIKIDATA)
            for key, title, members in await self._wikidata.search(query)
        ]

    def _external_candidate(
        self, group_key: str, title: str, members: list[_ExternalGame], source: GameGroupSource
    ) -> _Candidate:
        return _Candidate(
            group_key=group_key,
            title=title,
            kind=GameGroupKind.SERIES,
            source_keys={source: group_key},
            members=members,
        )

    async def _reconcile(self, member: _ExternalGame) -> CatalogGame | None:
        if member.igdb_slug:
            match = await self._igdb_by_slug(member.igdb_slug)
            if match:
                return match
        candidates = await self._igdb.search(member.name, limit=10)
        exact = [game for game in candidates if _normalize(game.name) == _normalize(member.name)]
        if member.release_year is not None:
            exact = [
                game
                for game in exact
                if game.release_year is not None and abs(game.release_year - member.release_year) <= 1
            ]
        return exact[0] if len(exact) == 1 else None

    async def _igdb_groups(self, endpoint: str, query: str) -> list[tuple[int, str, list[_ExternalGame]]]:
        if not self._igdb._is_configured():
            return []
        client_id, token = await self._igdb._get_auth_headers()
        response = await self._igdb._http_client.post(
            f"https://api.igdb.com/v4/{endpoint}",
            headers={"Client-ID": client_id, "Authorization": f"Bearer {token}"},
            content=f'fields id,name; search "{self._igdb._escape_search_query(query)}"; limit 20;',
        )
        response.raise_for_status()
        return [
            (item["id"], item["name"], _igdb_group_members(item.get("games")))
            for item in response.json()
            if isinstance(item.get("id"), int) and isinstance(item.get("name"), str)
        ]

    async def _igdb_groups_for_game(self, endpoint: str, igdb_id: int) -> list[tuple[int, str]]:
        if not self._igdb._is_configured():
            return []
        client_id, token = await self._igdb._get_auth_headers()
        response = await self._igdb._http_client.post(
            f"https://api.igdb.com/v4/{endpoint}",
            headers={"Client-ID": client_id, "Authorization": f"Bearer {token}"},
            content=f"fields id,name; where games = ({igdb_id}); limit 20;",
        )
        response.raise_for_status()
        return [
            (item["id"], item["name"])
            for item in response.json()
            if isinstance(item.get("id"), int) and isinstance(item.get("name"), str)
        ]

    async def _igdb_group(self, endpoint: str, identifier: int) -> tuple[str, list[_ExternalGame]]:
        plural = f"{endpoint}s"
        groups = await self._igdb_groups_by_id(plural, identifier)
        if not groups:
            raise LookupError(f"igdb:{endpoint}:{identifier}")
        return groups[0][1], groups[0][2]

    async def _igdb_groups_by_id(self, endpoint: str, identifier: int) -> list[tuple[int, str, list[_ExternalGame]]]:
        if not self._igdb._is_configured():
            raise LookupError(identifier)
        client_id, token = await self._igdb._get_auth_headers()
        response = await self._igdb._http_client.post(
            f"https://api.igdb.com/v4/{endpoint}",
            headers={"Client-ID": client_id, "Authorization": f"Bearer {token}"},
            content=(f"fields id,name,games.id,games.name,games.first_release_date; where id = {identifier}; limit 1;"),
        )
        response.raise_for_status()
        return [
            (item["id"], item["name"], _igdb_group_members(item.get("games")))
            for item in response.json()
            if isinstance(item.get("id"), int) and isinstance(item.get("name"), str)
        ]

    async def _igdb_by_slug(self, slug: str) -> CatalogGame | None:
        if not self._igdb._is_configured():
            return None
        client_id, token = await self._igdb._get_auth_headers()
        response = await self._igdb._http_client.post(
            "https://api.igdb.com/v4/games",
            headers={"Client-ID": client_id, "Authorization": f"Bearer {token}"},
            content=(
                "fields id,name,summary,rating,first_release_date,cover.url,genres.name,platforms.name;"
                f'where slug = "{self._igdb._escape_search_query(slug)}"; limit 1;'
            ),
        )
        response.raise_for_status()
        return self._igdb._to_catalog_game(response.json()[0]) if response.json() else None

    async def _igdb_games(self, ids: set[int]) -> list[dict[str, Any]]:
        if not ids:
            return []
        if not self._igdb._is_configured():
            fetched_games = await asyncio.gather(
                *(self._igdb.get_by_id(identifier) for identifier in ids), return_exceptions=True
            )
            return [
                game.model_dump() | {"id": game.igdb_id, "game_type": 0, "version_parent": None}
                for game in fetched_games
                if isinstance(game, CatalogGame)
            ]
        client_id, token = await self._igdb._get_auth_headers()
        rows: list[dict[str, Any]] = []
        for batch in _batches(sorted(ids), 500):
            response = await self._igdb._http_client.post(
                "https://api.igdb.com/v4/games",
                headers={"Client-ID": client_id, "Authorization": f"Bearer {token}"},
                content=(
                    "fields id,name,summary,rating,first_release_date,cover.url,genres.name,platforms.name,"
                    "game_type,version_parent,ports,remasters,expanded_games;"
                    f"where id = ({','.join(map(str, batch))}); limit {len(batch)};"
                ),
            )
            response.raise_for_status()
            rows.extend(response.json())
        return rows

    def _to_result(self, candidate: _Candidate) -> GameGroupSearchResult:
        primary = _primary_source(candidate)
        scope_name = {
            (GameGroupSource.IGDB, GameGroupKind.SERIES): "series",
            (GameGroupSource.IGDB, GameGroupKind.FRANCHISE): "franchise",
            (GameGroupSource.RAWG, GameGroupKind.SERIES): "related games",
            (GameGroupSource.WIKIDATA, GameGroupKind.SERIES): "related titles",
        }.get((primary, candidate.kind), "related games")
        return GameGroupSearchResult(
            group_key=candidate.group_key,
            display_name=f"{candidate.title} — {scope_name}",
            scope_name=scope_name,
            card_kind=candidate.kind,
            candidate_count=len(candidate.members) or len(candidate.member_ids),
            sources=[GameGroupEvidence(source=source, label=_source_label(source)) for source in candidate.source_keys],
            warning=(
                "Includes spin-offs, DLC, editions, and remasters. Review required."
                if candidate.kind is GameGroupKind.FRANCHISE
                else None
            ),
        )

    async def aclose(self) -> None:
        await asyncio.gather(self._rawg.aclose(), self._wikidata.aclose())

    @staticmethod
    def _trim_cache(cache: dict[str, tuple[float, Any]]) -> None:
        now = time.monotonic()
        for key, (expires_at, _) in list(cache.items()):
            if expires_at <= now:
                del cache[key]
        while len(cache) > _CACHE_MAX_ENTRIES:
            del cache[next(iter(cache))]


def _merge_candidates(candidates: list[_Candidate]) -> list[_Candidate]:
    unique = {candidate.group_key: candidate for candidate in candidates}
    return sorted(
        unique.values(),
        key=lambda candidate: (
            candidate.kind is GameGroupKind.FRANCHISE,
            -max(len(candidate.members), len(candidate.member_ids)),
            candidate.title,
        ),
    )


def _should_merge(left: _Candidate, right: _Candidate) -> bool:
    if left.kind is not right.kind or _normalize(left.title) != _normalize(right.title):
        return False
    overlap = len(left.member_ids & right.member_ids)
    return overlap >= 2 and overlap / min(len(left.member_ids), len(right.member_ids)) >= 0.5


def _canonical_games(rows: list[dict[str, Any]]) -> tuple[list[CatalogGame], list[GameGroupExcludedItem]]:
    candidates = [
        row
        for row in rows
        if row.get("id")
        and row.get("name")
        and row.get("version_parent") is None
        and row.get("game_type", 0) in _ALLOWED_GAME_TYPES
    ]
    by_id = {row["id"]: row for row in candidates}
    parent = {identifier: identifier for identifier in by_id}

    def find(identifier: int) -> int:
        while parent[identifier] != identifier:
            parent[identifier] = parent[parent[identifier]]
            identifier = parent[identifier]
        return identifier

    def union(left: int, right: int) -> None:
        left_root, right_root = find(left), find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    for row in candidates:
        for relation_field in ("ports", "remasters", "expanded_games"):
            for related in row.get(relation_field) or []:
                if related in by_id:
                    union(row["id"], related)
    groups: dict[int, list[dict[str, Any]]] = {}
    for row in candidates:
        groups.setdefault(find(row["id"]), []).append(row)
    selected: list[dict[str, Any]] = []
    excluded: list[GameGroupExcludedItem] = []
    for group in groups.values():
        representative = min(
            group,
            key=lambda row: (row.get("game_type", 0) != 0, row.get("first_release_date") or 2**63, row["id"]),
        )
        selected.append(representative)
        excluded.extend(
            GameGroupExcludedItem(
                label=row["name"], reason="Version, port, or remaster represented by a canonical release"
            )
            for row in group
            if row["id"] != representative["id"]
        )
    selected.sort(key=lambda row: (row.get("first_release_date") or 2**63, row["name"], row["id"]))
    return [IGDBService._to_catalog_game(row) for row in selected], excluded


def _normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def _igdb_group_members(value: Any) -> list[_ExternalGame]:
    return [
        _ExternalGame(str(member["id"]), member["name"], _igdb_year(member.get("first_release_date")))
        for member in value or []
        if isinstance(member, dict) and isinstance(member.get("id"), int) and isinstance(member.get("name"), str)
    ]


def _igdb_year(value: Any) -> int | None:
    return time.gmtime(value).tm_year if isinstance(value, int) and value > 0 else None


def _rawg_year(value: Any) -> int | None:
    return int(value[:4]) if isinstance(value, str) and value[:4].isdigit() else None


def _batches(values: list[int], size: int) -> list[list[int]]:
    return [values[index : index + size] for index in range(0, len(values), size)]


def _primary_source(candidate: _Candidate) -> GameGroupSource:
    for source in (GameGroupSource.IGDB, GameGroupSource.WIKIDATA, GameGroupSource.RAWG):
        if source in candidate.source_keys:
            return source
    return GameGroupSource.IGDB


def _source_label(source: GameGroupSource) -> str:
    return {GameGroupSource.IGDB: "IGDB", GameGroupSource.RAWG: "RAWG", GameGroupSource.WIKIDATA: "Wikidata"}[source]
