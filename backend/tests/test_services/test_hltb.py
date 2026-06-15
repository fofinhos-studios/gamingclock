from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from gamingclock.models.game import Game
from gamingclock.services.hltb import HLTBService


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
async def test_search_returns_empty_list_when_library_request_fails():
    api = SimpleNamespace(async_search=AsyncMock(return_value=None))

    results = await HLTBService(api=api).search("Unknown")

    assert results == []


@pytest.mark.asyncio
async def test_search_uses_runtime_cache_for_repeated_queries():
    api = SimpleNamespace(async_search=AsyncMock(return_value=[_result("Final Fantasy VII", 1.0, 36.03)]))
    service = HLTBService(api=api)

    first_results = await service.search("Final Fantasy VII")
    second_results = await service.search("Final Fantasy VII")

    assert first_results == second_results
    api.async_search.assert_awaited_once()


@pytest.mark.asyncio
async def test_search_returns_empty_list_for_blank_query():
    api = SimpleNamespace(async_search=AsyncMock())

    results = await HLTBService(api=api).search(" ")

    assert results == []
    api.async_search.assert_not_awaited()
