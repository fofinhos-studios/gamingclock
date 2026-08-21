import httpx
import pytest

from gamingclock.services.steamgriddb import SteamGridDBService


@pytest.mark.asyncio
async def test_steamgriddb_returns_cover_logo_and_hero_for_the_best_name_match(monkeypatch):
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        assert request.headers["Authorization"] == "Bearer steamgriddb-key"
        if request.url.path == "/api/v2/search/autocomplete/Final Fantasy VII":
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": [
                        {"id": 999, "name": "Final Fantasy VII Remake"},
                        {"id": 7, "name": "Final Fantasy VII"},
                    ],
                },
            )
        if request.url.path == "/api/v2/logos/game/7":
            assert dict(request.url.params) == {"types": "static", "limit": "1"}
            return httpx.Response(
                200,
                json={"success": True, "data": [{"url": "https://cdn.example/ff7-logo.png"}]},
            )
        if request.url.path == "/api/v2/heroes/game/7":
            assert dict(request.url.params) == {"types": "static", "limit": "1"}
            return httpx.Response(
                200,
                json={"success": True, "data": [{"url": "https://cdn.example/ff7-hero.jpg"}]},
            )
        if request.url.path == "/api/v2/grids/game/7":
            assert dict(request.url.params) == {
                "dimensions": "600x900,342x482,660x930",
                "types": "static",
                "limit": "1",
            }
            return httpx.Response(
                200,
                json={"success": True, "data": [{"url": "https://cdn.example/ff7-cover.jpg"}]},
            )
        raise AssertionError(f"Unexpected request: {request.url}")

    monkeypatch.setenv("STEAMGRIDDB_API_KEY", "steamgriddb-key")
    service = SteamGridDBService(http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))

    artwork = await service.get_artwork("Final Fantasy VII")

    assert artwork.cover_url == "https://cdn.example/ff7-cover.jpg"
    assert artwork.logo_url == "https://cdn.example/ff7-logo.png"
    assert artwork.hero_url == "https://cdn.example/ff7-hero.jpg"
    assert len(requests) == 4


@pytest.mark.asyncio
async def test_steamgriddb_returns_empty_artwork_without_credentials(monkeypatch):
    monkeypatch.delenv("STEAMGRIDDB_API_KEY", raising=False)

    artwork = await SteamGridDBService().get_artwork("Final Fantasy VII")

    assert artwork.cover_url == ""
    assert artwork.logo_url == ""
    assert artwork.hero_url == ""


@pytest.mark.asyncio
async def test_steamgriddb_returns_empty_artwork_when_no_game_matches(monkeypatch):
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v2/search/autocomplete/Unknown"
        return httpx.Response(200, json={"success": True, "data": []})

    monkeypatch.setenv("STEAMGRIDDB_API_KEY", "steamgriddb-key")
    service = SteamGridDBService(http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))

    artwork = await service.get_artwork("Unknown")

    assert artwork.cover_url == ""
    assert artwork.logo_url == ""
    assert artwork.hero_url == ""
