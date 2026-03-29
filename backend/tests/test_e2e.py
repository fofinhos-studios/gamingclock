"""End-to-end test: search -> resolve -> schedule -> iCal download."""

from unittest.mock import AsyncMock, patch


def test_full_flow(client):
    catalog_game = {
        "igdb_id": 7,
        "name": "Final Fantasy VII",
        "cover_url": "https://images.igdb.com/ff7.png",
        "summary": "A legendary JRPG.",
        "genres": ["Role-playing (RPG)"],
        "platforms": ["PlayStation"],
        "release_year": 1997,
        "rating": 94.0,
    }
    resolved_game = {
        **catalog_game,
        "hltb_status": "resolved",
        "hltb_match_name": "Final Fantasy VII",
        "main_story_hours": 36.5,
        "main_extra_hours": 52.0,
        "completionist_hours": 83.0,
    }
    hltb_match = {
        "name": "Final Fantasy VII",
        "image_url": "https://example.com/ff7.png",
        "main_story_hours": 36.5,
        "main_extra_hours": 52.0,
        "completionist_hours": 83.0,
    }

    with patch("gamingclock.routers.games.igdb_service") as mock_igdb:
        mock_igdb.search = AsyncMock(return_value=[catalog_game])
        search_resp = client.get("/games/search", params={"query": "Final Fantasy"})
    assert search_resp.status_code == 200
    assert search_resp.json() == [catalog_game]

    with (
        patch("gamingclock.routers.games.igdb_service") as mock_igdb,
        patch("gamingclock.routers.games.hltb_service") as mock_hltb,
    ):
        mock_igdb.get_by_id = AsyncMock(return_value=catalog_game)
        mock_hltb.search = AsyncMock(return_value=[hltb_match])
        resolve_resp = client.post("/games/resolve", json={"igdb_id": 7})
    assert resolve_resp.status_code == 200
    assert resolve_resp.json() == resolved_game

    schedule_body = {
        "game_list_name": "FF Series",
        "games": [resolved_game],
        "availability": {"days": [{"day_of_week": 5, "hours": 4.0}, {"day_of_week": 6, "hours": 4.0}]},
        "algorithm": "sequential",
        "start_date": "2026-04-04",
    }

    schedule_resp = client.post("/schedule/generate", json=schedule_body)
    assert schedule_resp.status_code == 200
    data = schedule_resp.json()
    assert data["total_hours"] > 0
    assert len(data["sessions"]) > 0

    ical_resp = client.post("/schedule/ical", json=schedule_body)
    assert ical_resp.status_code == 200
    assert "BEGIN:VCALENDAR" in ical_resp.text


def test_schedule_blocks_unresolved_games(client):
    unresolved_game = {
        "igdb_id": 12,
        "name": "Mystery Game",
        "cover_url": "",
        "summary": "",
        "genres": [],
        "platforms": [],
        "release_year": None,
        "rating": None,
        "hltb_status": "unresolved",
        "hltb_match_name": None,
        "main_story_hours": None,
        "main_extra_hours": None,
        "completionist_hours": None,
    }

    response = client.post(
        "/schedule/generate",
        json={
            "game_list_name": "Blocked",
            "games": [unresolved_game],
            "availability": {"days": [{"day_of_week": 0, "hours": 2.0}]},
            "algorithm": "sequential",
            "start_date": "2026-03-30",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"]["unresolved_games"] == [
        {"igdb_id": 12, "name": "Mystery Game"},
    ]
