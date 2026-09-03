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
            body = request.content.decode()
            assert 'search "Dragon Quest";' in body
            assert "where version_parent = null & game_type = (0,8,9,10);" in body
            assert "sort" not in body
            assert "limit 40;" in body
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
async def test_igdb_search_filters_noise_and_collapses_related_releases(monkeypatch):
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "id.twitch.tv":
            return _token_response()
        if request.url.host == "api.igdb.com":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": 2,
                        "name": "Galactic Adventure: Enhanced",
                        "game_type": 10,
                        "total_rating_count": 200,
                        "platforms": [{"name": "Switch"}],
                    },
                    {
                        "id": 3,
                        "name": "Galactic Adventure Ultimate Mod",
                        "game_type": 5,
                        "total_rating_count": 9999,
                    },
                    {
                        "id": 4,
                        "name": "Galactic Adventure Deluxe",
                        "game_type": 0,
                        "version_parent": 1,
                        "total_rating_count": 500,
                    },
                    {
                        "id": 1,
                        "name": "Galactic Adventure",
                        "game_type": 0,
                        "expanded_games": [2],
                        "total_rating_count": 50,
                        "platforms": [{"name": "PC"}],
                    },
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

    results = await service.search("Galactic Adventure")

    assert [result.name for result in results] == ["Galactic Adventure"]
    assert results[0].platforms == ["Switch", "PC"]


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


@pytest.mark.asyncio
async def test_igdb_popular_games_blends_current_recent_and_all_time_candidates(monkeypatch):
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "id.twitch.tv":
            return _token_response()
        assert request.url.host == "api.igdb.com"
        body = request.content.decode()
        if request.url.path == "/v4/popularity_primitives":
            assert "sort value desc;" in body
            assert "limit 6;" in body
            if "where popularity_type = 1;" in body:
                return httpx.Response(200, json=[{"game_id": 2}, {"game_id": 4}])
            assert "where popularity_type = 8;" in body
            return httpx.Response(200, json=[{"game_id": 3}, {"game_id": 1}])
        assert request.url.path == "/v4/games"
        if body.startswith("fields id;"):
            assert "first_release_date >" in body
            assert "sort total_rating_count desc;" in body
            return httpx.Response(200, json=[{"id": 4}, {"id": 2}])
        assert "where id = (2,4,3,1);" in body
        return httpx.Response(
            200,
            json=[
                {"id": 1, "name": "All Time Runner-up", "game_type": 0},
                {"id": 2, "name": "Current Visit", "game_type": 0},
                {"id": 3, "name": "All Time Leader", "game_type": 0},
                {"id": 4, "name": "Recent Release", "game_type": 0},
            ],
        )

    transport = httpx.MockTransport(handler)
    monkeypatch.setenv("IGDB_CLIENT_ID", "client-id")
    monkeypatch.setenv("IGDB_CLIENT_SECRET", "client-secret")
    service = IGDBService(
        http_client=httpx.AsyncClient(transport=transport),
        token_client=httpx.AsyncClient(transport=transport),
    )

    games = await service.popular_games(3)

    assert [game.name for game in games] == ["Current Visit", "Recent Release", "All Time Leader"]
