def test_generate_schedule(client):
    response = client.post(
        "/schedule/generate",
        json={
            "game_list_name": "Test",
            "games": [
                {
                    "igdb_id": 10,
                    "name": "FF7",
                    "cover_url": "https://example.com/ff7.png",
                    "summary": "Classic RPG",
                    "genres": ["RPG"],
                    "platforms": ["PlayStation"],
                    "release_year": 1997,
                    "rating": 95.0,
                    "hltb_status": "resolved",
                    "hltb_match_name": "Final Fantasy VII",
                    "main_story_hours": 4.0,
                    "main_extra_hours": 6.0,
                    "completionist_hours": 10.0,
                },
            ],
            "availability": {"days": [{"day_of_week": 0, "hours": 2.0}]},
            "algorithm": "sequential",
            "start_date": "2026-03-30",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "sessions" in data
    assert "total_hours" in data
    assert "estimated_end_date" in data
    assert len(data["sessions"]) > 0


def test_generate_schedule_empty_games(client):
    response = client.post(
        "/schedule/generate",
        json={
            "game_list_name": "Empty",
            "games": [],
            "availability": {"days": [{"day_of_week": 0, "hours": 2.0}]},
            "algorithm": "sequential",
            "start_date": "2026-03-30",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["sessions"] == []
    assert data["total_hours"] == 0


def test_generate_schedule_blocks_unresolved_games(client):
    response = client.post(
        "/schedule/generate",
        json={
            "game_list_name": "Blocked",
            "games": [
                {
                    "igdb_id": 11,
                    "name": "Unknown Game",
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
                },
            ],
            "availability": {"days": [{"day_of_week": 0, "hours": 2.0}]},
            "algorithm": "sequential",
            "start_date": "2026-03-30",
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": {
            "message": "Cannot generate schedule with unresolved games",
            "unresolved_games": [{"igdb_id": 11, "name": "Unknown Game"}],
        }
    }
