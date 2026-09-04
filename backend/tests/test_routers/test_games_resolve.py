from unittest.mock import AsyncMock, patch

from gamingclock.models.catalog import GameArtwork


def test_resolve_game_returns_resolved_item(client):
    with (
        patch("gamingclock.routers.games.igdb_service") as mock_igdb,
        patch("gamingclock.routers.games.hltb_service") as mock_hltb,
    ):
        mock_igdb.get_by_id = AsyncMock(
            return_value={
                "igdb_id": 10,
                "name": "Final Fantasy VII",
                "cover_url": "https://example.com/cover.png",
                "summary": "A classic RPG.",
                "genres": ["RPG"],
                "platforms": ["PlayStation"],
                "release_year": 1997,
                "rating": 91.2,
            }
        )
        mock_hltb.search = AsyncMock(
            return_value=[
                {
                    "name": "Final Fantasy VII",
                    "image_url": "https://example.com/hltb.png",
                    "main_story_hours": 36.5,
                    "main_extra_hours": 52.0,
                    "completionist_hours": 82.0,
                }
            ]
        )
        response = client.post("/games/resolve", json={"igdb_id": 10})

    assert response.status_code == 200
    data = response.json()
    assert data["igdb_id"] == 10
    assert data["cover_url"] == "https://example.com/cover.png"
    assert data["hltb_status"] == "resolved"
    assert data["main_story_hours"] == 36.5


def test_resolve_game_returns_unresolved_item_when_hltb_misses(client):
    with (
        patch("gamingclock.routers.games.igdb_service") as mock_igdb,
        patch("gamingclock.routers.games.hltb_service") as mock_hltb,
    ):
        mock_igdb.get_by_id = AsyncMock(
            return_value={
                "igdb_id": 11,
                "name": "Obscure Game",
                "cover_url": "https://example.com/cover.png",
                "summary": "A deep cut.",
                "genres": [],
                "platforms": [],
                "release_year": 2001,
                "rating": None,
            }
        )
        mock_hltb.search = AsyncMock(return_value=[])
        response = client.post("/games/resolve", json={"igdb_id": 11})

    assert response.status_code == 200
    data = response.json()
    assert data["igdb_id"] == 11
    assert data["hltb_status"] == "unresolved"
    assert data["main_story_hours"] is None


def test_resolve_batch_preserves_the_requested_order(client):
    with (
        patch("gamingclock.routers.games.igdb_service") as mock_igdb,
        patch("gamingclock.routers.games.hltb_service") as mock_hltb,
    ):
        mock_igdb.get_by_id = AsyncMock(
            side_effect=[
                {
                    "igdb_id": 2,
                    "name": "Second",
                    "cover_url": "",
                    "summary": "",
                    "genres": [],
                    "platforms": [],
                    "release_year": 2002,
                    "rating": None,
                },
                {
                    "igdb_id": 1,
                    "name": "First",
                    "cover_url": "",
                    "summary": "",
                    "genres": [],
                    "platforms": [],
                    "release_year": 2001,
                    "rating": None,
                },
            ]
        )
        mock_hltb.search = AsyncMock(return_value=[])
        response = client.post("/games/resolve-batch", json={"games": [{"igdb_id": 2}, {"igdb_id": 1}]})

    assert response.status_code == 200
    assert [game["igdb_id"] for game in response.json()["games"]] == [2, 1]


def test_resolve_game_includes_steamgriddb_artwork(client):
    with (
        patch("gamingclock.routers.games.igdb_service") as mock_igdb,
        patch("gamingclock.routers.games.hltb_service") as mock_hltb,
        patch("gamingclock.routers.games.steamgriddb_service") as mock_steamgriddb,
    ):
        mock_igdb.get_by_id = AsyncMock(
            return_value={
                "igdb_id": 10,
                "name": "Final Fantasy VII",
                "cover_url": "https://example.com/cover.png",
                "summary": "A classic RPG.",
                "genres": ["RPG"],
                "platforms": ["PlayStation"],
                "release_year": 1997,
                "rating": 91.2,
            }
        )
        mock_hltb.search = AsyncMock(return_value=[])
        mock_steamgriddb.get_artwork = AsyncMock(
            return_value=GameArtwork(
                cover_url="https://cdn.example/ff7-cover.jpg",
                logo_url="https://cdn.example/ff7-logo.png",
                hero_url="https://cdn.example/ff7-hero.jpg",
            )
        )

        response = client.post("/games/resolve", json={"igdb_id": 10})

    assert response.status_code == 200
    data = response.json()
    assert data["cover_url"] == "https://cdn.example/ff7-cover.jpg"
    assert data["logo_url"] == "https://cdn.example/ff7-logo.png"
    assert data["hero_url"] == "https://cdn.example/ff7-hero.jpg"
    mock_steamgriddb.get_artwork.assert_awaited_once_with("Final Fantasy VII")


def test_get_game_artwork_returns_only_search_card_artwork(client):
    with patch("gamingclock.routers.games.steamgriddb_service") as mock_steamgriddb:
        mock_steamgriddb.get_artwork = AsyncMock(
            return_value=GameArtwork(
                cover_url="https://cdn.example/ff7-cover.jpg",
                logo_url="https://cdn.example/ff7-logo.png",
                hero_url="https://cdn.example/ff7-hero.jpg",
            )
        )

        response = client.get(
            "/games/artwork",
            params={"igdb_id": 10, "name": "Final Fantasy VII"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "cover_url": "https://cdn.example/ff7-cover.jpg",
        "logo_url": "https://cdn.example/ff7-logo.png",
        "hero_url": "https://cdn.example/ff7-hero.jpg",
    }
    assert response.headers["cache-control"] == ("public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800")
    mock_steamgriddb.get_artwork.assert_awaited_once_with("Final Fantasy VII")
