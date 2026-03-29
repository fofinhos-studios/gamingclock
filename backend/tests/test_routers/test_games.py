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
    with patch("gamingclock.routers.games.igdb_service") as mock_service:
        mock_service.search = AsyncMock(return_value=mock_games)
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
