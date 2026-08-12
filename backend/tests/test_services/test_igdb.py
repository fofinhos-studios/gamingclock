import httpx
import pytest

from gamingclock.services.igdb import IGDBService


def _token_response() -> httpx.Response:
    return httpx.Response(
        200,
        json={"access_token": "test-token", "expires_in": 3600, "token_type": "bearer"},
    )


@pytest.mark.asyncio
async def test_igdb_search_uses_live_api_when_credentials_are_configured(monkeypatch):
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "id.twitch.tv":
            return _token_response()
        if request.url.host == "api.igdb.com":
            assert request.headers["Client-ID"] == "client-id"
            assert request.headers["Authorization"] == "Bearer test-token"
            assert 'where name ~ "dragon quest"*;' in request.content.decode()
            return httpx.Response(
                200,
                json=[
                    {
                        "id": 555,
                        "name": "Dragon Quest XI S: Echoes of an Elusive Age",
                        "summary": "A long-running role-playing adventure.",
                        "rating": 91.0,
                        "first_release_date": 1538697600,
                        "cover": {"url": "//images.igdb.com/igdb/image/upload/t_thumb/dq11.jpg"},
                        "genres": [{"name": "Role-playing (RPG)"}],
                        "platforms": [{"name": "Nintendo Switch"}],
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

    results = await service.search("Dragon Quest")

    assert [result.name for result in results] == ["Dragon Quest XI S: Echoes of an Elusive Age"]
    assert results[0].cover_url == "https://images.igdb.com/igdb/image/upload/t_thumb/dq11.jpg"


@pytest.mark.asyncio
async def test_igdb_search_returns_mocked_metadata_without_credentials(monkeypatch):
    monkeypatch.delenv("IGDB_CLIENT_ID", raising=False)
    monkeypatch.delenv("IGDB_CLIENT_SECRET", raising=False)

    results = await IGDBService().search("Final Fantasy")

    assert results[0].igdb_id == 7
    assert results[0].name == "Final Fantasy VII"
    assert results[0].summary
    assert results[0].cover_url == ""


@pytest.mark.asyncio
async def test_igdb_get_by_id_returns_mocked_game(monkeypatch):
    monkeypatch.delenv("IGDB_CLIENT_ID", raising=False)
    monkeypatch.delenv("IGDB_CLIENT_SECRET", raising=False)

    result = await IGDBService().get_by_id(22)

    assert result.igdb_id == 22
    assert result.name == "Chrono Trigger"
