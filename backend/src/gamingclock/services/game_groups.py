"""Merge provider game-group evidence into canonical IGDB-backed previews."""

import asyncio
import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from gamingclock.models.catalog import CatalogGame
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
    GameGroupSource,
)
from gamingclock.services.igdb import IGDBService

logger = logging.getLogger(__name__)
_ALLOWED_GAME_TYPES = frozenset({0, 8, 9, 10})
_CACHE_SECONDS = 300
_CACHE_MAX_ENTRIES = 100
_OPTIONAL_SOURCE_TIMEOUT_SECONDS = 3.0
_RAWG_ATTRIBUTION_URL = "https://rawg.io/"


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
    possible_matches: list[GameGroupPossibleMatch] = field(default_factory=list)
    unavailable_sources: set[GameGroupSource] = field(default_factory=set)

    def merge(self, other: _Candidate) -> None:
        self.source_keys.update(other.source_keys)
        self.member_ids.update(other.member_ids)
        self.possible_matches.extend(other.possible_matches)
        self.unavailable_sources.update(other.unavailable_sources)


class RAWGAdapter:
    def __init__(self, client: httpx.AsyncClient | None = None):
        self._client = client or httpx.AsyncClient(timeout=10)

    @property
    def configured(self) -> bool:
        return bool(os.getenv("RAWG_API_KEY"))

    async def search(self, query: str) -> list[tuple[str, str, list[_ExternalGame]]]:
        if not self.configured:
            return []
        response = await self._client.get(
            "https://api.rawg.io/api/games",
            params={"key": os.environ["RAWG_API_KEY"], "search": query, "page_size": 5},
        )
        response.raise_for_status()
        source_games = [
            game
            for game in response.json().get("results", [])
            if isinstance(game.get("id"), int) and isinstance(game.get("name"), str)
        ]
        related_results = await asyncio.gather(
            *(self._related_games(game["id"]) for game in source_games),
            return_exceptions=True,
        )
        candidates: list[tuple[str, str, list[_ExternalGame]]] = []
        for game, related in zip(source_games, related_results, strict=True):
            game_id = game.get("id")
            name = game.get("name")
            if not isinstance(game_id, int) or not isinstance(name, str) or not isinstance(related, list):
                continue
            members = [_ExternalGame(str(game_id), name, _rawg_year(game.get("released"))), *related]
            candidates.append((f"rawg:related:{game_id}", name, members))
        return candidates

    async def by_key(self, group_key: str) -> tuple[str, list[_ExternalGame]]:
        _, _, raw_id = group_key.partition("rawg:related:")
        if not raw_id.isdigit() or not self.configured:
            raise LookupError(group_key)
        response = await self._client.get(
            f"https://api.rawg.io/api/games/{raw_id}", params={"key": os.environ["RAWG_API_KEY"]}
        )
        response.raise_for_status()
        game = response.json()
        name = game.get("name")
        if not isinstance(name, str):
            raise LookupError(group_key)
        seed = _ExternalGame(raw_id, name, _rawg_year(game.get("released")))
        return name, [seed, *await self._related_games(int(raw_id))]

    async def _related_games(self, game_id: int) -> list[_ExternalGame]:
        members: dict[str, _ExternalGame] = {}
        for suffix in ("game-series", "parent-games"):
            response = await self._client.get(
                f"https://api.rawg.io/api/games/{game_id}/{suffix}",
                params={"key": os.environ["RAWG_API_KEY"], "page_size": 40},
            )
            response.raise_for_status()
            for game in response.json().get("results", []):
                raw_id = game.get("id")
                name = game.get("name")
                if isinstance(raw_id, int) and isinstance(name, str):
                    members[str(raw_id)] = _ExternalGame(str(raw_id), name, _rawg_year(game.get("released")))
        return list(members.values())

    async def aclose(self) -> None:
        await self._client.aclose()


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
        member_results = await asyncio.gather(
            *(self._members(result["id"]) for result in source_groups),
            return_exceptions=True,
        )
        candidates: list[tuple[str, str, list[_ExternalGame]]] = []
        for result, members in zip(source_groups, member_results, strict=True):
            qid = result.get("id")
            label = result.get("label")
            if not isinstance(qid, str) or not isinstance(label, str) or not isinstance(members, list):
                continue
            if members:
                candidates.append((f"wikidata:series:{qid}", label, members))
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
    """The sole seam that turns source memberships into IGDB-backed game groups."""

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
        game = await self._igdb.get_by_id(igdb_id)
        candidates = await self._discover(game.name)
        return [self._to_result(candidate) for candidate in candidates if igdb_id in candidate.member_ids][:4]

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
        raw_games = await self._igdb_games(candidate.member_ids)
        selected, excluded = _canonical_games(raw_games)
        existing = set(request.existing_igdb_ids)
        items = [
            GameGroupPreviewItem(
                game=game,
                order=index,
                initially_selected=True,
                already_in_backlog=game.igdb_id in existing,
                evidence=[
                    GameGroupPreviewEvidence(source=source, relation="membership", label=_source_label(source))
                    for source in candidate.source_keys
                ],
                edition=GameGroupEdition(state="canonical", label="Canonical release"),
            )
            for index, game in enumerate(selected, start=1)
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

    async def _discover(self, query: str) -> list[_Candidate]:
        if not query.strip():
            return []
        igdb_task = self._igdb_candidates(query)
        rawg_task = asyncio.wait_for(self._rawg_candidates(query), timeout=_OPTIONAL_SOURCE_TIMEOUT_SECONDS)
        wikidata_task = asyncio.wait_for(self._wikidata_candidates(query), timeout=_OPTIONAL_SOURCE_TIMEOUT_SECONDS)
        started_at = time.perf_counter()
        results = await asyncio.gather(igdb_task, rawg_task, wikidata_task, return_exceptions=True)
        candidates: list[_Candidate] = []
        unavailable_sources: set[GameGroupSource] = set()
        for source, result in zip(GameGroupSource, results, strict=True):
            if isinstance(result, Exception):
                logger.info("game group source failed source=%s error=%s", source, type(result).__name__)
                unavailable_sources.add(source)
                continue
            if isinstance(result, list):
                candidates.extend(result)
        for candidate in candidates:
            candidate.unavailable_sources.update(unavailable_sources)
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
            kind, _, raw_id = group_key.split(":", 2)
            if kind != "igdb" or not raw_id.isdigit():
                raise LookupError(group_key)
            endpoint, identifier = group_key.split(":", 2)[1:]
            if endpoint not in {"collection", "franchise"}:
                raise LookupError(group_key)
            title, members = await self._igdb_group(endpoint, int(identifier))
            discovered = await self._discover(title)
            return next(
                (item for item in discovered if item.group_key == group_key),
                _Candidate(
                    group_key=group_key,
                    title=title,
                    kind=GameGroupKind.SERIES if endpoint == "collection" else GameGroupKind.FRANCHISE,
                    source_keys={GameGroupSource.IGDB: group_key},
                    member_ids=set(members),
                ),
            )
        if group_key.startswith("rawg:related:"):
            title, members = await self._rawg.by_key(group_key)
            return await self._external_candidate(group_key, title, members, GameGroupSource.RAWG)
        if group_key.startswith("wikidata:series:"):
            title, members = await self._wikidata.by_key(group_key)
            return await self._external_candidate(group_key, title, members, GameGroupSource.WIKIDATA)
        raise LookupError(group_key)

    async def _igdb_candidates(self, query: str) -> list[_Candidate]:
        groups = await asyncio.gather(self._igdb_groups("collections", query), self._igdb_groups("franchises", query))
        candidates = []
        for endpoint, items in zip(("collections", "franchises"), groups, strict=True):
            kind = GameGroupKind.SERIES if endpoint == "collections" else GameGroupKind.FRANCHISE
            singular = endpoint.removesuffix("s")
            for item in items:
                identifier, name, member_ids = item
                if member_ids:
                    candidates.append(
                        _Candidate(
                            group_key=f"igdb:{singular}:{identifier}",
                            title=name,
                            kind=kind,
                            source_keys={GameGroupSource.IGDB: f"igdb:{singular}:{identifier}"},
                            member_ids=set(member_ids),
                        )
                    )
        return candidates

    async def _rawg_candidates(self, query: str) -> list[_Candidate]:
        return [
            await self._external_candidate(key, title, members, GameGroupSource.RAWG)
            for key, title, members in await self._rawg.search(query)
        ]

    async def _wikidata_candidates(self, query: str) -> list[_Candidate]:
        return [
            await self._external_candidate(key, title, members, GameGroupSource.WIKIDATA)
            for key, title, members in await self._wikidata.search(query)
        ]

    async def _external_candidate(
        self, group_key: str, title: str, members: list[_ExternalGame], source: GameGroupSource
    ) -> _Candidate:
        matches = await asyncio.gather(*(self._reconcile(member) for member in members))
        member_ids: set[int] = set()
        possible: list[GameGroupPossibleMatch] = []
        for member, match in zip(members, matches, strict=True):
            if match is not None:
                member_ids.add(match.igdb_id)
            else:
                possible.append(
                    GameGroupPossibleMatch(
                        source=source,
                        source_id=member.source_id,
                        name=member.name,
                        release_year=member.release_year,
                        reason="No confident IGDB match",
                    )
                )
        if len(member_ids) < 2:
            member_ids.clear()
        return _Candidate(
            group_key=group_key,
            title=title,
            kind=GameGroupKind.SERIES,
            source_keys={source: group_key},
            member_ids=member_ids,
            possible_matches=possible,
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

    async def _igdb_groups(self, endpoint: str, query: str) -> list[tuple[int, str, list[int]]]:
        if not self._igdb._is_configured():
            return []
        client_id, token = await self._igdb._get_auth_headers()
        response = await self._igdb._http_client.post(
            f"https://api.igdb.com/v4/{endpoint}",
            headers={"Client-ID": client_id, "Authorization": f"Bearer {token}"},
            content=f'fields id,name,games; search "{self._igdb._escape_search_query(query)}"; limit 20;',
        )
        response.raise_for_status()
        return [
            (item["id"], item["name"], [member for member in item.get("games") or [] if isinstance(member, int)])
            for item in response.json()
            if isinstance(item.get("id"), int) and isinstance(item.get("name"), str)
        ]

    async def _igdb_group(self, endpoint: str, identifier: int) -> tuple[str, list[int]]:
        plural = f"{endpoint}s"
        groups = await self._igdb_groups_by_id(plural, identifier)
        if not groups:
            raise LookupError(f"igdb:{endpoint}:{identifier}")
        return groups[0][1], groups[0][2]

    async def _igdb_groups_by_id(self, endpoint: str, identifier: int) -> list[tuple[int, str, list[int]]]:
        if not self._igdb._is_configured():
            raise LookupError(identifier)
        client_id, token = await self._igdb._get_auth_headers()
        response = await self._igdb._http_client.post(
            f"https://api.igdb.com/v4/{endpoint}",
            headers={"Client-ID": client_id, "Authorization": f"Bearer {token}"},
            content=f"fields id,name,games; where id = {identifier}; limit 1;",
        )
        response.raise_for_status()
        return [
            (item["id"], item["name"], [member for member in item.get("games") or [] if isinstance(member, int)])
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
            candidate_count=len(candidate.member_ids),
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
    eligible = [candidate for candidate in candidates if candidate.member_ids]
    merged: list[_Candidate] = []
    for candidate in eligible:
        target = next((current for current in merged if _should_merge(current, candidate)), None)
        if target:
            target.merge(candidate)
            if _primary_source(candidate) is GameGroupSource.IGDB:
                target.group_key, target.title, target.kind = candidate.group_key, candidate.title, candidate.kind
        else:
            merged.append(candidate)
    for candidate in merged:
        candidate.group_key = candidate.source_keys[_primary_source(candidate)]
    merged.sort(
        key=lambda candidate: (candidate.kind is GameGroupKind.FRANCHISE, -len(candidate.member_ids), candidate.title)
    )
    return merged


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
