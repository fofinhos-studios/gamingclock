import json

import httpx
import pytest

from gamingclock.models.game import Game
from gamingclock.services.hltb import HLTBService


@pytest.mark.asyncio
async def test_search_returns_games():
    init_calls = 0
    search_calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal init_calls, search_calls
        if request.url.path == "/api/find/init":
            init_calls += 1
            return httpx.Response(
                200,
                json={"token": "token", "hpKey": "hp_key", "hpVal": "hp_val"},
            )
        if request.url.path == "/api/find":
            search_calls += 1
            payload = json.loads(request.content.decode())
            assert payload["searchTerms"] == ["Grand", "Theft", "Auto", "V"]
            assert request.headers["x-auth-token"] == "token"
            assert request.headers["x-hp-key"] == "hp_key"
            assert request.headers["x-hp-val"] == "hp_val"
            return httpx.Response(
                200,
                json={
                    "data": [
                        {
                            "game_name": "Grand Theft Auto V",
                            "game_alias": "GTA V",
                            "game_image": "gta-v.jpg",
                            "comp_main": 113400,
                            "comp_plus": 187200,
                            "comp_100": 302400,
                        }
                    ]
                },
            )
        raise AssertionError(f"Unexpected request: {request.url}")

    service = HLTBService(
        http_client=httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="https://howlongtobeat.com",
        )
    )
    results = await service.search("Grand Theft Auto V")

    assert len(results) > 0
    assert isinstance(results[0], Game)
    assert results[0].name == "Grand Theft Auto V"
    assert results[0].main_story_hours == 31.5
    assert results[0].main_extra_hours == 52.0
    assert results[0].completionist_hours == 84.0
    assert results[0].image_url == "https://howlongtobeat.com/games/gta-v.jpg"
    assert init_calls == 1
    assert search_calls == 1


@pytest.mark.asyncio
async def test_search_no_results():
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/find/init":
            return httpx.Response(
                200,
                json={"token": "token", "hpKey": "hp_key", "hpVal": "hp_val"},
            )
        if request.url.path == "/api/find":
            return httpx.Response(200, json={"data": []})
        raise AssertionError(f"Unexpected request: {request.url}")

    service = HLTBService(
        http_client=httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="https://howlongtobeat.com",
        )
    )
    results = await service.search("xyznonexistentgame12345")

    assert results == []


@pytest.mark.asyncio
async def test_search_refreshes_security_after_403():
    init_calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal init_calls
        if request.url.path == "/api/find/init":
            init_calls += 1
            return httpx.Response(
                200,
                json={
                    "token": f"token-{init_calls}",
                    "hpKey": "hp_key",
                    "hpVal": f"hp_val_{init_calls}",
                },
            )
        if request.url.path == "/api/find":
            if request.headers["x-auth-token"] == "token-1":
                return httpx.Response(
                    403,
                    json={"error": "Session expired or invalid fingerprint"},
                )
            return httpx.Response(
                200,
                json={
                    "data": [
                        {
                            "game_name": "Halo",
                            "game_alias": "",
                            "game_image": "halo.jpg",
                            "comp_main": 28800,
                        }
                    ]
                },
            )
        raise AssertionError(f"Unexpected request: {request.url}")

    service = HLTBService(
        http_client=httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="https://howlongtobeat.com",
        )
    )
    results = await service.search("Halo")

    assert len(results) == 1
    assert results[0].name == "Halo"
    assert init_calls == 2
