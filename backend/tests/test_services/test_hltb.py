from json import loads
from types import SimpleNamespace
from unittest.mock import AsyncMock, call

import httpx
import pytest

from gamingclock.models.game import Game
from gamingclock.services.hltb import HLTBService, HLTBWebClient


class SharedCacheFake:
    def __init__(self, result: list[Game] | None) -> None:
        self.result = result
        self.get_calls: list[str] = []
        self.set_calls: list[tuple[str, list[Game]]] = []

    async def get(self, normalized_query: str) -> list[Game] | None:
        self.get_calls.append(normalized_query)
        return self.result

    async def set(self, normalized_query: str, results: list[Game]) -> None:
        self.set_calls.append((normalized_query, results))


def _result(
    name: str,
    similarity: float,
    main_story: float,
    main_extra: float | None = None,
    completionist: float | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        game_name=name,
        game_image_url=f"https://howlongtobeat.com/games/{name}.jpg",
        main_story=main_story,
        main_extra=main_extra,
        completionist=completionist,
        similarity=similarity,
    )


@pytest.mark.asyncio
async def test_search_maps_and_sorts_library_results():
    api = SimpleNamespace(
        async_search=AsyncMock(
            return_value=[
                _result("Grand Theft Auto IV", 0.8, 27.1),
                _result("Grand Theft Auto V", 1.0, 32.05, 51.46, 88.82),
            ]
        )
    )

    results = await HLTBService(api=api).search("Grand Theft Auto V")

    api.async_search.assert_awaited_once_with("Grand Theft Auto V", similarity_case_sensitive=False)
    assert all(isinstance(result, Game) for result in results)
    assert [result.name for result in results] == ["Grand Theft Auto V", "Grand Theft Auto IV"]
    assert results[0].main_story_hours == 32.05
    assert results[0].main_extra_hours == 51.46
    assert results[0].completionist_hours == 88.82


@pytest.mark.asyncio
async def test_web_client_uses_current_hltb_search_endpoints_and_maps_seconds_to_hours():
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path == "/api/search/site/init":
            return httpx.Response(
                200,
                json={"token": "token", "hpKey": "proof", "hpVal": "value"},
            )
        if request.url.path == "/api/search/site":
            assert request.headers["x-auth-token"] == "token"
            assert request.headers["x-hp-key"] == "proof"
            assert request.headers["x-hp-val"] == "value"
            assert loads(request.content) == {
                "searchType": "games",
                "searchTerms": ["Hollow", "Knight"],
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
                "proof": "value",
            }
            return httpx.Response(
                200,
                json={
                    "data": [
                        {
                            "game_name": "Hollow Knight",
                            "game_image": "26286_Hollow_Knight.jpg",
                            "comp_main": 9000,
                            "comp_plus": 14400,
                            "comp_100": 21600,
                        }
                    ]
                },
            )
        raise AssertionError(f"Unexpected request: {request.method} {request.url}")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
        results = await HLTBService(
            api=HLTBWebClient(http_client=http_client, clock=lambda: 123),
        ).search("Hollow Knight")

    assert [request.url.path for request in requests] == [
        "/api/search/site/init",
        "/api/search/site",
    ]
    assert results == [
        Game(
            name="Hollow Knight",
            image_url="https://howlongtobeat.com/games/26286_Hollow_Knight.jpg",
            main_story_hours=2.5,
            main_extra_hours=4.0,
            completionist_hours=6.0,
        )
    ]


@pytest.mark.asyncio
async def test_search_returns_empty_list_when_library_request_fails():
    api = SimpleNamespace(async_search=AsyncMock(return_value=None))
    sleep = AsyncMock()

    results = await HLTBService(api=api, retry_attempts=3, sleep=sleep).search("Unknown")

    assert results == []
    assert api.async_search.await_count == 3
    sleep.assert_has_awaits([call(0.5), call(1.0)])


@pytest.mark.asyncio
async def test_search_retries_transient_errors_with_exponential_backoff():
    api = SimpleNamespace(
        async_search=AsyncMock(
            side_effect=[RuntimeError("temporary failure"), [_result("Final Fantasy VII", 1.0, 36.03)]]
        )
    )
    sleep = AsyncMock()

    results = await HLTBService(api=api, sleep=sleep).search("Final Fantasy VII")

    assert [result.name for result in results] == ["Final Fantasy VII"]
    assert api.async_search.await_count == 2
    sleep.assert_awaited_once_with(0.5)


@pytest.mark.asyncio
async def test_search_uses_runtime_cache_for_repeated_queries():
    api = SimpleNamespace(async_search=AsyncMock(return_value=[_result("Final Fantasy VII", 1.0, 36.03)]))
    service = HLTBService(api=api)

    first_results = await service.search("Final Fantasy VII")
    second_results = await service.search("Final Fantasy VII")

    assert first_results == second_results
    api.async_search.assert_awaited_once()


@pytest.mark.asyncio
async def test_search_uses_shared_cache_before_calling_hltb():
    cached_game = Game(
        name="Final Fantasy VII",
        image_url="https://howlongtobeat.com/games/ff7.jpg",
        main_story_hours=36.03,
    )
    shared_cache = SharedCacheFake([cached_game])
    api = SimpleNamespace(async_search=AsyncMock())

    results = await HLTBService(api=api, shared_cache=shared_cache).search("Final Fantasy VII")

    assert results == [cached_game]
    assert shared_cache.get_calls == ["final fantasy vii"]
    assert shared_cache.set_calls == []
    api.async_search.assert_not_awaited()


@pytest.mark.asyncio
async def test_search_returns_empty_list_for_blank_query():
    api = SimpleNamespace(async_search=AsyncMock())

    results = await HLTBService(api=api).search(" ")

    assert results == []
    api.async_search.assert_not_awaited()
