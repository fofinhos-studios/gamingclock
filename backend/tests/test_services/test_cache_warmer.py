import asyncio

import pytest

from gamingclock.models.catalog import CatalogGame
from gamingclock.services.cache_warmer import PopularCacheWarmer


def game(game_id: int, name: str) -> CatalogGame:
    return CatalogGame(
        igdb_id=game_id,
        name=name,
        cover_url="",
        summary="",
        genres=[],
        platforms=[],
    )


@pytest.mark.asyncio
async def test_warmer_limits_concurrent_hltb_requests_and_keeps_going_after_failures():
    active_requests = 0
    peak_requests = 0
    calls: list[str] = []

    async def popular_games(limit: int) -> list[CatalogGame]:
        assert limit == 3
        return [game(1, "Alpha"), game(2, "Bravo"), game(3, "Charlie")]

    async def warm_hltb(name: str) -> bool:
        nonlocal active_requests, peak_requests
        calls.append(name)
        active_requests += 1
        peak_requests = max(peak_requests, active_requests)
        await asyncio.sleep(0)
        active_requests -= 1
        if name == "Bravo":
            raise RuntimeError("HLTB is unavailable")
        return True

    result = await PopularCacheWarmer(popular_games, warm_hltb, concurrency=2).warm(3)

    assert calls == ["Alpha", "Bravo", "Charlie"]
    assert peak_requests == 2
    assert result.model_dump() == {
        "requested_games": 3,
        "warmed_games": 2,
        "failed_games": 1,
    }
