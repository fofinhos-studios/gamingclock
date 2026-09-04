import asyncio

import httpx
import pytest

from gamingclock.models.catalog import CatalogGame
from gamingclock.models.game_groups import (
    GameGroupKind,
    GameGroupSource,
    ResolveGameGroupSelectionRequest,
)
from gamingclock.services.game_group_cache import CachedPayload
from gamingclock.services.game_groups import (
    GameGroupExplorer,
    RAWGAdapter,
    WikidataAdapter,
    _Candidate,
    _canonical_games,
    _ExternalGame,
    _merge_candidates,
)


def _candidate(
    key: str,
    title: str,
    kind: GameGroupKind,
    source: GameGroupSource,
    members: set[int],
) -> _Candidate:
    return _Candidate(
        group_key=key,
        title=title,
        kind=kind,
        source_keys={source: key},
        member_ids=members,
    )


def test_prefers_igdb_over_a_same_name_source_native_card():
    merged = _merge_candidates(
        [
            _candidate("rawg:related:1", "Final Fantasy", GameGroupKind.SERIES, GameGroupSource.RAWG, {1, 2, 3}),
            _candidate("igdb:collection:39", "Final Fantasy", GameGroupKind.SERIES, GameGroupSource.IGDB, {1, 2}),
        ]
    )

    assert [candidate.group_key for candidate in merged] == ["igdb:collection:39"]


def test_never_merges_a_series_with_a_franchise_or_one_shared_member():
    merged = _merge_candidates(
        [
            _candidate("igdb:collection:1", "Final Fantasy", GameGroupKind.SERIES, GameGroupSource.IGDB, {1, 2}),
            _candidate("igdb:franchise:1", "Final Fantasy", GameGroupKind.FRANCHISE, GameGroupSource.IGDB, {1, 2}),
            _candidate("rawg:related:1", "Final Fantasy", GameGroupKind.SERIES, GameGroupSource.RAWG, {1, 3}),
        ]
    )

    assert len(merged) == 2


def test_preview_collapses_connected_port_and_remaster_variants():
    games, excluded = _canonical_games(
        [
            {
                "id": 1,
                "name": "Game",
                "game_type": 0,
                "version_parent": None,
                "first_release_date": 1,
                "ports": [2],
                "remasters": [],
                "expanded_games": [],
            },
            {
                "id": 2,
                "name": "Game Remaster",
                "game_type": 0,
                "version_parent": None,
                "first_release_date": 2,
                "ports": [],
                "remasters": [1],
                "expanded_games": [],
            },
            {
                "id": 3,
                "name": "Game DLC",
                "game_type": 1,
                "version_parent": None,
                "first_release_date": 3,
                "ports": [],
                "remasters": [],
                "expanded_games": [],
            },
        ]
    )

    assert [game.igdb_id for game in games] == [1]
    assert [item.label for item in excluded] == ["Game Remaster"]


@pytest.mark.asyncio
async def test_discovery_returns_a_source_native_card_without_reconciliation():
    explorer = GameGroupExplorer()
    candidate = explorer._external_candidate(
        "rawg:related:1",
        "Final Fantasy",
        [_ExternalGame("1", "Final Fantasy", 1987), _ExternalGame("2", "Final Fantasy II", 1988)],
        GameGroupSource.RAWG,
    )

    assert candidate.member_ids == set()
    assert [member.name for member in candidate.members] == ["Final Fantasy", "Final Fantasy II"]
    await explorer.aclose()


@pytest.mark.asyncio
async def test_selection_reconciles_only_checked_source_members(monkeypatch):
    explorer = GameGroupExplorer()
    candidate = _Candidate(
        group_key="rawg:related:1",
        title="Final Fantasy",
        kind=GameGroupKind.SERIES,
        source_keys={GameGroupSource.RAWG: "rawg:related:1"},
        members=[_ExternalGame("1", "One"), _ExternalGame("2", "Two")],
    )
    monkeypatch.setattr(explorer, "_candidate_for_key", lambda _: asyncio.sleep(0, result=candidate))
    calls: list[str] = []

    async def reconcile(member: _ExternalGame) -> CatalogGame | None:
        calls.append(member.source_id)
        return None

    monkeypatch.setattr(explorer, "_reconcile", reconcile)
    response = await explorer.resolve_selection(
        ResolveGameGroupSelectionRequest(group_key=candidate.group_key, source_member_ids=["2"])
    )

    assert calls == ["2"]
    assert response.resolutions[0].name == "Two"
    assert response.resolutions[0].game is None
    await explorer.aclose()


@pytest.mark.asyncio
async def test_rawg_search_uses_only_the_best_seed_and_caches_it(monkeypatch):
    monkeypatch.setenv("RAWG_API_KEY", "test-key")
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "results": [
                    {"id": 1, "name": "First"},
                    {"id": 2, "name": "Second"},
                ]
            },
        )

    class Cache:
        def __init__(self):
            self.writes: list[tuple[str, object, int, int]] = []

        async def get(self, key: str):
            return None

        async def set(self, key: str, value: object, *, fresh_seconds: int, stale_seconds: int = 0):
            self.writes.append((key, value, fresh_seconds, stale_seconds))

        async def try_acquire_refresh_lock(self, key: str, *, seconds: int = 30):
            return True

        async def aclose(self):
            return None

    cache = Cache()
    adapter = RAWGAdapter(
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        shared_cache=cache,
    )
    results = await adapter.search("Final Fantasy")

    assert [group[0] for group in results] == ["rawg:related:1"]
    assert requests[0].url.params["page_size"] == "1"
    assert cache.writes[0][0] == "rawg:search:final fantasy"
    await adapter.aclose()


