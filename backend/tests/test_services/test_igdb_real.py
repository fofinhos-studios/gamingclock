from unittest.mock import AsyncMock

import httpx
import pytest

from gamingclock.services.igdb import IGDBService


def _token_response() -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "access_token": "test-token",
            "expires_in": 3600,
            "token_type": "bearer",
        },
    )


def _games_response() -> httpx.Response:
    return httpx.Response(
        200,
        json=[
            {
                "id": 1,
                "name": "Final Fantasy VII",
                "summary": "Save the planet.",
                "rating": 91.2,
                "first_release_date": 883612800,
                "cover": {"url": "//images.igdb.com/igdb/image/upload/t_thumb/cover.jpg"},
                "genres": [{"name": "RPG"}],
                "platforms": [{"name": "PlayStation"}],
            }
        ],
    )


@pytest.mark.asyncio
async def test_igdb_search_fetches_token_once_and_maps_results(monkeypatch):
    token_calls = 0
    game_calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal token_calls, game_calls
        if request.url.host == "id.twitch.tv":
            token_calls += 1
            return _token_response()
        if request.url.host == "api.igdb.com":
            game_calls += 1
            body = request.content.decode()
            assert 'where name ~ "final"*;' in body
            assert "fields id,name" in body
            return _games_response()
        raise AssertionError(f"Unexpected request: {request.url}")

    transport = httpx.MockTransport(handler)
    monkeypatch.setenv("IGDB_CLIENT_ID", "client-id")
    monkeypatch.setenv("IGDB_CLIENT_SECRET", "client-secret")

    service = IGDBService(
        http_client=httpx.AsyncClient(transport=transport),
        token_client=httpx.AsyncClient(transport=transport),
    )

    first = await service.search("Final")
    second = await service.search("Final")

    assert token_calls == 1
    assert game_calls == 2
    assert first[0].igdb_id == 1
    assert first[0].name == "Final Fantasy VII"
    assert first[0].cover_url.startswith("https://")
    assert first[0].release_year == 1998
    assert first[0].genres == ["RPG"]
    assert second[0].name == "Final Fantasy VII"


@pytest.mark.asyncio
async def test_igdb_get_by_id_returns_single_result(monkeypatch):
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "id.twitch.tv":
            return _token_response()
        if request.url.host == "api.igdb.com":
            body = request.content.decode()
            assert "where id = 99;" in body
            return httpx.Response(
                200,
                json=[
                    {
                        "id": 99,
                        "name": "Chrono Trigger",
                        "summary": "Time travel.",
                        "rating": 96.0,
                        "first_release_date": 807926400,
                        "cover": {"url": "//images.igdb.com/igdb/image/upload/t_thumb/chrono.jpg"},
                        "genres": [],
                        "platforms": [],
                    }
                ],
            )
        raise AssertionError(f"Unexpected request: {request.url}")

    transport = httpx.MockTransport(handler)
    monkeypatch.setenv("IGDB_CLIENT_ID", "client-id")
    monkeypatch.setenv("IGDB_CLIENT_SECRET", "client-secret")

    service = IGDBService(
        http_client=httpx.AsyncClient(transport=transport),
        token_client=httpx.AsyncClient(transport=transport),
    )

    result = await service.get_by_id(99)

    assert result.igdb_id == 99
    assert result.name == "Chrono Trigger"


@pytest.mark.asyncio
async def test_igdb_service_requires_env_credentials(monkeypatch):
    monkeypatch.delenv("IGDB_CLIENT_ID", raising=False)
    monkeypatch.delenv("IGDB_CLIENT_SECRET", raising=False)

    service = IGDBService(
        http_client=AsyncMock(),
        token_client=AsyncMock(),
    )

    with pytest.raises(RuntimeError):
        await service.search("Final")
