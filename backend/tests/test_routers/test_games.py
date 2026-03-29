from unittest.mock import AsyncMock, patch


def test_search_games(client):
    mock_games = [
        {
            "igdb_id": 1,
            "name": "Final Fantasy VII",
            "cover_url": "https://example.com/ff7.png",
            "summary": "A classic RPG.",
            "genres": ["RPG"],
            "platforms": ["PlayStation"],
            "release_year": 1997,
            "rating": 91.2,
        }
    ]
    with (
        patch("gamingclock.routers.games.igdb_service") as mock_igdb,
        patch("gamingclock.routers.games.hltb_service") as mock_hltb,
    ):
        mock_igdb.search = AsyncMock(return_value=mock_games)
        mock_hltb.search = AsyncMock(return_value=[])
        response = client.get("/games/search", params={"query": "Final Fantasy VII"})

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Final Fantasy VII"
    assert data[0]["igdb_id"] == 1


def test_search_games_empty(client):
    with patch("gamingclock.routers.games.igdb_service") as mock_service:
        mock_service.search = AsyncMock(return_value=[])
        response = client.get("/games/search", params={"query": "nonexistent"})

    assert response.status_code == 200
    assert response.json() == []


def test_search_games_missing_query(client):
    response = client.get("/games/search")
    assert response.status_code == 422


def test_search_games_enriches_and_sorts_hltb_matches_first(client):
    with (
        patch("gamingclock.routers.games.igdb_service") as mock_igdb,
        patch("gamingclock.routers.games.hltb_service") as mock_hltb,
    ):
        mock_igdb.search = AsyncMock(
            return_value=[
                {
                    "igdb_id": 1,
                    "name": "Game Deluxe Edition",
                    "cover_url": "https://example.com/deluxe.png",
                    "summary": "",
                    "genres": ["RPG"],
                    "platforms": ["PC"],
                    "release_year": 2024,
                    "rating": 70.0,
                },
                {
                    "igdb_id": 2,
                    "name": "Game",
                    "cover_url": "https://example.com/base.png",
                    "summary": "",
                    "genres": ["RPG"],
                    "platforms": ["PC"],
                    "release_year": 2024,
                    "rating": 88.0,
                },
            ]
        )
        mock_hltb.search = AsyncMock(
            side_effect=[
                [],
                [
                    {
                        "name": "Game",
                        "image_url": "https://example.com/hltb.png",
                        "main_story_hours": 24.0,
                        "main_extra_hours": 35.0,
                        "completionist_hours": 50.0,
                    }
                ],
            ]
        )

        response = client.get("/games/search", params={"query": "Game"})

    assert response.status_code == 200
    data = response.json()
    assert [item["name"] for item in data] == ["Game", "Game Deluxe Edition"]
    assert data[0]["hltb_status"] == "resolved"
    assert data[0]["main_story_hours"] == 24.0
    assert data[1]["hltb_status"] == "unresolved"
    assert data[1]["main_story_hours"] is None