@pytest.mark.asyncio
async def test_rawg_returns_stale_payload_without_waiting_for_a_losing_refresh_lock(monkeypatch):
    monkeypatch.setenv("RAWG_API_KEY", "test-key")

    class Cache:
        async def get(self, key: str):
            return CachedPayload(
                value=[{"key": "rawg:related:1", "title": "Final Fantasy", "members": []}],
                is_fresh=False,
            )

        async def try_acquire_refresh_lock(self, key: str, *, seconds: int = 30):
            return False

        async def set(self, key: str, value: object, *, fresh_seconds: int, stale_seconds: int = 0):
            return None

        async def aclose(self):
            return None

    async def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("stale response must not make a RAWG request")

    adapter = RAWGAdapter(
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        shared_cache=Cache(),
    )
    results = await adapter.search("Final Fantasy")
    await asyncio.sleep(0)

    assert results[0][1] == "Final Fantasy"
    await adapter.aclose()


@pytest.mark.asyncio
async def test_popular_warmer_caps_cold_rawg_attempts(monkeypatch):
    explorer = GameGroupExplorer()
    popular_games = [
        CatalogGame(
            igdb_id=index,
            name=f"Game {index}",
            cover_url="",
            summary="",
            genres=[],
            platforms=[],
            release_year=None,
            rating=None,
        )
        for index in range(1, 9)
    ]
    attempts: list[str] = []

    class IGDB:
        async def popular_games(self, limit: int):
            return popular_games[:limit]

    class RAWG:
        configured = True

        async def get_warm_cursor(self):
            return 0

        async def is_seed_cold(self, query: str):
            return True

        async def warm_seed_if_needed(self, query: str):
            attempts.append(query)
            return False

        async def set_warm_cursor(self, cursor: int):
            return None

    monkeypatch.setattr(explorer, "_igdb", IGDB())
    monkeypatch.setattr(explorer, "_rawg", RAWG())
    result = await explorer.warm_rawg_popular(2)

    assert attempts == ["Game 1", "Game 2"]
    assert result.failed_games == 2


@pytest.mark.asyncio
async def test_discovery_returns_when_the_first_provider_has_usable_cards(monkeypatch):
    explorer = GameGroupExplorer()
    candidate = _Candidate(
        group_key="wikidata:series:Q1",
        title="Final Fantasy",
        kind=GameGroupKind.SERIES,
        source_keys={GameGroupSource.WIKIDATA: "wikidata:series:Q1"},
    )

    async def slow_source(query: str):
        await asyncio.sleep(0.2)
        return []

    async def fast_source(query: str):
        await asyncio.sleep(0.01)
        return [candidate]

    monkeypatch.setattr(explorer, "_igdb_candidates", slow_source)
    monkeypatch.setattr(explorer, "_rawg_candidates", slow_source)
    monkeypatch.setattr(explorer, "_wikidata_candidates", fast_source)
    started = asyncio.get_running_loop().time()
    groups = await explorer._discover("Final Fantasy")

    assert asyncio.get_running_loop().time() - started < 0.1
    assert groups == [candidate]
    await explorer.aclose()


@pytest.mark.asyncio
async def test_discovery_collects_a_better_card_during_the_quality_grace_window(monkeypatch):
    explorer = GameGroupExplorer()
    wikidata = _Candidate(
        group_key="wikidata:series:Q1",
        title="Final Fantasy",
        kind=GameGroupKind.SERIES,
        source_keys={GameGroupSource.WIKIDATA: "wikidata:series:Q1"},
    )
    igdb = _Candidate(
        group_key="igdb:collection:39",
        title="Final Fantasy",
        kind=GameGroupKind.SERIES,
        source_keys={GameGroupSource.IGDB: "igdb:collection:39"},
    )

    async def empty_source(query: str):
        await asyncio.sleep(0.2)
        return []

    async def fast_wikidata(query: str):
        await asyncio.sleep(0.01)
        return [wikidata]

    async def near_igdb(query: str):
        await asyncio.sleep(0.02)
        return [igdb]

    monkeypatch.setattr(explorer, "_igdb_candidates", near_igdb)
    monkeypatch.setattr(explorer, "_rawg_candidates", empty_source)
    monkeypatch.setattr(explorer, "_wikidata_candidates", fast_wikidata)

    assert await explorer._discover("Final Fantasy") == [igdb]
    await explorer.aclose()


@pytest.mark.asyncio
async def test_wikidata_search_uses_the_shared_provider_payload_cache():
    class Cache:
        async def get(self, key: str):
            return CachedPayload(
                value=[{"key": "wikidata:series:Q1", "title": "Final Fantasy", "members": []}],
                is_fresh=True,
            )

        async def set(self, key: str, value: object, *, fresh_seconds: int, stale_seconds: int = 0):
            raise AssertionError("a fresh result must not be rewritten")

        async def try_acquire_refresh_lock(self, key: str, *, seconds: int = 30):
            return False

        async def aclose(self):
            return None

    async def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("a fresh cache hit must not call Wikidata")

    adapter = WikidataAdapter(
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        shared_cache=Cache(),
    )

    assert await adapter.search("Final Fantasy") == [("wikidata:series:Q1", "Final Fantasy", [])]
    await adapter.aclose()
