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


@pytest.mark.asyncio
async def test_igdb_search_returns_metadata(monkeypatch):
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "id.twitch.tv":
            return _token_response()
        if request.url.host == "api.igdb.com":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": 1234,
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
        raise AssertionError(f"Unexpected request: {request.url}")

    transport = httpx.MockTransport(handler)
    monkeypatch.setenv("IGDB_CLIENT_ID", "client-id")
    monkeypatch.setenv("IGDB_CLIENT_SECRET", "client-secret")

    service = IGDBService(
        http_client=httpx.AsyncClient(transport=transport),
        token_client=httpx.AsyncClient(transport=transport),
    )

    results = await service.search("Final Fantasy VII")

    assert len(results) == 1
    result = results[0]
    assert result.name == "Final Fantasy VII"
    assert result.igdb_id == 1234
    assert result.summary == "Save the planet."


@pytest.mark.asyncio
async def test_igdb_get_by_id(monkeypatch):
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "id.twitch.tv":
            return _token_response()
        if request.url.host == "api.igdb.com":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": 1234,
                        "name": "Chrono Trigger",
                        "summary": "",
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

    result = await service.get_by_id(1234)

    assert result is not None
    assert result.igdb_id == 1234
    assert result.name == "Chrono Trigger"
